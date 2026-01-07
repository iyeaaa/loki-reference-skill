/**
 * Lead Search & Enrichment Service
 *
 * Unified service for discovering and enriching leads with filtering.
 * Pure business logic - no database dependencies.
 * Can be tested independently without DB involvement.
 */

import { z } from "zod"
import { VALID_HUNTERIO_INDUSTRIES } from "../constants/hunterio-industries"
import {
  createB2BCustomerIndustryAgent,
  createB2BHunterIndustryAgent,
  generateB2BCustomerIndustryPrompt,
  generateB2BHunterIndustryPrompt,
} from "../shared/mastra"
import { structuredExtractionAgent } from "../shared/mastra/shell/agents/structured-extraction-agent"
import { generateTraceId, leadSearchLogger } from "../utils/logger"
import { isBeautyRelatedIndustry, searchBeautyDatabase } from "./beauty-db-search.service"
import { searchBigQuery } from "./bigquery-search.service"
import { searchDomainWithSmartSelection } from "./hunterio-domain-search.service"
import { searchLeadsWithHunter } from "./hunterio-lead-search.service"
import { findMatchingIndustries, generateHunterioQuery } from "./hunterio-query-generator.service"
import {
  generateIdealCustomerProfile,
  type IdealCustomerProfile,
} from "./ideal-customer-profile.service"
import { enrichLeadsWithDescriptions } from "./lead-description-enrichment.service"
import {
  APOLLO_LEADS_DATA_DICTIONARY,
  B2B_LEADS_DATA_DICTIONARY,
  FRESH_LEADS_DATA_DICTIONARY,
  REVATION_LEADS_DATA_DICTIONARY,
} from "./lead-discovery/nodes/bigquery-executor"
import { formatLeadForScoring, rerankLeadsByRelevance, scoreLeadFit } from "./lead-scoring.service"
import { enrichLeadsForOnboarding } from "./onboarding.service"
import {
  convertPerplexityToBigQueryFormat,
  optimizeQueryForPerplexity,
  PERPLEXITY_CONFIG,
  searchCustomersWithPerplexityEnhanced,
  searchLeadsWithPerplexity,
  searchLeadsWithPerplexityEnhanced,
} from "./perplexity-search.service"

// ====================================
// CONSTANTS
// ====================================

export const SEARCH_CONFIG = {
  TARGET_LEADS: 30, // 30 leads for optimized search
  ENRICHMENT_BATCH_SIZE: 30,
  BIGQUERY_BATCH_SIZE: 30, // Reduced for 30 leads target
  MAX_EMPLOYEE_COUNT: 5000, // Skip companies with >5000 employees (target SMBs)
  HUNTERIO_MAX_PER_PAGE: 30, // Reduced for 30 leads target
  HUNTERIO_MAX_EMAIL_COUNT: 100, // Skip companies with >100 indexed emails (proxy for large companies)
  // Hybrid search strategy config
  BIGQUERY_RICH_COUNTRIES: PERPLEXITY_CONFIG.BIGQUERY_RICH_COUNTRIES,
  PERPLEXITY_BASE_COUNT: 15, // Reduced for 30 leads target (기본 Perplexity 검색 수)
  PERPLEXITY_ENHANCED_COUNT: 30, // Reduced for 30 leads target (비미국 국가용)
} as const

// ====================================
// TYPES
// ====================================

export interface EnrichedLead {
  companyName: string
  websiteUrl: string
  primaryEmail: string | null
  businessType?: string
  country?: string
  employeeCount?: string
  description?: string
  leadSource:
    | "b2b"
    | "apollo"
    | "fresh"
    | "revation"
    | "perplexity"
    | "hunterio-discover"
    | "beauty_db"
    | "beauty_db"
  /** AI 리랭킹 점수 (0-100) */
  relevanceScore?: number
  /** AI 리랭킹 이유 */
  relevanceReasoning?: string
}

export interface SearchResult {
  leads: EnrichedLead[]
  stats: {
    totalFound: number
    fromBigQuery: number
    fromHunterIO: number
    skippedDuplicates: number
    skippedLargeCompanies: number
    skippedLowScoring: number
    withEmails: number
  }
}

export interface SearchProgress {
  phase:
    | "bigquery"
    | "hunterio"
    | "enrichment"
    | "description_enrichment"
    | "scoring"
    | "reranking"
    | "complete"
  message: string
  messageKr?: string
  currentCount: number
  targetCount: number
}

export type ProgressCallback = (progress: SearchProgress) => void | Promise<void>

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Parse natural language query to extract industry and country
 * Examples:
 *   "Software companies in United States" -> { industry: "Software", country: "United States" }
 *   "Technology startups in Japan" -> { industry: "Technology", country: "Japan" }
 */
async function parseNaturalLanguageQuery(query: string): Promise<{
  industry: string
  country: string
}> {
  try {
    console.log(`[LeadSearch] Parsing natural language query: "${query}"`)

    const structured = await structuredExtractionAgent.generate(
      [
        {
          role: "user",
          content: `Extract the industry and country from this search query: "${query}"

Return the industry name and country name.

Examples:
- "Software companies in United States" -> industry: "Software", country: "United States"
- "Technology startups in Japan" -> industry: "Technology", country: "Japan"
- "Healthcare B2B companies in Germany" -> industry: "Healthcare", country: "Germany"`,
        },
      ],
      {
        output: z.object({
          industry: z.string().describe("The industry or sector name"),
          country: z.string().describe("The country name"),
        }),
      },
    )

    console.log(
      `[LeadSearch] Parsed query -> Industry: ${structured.object.industry}, Country: ${structured.object.country}`,
    )

    return structured.object
  } catch (error) {
    console.error("[LeadSearch] Failed to parse query, using fallback", error)
    // Fallback: try to extract country after "in"
    const match = query.match(/in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)
    const country = match?.[1] || "United States"
    const industry = query.split(/\s+in\s+/i)[0]?.trim() || "Software"
    return { industry, country }
  }
}

/**
 * Get B2B customer industries using AI agent
 * Takes the seller's industry and country, returns 1-3 target customer industries
 */
async function getB2BCustomerIndustries(
  industryName: string,
  countryName: string,
): Promise<string[]> {
  try {
    console.log(
      `[LeadSearch] Analyzing target customer industries for: ${industryName} in ${countryName}`,
    )

    // Step 1: Generate analysis using B2B agent
    const agent = createB2BCustomerIndustryAgent()
    const prompt = generateB2BCustomerIndustryPrompt(industryName, countryName)
    const response = await agent.generate(prompt)

    console.log(`[LeadSearch] B2B Agent response received`)

    // Step 2: Extract structured output using structured extraction agent
    const structured = await structuredExtractionAgent.generate(
      [
        {
          role: "user",
          content: `Extract the target industries from the following analysis. Return only the industry names as a JSON array.

Analysis:
${response.text}

Return format: { "targetIndustries": ["Industry1", "Industry2", "Industry3"] }`,
        },
      ],
      {
        output: z.object({
          targetIndustries: z
            .array(z.string())
            .min(1)
            .max(3)
            .describe("1-3 target customer industries"),
        }),
      },
    )

    const industries = structured.object.targetIndustries
    console.log(`[LeadSearch] Target industries (raw): ${industries.join(", ")}`)

    // Validate industries against Hunter.io valid industries list
    const validatedIndustries: string[] = []
    for (const industry of industries) {
      // Check if it's already a valid industry
      if (
        VALID_HUNTERIO_INDUSTRIES.includes(industry as (typeof VALID_HUNTERIO_INDUSTRIES)[number])
      ) {
        validatedIndustries.push(industry)
        continue
      }

      // Try to map to valid industries using fuzzy matching
      const mappedIndustries = findMatchingIndustries(industry)
      if (mappedIndustries.length > 0) {
        console.log(`[LeadSearch] Mapped "${industry}" to: ${mappedIndustries.join(", ")}`)
        // Only take the first mapped industry to avoid too many results
        const firstMapped = mappedIndustries[0]
        if (firstMapped && !validatedIndustries.includes(firstMapped)) {
          validatedIndustries.push(firstMapped)
        }
      } else {
        console.warn(
          `[LeadSearch] Could not map industry "${industry}" to valid Hunter.io industry, skipping`,
        )
      }
    }

    // If no valid industries found, fall back to original industry name
    if (validatedIndustries.length === 0) {
      console.warn(
        `[LeadSearch] No valid industries found, falling back to original: ${industryName}`,
      )
      const fallbackIndustries = findMatchingIndustries(industryName)
      if (fallbackIndustries.length > 0) {
        validatedIndustries.push(...fallbackIndustries.slice(0, 3))
      } else {
        // Last resort: use a generic industry
        validatedIndustries.push("Professional Services")
      }
    }

    console.log(`[LeadSearch] Target industries (validated): ${validatedIndustries.join(", ")}`)

    return validatedIndustries
  } catch (error) {
    console.error("[LeadSearch] B2B Agent failed, falling back to original industry", error)
    return [industryName] // Fallback to original behavior
  }
}

