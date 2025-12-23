/**
 * Lead Scoring Service
 *
 * Evaluates how well a lead matches search criteria using GPT-4o-mini.
 * Returns a score from 0-100 where:
 * - 100 = Perfect match for the query criteria
 * - 0 = Does not match at all
 */

import { createHash } from "node:crypto"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"
import { config } from "../config"
import logger from "../utils/logger"
import { RedisCache } from "./redis-cache.service"

// Initialize GPT-4o-mini for scoring
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0, // Deterministic scoring
})

// Initialize cache with 24-hour TTL
const cache = RedisCache.fromConfig({
  enabled: config.cache.leadDiscovery.enabled,
  keyPrefix: "lead_score:v1:",
  ttlMs: 24 * 60 * 60 * 1000, // 24 hours
  timeoutMs: 250,
})

/**
 * Generate cache key from query and lead data
 */
function generateCacheKey(query: string, leadData: string): string {
  const combined = `${query}|${leadData}`
  const hash = createHash("sha256").update(combined).digest("hex")
  return hash
}

/**
 * Lead scoring response schema
 */
const LeadScoreSchema = z.object({
  score: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Fit score from 0-100, where 100 is perfect match"),
  reasoning: z.string().describe("Brief explanation of why this score was assigned"),
})

export type LeadScore = z.infer<typeof LeadScoreSchema>

/**
 * Score a lead based on how well it matches the search query criteria
 *
 * @param query - The search query string (e.g., "Software companies in United States")
 * @param leadData - String representation of the lead data (company info, industry, location, etc.)
 * @returns Score from 0-100 and reasoning
 *
 * @example
 * ```typescript
 * const score = await scoreLeadFit(
 *   "Software companies in United States",
 *   "Company: Acme Corp | Industry: Software Development | Country: United States | Employees: 50"
 * )
 * // { score: 95, reasoning: "Exact match on industry and country, appropriate company size" }
 * ```
 */
