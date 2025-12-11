import { createStep, createWorkflow } from "@mastra/core/workflows"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"
import { jinaReader } from "./api-clients"
import { CompanyInfoSchema, GoogleSearchResultSchema } from "./types"

/**
 * Extract from Directory Workflow
 * Detects and extracts companies from directory/list pages
 * Shell layer - orchestrates detection and bulk extraction
 */

const detectDirectoriesStep = createStep({
  id: "detect-directories",
  description: "Detect directory/list pages from search results using AI",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    directories: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    ),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { searchResults, openaiApiKey } = inputData

    try {
      const openaiClient = new OpenAI({ apiKey: openaiApiKey })

      // Filter results that might be directories
      const candidates = searchResults.slice(0, 10) // Check top 10 results

      const resultsContext = candidates
        .map(
          (result, idx) => `[${idx + 1}]
Title: ${result.title}
URL: ${result.link}
Snippet: ${result.snippet || "N/A"}
Display Link: ${result.displayedLink}`,
        )
        .join("\n---\n")

      const prompt = `Identify which of these search results are likely DIRECTORY or LIST pages containing multiple companies.

RESULTS:
${resultsContext}

DIRECTORY INDICATORS:
- Title contains: "directory", "list", "top companies", "best businesses", "directory of"
- URL patterns: /directory/, /list/, /companies/, /businesses/
- Snippet mentions multiple companies or "find businesses"
- Aggregator sites: Yelp, Yellow Pages, Chamber of Commerce, industry directories

CLASSIFY each result:
- HIGH confidence: Clear directory/list (e.g., "Top 50 Manufacturing Companies")
- MEDIUM confidence: Likely has multiple companies (e.g., "Industry Association Members")
- LOW or skip: Individual company pages or general articles

Return only results with MEDIUM or HIGH confidence.`

      const directorySchema = z.object({
        directories: z.array(
          z.object({
            resultIndex: z.number(),
            confidence: z.enum(["high", "medium", "low"]),
            reason: z.string(),
          }),
        ),
      })

      const response = await pRetry(
        () =>
          openaiClient.responses.parse({
            model: "gpt-4o-mini",
            input: [
              {
                role: "user",
                content: prompt,
              },
            ],
            text: {
              format: zodTextFormat(directorySchema, "DirectoryDetection"),
            },
            temperature: 0.2,
          }),
        { retries: 3 },
      )

      const object = response.output_parsed
      if (!object) {
        throw new Error("Failed to parse directory detection response")
      }

      // Map back to URLs
      const directories = object.directories
        .filter((dir) => dir.confidence === "high" || dir.confidence === "medium")
        .map((dir) => {
          const result = candidates[dir.resultIndex - 1]
          return {
            url: result?.link || "",
            title: result?.title || "",
            confidence: dir.confidence,
          }
        })
        .filter((dir) => dir.url) // Filter out invalid entries

      return {
        directories,
        success: true,
        message: `Detected ${directories.length} directories`,
      }
    } catch (error) {
      console.error("Failed to detect directories:", error)
      return {
        directories: [],
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

const extractFromDirectoryStep = createStep({
  id: "extract-from-directory-page",
  description: "Extract all companies from a directory page",
  inputSchema: z.object({
    url: z.string(),
    title: z.string(),
    openaiApiKey: z.string(),
    jinaApiKey: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { url, title, openaiApiKey, jinaApiKey } = inputData

    try {
      const openaiClient = new OpenAI({ apiKey: openaiApiKey })

      // Read the directory page
      let pageContent: string
      try {
        pageContent = await jinaReader({ url, jinaApiKey })
      } catch (error) {
        console.error(`Failed to read directory ${url}:`, error)
        return {
          companies: [],
          success: false,
          message: `Failed to read page: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }

      // Limit content size to avoid token limits
      const truncatedContent =
        pageContent.length > 15_000
          ? `${pageContent.slice(0, 15_000)}\n[...content truncated...]`
          : pageContent

      const prompt = `Extract ALL company contacts from this directory/list page.

PAGE TITLE: ${title}
SOURCE URL: ${url}

CONTENT:
${truncatedContent}

EXTRACTION RULES:
- Extract EVERY company listed on this page
- Speed mode: Focus on capturing Name, Website, Location
- Company name is required
- Website URL if available (look for links)
- Location if available (city, state, country)
- Skip navigation links, ads, and non-company entries
- If it's a table or list, extract all rows

PRIORITIZE VOLUME: It's better to capture all companies quickly than to be perfect.
Aim to extract 10-50+ companies if they're present.`

      const companiesSchema = z.object({
        companies: z.array(
          z.object({
            name: z.string(),
            website: z.string().optional(),
            location: z.string().optional(),
          }),
        ),
        totalFound: z.number().describe("Total number of companies extracted"),
      })

      const response = await pRetry(
        () =>
          openaiClient.responses.parse({
            model: "gpt-4o",
            input: [
              {
                role: "user",
                content: prompt,
              },
            ],
            text: {
              format: zodTextFormat(companiesSchema, "DirectoryCompanies"),
            },
            temperature: 0.3,
          }),
        { retries: 3 },
      )

      const object = response.output_parsed
      if (!object) {
        throw new Error("Failed to parse directory companies response")
      }

      // Transform to CompanyInfo format
      const companies = object.companies.map((company) => ({
        name: company.name,
        website: company.website,
        location: company.location,
        source: url,
        sourceType: "directory" as const,
        extractedAt: new Date().toISOString(),
      }))

      return {
        companies,
        success: true,
        message: `Extracted ${companies.length} companies from directory`,
      }
    } catch (error) {
      console.error("Failed to extract from directory:", error)
      return {
        companies: [],
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

export const detectDirectoriesWorkflow = createWorkflow({
  id: "detect-directories",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    directories: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        confidence: z.enum(["high", "medium", "low"]),
      }),
    ),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(detectDirectoriesStep)
  .commit()

export const extractFromDirectoryWorkflow = createWorkflow({
  id: "extract-from-directory",
  inputSchema: z.object({
    url: z.string(),
    title: z.string(),
    openaiApiKey: z.string(),
    jinaApiKey: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(extractFromDirectoryStep)
  .commit()