/**
 * Filter company by employee count
 */
function isCompanyTooLarge(employeeCount: number): boolean {
  return employeeCount > SEARCH_CONFIG.MAX_EMPLOYEE_COUNT
}

/**
 * Filter company by email count (proxy for size)
 */
function isCompanyTooLargeByEmailCount(emailCount: number): boolean {
  return emailCount > SEARCH_CONFIG.HUNTERIO_MAX_EMAIL_COUNT
}

// ====================================
// BIGQUERY SEARCH (Hybrid Strategy)
// ====================================

interface BigQuerySearchOptions {
  targetIndustries: string[]
  countryName: string
  targetCount: number
  onProgress?: ProgressCallback
  /** 🆕 본인 회사 설명 (예: "탈모 샴푸를 제조하는 K-뷰티 브랜드") - ICP 생성 및 고객사 검색에 사용 */
  myCompanyDescription?: string
  /** 🆕 ICP가 이미 생성된 경우 재사용 */
  idealCustomerProfile?: IdealCustomerProfile
}

type LeadSource = "b2b" | "apollo" | "fresh" | "revation" | "perplexity" | "beauty_db"

/**
 * 국가가 BigQuery 데이터가 풍부한 국가인지 확인
 */
function isBigQueryRichCountry(country: string): boolean {
  const normalizedCountry = country.toLowerCase().trim()
  return SEARCH_CONFIG.BIGQUERY_RICH_COUNTRIES.some(
    (rich) => rich.toLowerCase() === normalizedCountry,
  )
}

/**
 * 하이브리드 검색 전략:
 * - BigQuery 풍부 국가 (미국, 영국, 캐나다, 호주): BigQuery 우선 + Perplexity 보조
 * - 기타 국가: Perplexity 우선 (Enhanced 버전) + BigQuery 보조
 */
async function searchWithBigQuery(options: BigQuerySearchOptions): Promise<{
  leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }>
  stats: {
    totalQueried: number
    skippedDuplicates: number
    skippedLargeCompanies: number
    fromB2B: number
    fromApollo: number
    fromFresh: number
    fromRevation: number
    fromPerplexity: number
  }
}> {
  const { countryName } = options
  const isBigQueryRich = isBigQueryRichCountry(countryName)

  // 하이브리드 전략 결정
  if (isBigQueryRich) {
    console.log(
      `[LeadSearch] Using BigQuery-first strategy for "${countryName}" (data-rich country)`,
    )
    return searchBigQueryFirst(options)
  } else {
    console.log(
      `[LeadSearch] Using Perplexity-first strategy for "${countryName}" (limited BigQuery data)`,
    )
    return searchPerplexityFirst(options)
  }
}

/**
 * BigQuery 우선 검색 (미국 등 데이터 풍부 국가용)
 * - BigQuery 4개 테이블 + Perplexity 30개
 */