export async function scoreLeadFit(query: string, leadData: string): Promise<LeadScore> {
  const startTime = Date.now()

  try {
    // 1. Check cache first
    const cacheKey = generateCacheKey(query, leadData)
    const cached = await cache.get<LeadScore>(cacheKey)

    if (cached) {
      const elapsed = Date.now() - startTime
      console.log(`[LeadScoring] ✅ Cache hit: ${cached.score}/100 (${elapsed}ms)`)
      return cached
    }

    console.log(`[LeadScoring] Scoring lead against query: "${query}"`)

    // 2. Construct evaluation prompt
    const prompt = `You are evaluating how well a potential business lead matches search criteria.

## Search Query:
"${query}"

## Lead Information:
${leadData}

## Task:
Evaluate how well this lead matches the search query and assign a fit score from 0-100:

**Scoring Guidelines:**
- **90-100**: Excellent match - Industry, location, and company characteristics align perfectly
- **70-89**: Good match - Most criteria match with minor deviations
- **50-69**: Moderate match - Some criteria match but significant differences exist
- **30-49**: Poor match - Few criteria match, major differences
- **0-29**: Very poor match - Does not match the search criteria

**Key Factors to Consider:**
1. **Industry Match (40%)**: Does the lead's industry/business type match the query?
2. **Location Match (30%)**: Does the lead's country/region match the query?
3. **Company Size (20%)**: Is the company size appropriate for the context?
4. **Other Attributes (10%)**: Any additional relevant matching factors

**Response Format (JSON only, no markdown):**
{
  "score": <number 0-100>,
  "reasoning": "<1-2 sentence explanation>"
}

IMPORTANT: Return ONLY the JSON object, no markdown code blocks, no additional text.`

    // Call LLM with structured output
    const response = await llm.invoke(prompt)
    const responseText = (response.content as string).trim()

    // Try to extract JSON from various formats
    let jsonText = responseText

    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "")

    // Try to find JSON object
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/)?.[0]

    if (!jsonMatch) {
      logger.warn(
        { query, leadData, response: responseText },
        "Failed to extract JSON from lead scoring response",
      )

      // Fallback: Try to extract score and reasoning from text
      const scoreMatch = responseText.match(/(?:score|fit score)[:\s]+(\d+)/i)
      const score = scoreMatch?.[1] ? parseInt(scoreMatch[1], 10) : 50

      // Try to extract reasoning
      const reasoningMatch = responseText.match(/(?:reasoning|explanation)[:\s]+(.+?)(?:\n|$)/i)
      const reasoning =
        reasoningMatch?.[1]?.trim() ||
        responseText
          .split("\n")
          .find((line) => line.length > 20)
          ?.trim() ||
        "Unable to parse detailed reasoning from response"

      return {
        score: Math.min(100, Math.max(0, score)),
        reasoning: reasoning.slice(0, 200), // Limit length
      }
    }

    const parsed = JSON.parse(jsonMatch)
    const validated = LeadScoreSchema.parse(parsed)

    const elapsed = Date.now() - startTime
    console.log(
      `[LeadScoring] Score: ${validated.score}/100 (${elapsed}ms) - ${validated.reasoning}`,
    )

    // 3. Cache the result
    await cache.set(cacheKey, validated)

    return validated
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[LeadScoring] Error scoring lead (${elapsed}ms):`, error)
    logger.error({ error, query, leadData }, "Lead scoring failed")

    // Return neutral score on error
    return {
      score: 50,
      reasoning: "Error occurred during scoring evaluation",
    }
  }
}

/**
 * Score multiple leads in batch
 * Processes leads sequentially to avoid rate limiting
 *
 * @param query - The search query string
 * @param leads - Array of lead data strings
 * @param onProgress - Optional callback for progress updates
 * @returns Array of scores matching the input lead order
 */
export async function scoreLeadsBatch(
  query: string,
  leads: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<LeadScore[]> {
  console.log(`[LeadScoring] Batch scoring ${leads.length} leads`)

  const scores: LeadScore[] = []

  for (let i = 0; i < leads.length; i++) {
    const leadData = leads[i]
    if (!leadData) continue

    const score = await scoreLeadFit(query, leadData)
    scores.push(score)

    if (onProgress) {
      onProgress(i + 1, leads.length)
    }
  }

  console.log(
    `[LeadScoring] Batch complete. Average score: ${Math.round(
      scores.reduce((sum, s) => sum + s.score, 0) / scores.length,
    )}/100`,
  )

  return scores
}

/**
 * Format lead object into a string for scoring
 * Helper function to convert structured lead data into scoring format
 *
 * @param lead - Lead object with company information
 * @returns Formatted string for scoring
 */
export function formatLeadForScoring(lead: {
  companyName?: string
  industry?: string
  country?: string
  employeeCount?: string
  description?: string
  websiteUrl?: string
  [key: string]: unknown
}): string {
  const parts: string[] = []

  if (lead.companyName) parts.push(`Company: ${lead.companyName}`)
  if (lead.industry) parts.push(`Industry: ${lead.industry}`)
  if (lead.country) parts.push(`Country: ${lead.country}`)
  if (lead.employeeCount) parts.push(`Employees: ${lead.employeeCount}`)
  if (lead.websiteUrl) parts.push(`Website: ${lead.websiteUrl}`)
  if (lead.description) parts.push(`Description: ${lead.description}`)

  return parts.join(" | ")
}

/**
 * Check if caching is enabled
 * @returns true if Redis caching is enabled
 */
export function isCacheEnabled(): boolean {
  return cache.isEnabled()
}

/**
 * Clear a specific cache entry
 * @param query - Search query
 * @param leadData - Lead data string
 */
export async function clearCacheEntry(query: string, leadData: string): Promise<void> {
  const cacheKey = generateCacheKey(query, leadData)
  await cache.del(cacheKey)
  console.log(`[LeadScoring] Cache entry cleared for key: ${cacheKey}`)
}
