import { createOpenAI } from "@ai-sdk/openai"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { generateObject } from "ai"
import { z } from "zod"
import { CompanyInfoSchema, GoogleSearchResultSchema } from "./types"

/**
 * Extract from Snippets Workflow
 * Extracts company information from search result snippets (no page opening)
 * Shell layer - orchestrates AI extraction
 */

const extractSnippetStep = createStep({
  id: "extract-from-snippets",
  description: "Extract company information from search result snippets using AI",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    sourceQuery: z.string(),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { searchResults, sourceQuery, openaiApiKey } = inputData

    try {
      const openai = createOpenAI({ apiKey: openaiApiKey })

      // Filter results that likely contain useful information
      const relevantResults = searchResults.filter(
        (result) => result.snippet && (result.snippet.length > 50 || result.title.length > 20),
      )

      if (relevantResults.length === 0) {
        return {
          companies: [],
          success: true,
          message: "No relevant results found in snippets",
        }
      }

      // Build extraction context
      const snippetsContext = relevantResults
        .map(
          (result, idx) => `[${idx + 1}]
Title: ${result.title}
URL: ${result.link}
Snippet: ${result.snippet || "N/A"}
Display Link: ${result.displayedLink}
`,
        )
        .join("\n---\n")

      const prompt = `Extract company contact information from these search result snippets.

Search Query: "${sourceQuery}"

SNIPPETS:
${snippetsContext}

EXTRACTION RULES:
- Extract ONLY if snippet contains clear company name AND (website OR location)
- Company name must be explicit (not just industry terms)
- Website should be a proper URL (if available in snippet/link)
- Location can be city, state, country (if mentioned)
- Skip if snippet is just a generic description
- Skip aggregator sites unless they list specific companies
- Prioritize actual company pages over directories (but include both)

OUTPUT FORMAT:
For each valid contact found, extract:
- name: Company name
- website: Full URL (use result.link if it's the company website, or extract from snippet)
- location: Geographic location if mentioned
- resultIndex: The [number] of the result this came from

Extract as many valid contacts as possible from the snippets.`

      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          contacts: z.array(
            z.object({
              name: z.string(),
              website: z.string().optional(),
              location: z.string().optional(),
              resultIndex: z.number(),
            }),
          ),
        }),
        prompt,
        temperature: 0.3, // Lower temperature for accuracy
      })

      // Transform to CompanyInfo format
      const companies = object.contacts.map((contact) => {
        const sourceResult = relevantResults[contact.resultIndex - 1]
        return {
          name: contact.name,
          website: contact.website,
          location: contact.location,
          source: sourceResult?.link || sourceQuery,
          sourceType: "snippet" as const,
          extractedAt: new Date().toISOString(),
        }
      })

      return {
        companies,
        success: true,
        message: `Extracted ${companies.length} companies from snippets`,
      }
    } catch (error) {
      console.error("Failed to extract from snippets:", error)
      return {
        companies: [],
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

export const extractSnippetWorkflow = createWorkflow({
  id: "extract-from-snippets",
  inputSchema: z.object({
    searchResults: z.array(GoogleSearchResultSchema),
    sourceQuery: z.string(),
    openaiApiKey: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(extractSnippetStep)
  .commit()