async function searchBigQueryFirst(options: BigQuerySearchOptions): Promise<{
  leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }>
  stats: {
    totalQueried: number
    skippedDuplicates: number
    skippedLargeCompanies: number
    fromB2B: number
    fromApollo: number
    fromFresh: number
    fromRevation: number
    fromPerplexity: number
  }
}> {
  const { targetIndustries, countryName, targetCount, onProgress } = options
  const processedWebsites = new Set<string>()
  const leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }> = []

  let totalQueried = 0
  let skippedDuplicates = 0
  let skippedLargeCompanies = 0
  let fromB2B = 0
  let fromApollo = 0
  let fromFresh = 0
  let fromRevation = 0
  let fromPerplexity = 0

  // Build natural language query combining all target industries
  const nlQuery = `${targetIndustries.join(" or ")} companies in ${countryName}`
  const perplexityQuery = optimizeQueryForPerplexity(nlQuery)

  // Create local logging context
  const localLogCtx = {
    traceId: generateTraceId(),
    query: nlQuery,
    country: countryName,
    industry: targetIndustries.join(", "),
  }

  leadSearchLogger.strategySelected("bigquery-first", countryName, localLogCtx)
  leadSearchLogger.debug(`Query: "${nlQuery}"`, localLogCtx, { perplexityQuery })

  // 🆕 Step 0: 뷰티/화장품 산업이면 뷰티 DB 우선 검색
  const isBeautyIndustry = targetIndustries.some((ind) => isBeautyRelatedIndustry(ind))

  if (isBeautyIndustry) {
    leadSearchLogger.debug(
      "Beauty industry detected - checking internal Beauty DB first",
      localLogCtx,
    )

    const beautyResult = await searchBeautyDatabase({
      country: countryName,
      limit: Math.min(targetCount, 100),
      excludeWebsites: processedWebsites,
    })

    leadSearchLogger.beautyDBSearch(localLogCtx, beautyResult.leads.length, countryName)

    if (beautyResult.leads.length > 0) {
      for (const bLead of beautyResult.leads) {
        const normalizedUrl = bLead.websiteUrl?.toLowerCase().replace(/\/+$/, "")
        if (!normalizedUrl || processedWebsites.has(normalizedUrl)) {
          skippedDuplicates++
          continue
        }
        processedWebsites.add(normalizedUrl)

        leads.push({
          company: bLead.companyName,
          website: bLead.websiteUrl,
          industry: bLead.businessType || "beauty",
          employees: bLead.employeeCount || "",
          country: bLead.country || countryName,
          description: bLead.description || undefined,
          source: "beauty_db" as LeadSource,
        })
        totalQueried++
      }

      leadSearchLogger.sourceResult("BeautyDB", leads.length, localLogCtx)

      // 충분한 리드를 찾았으면 바로 반환
      if (leads.length >= targetCount) {
        return {
          leads: leads.slice(0, targetCount),
          stats: {
            totalQueried,
            skippedDuplicates,
            skippedLargeCompanies,
            fromB2B,
            fromApollo,
            fromFresh,
            fromRevation,
            fromPerplexity: beautyResult.leads.length,
          },
        }
      }
    }
  }

  // Report progress
  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: "Searching 5 data sources in parallel (BigQuery-first strategy)...",
      currentCount: leads.length,
      targetCount,
    })
  }

  // Search all 5 sources in parallel (BigQuery + Perplexity 30개)
  const [b2bResult, apolloResult, freshResult, revationResult, perplexityResult] =
    await Promise.allSettled([
      searchBigQuery(nlQuery, B2B_LEADS_DATA_DICTIONARY, { limitOverride: targetCount }),
      searchBigQuery(nlQuery, APOLLO_LEADS_DATA_DICTIONARY, { limitOverride: targetCount }),
      searchBigQuery(nlQuery, FRESH_LEADS_DATA_DICTIONARY, { limitOverride: targetCount }),
      searchBigQuery(nlQuery, REVATION_LEADS_DATA_DICTIONARY, { limitOverride: targetCount }),
      searchLeadsWithPerplexity(perplexityQuery, SEARCH_CONFIG.PERPLEXITY_BASE_COUNT),
    ])

  // Helper function to transform BigQuery results
  function transformBigQueryResults(
    result: PromiseSettledResult<{
      results: Record<string, unknown>[]
      totalCount: number
      sql: string
    }>,
    source: LeadSource,
  ): Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }> {
    if (result.status !== "fulfilled") {
      console.warn(`[LeadSearch] ${source} search failed:`, result.reason)
      return []
    }

    console.log(`[LeadSearch] ${source}: ${result.value.results.length} results`)
    return result.value.results.map((row) => ({
      company: (row.company as string) || "",
      website: (row.website as string) || "",
      industry: ((row.industry || row.industry_category) as string) || "",
      employees: row.employees?.toString() || row.employee_count?.toString() || "",
      country: (row.country as string) || "",
      description: (row.description as string) || undefined,
      source,
    }))
  }

  // Transform results from each source
  const b2bLeads = transformBigQueryResults(b2bResult, "b2b")
  const apolloLeads = transformBigQueryResults(apolloResult, "apollo")
  const freshLeads = transformBigQueryResults(freshResult, "fresh")
  const revationLeads = transformBigQueryResults(revationResult, "revation")

  // Transform Perplexity results
  let perplexityLeads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }> = []
  if (perplexityResult.status === "fulfilled") {
    const pxResults = convertPerplexityToBigQueryFormat(perplexityResult.value.leads)
    perplexityLeads = pxResults.map((r) => ({
      company: r.companyName || "",
      website: r.webAddress || "",
      industry: r.mainIndustry || "",
      employees: r.employee || "",
      country: r.country || "",
      description: r.description || undefined,
      source: "perplexity" as LeadSource,
    }))
    console.log(`[LeadSearch] perplexity: ${perplexityLeads.length} results`)
  } else {
    console.warn(`[LeadSearch] perplexity search failed:`, perplexityResult.reason)
  }

  // Combine all results with priority order (Perplexity > Revation > Apollo > Fresh > B2B)
  const allResults = [
    ...perplexityLeads, // Perplexity first (real-time with description)
    ...revationLeads, // Premium curated leads with description
    ...apolloLeads, // High quality
    ...freshLeads, // Fresh leads
    ...b2bLeads, // B2B leads
  ]

  totalQueried = allResults.length

  // Filter and deduplicate results
  for (const row of allResults) {
    if (leads.length >= targetCount) {
      console.log(`[LeadSearch] BigQuery-first target reached: ${leads.length}/${targetCount}`)
      break
    }

    const website = row.website
    if (!website) continue

    // Filter 1: Skip duplicates
    if (processedWebsites.has(website.toLowerCase())) {
      skippedDuplicates++
      continue
    }

    // Filter 2: Skip large companies
    const employeeCount = parseInt(row.employees || "0", 10)
    if (isCompanyTooLarge(employeeCount)) {
      console.log(
        `[LeadSearch] Skipping large company (${employeeCount} employees): ${row.company}`,
      )
      skippedLargeCompanies++
      continue
    }

    processedWebsites.add(website.toLowerCase())

    // Track source counts
    switch (row.source) {
      case "b2b":
        fromB2B++
        break
      case "apollo":
        fromApollo++
        break
      case "fresh":
        fromFresh++
        break
      case "revation":
        fromRevation++
        break
      case "perplexity":
        fromPerplexity++
        break
    }

    leads.push(row)
  }

  // Report progress
  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: `Found ${leads.length}/${targetCount} leads from 5 data sources`,
      currentCount: leads.length,
      targetCount,
    })
  }

  console.log(
    `[LeadSearch] BigQuery-first complete: ${leads.length} leads from 5 sources ` +
      `(B2B: ${fromB2B}, Apollo: ${fromApollo}, Fresh: ${fromFresh}, Revation: ${fromRevation}, Perplexity: ${fromPerplexity}) ` +
      `(${skippedDuplicates} duplicates, ${skippedLargeCompanies} large companies skipped)`,
  )

  return {
    leads,
    stats: {
      totalQueried,
      skippedDuplicates,
      skippedLargeCompanies,
      fromB2B,
      fromApollo,
      fromFresh,
      fromRevation,
      fromPerplexity,
    },
  }
}

/**
 * Perplexity 우선 검색 (비미국 등 BigQuery 데이터 부족 국가용)
 * - Perplexity Enhanced 60-100개 우선
 * - BigQuery는 보조로 사용 (있으면 추가)
 */
