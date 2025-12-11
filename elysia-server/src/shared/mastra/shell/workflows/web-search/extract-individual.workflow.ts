import { createStep, createWorkflow } from "@mastra/core/workflows"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"
import { jinaReader } from "./api-clients"
import { CompanyInfoSchema, GoogleSearchResultSchema } from "./types"

/**
 * Extract from Individual Page Workflow
 * Evaluates and extracts company information from individual company pages
 * Shell layer - orchestrates page evaluation and extraction
 */

const evaluatePagesStep = createStep({
  id: "evaluate-pages",
  description: "Evaluate which pages are worth opening for extraction",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    alreadyExtractedUrls: z.array(z.string()).default([]),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    pagesToOpen: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        priority: z.number(),
      }),
    ),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { searchResults, alreadyExtractedUrls, openaiApiKey } = inputData

    try {
      const openaiClient = new OpenAI({ apiKey: openaiApiKey })

      // Filter out already processed URLs
      const alreadyExtracted = new Set(alreadyExtractedUrls)
      const newResults = searchResults.filter((result) => !alreadyExtracted.has(result.link))

      if (newResults.length === 0) {
        return {
          pagesToOpen: [],
          success: true,
          message: "No new results to evaluate",
        }
      }

      const resultsContext = newResults
        .slice(0, 15) // Check top 15 new results
        .map(
          (result, idx) => `[${idx + 1}]
Title: ${result.title}
URL: ${result.link}
Snippet: ${result.snippet || "N/A"}
Display Link: ${result.displayedLink}`,
        )
        .join("\n---\n")

      const prompt = `Evaluate which of these search results are worth opening for contact extraction.

RESULTS:
${resultsContext}

WORTH OPENING IF:
- Individual company website (not aggregator/directory)
- Likely has company information (About, Contact, Location)
- Business/commercial entity (not blog post or news article)
- Domain looks legitimate (not spam/scrapers)

SKIP IF:
- Already a directory/list (handle separately)
- News article or blog post about a company
- Social media profile (LinkedIn, Facebook) - low value
- Generic pages (Wikipedia, forums)
- Spam or low-quality sites

ASSIGN PRIORITY:
- 3 = High priority (clear company page, likely has info)
- 2 = Medium priority (might have info, worth checking)
- 1 = Low priority (borderline, only if time permits)
- 0 = Skip (not worth opening)

Return results with priority >= 2, sorted by priority (highest first).`

      const evalSchema = z.object({
        worthOpening: z.array(
          z.object({
            resultIndex: z.number(),
            priority: z.number().min(0).max(3),
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
              format: zodTextFormat(evalSchema, "PageEvaluation"),
            },
            temperature: 0.3,
          }),
        { retries: 3 },
      )

      const object = response.output_parsed
      if (!object) {
        throw new Error("Failed to parse page evaluation response")
      }

      // Map back and sort by priority
      const pagesToOpen = object.worthOpening
        .filter((item) => item.priority >= 2)
        .map((item) => {
          const result = newResults[item.resultIndex - 1]
          return {
            url: result?.link || "",
            title: result?.title || "",
            priority: item.priority,
          }
        })
        .filter((page) => page.url) // Filter out invalid entries
        .sort((a, b) => b.priority - a.priority)

      return {
        pagesToOpen,
        success: true,
        message: `Evaluated ${newResults.slice(0, 15).length} results, ${pagesToOpen.length} worth opening`,
      }
    } catch (error) {
      console.error("Failed to evaluate pages:", error)
      return {
        pagesToOpen: [],
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

const extractFromIndividualPageStep = createStep({
  id: "extract-from-individual-page",
  description: "Extract company information from an individual page",
  inputSchema: z.object({
    url: z.string(),
    title: z.string(),
    openaiApiKey: z.string(),
    jinaApiKey: z.string(),
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema.nullable(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { url, title, openaiApiKey, jinaApiKey } = inputData

    try {
      const openaiClient = new OpenAI({ apiKey: openaiApiKey })

      // Read the page
      let pageContent: string
      try {
        pageContent = await jinaReader({ url, jinaApiKey })
      } catch (error) {
        console.error(`Failed to read page ${url}:`, error)
        return {
          company: null,
          success: false,
          message: `Failed to read page: ${error instanceof Error ? error.message : "Unknown error"}`,
        }
      }

      // Truncate to save tokens - we just need basic info
      const truncatedContent =
        pageContent.length > 8000 ? `${pageContent.slice(0, 8000)}\n[...truncated...]` : pageContent

      const prompt = `Extract company contact information from this webpage.

PAGE TITLE: ${title}
URL: ${url}

CONTENT:
${truncatedContent}

EXTRACT:
- Company name (official business name)
- Website URL (use provided URL if it's the main site)
- Location (headquarters or main office location: city, state, country)

RULES:
- IMPORTANT: Extract only ONE company (not multiple companies)
- This should be an individual company page, not a directory/list
- If this is a list of multiple companies, set found=false
- Quick extraction: grab obvious information only
- Skip if this isn't actually a company page
- Return found=false if no single clear company information found`

      const companySchema = z.object({
        found: z.boolean(),
        company: z
          .object({
            name: z.string(),
            website: z.string().optional(),
            location: z.string().optional(),
          })
          .nullable()
          .optional(),
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
              format: zodTextFormat(companySchema, "CompanyExtraction"),
            },
            temperature: 0.2,
          }),
        { retries: 3 },
      )

      const object = response.output_parsed
      if (!object) {
        throw new Error("Failed to parse company extraction response")
      }

      if (!(object.found && object.company)) {
        return {
          company: null,
          success: true,
          message: "No company found on page",
        }
      }

      return {
        company: {
          name: object.company.name,
          website: object.company.website || url,
          location: object.company.location,
          source: url,
          sourceType: "individual" as const,
          extractedAt: new Date().toISOString(),
        },
        success: true,
        message: "Extracted company information",
      }
    } catch (error) {
      console.error("Failed to extract from individual page:", error)
      return {
        company: null,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

export const evaluatePagesWorkflow = createWorkflow({
  id: "evaluate-pages",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    alreadyExtractedUrls: z.array(z.string()).default([]),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    pagesToOpen: z.array(
      z.object({
        url: z.string(),
        title: z.string(),
        priority: z.number(),
      }),
    ),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(evaluatePagesStep)
  .commit()

export const extractFromIndividualPageWorkflow = createWorkflow({
  id: "extract-from-individual-page",
  inputSchema: z.object({
    url: z.string(),
    title: z.string(),
    openaiApiKey: z.string(),
    jinaApiKey: z.string(),
  }),
  outputSchema: z.object({
    company: CompanyInfoSchema.nullable(),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(extractFromIndividualPageStep)
  .commit()
