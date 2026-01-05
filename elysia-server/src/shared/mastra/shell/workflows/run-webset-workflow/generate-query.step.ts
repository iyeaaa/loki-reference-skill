import { createOpenAI } from "@ai-sdk/openai"
import { createStep } from "@mastra/core/workflows"
import { generateText } from "ai"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { config } from "../../../../../config"
import { db } from "../../../../../db"
import { websets } from "../../../../../db/schema/websets"

/**
 * Step 0: Generate a unique search query variation
 * Generates one new query per iteration using AI
 */
export const generateQueryStep = createStep({
  id: "generate-query",
  description: "Generate a unique search query variation using AI",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    searchQuery: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { websetId, iterationCount } = inputData
    const currentIteration = iterationCount + 1

    console.log(`\n🎯 Step 0: Generating search query for iteration ${currentIteration}...`)

    try {
      // Get webset configuration including used queries
      const [webset] = await db
        .select({
          query: websets.query,
          usedQueries: websets.usedQueries,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        throw new Error("Webset not found")
      }

      const usedQueries = webset.usedQueries || []
      const openai = createOpenAI({ apiKey: config.openai.apiKey })

      let searchQuery = webset.query

      // Generate a new query variation if we have used queries (after first iteration)
      if (usedQueries.length > 0 || currentIteration > 1) {
        try {
          // Note: gpt-5-mini does not support temperature
          const { text } = await generateText({
            model: openai("gpt-5-mini"),
            providerOptions: {
              openai: {
                reasoningEffort: "low",
              },
            },
            prompt: `
You are a search query generator. Your task is to create variations of a base search query to find companies.

Base Query: "${webset.query}"

Previously Used Queries:
${usedQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Guidelines:
- Create a NEW search query variation that is DIFFERENT from all previously used queries
- The query should still be relevant to the base query intent
- Use different keywords, synonyms, or phrasing
- Keep the query concise (2-5 words typically)
- Focus on finding companies that match the original intent
- Return ONLY the search query text, nothing else

Examples of good variations:
- "pizza NYC" → "New York pizzerias", "Manhattan pizza restaurants", "NYC pizza shops"
- "tech startups" → "technology companies", "startup ventures", "emerging tech firms"
- "coffee shops Seattle" → "Seattle cafes", "coffee houses Seattle area", "specialty coffee Seattle"

Generate a new unique search query:`,
          })

          const generatedQuery = text.trim()

          // Check if generated query is exact duplicate (case-insensitive)
          const isDuplicate = usedQueries.some(
            (used) => used.toLowerCase() === generatedQuery.toLowerCase(),
          )

          // If duplicate or empty, fall back to base query with iteration suffix
          searchQuery =
            isDuplicate || !generatedQuery
              ? `${webset.query} companies ${currentIteration}`
              : generatedQuery

          console.log(`  ✅ Generated query: "${searchQuery}"`)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error"
          console.error(`  ❌ Query generation failed: ${errorMessage}`)

          // Fall back to base query with iteration suffix
          searchQuery = `${webset.query} ${currentIteration}`
          console.log(`  ⚠️  Using fallback query: "${searchQuery}"`)
        }
      } else {
        // First iteration - use base query
        console.log(`  ℹ️  First iteration - using base query: "${searchQuery}"`)
      }

      // Update used queries in database (keep only last 50 to prevent unbounded growth)
      const MAX_QUERY_HISTORY = 50
      const updatedUsedQueries = [...usedQueries, searchQuery].slice(-MAX_QUERY_HISTORY)
      await db
        .update(websets)
        .set({
          usedQueries: updatedUsedQueries,
          updatedAt: new Date(),
        })
        .where(eq(websets.id, websetId))

      console.log(`  💾 Saved query to database (${updatedUsedQueries.length} total)\n`)

      return {
        websetId,
        iterationCount: currentIteration,
        searchQuery,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`  ❌ Query generation step failed: ${errorMessage}\n`)
      throw error
    }
  },
})