async function searchPerplexityFirst(options: BigQuerySearchOptions): Promise<{
  leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }>
  stats: {
    totalQueried: number
    skippedDuplicates: number
    skippedLargeCompanies: number
    fromB2B: number
    fromApollo: number
    fromFresh: number
    fromRevation: number
    fromPerplexity: number
  }
}> {
  const {
    targetIndustries,
    countryName,
    targetCount,
    onProgress,
    myCompanyDescription,
    idealCustomerProfile,
  } = options
  const processedWebsites = new Set<string>()
  const leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }> = []

  let totalQueried = 0
  let skippedDuplicates = 0
  let skippedLargeCompanies = 0
  let fromB2B = 0
  let fromApollo = 0
  let fromFresh = 0
  let fromRevation = 0
  let fromPerplexity = 0

  // Create local logging context
  const localLogCtx = {
    traceId: generateTraceId(),
    query: `${targetIndustries.join(" or ")} in ${countryName}`,
    country: countryName,
    industry: targetIndustries.join(", "),
  }

  leadSearchLogger.strategySelected("perplexity-first", countryName, localLogCtx)

  // 🆕 ICP 기반 검색: 본인 회사 설명 → 고객사 찾기
  let icp = idealCustomerProfile
  let useICPSearch = false

  if (myCompanyDescription && myCompanyDescription.length > 10) {
    leadSearchLogger.debug(
      `ICP-based search: My company = "${myCompanyDescription.slice(0, 50)}..."`,
      localLogCtx,
      { myCompanyDescriptionLength: myCompanyDescription.length },
    )

    // ICP가 없으면 생성
    if (!icp) {
      leadSearchLogger.phaseStart("icp_generation", localLogCtx)
      icp = await generateIdealCustomerProfile({
        description: myCompanyDescription,
        industry: targetIndustries[0],
        target: "b2b",
        country: countryName,
      })
      leadSearchLogger.icpGenerated(localLogCtx, icp.customerTypes)
    }

    useICPSearch = true
  }

  // Report progress
  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: useICPSearch
        ? "Searching for potential CUSTOMERS using ICP strategy..."
        : "Searching with Perplexity-first strategy (enhanced for non-US countries)...",
      currentCount: 0,
      targetCount,
    })
  }

  // BigQuery 보조 검색용 쿼리 (Step 2에서 사용)
  const nlQuery =
    useICPSearch && icp
      ? `${icp.customerTypes.slice(0, 3).join(" ")} companies in ${countryName}`
      : `${targetIndustries.join(" or ")} companies in ${countryName}`

  // 🆕 Step 0: 뷰티/화장품 산업이면 뷰티 DB 우선 검색
  const isBeautyIndustry = targetIndustries.some((ind) => isBeautyRelatedIndustry(ind))

  if (isBeautyIndustry) {
    leadSearchLogger.debug(
      "Beauty industry detected - checking internal Beauty DB first",
      localLogCtx,
    )

    const beautyResult = await searchBeautyDatabase({
      country: countryName,
      limit: Math.min(targetCount, 100),
      excludeWebsites: processedWebsites,
    })

    leadSearchLogger.beautyDBSearch(localLogCtx, beautyResult.leads.length, countryName)

    if (beautyResult.leads.length > 0) {
      for (const bLead of beautyResult.leads) {
        const normalizedUrl = bLead.websiteUrl?.toLowerCase().replace(/\/+$/, "")
        if (!normalizedUrl || processedWebsites.has(normalizedUrl)) {
          skippedDuplicates++
          continue
        }
        processedWebsites.add(normalizedUrl)

        leads.push({
          company: bLead.companyName,
          website: bLead.websiteUrl,
          industry: bLead.businessType || "beauty",
          employees: bLead.employeeCount || "",
          country: bLead.country || countryName,
          description: bLead.description || undefined,
          source: "beauty_db" as LeadSource,
        })
        totalQueried++
      }

      leadSearchLogger.sourceResult("BeautyDB", leads.length, localLogCtx, {
        skippedDuplicates,
      })

      // 충분한 리드를 찾았으면 바로 반환
      if (leads.length >= targetCount) {
        return {
          leads: leads.slice(0, targetCount),
          stats: {
            totalQueried,
            skippedDuplicates,
            skippedLargeCompanies,
            fromB2B,
            fromApollo,
            fromFresh,
            fromRevation,
            fromPerplexity: beautyResult.leads.length,
          },
        }
      }
    }
  }

  // Step 1: Perplexity 검색
  let perplexityResult: Awaited<ReturnType<typeof searchLeadsWithPerplexityEnhanced>>
  if (useICPSearch && icp && myCompanyDescription) {
    // 🆕 ICP 기반 고객사 검색
    console.log(
      `[LeadSearch] Step 1: ICP-based customer search (${SEARCH_CONFIG.PERPLEXITY_ENHANCED_COUNT} leads)`,
    )
    console.log(`[LeadSearch] Finding: ${icp.customerTypes.join(", ")}`)

    perplexityResult = await searchCustomersWithPerplexityEnhanced({
      sellerDescription: myCompanyDescription,
      idealCustomerTypes: icp.customerTypes,
      country: countryName,
      excludeTypes: icp.excludeTypes,
      count: SEARCH_CONFIG.PERPLEXITY_ENHANCED_COUNT,
    })
  } else {
    // 기존 방식: 산업 키워드 기반 검색
    const perplexityQuery = optimizeQueryForPerplexity(nlQuery)

    console.log(
      `[LeadSearch] Step 1: Perplexity Enhanced search (${SEARCH_CONFIG.PERPLEXITY_ENHANCED_COUNT} leads)`,
    )
    console.log(`[LeadSearch] Perplexity query: "${perplexityQuery}"`)

    perplexityResult = await searchLeadsWithPerplexityEnhanced(
      perplexityQuery,
      SEARCH_CONFIG.PERPLEXITY_ENHANCED_COUNT,
    )
  }

  // Transform Perplexity results
  let perplexityLeads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
    source: LeadSource
    description?: string
  }> = []

  if (perplexityResult.leads.length > 0) {
    const pxResults = convertPerplexityToBigQueryFormat(perplexityResult.leads)
    perplexityLeads = pxResults.map((r) => ({
      company: r.companyName || "",
      website: r.webAddress || "",
      industry: r.mainIndustry || "",
      employees: r.employee || "",
      country: r.country || "",
      description: r.description || undefined,
      source: "perplexity" as LeadSource,
    }))
    console.log(`[LeadSearch] Perplexity enhanced: ${perplexityLeads.length} results`)
  } else {
    console.warn(`[LeadSearch] Perplexity enhanced search returned 0 results`)
  }

  // Add Perplexity leads first (they have descriptions)
  for (const row of perplexityLeads) {
    if (leads.length >= targetCount) break

    const website = row.website
    if (!website) continue

    if (processedWebsites.has(website.toLowerCase())) {
      skippedDuplicates++
      continue
    }

    processedWebsites.add(website.toLowerCase())
    fromPerplexity++
    leads.push(row)
  }

  console.log(`[LeadSearch] After Perplexity: ${leads.length}/${targetCount} leads`)

  // Step 2: BigQuery 보조 검색 (Perplexity로 부족한 경우에만)
  if (leads.length < targetCount) {
    const remaining = targetCount - leads.length
    console.log(`[LeadSearch] Step 2: BigQuery supplementary search for ${remaining} more leads`)

    // BigQuery 검색 (4개 테이블 병렬)
    const [b2bResult, apolloResult, freshResult, revationResult] = await Promise.allSettled([
      searchBigQuery(nlQuery, B2B_LEADS_DATA_DICTIONARY, { limitOverride: remaining }),
      searchBigQuery(nlQuery, APOLLO_LEADS_DATA_DICTIONARY, { limitOverride: remaining }),
      searchBigQuery(nlQuery, FRESH_LEADS_DATA_DICTIONARY, { limitOverride: remaining }),
      searchBigQuery(nlQuery, REVATION_LEADS_DATA_DICTIONARY, { limitOverride: remaining }),
    ])

    // Helper function to transform BigQuery results
    function transformBigQueryResults(
      result: PromiseSettledResult<{
        results: Record<string, unknown>[]
        totalCount: number
        sql: string
      }>,
      source: LeadSource,
    ): Array<{
      company: string
      website: string
      industry: string
      employees: string
      country: string
      source: LeadSource
      description?: string
    }> {
      if (result.status !== "fulfilled") {
        console.warn(`[LeadSearch] ${source} search failed:`, result.reason)
        return []
      }

      console.log(`[LeadSearch] ${source}: ${result.value.results.length} results`)
      return result.value.results.map((row) => ({
        company: (row.company as string) || "",
        website: (row.website as string) || "",
        industry: ((row.industry || row.industry_category) as string) || "",
        employees: row.employees?.toString() || row.employee_count?.toString() || "",
        country: (row.country as string) || "",
        description: (row.description as string) || undefined,
        source,
      }))
    }

    const b2bLeads = transformBigQueryResults(b2bResult, "b2b")
    const apolloLeads = transformBigQueryResults(apolloResult, "apollo")
    const freshLeads = transformBigQueryResults(freshResult, "fresh")
    const revationLeads = transformBigQueryResults(revationResult, "revation")

    // BigQuery 결과 우선순위: Revation > Apollo > Fresh > B2B
    const bigQueryLeads = [...revationLeads, ...apolloLeads, ...freshLeads, ...b2bLeads]

    totalQueried += bigQueryLeads.length

    // Filter and add BigQuery leads
    for (const row of bigQueryLeads) {
      if (leads.length >= targetCount) {
        console.log(`[LeadSearch] Perplexity-first target reached: ${leads.length}/${targetCount}`)
        break
      }

      const website = row.website
      if (!website) continue

      if (processedWebsites.has(website.toLowerCase())) {
        skippedDuplicates++
        continue
      }

      const employeeCount = parseInt(row.employees || "0", 10)
      if (isCompanyTooLarge(employeeCount)) {
        console.log(
          `[LeadSearch] Skipping large company (${employeeCount} employees): ${row.company}`,
        )
        skippedLargeCompanies++
        continue
      }

      processedWebsites.add(website.toLowerCase())

      // Track source counts
      switch (row.source) {
        case "b2b":
          fromB2B++
          break
        case "apollo":
          fromApollo++
          break
        case "fresh":
          fromFresh++
          break
        case "revation":
          fromRevation++
          break
      }

      leads.push(row)
    }
  }

  totalQueried += perplexityLeads.length

  // Report progress
  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: `Found ${leads.length}/${targetCount} leads (Perplexity-first strategy)`,
      currentCount: leads.length,
      targetCount,
    })
  }

  console.log(
    `[LeadSearch] Perplexity-first complete: ${leads.length} leads ` +
      `(Perplexity: ${fromPerplexity}, B2B: ${fromB2B}, Apollo: ${fromApollo}, Fresh: ${fromFresh}, Revation: ${fromRevation}) ` +
      `(${skippedDuplicates} duplicates, ${skippedLargeCompanies} large companies skipped)`,
  )

  return {
    leads,
    stats: {
      totalQueried,
      skippedDuplicates,
      skippedLargeCompanies,
      fromB2B,
      fromApollo,
      fromFresh,
      fromRevation,
      fromPerplexity,
    },
  }
}

// ====================================
// HUNTER.IO SEARCH
// ====================================

