import { createOpenAI } from "@ai-sdk/openai"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { generateObject } from "ai"
import { z } from "zod"
import { SearchQuerySchema } from "./types"

/**
 * Generate Search Queries Workflow
 * Generates diverse search queries for comprehensive web search
 * Shell layer - orchestrates AI query generation
 */

const generateQueriesStep = createStep({
  id: "generate-search-queries",
  description: "Generate diverse search queries using AI",
  inputSchema: z.object({
    originalQuery: z.string().describe("Original search query from user"),
    searchQueryCount: z.number().default(5).describe("Number of queries to generate"),
    defaultLocation: z.string().optional().describe("Default location for searches"),
    defaultLanguage: z.string().optional().describe("Default language for searches"),
    openaiApiKey: z.string().describe("OpenAI API key"),
  }),
  outputSchema: z.object({
    queries: z.array(SearchQuerySchema),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { originalQuery, searchQueryCount, defaultLocation, defaultLanguage, openaiApiKey } =
      inputData

    try {
      const openai = createOpenAI({ apiKey: openaiApiKey })

      const defaultLocationText = defaultLocation
        ? `\n\nDefault Location: "${defaultLocation}"`
        : ""
      const defaultLanguageText = defaultLanguage ? `\nDefault Language: "${defaultLanguage}"` : ""

      const prompt = `Generate ${searchQueryCount} unique SERP (Search Engine Results Page) queries to find relevant results for this original query:

Original Query: "${originalQuery}"${defaultLocationText}${defaultLanguageText}

Requirements:
- Generate exactly ${searchQueryCount} NEW unique SERP queries with location and language parameters
- Each query should approach the topic from a different angle
- Queries must be optimized for search engines like Google (concise, keyword-focused)
- Use effective search operators and keywords that maximize SERP results
- Vary the search terms, synonyms, and approaches
- Focus on queries that would return high-quality, relevant search results

For each query, specify:
1. query: The search string optimized for Google
2. location (optional): Geographic location to focus the search (e.g., "San Francisco, California, United States", "New York, NY, United States"). Use the default location if not specified, or omit if not relevant.
3. language (optional): Language code (e.g., "en" for English, "es" for Spanish). IMPORTANT: Only specify language if explicitly needed. In most cases, OMIT this field entirely to let Google automatically determine the language.

IMPORTANT: Vary locations if it makes sense for the query. Don't always use the default location - consider broader or narrower geographic scopes when appropriate.`

      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: z.object({
          queries: z
            .array(SearchQuerySchema)
            .describe(
              `Array of exactly ${searchQueryCount} unique SERP queries with location and language parameters`,
            ),
        }),
        prompt,
        temperature: 0.8, // Higher temperature for more variety
      })

      return {
        queries: object.queries,
        success: true,
        message: `Generated ${object.queries.length} search queries`,
      }
    } catch (error) {
      console.error("Failed to generate queries:", error)
      return {
        queries: [],
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    }
  },
})

export const generateQueriesWorkflow = createWorkflow({
  id: "generate-search-queries",
  inputSchema: z.object({
    originalQuery: z.string().describe("Original search query from user"),
    searchQueryCount: z.number().default(5).describe("Number of queries to generate"),
    defaultLocation: z.string().optional().describe("Default location for searches"),
    defaultLanguage: z.string().optional().describe("Default language for searches"),
    openaiApiKey: z.string().describe("OpenAI API key"),
  }),
  outputSchema: z.object({
    queries: z.array(SearchQuerySchema),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(generateQueriesStep)
  .commit()
