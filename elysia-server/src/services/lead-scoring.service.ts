/**
 * Lead Scoring Service
 *
 * Evaluates how well a lead matches search criteria using gpt-5-mini.
 * Returns a score from 0-100 where:
 * - 100 = Perfect match for the query criteria
 * - 0 = Does not match at all
 *
 * Enhanced with description-based semantic relevance scoring.
 */

import { createHash } from "node:crypto"
import { ChatOpenAI } from "@langchain/openai"
import { z } from "zod"
import { config } from "../config"
import logger from "../utils/logger"
import {
  calculateBatchRelevanceScores,
  calculateDescriptionRelevance,
  type EnrichedLeadDescription,
  enrichLeadsWithDescriptions,
  enrichLeadWithDescription,
  type LeadForDescriptionEnrichment,
  type RelevanceScoreResult,
} from "./lead-description-enrichment.service"
import { RedisCache } from "./redis-cache.service"

// Re-export description enrichment types and functions
export {
  calculateBatchRelevanceScores,
  calculateDescriptionRelevance,
  enrichLeadWithDescription,
  enrichLeadsWithDescriptions,
  type EnrichedLeadDescription,
  type LeadForDescriptionEnrichment,
  type RelevanceScoreResult,
}

// Initialize gpt-5-mini for scoring
// Note: gpt-5-mini does not support temperature, uses reasoning_effort instead
const llm = new ChatOpenAI({
  model: "gpt-5-mini",
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

// ====================================
// ENHANCED SCORING WITH DESCRIPTION
// ====================================

export interface EnhancedLeadScoreResult {
  score: number // 0-100 combined score
  fitScore: number // Traditional fit score
  relevanceScore: number // Description-based relevance score
  reasoning: string
  matchedKeywords: string[]
  hasDescription: boolean
}

/**
 * Enhanced lead scoring that combines traditional fit scoring with
 * description-based semantic relevance scoring.
 *
 * - If lead has description: Uses both fit score and relevance score
 * - If lead has no description: Falls back to traditional fit scoring only
 *
 * @param query - Search query
 * @param lead - Lead object with company information
 * @returns Combined score with breakdown
 */
export async function scoreLeadFitEnhanced(
  query: string,
  lead: {
    companyName?: string
    industry?: string
    country?: string
    employeeCount?: string
    description?: string
    websiteUrl?: string
    [key: string]: unknown
  },
): Promise<EnhancedLeadScoreResult> {
  const startTime = Date.now()
  const hasDescription = !!lead.description && lead.description.length > 20

  console.log(
    `[LeadScoring] Enhanced scoring for ${lead.companyName} (has description: ${hasDescription})`,
  )

  // 1. Traditional fit scoring
  const leadData = formatLeadForScoring(lead)
  const fitResult = await scoreLeadFit(query, leadData)

  // 2. If no description, return fit score only
  if (!hasDescription) {
    return {
      score: fitResult.score,
      fitScore: fitResult.score,
      relevanceScore: 0,
      reasoning: fitResult.reasoning,
      matchedKeywords: [],
      hasDescription: false,
    }
  }

  // 3. Calculate description-based relevance score
  const relevanceResult = await calculateDescriptionRelevance(
    query,
    lead.description || "",
    lead.industry,
  )

  // 4. Combine scores (60% fit score + 40% relevance score)
  const combinedScore = Math.round(fitResult.score * 0.6 + relevanceResult.score * 0.4)

  const elapsed = Date.now() - startTime
  console.log(
    `[LeadScoring] Enhanced score: ${combinedScore}/100 ` +
      `(fit: ${fitResult.score}, relevance: ${relevanceResult.score}) (${elapsed}ms)`,
  )

  return {
    score: combinedScore,
    fitScore: fitResult.score,
    relevanceScore: relevanceResult.score,
    reasoning: `${fitResult.reasoning} | Relevance: ${relevanceResult.reasoning}`,
    matchedKeywords: relevanceResult.matchedKeywords,
    hasDescription: true,
  }
}

/**
 * Score leads with description enrichment
 *
 * 1. Enriches leads without description using website crawling + AI
 * 2. Scores all leads using enhanced scoring
 *
 * @param query - Search query
 * @param leads - Array of leads to score
 * @param options - Scoring options
 * @returns Array of enhanced scores
 */
export async function scoreLeadsWithEnrichment(
  query: string,
  leads: Array<{
    companyName?: string
    industry?: string
    country?: string
    employeeCount?: string
    description?: string
    websiteUrl?: string
    [key: string]: unknown
  }>,
  options?: {
    enrichMissingDescriptions?: boolean
    onProgress?: (phase: string, completed: number, total: number) => void
  },
): Promise<EnhancedLeadScoreResult[]> {
  const shouldEnrich = options?.enrichMissingDescriptions ?? false

  console.log(`[LeadScoring] Scoring ${leads.length} leads (enrich missing: ${shouldEnrich})`)

  // 1. Optionally enrich leads without descriptions
  let enrichedLeads = leads
  if (shouldEnrich) {
    const leadsNeedingEnrichment = leads.filter(
      (l) => l.websiteUrl && (!l.description || l.description.length < 20),
    )

    if (leadsNeedingEnrichment.length > 0) {
      console.log(
        `[LeadScoring] Enriching ${leadsNeedingEnrichment.length} leads with descriptions`,
      )

      const toEnrich: LeadForDescriptionEnrichment[] = leadsNeedingEnrichment.map((l) => ({
        companyName: l.companyName || "Unknown",
        websiteUrl: l.websiteUrl || "",
        industry: l.industry,
        country: l.country,
        existingDescription: l.description,
      }))

      const enriched = await enrichLeadsWithDescriptions(toEnrich, {
        concurrency: 3,
        onProgress: (completed, total) => {
          options?.onProgress?.("enrichment", completed, total)
        },
      })

      // Create a map for quick lookup
      const enrichedMap = new Map<string, string>()
      for (const e of enriched) {
        if (e.websiteUrl && e.description) {
          enrichedMap.set(e.websiteUrl.toLowerCase(), e.description)
        }
      }

      // Merge enriched descriptions back
      enrichedLeads = leads.map((l) => {
        if (l.websiteUrl) {
          const enrichedDesc = enrichedMap.get(l.websiteUrl.toLowerCase())
          if (enrichedDesc) {
            return { ...l, description: enrichedDesc }
          }
        }
        return l
      })
    }
  }

  // 2. Score all leads
  const scores: EnhancedLeadScoreResult[] = []

  for (let i = 0; i < enrichedLeads.length; i++) {
    const lead = enrichedLeads[i]
    if (!lead) continue

    const score = await scoreLeadFitEnhanced(query, lead)
    scores.push(score)

    options?.onProgress?.("scoring", i + 1, enrichedLeads.length)
  }

  // Log summary
  const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
  const withDesc = scores.filter((s) => s.hasDescription).length

  console.log(
    `[LeadScoring] Complete. Average: ${avgScore}/100, ` +
      `with description: ${withDesc}/${scores.length}`,
  )

  return scores
}

// ====================================
// AI RERANKING
// ====================================

export interface RankedLead<T> {
  lead: T
  score: number
  relevanceScore: number
  reasoning: string
  matchedKeywords: string[]
}

export interface RerankOptions {
  topN?: number // 상위 N개만 반환 (기본값: 전체)
  minScore?: number // 최소 점수 (기본값: 0)
  minCount?: number // 최소 반환 개수 - minScore 미만이어도 이 개수까지는 반환 (기본값: 10)
  concurrency?: number // 병렬 처리 동시성 (기본값: 10)
  onProgress?: (completed: number, total: number, phase: string) => void
}

/**
 * 🆕 AI 리랭킹: 사용자가 찾고자 하는 회사 특성과 리드를 비교하여 순위 매기기
 *
 * @param targetDescription - 찾고자 하는 회사 특성/설명 (예: "탈모 샴푸 제조업체")
 * @param leads - 리랭킹할 리드 배열
 * @param options - 리랭킹 옵션
 * @returns 점수 기준 정렬된 리드 배열
 *
 * @example
 * ```typescript
 * const ranked = await rerankLeadsByRelevance(
 *   "탈모 샴푸를 제조하거나 유통하는 B2B 업체",
 *   leads,
 *   { topN: 30, minScore: 50 }
 * )
 * ```
 */
export async function rerankLeadsByRelevance<
  T extends {
    companyName?: string
    description?: string
    industry?: string
    country?: string
    websiteUrl?: string
  },
>(targetDescription: string, leads: T[], options?: RerankOptions): Promise<RankedLead<T>[]> {
  const { topN, minScore = 0, minCount = 10, concurrency = 10, onProgress } = options || {}

  console.log(
    `[Reranking] Starting AI rerank for ${leads.length} leads ` +
      `(target: "${targetDescription.slice(0, 50)}...")`,
  )

  const startTime = Date.now()

  // 1. Description이 있는 리드와 없는 리드 분리
  const leadsWithDesc = leads.filter((l) => l.description && l.description.length > 20)
  const leadsWithoutDesc = leads.filter((l) => !l.description || l.description.length <= 20)

  console.log(
    `[Reranking] ${leadsWithDesc.length} leads with description, ` +
      `${leadsWithoutDesc.length} without`,
  )

  // 2. Description 있는 리드에 대해 관련성 점수 계산 (병렬 처리)
  const pLimit = (await import("p-limit")).default
  const limit = pLimit(concurrency)
  let completed = 0

  const scoringPromises = leadsWithDesc.map((lead) =>
    limit(async (): Promise<RankedLead<T>> => {
      const result = await calculateDescriptionRelevance(
        targetDescription,
        lead.description || "",
        lead.industry,
      )

      completed++
      onProgress?.(completed, leadsWithDesc.length, "scoring")

      return {
        lead,
        score: result.score,
        relevanceScore: result.score,
        reasoning: result.reasoning,
        matchedKeywords: result.matchedKeywords,
      }
    }),
  )

  const rankedWithDesc = await Promise.all(scoringPromises)

  // 3. Description 없는 리드는 낮은 점수 부여 (industry 매칭만 확인)
  const rankedWithoutDesc: RankedLead<T>[] = leadsWithoutDesc.map((lead) => {
    // 간단한 키워드 매칭으로 기본 점수 부여
    const targetLower = targetDescription.toLowerCase()
    const industryLower = (lead.industry || "").toLowerCase()
    const companyLower = (lead.companyName || "").toLowerCase()

    let baseScore = 20 // 기본 점수

    // 산업 키워드 매칭
    const keywords = targetLower.split(/\s+/).filter((k) => k.length > 2)
    const matchedKeywords: string[] = []

    for (const keyword of keywords) {
      if (industryLower.includes(keyword) || companyLower.includes(keyword)) {
        baseScore += 10
        matchedKeywords.push(keyword)
      }
    }

    return {
      lead,
      score: Math.min(60, baseScore), // 최대 60점 (description 없으면 상위권 불가)
      relevanceScore: baseScore,
      reasoning: "No description available - scored by keyword matching only",
      matchedKeywords,
    }
  })

  // 4. 모든 결과 합치고 점수순 정렬
  const allRanked = [...rankedWithDesc, ...rankedWithoutDesc].sort((a, b) => b.score - a.score)

  // 5. 필터링 및 상위 N개 선택
  // minScore 이상인 것들 우선
  const aboveMinScore = allRanked.filter((r) => r.score >= minScore)

  // 🆕 minCount 보장: minScore 이상이 부족하면 점수순으로 추가
  let filtered: RankedLead<T>[] = aboveMinScore
  if (filtered.length < minCount) {
    const belowMinScore = allRanked.filter((r) => r.score < minScore)
    const additionalNeeded = minCount - filtered.length
    const additional = belowMinScore.slice(0, additionalNeeded)
    filtered = [...filtered, ...additional]
    console.log(
      `[Reranking] minCount guarantee: Added ${additional.length} leads below minScore (${minScore}) ` +
        `to reach minimum ${minCount}`,
    )
  }

  if (topN && topN > 0) {
    filtered = filtered.slice(0, topN)
  }

  const elapsed = Date.now() - startTime
  const avgScore =
    filtered.length > 0
      ? Math.round(filtered.reduce((s, r) => s + r.score, 0) / filtered.length)
      : 0

  console.log(
    `[Reranking] Complete in ${elapsed}ms. ` +
      `Returned ${filtered.length}/${leads.length} leads, avg score: ${avgScore}/100`,
  )

  // 로그: 상위 5개 결과
  console.log(`[Reranking] Top 5 results:`)
  for (let i = 0; i < Math.min(5, filtered.length); i++) {
    const r = filtered[i]
    if (r) {
      console.log(
        `  ${i + 1}. ${r.lead.companyName} - Score: ${r.score}/100 - ${r.reasoning.slice(0, 50)}...`,
      )
    }
  }

  return filtered
}