interface HunterIOSearchOptions {
  naturalLanguageQuery: string
  existingDomains: Set<string>
  currentCount: number
  targetCount: number
  onProgress?: ProgressCallback
  industryName: string
  countryName: string
  experience?: string
  target?: string
}

async function searchWithHunterIO(options: HunterIOSearchOptions): Promise<{
  leads: Array<{
    companyName: string
    websiteUrl: string
    primaryEmail: string
    businessType?: string
    country?: string
    employeeCount?: string
    description?: string
  }>
  stats: {
    totalQueried: number
    skippedDuplicates: number
    skippedLargeCompanies: number
  }
}> {
  const {
    existingDomains,
    currentCount,
    targetCount,
    onProgress,
    industryName,
    countryName,
    experience,
    target,
  } = options
  const leads: Array<{
    companyName: string
    websiteUrl: string
    primaryEmail: string
    businessType?: string
    country?: string
    employeeCount?: string
    description?: string
  }> = []

  let totalQueried = 0
  let skippedDuplicates = 0
  let skippedLargeCompanies = 0

  console.log(
    `[LeadSearch] Starting Hunter.io fallback. Current: ${currentCount}, Target: ${targetCount}`,
  )

  try {
    // 1. Get target industries using B2B Hunter Industry Agent
    console.log(
      `[LeadSearch] Hunter.io - Getting target industries for: ${industryName} in ${countryName}`,
    )

    const hunterAgent = createB2BHunterIndustryAgent()
    const hunterPrompt = generateB2BHunterIndustryPrompt(industryName, countryName)
    const hunterResponse = await hunterAgent.generate(hunterPrompt)

    // Extract structured output
    const hunterStructured = await structuredExtractionAgent.generate(
      [
        {
          role: "user",
          content: `Extract the target industries from the following analysis. Return only the industry names as a JSON array.

Analysis:
${hunterResponse.text}

Return format: { "targetIndustries": ["Industry1", "Industry2", "Industry3"] }`,
        },
      ],
      {
        output: z.object({
          targetIndustries: z
            .array(z.string())
            .min(1)
            .max(3)
            .describe("1-3 target customer industries for Hunter.io"),
        }),
      },
    )

    const hunterIndustries = hunterStructured.object.targetIndustries
    console.log(`[LeadSearch] Hunter.io target industries: ${hunterIndustries.join(", ")}`)

    const surveyData = {
      industry: industryName,
      country: countryName,
      target:
        target === "both"
          ? "both b2b and or b2c in those industries "
          : target + hunterIndustries.join(", "),
      experience: !experience || experience === "none" ? "not experienced" : experience,
    }

    const baseParams = await generateHunterioQuery(surveyData)

    // Force SMB company size limits (1-1000 employees)
    const smbHeadcount: Array<"1-10" | "11-50" | "51-200" | "201-500" | "501-1000"> = [
      "1-10",
      "11-50",
      "51-200",
      "201-500",
      "501-1000",
    ]
    const smbParams = {
      ...baseParams,
      headcount: smbHeadcount,
    }

    console.log("[LeadSearch] Generated Hunter.io params with SMB filter:", smbParams)

    let offset = 0
    let hasMoreResults = true

    // 2. Paginate until target reached
    while (hasMoreResults && currentCount + leads.length < targetCount) {
      const params = { ...smbParams, limit: SEARCH_CONFIG.HUNTERIO_MAX_PER_PAGE, offset }
      console.log(`[LeadSearch] Hunter.io page at offset ${offset}`)

      const companies = await searchLeadsWithHunter(params)
      totalQueried += companies.length

      if (companies.length === 0) {
        console.log("[LeadSearch] No more results from Hunter.io")
        hasMoreResults = false
        break
      }

      console.log(`[LeadSearch] Found ${companies.length} companies from Hunter.io`)

      // 3. Process each company with filters
      for (const company of companies) {
        // Filter 1: Skip duplicates
        if (existingDomains.has(company.domain.toLowerCase())) {
          console.log(`[LeadSearch] Skipping duplicate: ${company.domain}`)
          skippedDuplicates++
          continue
        }

        // Filter 2: Skip large companies
        if (isCompanyTooLargeByEmailCount(company.emailsCount.total)) {
          console.log(
            `[LeadSearch] Skipping large company (${company.emailsCount.total} emails): ${company.organization}`,
          )
          skippedLargeCompanies++
          continue
        }

        // 4. Get emails via Domain Search API with smart selection (C-level priority)
        const emailResult = await searchDomainWithSmartSelection(company.domain, 70)

        if (emailResult.email) {
          leads.push({
            companyName: company.organization,
            websiteUrl: `https://${company.domain}`,
            primaryEmail: emailResult.email,
            businessType: emailResult.industry || undefined,
            country: emailResult.country || undefined,
            employeeCount: emailResult.headcount || undefined,
            description: emailResult.description || undefined,
          })
          existingDomains.add(company.domain.toLowerCase())

          console.log(
            `[LeadSearch] Added lead from Hunter.io: ${company.organization} (${emailResult.email}, type: ${emailResult.emailType})`,
          )

          // Report progress
          if (onProgress) {
            await onProgress({
              phase: "hunterio",
              message: `Found ${currentCount + leads.length}/${targetCount} leads (Hunter.io fallback)`,
              currentCount: currentCount + leads.length,
              targetCount,
            })
          }
        }

        if (currentCount + leads.length >= targetCount) {
          console.log("[LeadSearch] Hunter.io target reached!")
          break
        }
      }

      offset += SEARCH_CONFIG.HUNTERIO_MAX_PER_PAGE

      if (companies.length < SEARCH_CONFIG.HUNTERIO_MAX_PER_PAGE) {
        hasMoreResults = false
      }
    }

    console.log(
      `[LeadSearch] Hunter.io complete: ${leads.length} leads (${skippedDuplicates} duplicates, ${skippedLargeCompanies} large companies skipped)`,
    )

    return {
      leads,
      stats: {
        totalQueried,
        skippedDuplicates,
        skippedLargeCompanies,
      },
    }
  } catch (error) {
    console.error("[LeadSearch] Hunter.io error:", error)
    return {
      leads,
      stats: {
        totalQueried,
        skippedDuplicates,
        skippedLargeCompanies,
      },
    }
  }
}

// ====================================
// ENRICHMENT
// ====================================

async function enrichLeads(
  rawLeads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
  }>,
  onProgress?: ProgressCallback,
): Promise<
  Array<{
    companyName: string
    websiteUrl: string
    primaryEmail: string | null
    businessType?: string
    country?: string
    employeeCount?: string
    description?: string
  }>
> {
  console.log(`[LeadSearch] Enriching ${rawLeads.length} leads in batches`)

  const enrichedLeads: Array<{
    companyName: string
    websiteUrl: string
    primaryEmail: string | null
    businessType?: string
    country?: string
    employeeCount?: string
    description?: string
  }> = []

  const _totalBatches = Math.ceil(rawLeads.length / SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE)

  const batches = []
  for (let i = 0; i < rawLeads.length; i += SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE) {
    batches.push(rawLeads.slice(i, i + SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE))
  }

  const results = await Promise.all(
    batches.map(async (batch, batchIndex) => {
      const enrichedBatch = await enrichLeadsForOnboarding(batch)

      if (onProgress) {
        const completed = (batchIndex + 1) * batch.length
        const progressPercent = Math.floor((completed / rawLeads.length) * 100)
        let messageKr = "연락처 찾는 중..."
        if (progressPercent > 80) {
          messageKr = "거의 다 됐어요!"
        } else if (completed > 0) {
          messageKr = `${completed}명 확인 중`
        }

        await onProgress({
          phase: "enrichment",
          message: `Finding contacts for ${completed}/${rawLeads.length} leads...`,
          messageKr,
          currentCount: completed,
          targetCount: rawLeads.length,
        })
      }

      return enrichedBatch.map((lead) => ({
        ...lead,
        primaryEmail: lead.primaryEmail || null,
      }))
    }),
  )

  enrichedLeads.push(...results.flat())

  // for (let i = 0; i < rawLeads.length; i += SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE) {
  //   const batch = rawLeads.slice(i, i + SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE)
  //   const batchNum = Math.floor(i / SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE) + 1

  //   console.log(`[LeadSearch] Enriching batch ${batchNum}/${totalBatches} (${batch.length} leads)`)

  //   const enrichedBatch = await enrichLeadsForOnboarding(batch)

  //   const withEmails = enrichedBatch.filter((l) => l.primaryEmail)
  //   console.log(
  //     `[LeadSearch] Batch ${batchNum}: ${withEmails.length}/${enrichedBatch.length} have emails`,
  //   )

  //   // Map to expected format (primaryEmail?: string -> primaryEmail: string | null)
  //   const mappedBatch = enrichedBatch.map((lead) => ({
  //     ...lead,
  //     primaryEmail: lead.primaryEmail || null,
  //   }))

  //   enrichedLeads.push(...mappedBatch)

  //   if (onProgress) {
  //     await onProgress({
  //       phase: "enrichment",
  //       message: `Enriched ${i + batch.length}/${rawLeads.length} leads`,
  //       currentCount: i + batch.length,
  //       targetCount: rawLeads.length,
  //     })
  //   }
  // }

  return enrichedLeads
}

// ====================================
// MAIN SERVICE FUNCTION
// ====================================

/**
 * Search and enrich leads using BigQuery + Hunter.io fallback
 *
 * Pure business logic function with no database dependencies.
 * Can be tested independently.
 *
 * When minimumMatchScore > 0, this function will continue fetching and scoring
 * leads until the target count of qualifying leads is reached.
 *
 * @param targetLeadCount - Number of qualifying leads to find
 * @param query - Natural language search query (e.g., "Software companies in United States")
 * @param minimumMatchScore - Minimum score (0-100) required for leads to be included (default: 0 = include all)
 * @param onProgress - Optional progress callback
 * @param options - Optional direct industry/country input to skip AI parsing
 * @returns Search results with enriched leads and statistics
 */
export async function searchAndEnrichLeads(
  targetLeadCount: number,
  query: string, // natural language query
  minimumMatchScore = 0,
  onProgress?: ProgressCallback,
  options?: {
    industry?: string
    country?: string
    experience?: string
    lang?: string
    target?: string
    /** 🆕 본인 회사 설명 - ICP 생성 및 고객사 검색에 사용 */
    myCompanyDescription?: string
    /** @deprecated 이전 버전 호환성 - myCompanyDescription 사용 권장 */
    targetCompanyDescription?: string
  },
): Promise<SearchResult> {
  const traceId = generateTraceId()
  const startTime = Date.now()

  // Create logging context
  const logCtx = {
    traceId,
    query,
    country: options?.country,
    industry: options?.industry,
  }

  leadSearchLogger.phaseStart("search_and_enrich", logCtx, {
    targetLeadCount,
    minimumMatchScore,
    hasMyCompanyDescription: !!options?.myCompanyDescription,
    hasTargetCompanyDescription: !!options?.targetCompanyDescription,
  })

  // Step 1: Parse natural language query (skip if industry/country provided directly)
  let industryName: string
  let countryName: string
  const experience: string = options?.experience || ""
  const target: string = options?.target || ""

  if (options?.industry && options?.country) {
    industryName = options.industry
    countryName = options.country
    leadSearchLogger.debug(
      `Using provided: industry="${industryName}", country="${countryName}"`,
      logCtx,
    )
  } else {
    const parsed = await parseNaturalLanguageQuery(query)
    industryName = parsed.industry
    countryName = parsed.country
    leadSearchLogger.debug(
      `Parsed from query: industry="${industryName}", country="${countryName}"`,
      logCtx,
    )
  }

  // Update logging context with parsed values
  logCtx.country = countryName
  logCtx.industry = industryName

  // Step 2: Get target B2B customer industries
  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)
  leadSearchLogger.debug(`Target industries: ${targetIndustries.join(", ")}`, logCtx, {
    targetIndustries,
  })

  // Track qualified leads and statistics
  const qualifiedLeads: EnrichedLead[] = []
  let totalBigQueryLeads = 0
  let totalHunterIOLeads = 0
  const totalPerplexityLeads = 0
  const totalBeautyDBLeads = 0
  let totalSkippedDuplicates = 0
  let totalSkippedLargeCompanies = 0
  let totalSkippedLowScoring = 0

  // Step 3: BigQuery search with iterative scoring
  leadSearchLogger.phaseStart("bigquery_search", logCtx, {
    targetCount: targetLeadCount,
    minimumMatchScore,
  })

  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: "Starting lead search...",
      messageKr: "바이어 찾는 중...",
      currentCount: 0,
      targetCount: targetLeadCount,
    })
  }

  // We'll fetch more leads than the target to account for filtering
  // Use 2x multiplier if scoring is enabled to reduce iterations
  const bigQueryTargetCount = minimumMatchScore > 0 ? targetLeadCount * 2 : targetLeadCount

  // 🆕 myCompanyDescription 우선, fallback으로 targetCompanyDescription (이전 버전 호환성)
  const myCompanyDesc = options?.myCompanyDescription || options?.targetCompanyDescription

  const bigQueryResult = await searchWithBigQuery({
    targetIndustries,
    countryName,
    targetCount: bigQueryTargetCount,
    onProgress,
    // 🆕 본인 회사 설명 - ICP 기반 고객사 검색에 사용
    myCompanyDescription: myCompanyDesc,
  })

  totalSkippedDuplicates += bigQueryResult.stats.skippedDuplicates
  totalSkippedLargeCompanies += bigQueryResult.stats.skippedLargeCompanies

  // Log BigQuery/Perplexity search result
  leadSearchLogger.phaseComplete(
    "bigquery_search",
    logCtx,
    {
      totalLeads: bigQueryResult.leads.length,
      fromB2B: bigQueryResult.stats.fromB2B,
      fromApollo: bigQueryResult.stats.fromApollo,
      fromFresh: bigQueryResult.stats.fromFresh,
      fromRevation: bigQueryResult.stats.fromRevation,
      fromPerplexity: bigQueryResult.stats.fromPerplexity,
      skippedDuplicates: bigQueryResult.stats.skippedDuplicates,
      skippedLargeCompanies: bigQueryResult.stats.skippedLargeCompanies,
    },
    Date.now() - startTime,
  )

  // Step 4: Enrich BigQuery leads
  leadSearchLogger.phaseStart("enrichment", logCtx, {
    leadCount: bigQueryResult.leads.length,
  })

  if (onProgress) {
    await onProgress({
      phase: "enrichment",
      message: "Finding contact information...",
      messageKr: "연락처 찾는 중...",
      currentCount: 0,
      targetCount: bigQueryResult.leads.length,
    })
  }

  // Create source lookup map BEFORE enrichment (to preserve source through enrichment)
  const sourceByWebsite = new Map<string, LeadSource>()
  for (const lead of bigQueryResult.leads) {
    sourceByWebsite.set(lead.website.toLowerCase(), lead.source)
  }

  const enrichmentStartTime = Date.now()
  const enrichedBigQueryLeads = await enrichLeads(bigQueryResult.leads, onProgress)

  // Filter leads with valid emails
  const bigQueryLeadsWithEmails = enrichedBigQueryLeads
    .filter((lead) => {
      if (!lead.primaryEmail) return false
      const email = lead.primaryEmail.toLowerCase()
      // Filter out generic no-reply addresses
      if (email.includes("noreply")) return false
      if (email.startsWith("postmaster@")) return false
      if (email.startsWith("abuse@")) return false
      return true
    })
    .map((lead) => ({
      ...lead,
      leadSource: sourceByWebsite.get(lead.websiteUrl.toLowerCase()) || "apollo",
    }))

  leadSearchLogger.phaseComplete(
    "enrichment",
    logCtx,
    {
      inputLeads: bigQueryResult.leads.length,
      enrichedLeads: enrichedBigQueryLeads.length,
      withValidEmails: bigQueryLeadsWithEmails.length,
      filteredNoEmail: enrichedBigQueryLeads.length - bigQueryLeadsWithEmails.length,
    },
    Date.now() - enrichmentStartTime,
  )

  // Critical log: How many leads have emails
  leadSearchLogger.enrichmentProgress(
    bigQueryLeadsWithEmails.length,
    bigQueryResult.leads.length,
    bigQueryLeadsWithEmails.length,
    logCtx,
  )

  // 🗑️ Step 5 제거: Description Enrichment를 Step 9.5로 통합 (중복 작업 제거)
  // BigQuery와 Hunter.io 리드를 모두 포함하여 한 번에 처리

  // Step 6: Score BigQuery leads if threshold is set
  if (minimumMatchScore > 0) {
    leadSearchLogger.phaseStart("scoring", logCtx, {
      leadsToScore: bigQueryLeadsWithEmails.length,
      minimumMatchScore,
    })

    if (onProgress) {
      await onProgress({
        phase: "scoring",
        message: "Analyzing lead quality...",
        messageKr: "적합도 분석 중...",
        currentCount: 0,
        targetCount: bigQueryLeadsWithEmails.length,
      })
    }

    for (let i = 0; i < bigQueryLeadsWithEmails.length; i++) {
      const lead = bigQueryLeadsWithEmails[i]
      if (!lead) continue

      const leadData = formatLeadForScoring({
        companyName: lead.companyName,
        industry: lead.businessType,
        country: lead.country,
        employeeCount: lead.employeeCount,
        description: lead.description,
        websiteUrl: lead.websiteUrl,
      })

      const scoreResult = await scoreLeadFit(query, leadData)

      if (scoreResult.score >= minimumMatchScore) {
        qualifiedLeads.push(lead)
        totalBigQueryLeads++
        console.log(
          `[LeadSearch] ✓ Qualified lead ${qualifiedLeads.length}: ${lead.companyName} (score: ${scoreResult.score})`,
        )
      } else {
        totalSkippedLowScoring++
        console.log(
          `[LeadSearch] ✗ Filtered: ${lead.companyName} (score: ${scoreResult.score} < ${minimumMatchScore})`,
        )
      }

      // Progress update every 5 leads (더 반응적으로)
      if (onProgress && (i + 1) % 5 === 0) {
        const progressPercent = Math.floor(((i + 1) / bigQueryLeadsWithEmails.length) * 100)
        let messageKr = "적합도 분석 중..."
        if (progressPercent > 80) {
          messageKr = "거의 다 됐어요!"
        }

        await onProgress({
          phase: "scoring",
          message: `Analyzing ${i + 1}/${bigQueryLeadsWithEmails.length} leads...`,
          messageKr,
          currentCount: i + 1,
          targetCount: bigQueryLeadsWithEmails.length,
        })
      }

      // Early exit if target reached
      if (qualifiedLeads.length >= targetLeadCount) {
        console.log(
          `[LeadSearch] Target reached with BigQuery leads: ${qualifiedLeads.length}/${targetLeadCount}`,
        )
        break
      }
    }
  } else {
    // No scoring needed, add all leads with emails
    qualifiedLeads.push(...bigQueryLeadsWithEmails)
    totalBigQueryLeads = bigQueryLeadsWithEmails.length
  }

  console.log(
    `[LeadSearch] BigQuery phase complete: ${qualifiedLeads.length}/${targetLeadCount} qualified leads`,
  )

  // Step 7: Hunter.io fallback if needed
  if (qualifiedLeads.length < targetLeadCount) {
    console.log(
      `[LeadSearch] Phase 2: Hunter.io fallback (need ${targetLeadCount - qualifiedLeads.length} more leads)`,
    )

    if (onProgress) {
      const foundCount = qualifiedLeads.length
      await onProgress({
        phase: "hunterio",
        message: `Found ${foundCount} leads, searching for more...`,
        messageKr: `${foundCount}명 찾았어요, 조금 더 찾는 중...`,
        currentCount: qualifiedLeads.length,
        targetCount: targetLeadCount,
      })
    }

    // Get all processed domains from BigQuery
    const processedDomains = new Set(bigQueryResult.leads.map((l) => l.website.toLowerCase()))

    // Fetch more leads than needed to account for filtering
    const hunterIOTargetCount =
      minimumMatchScore > 0
        ? (targetLeadCount - qualifiedLeads.length) * 2
        : targetLeadCount - qualifiedLeads.length

    const hunterIOResult = await searchWithHunterIO({
      naturalLanguageQuery: query,
      existingDomains: processedDomains,
      currentCount: qualifiedLeads.length,
      targetCount: qualifiedLeads.length + hunterIOTargetCount,
      onProgress,
      industryName,
      countryName,
      experience,
      target,
    })

    totalSkippedDuplicates += hunterIOResult.stats.skippedDuplicates
    totalSkippedLargeCompanies += hunterIOResult.stats.skippedLargeCompanies

    const hunterIOLeadsWithSource = hunterIOResult.leads.map((lead) => ({
      ...lead,
      leadSource: "hunterio-discover" as const,
    }))

    console.log(`[LeadSearch] Hunter.io: ${hunterIOLeadsWithSource.length} leads with emails`)

    // Step 8: Score Hunter.io leads if threshold is set
    if (minimumMatchScore > 0) {
      console.log("[LeadSearch] Scoring Hunter.io leads")

      if (onProgress) {
        await onProgress({
          phase: "scoring",
          message: "Analyzing additional leads...",
          messageKr: "추가 바이어 분석 중...",
          currentCount: qualifiedLeads.length,
          targetCount: targetLeadCount,
        })
      }

      for (let i = 0; i < hunterIOLeadsWithSource.length; i++) {
        const lead = hunterIOLeadsWithSource[i]
        if (!lead) continue

        const leadData = formatLeadForScoring({
          companyName: lead.companyName,
          industry: lead.businessType,
          country: lead.country,
          employeeCount: lead.employeeCount,
          description: lead.description,
          websiteUrl: lead.websiteUrl,
        })

        const scoreResult = await scoreLeadFit(query, leadData)

        if (scoreResult.score >= minimumMatchScore) {
          qualifiedLeads.push(lead)
          totalHunterIOLeads++
          console.log(
            `[LeadSearch] ✓ Qualified lead ${qualifiedLeads.length}: ${lead.companyName} (score: ${scoreResult.score})`,
          )
        } else {
          totalSkippedLowScoring++
          console.log(
            `[LeadSearch] ✗ Filtered: ${lead.companyName} (score: ${scoreResult.score} < ${minimumMatchScore})`,
          )
        }

        // Progress update every 5 leads
        if (onProgress && (i + 1) % 5 === 0) {
          await onProgress({
            phase: "scoring",
            message: `Scored ${i + 1}/${hunterIOLeadsWithSource.length} Hunter.io leads, ${qualifiedLeads.length} qualified`,
            currentCount: qualifiedLeads.length,
            targetCount: targetLeadCount,
          })
        }

        // Early exit if target reached
        if (qualifiedLeads.length >= targetLeadCount) {
          console.log(
            `[LeadSearch] Target reached with Hunter.io leads: ${qualifiedLeads.length}/${targetLeadCount}`,
          )
          break
        }
      }
    } else {
      // No scoring needed, add all Hunter.io leads
      qualifiedLeads.push(...hunterIOLeadsWithSource)
      totalHunterIOLeads = hunterIOLeadsWithSource.length
    }

    console.log(
      `[LeadSearch] Hunter.io phase complete: ${qualifiedLeads.length}/${targetLeadCount} total qualified leads`,
    )
  }

  // Step 9: Limit to target count (in case we exceeded)
  let finalLeads = qualifiedLeads.slice(0, targetLeadCount)

  // 🆕 Step 9.5: 통합 Description enrichment (BigQuery + Hunter.io 모두 포함)
  // 중복 enrichment 제거: 한 번에 모든 리드 처리
  const leadsWithoutDescription = finalLeads.filter(
    (lead) => !lead.description || lead.description.length < 30, // 🚀 20 → 30으로 변경 (더 나은 품질)
  )

  if (leadsWithoutDescription.length > 0) {
    leadSearchLogger.phaseStart("description_enrichment", logCtx, {
      leadsNeedingDescription: leadsWithoutDescription.length,
      leadsWithDescription: finalLeads.length - leadsWithoutDescription.length,
    })

    console.log(
      `[LeadSearch] 🔄 Unified description enrichment: ${leadsWithoutDescription.length} leads`,
    )

    if (onProgress) {
      await onProgress({
        phase: "description_enrichment",
        message: "Gathering company information...",
        messageKr: "회사 정보 수집 중...",
        currentCount: 0,
        targetCount: leadsWithoutDescription.length,
      })
    }

    const descriptionStartTime = Date.now()
    const enrichedDescriptions = await enrichLeadsWithDescriptions(
      leadsWithoutDescription.map((lead) => ({
        companyName: lead.companyName,
        websiteUrl: lead.websiteUrl,
        industry: lead.businessType,
        country: lead.country,
        existingDescription: lead.description,
      })),
      {
        concurrency: 15, // 🚀 병렬 처리 최적화
        onProgress: (completed, total) => {
          if (onProgress && completed % 5 === 0) {
            const progressPercent = Math.floor((completed / total) * 100)
            let messageKr = "바이어 정보 확인 중..."
            if (progressPercent > 80) {
              messageKr = "거의 다 됐어요!"
            } else if (progressPercent > 50) {
              messageKr = `${completed}개 완료`
            }

            onProgress({
              phase: "description_enrichment",
              message: `Checking ${completed}/${total} leads...`,
              messageKr,
              currentCount: completed,
              targetCount: total,
            })
          }
        },
      },
    )

    // Update leads with enriched descriptions + source info (for debugging)
    const enrichedMap = new Map(
      enrichedDescriptions.map((e) => [e.websiteUrl.toLowerCase(), e.description]),
    )
    for (const lead of finalLeads) {
      if (!lead.description || lead.description.length < 30) {
        const enrichedDesc = enrichedMap.get(lead.websiteUrl.toLowerCase())
        if (enrichedDesc && enrichedDesc.length > 30) {
          // 🔍 임시: source 정보를 description 끝에 추가 (디버깅용)
          lead.description = `${enrichedDesc} [Source: ${lead.leadSource}]`
        }
      } else {
        // 기존 description에도 source 추가
        lead.description = `${lead.description} [Source: ${lead.leadSource}]`
      }
    }

    const leadsWithDescNow = finalLeads.filter(
      (l) => l.description && l.description.length > 30,
    ).length

    leadSearchLogger.phaseComplete(
      "description_enrichment",
      logCtx,
      {
        descriptionsAdded: enrichedMap.size,
        leadsWithDescription: leadsWithDescNow,
      },
      Date.now() - descriptionStartTime,
    )

    console.log(
      `[LeadSearch] ✅ Description enrichment complete: ${leadsWithDescNow}/${finalLeads.length} leads (${Date.now() - descriptionStartTime}ms)`,
    )
  }

  // Step 10: AI Reranking (if myCompanyDescription is provided)
  // 🆕 "이 회사가 우리 제품을 살 가능성"을 평가
  if (myCompanyDesc && myCompanyDesc.length > 5) {
    console.log(
      `[LeadSearch] Step 10: AI Reranking - Finding customers for: "${myCompanyDesc.slice(0, 50)}..."`,
    )

    if (onProgress) {
      await onProgress({
        phase: "reranking",
        message: "Finding best matches...",
        messageKr: "최적의 바이어 찾는 중...",
        currentCount: 0,
        targetCount: finalLeads.length,
      })
    }

    // 리랭킹을 위해 리드를 변환
    const leadsForReranking = finalLeads.map((lead) => ({
      companyName: lead.companyName,
      description: lead.description,
      industry: lead.businessType,
      country: lead.country,
      websiteUrl: lead.websiteUrl,
      employeeCount: lead.employeeCount,
      primaryEmail: lead.primaryEmail,
      leadSource: lead.leadSource,
    }))

    // 🆕 ICP 기반 리랭킹 컨텍스트 생성
    // "이 회사가 우리 제품을 구매할 가능성"을 평가
    const rerankingQuery = `
**SELLER (My Company):** ${myCompanyDesc}

**SCORING CRITERIA:**
- High score (70-100): Company is a potential BUYER/CUSTOMER of my products (distributor, retailer, reseller, importer)
- Medium score (40-69): Company might buy my products but not an ideal fit
- Low score (0-39): Company is a competitor, manufacturer, or unrelated industry

**QUESTION:** Would this company BUY products from my company?
`.trim()

    const rankedResults = await rerankLeadsByRelevance(rerankingQuery, leadsForReranking, {
      topN: targetLeadCount,
      minScore: 30, // 최소 30점 이상 우선
      minCount: 30, // 🆕 최소 30개 보장 (minScore 미만이어도)
      concurrency: 20, // 🚀 10 → 20 증가 (3라운드 → 2라운드)
      onProgress: (completed, total, phase) => {
        if (onProgress && completed % 5 === 0) {
          onProgress({
            phase: "reranking",
            message: `${phase}: ${completed}/${total}`,
            currentCount: completed,
            targetCount: total,
          })
        }
      },
    })

    // 리랭킹된 결과로 최종 리드 목록 구성
    finalLeads = rankedResults.map((ranked) => ({
      companyName: ranked.lead.companyName || "",
      websiteUrl: ranked.lead.websiteUrl || "",
      businessType: ranked.lead.industry,
      country: ranked.lead.country,
      employeeCount: ranked.lead.employeeCount,
      description: ranked.lead.description,
      primaryEmail: ranked.lead.primaryEmail,
      leadSource: ranked.lead.leadSource as LeadSource,
      relevanceScore: ranked.score,
      relevanceReasoning: ranked.reasoning,
    }))

    leadSearchLogger.phaseComplete(
      "reranking",
      logCtx,
      {
        rerankedLeads: finalLeads.length,
        minScore: 30,
      },
      Date.now() - startTime,
    )
  }

  const elapsed = Date.now() - startTime

  // Final comprehensive summary log
  leadSearchLogger.summary(logCtx, {
    totalFound: finalLeads.length,
    fromBigQuery: totalBigQueryLeads,
    fromPerplexity: totalPerplexityLeads,
    fromBeautyDB: totalBeautyDBLeads,
    fromHunterIO: totalHunterIOLeads,
    withEmails: finalLeads.filter((l) => l.primaryEmail).length,
    skippedDuplicates: totalSkippedDuplicates,
    skippedLargeCompanies: totalSkippedLargeCompanies,
    skippedLowScoring: totalSkippedLowScoring,
    durationMs: elapsed,
  })

  if (onProgress) {
    await onProgress({
      phase: "complete",
      message: `Found ${finalLeads.length} qualifying leads`,
      currentCount: finalLeads.length,
      targetCount: targetLeadCount,
    })
  }

  return {
    leads: finalLeads,
    stats: {
      totalFound: finalLeads.length,
      fromBigQuery: totalBigQueryLeads,
      fromHunterIO: totalHunterIOLeads,
      skippedDuplicates: totalSkippedDuplicates,
      skippedLargeCompanies: totalSkippedLargeCompanies,
      skippedLowScoring: totalSkippedLowScoring,
      withEmails: finalLeads.filter((l) => l.primaryEmail).length,
    },
  }
}

/**
 * Export config for testing/overrides
 */
export function getSearchConfig() {
  return { ...SEARCH_CONFIG }
}

/**
 * Export individual search functions for advanced use cases
 */
export { searchWithBigQuery, searchWithHunterIO, enrichLeads }
