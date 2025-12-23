/**
 * Lead Search & Enrichment Service
 *
 * Unified service for discovering and enriching leads with filtering.
 * Pure business logic - no database dependencies.
 * Can be tested independently without DB involvement.
 */

import { z } from "zod"
import { createB2BCustomerIndustryAgent, generateB2BCustomerIndustryPrompt } from "../shared/mastra"
import { structuredExtractionAgent } from "../shared/mastra/shell/agents/structured-extraction-agent"
import { searchBigQuery } from "./bigquery-search.service"
import { searchDomainWithHunter } from "./hunterio-domain-search.service"
import { searchLeadsWithHunter } from "./hunterio-lead-search.service"
import { generateHunterioQuery } from "./hunterio-query-generator.service"
import { APOLLO_LEADS_DATA_DICTIONARY } from "./lead-discovery/nodes/bigquery-executor"
import { formatLeadForScoring, scoreLeadFit } from "./lead-scoring.service"
import { enrichLeadsForOnboarding } from "./onboarding.service"

// ====================================
// CONSTANTS
// ====================================

export const SEARCH_CONFIG = {
  TARGET_LEADS: 150,
  ENRICHMENT_BATCH_SIZE: 30,
  BIGQUERY_BATCH_SIZE: 100,
  MAX_SEARCH_ITERATIONS: 3,
  MAX_EMPLOYEE_COUNT: 5000, // Skip companies with >5000 employees (target SMBs)
  HUNTERIO_MAX_PER_PAGE: 100,
  HUNTERIO_MAX_EMAIL_COUNT: 100, // Skip companies with >100 indexed emails (proxy for large companies)
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
  leadSource: "bigquery-auto" | "hunterio-discover"
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
  phase: "bigquery" | "hunterio" | "enrichment" | "scoring" | "complete"
  message: string
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
    console.log(`[LeadSearch] Target industries: ${industries.join(", ")}`)

    return industries
  } catch (error) {
    console.error("[LeadSearch] B2B Agent failed, falling back to original industry", error)
    return [industryName] // Fallback to original behavior
  }
}

/**
 * Generate unique BigQuery search queries with variations
 */
function generateUniqueQuery(
  industryName: string,
  countryName: string,
  batchSize: number,
  iteration: number,
  usedQueries: Set<string>,
): string | null {
  const strategies = [
    // Base query with increasing limits
    () => `${industryName} companies in ${countryName} ${batchSize * iteration}개`,

    // Add employee size variations
    () =>
      `${industryName} companies in ${countryName} with 10-50 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 50-200 employees ${batchSize * iteration}개`,
    () =>
      `${industryName} companies in ${countryName} with 200+ employees ${batchSize * iteration}개`,

    // Add business type variations
    () => `${industryName} startups in ${countryName} ${batchSize * iteration}개`,
    () => `${industryName} SMB companies in ${countryName} ${batchSize * iteration}개`,

    // Add keyword variations
    () => `${industryName} B2B companies in ${countryName} ${batchSize * iteration}개`,
  ]

  // Try each strategy until we find an unused query
  for (const strategy of strategies) {
    const query = strategy()
    if (!usedQueries.has(query)) {
      usedQueries.add(query)
      return query
    }
  }

  return null // All strategies exhausted
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
// BIGQUERY SEARCH
// ====================================

interface BigQuerySearchOptions {
  targetIndustries: string[]
  countryName: string
  targetCount: number
  onProgress?: ProgressCallback
}

async function searchWithBigQuery(options: BigQuerySearchOptions): Promise<{
  leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
  }>
  stats: {
    totalQueried: number
    skippedDuplicates: number
    skippedLargeCompanies: number
  }
}> {
  const { targetIndustries, countryName, targetCount, onProgress } = options
  const processedWebsites = new Set<string>()
  const usedQueries = new Set<string>()
  const leads: Array<{
    company: string
    website: string
    industry: string
    employees: string
    country: string
  }> = []

  let totalQueried = 0
  let skippedDuplicates = 0
  let skippedLargeCompanies = 0

  for (let iteration = 0; iteration < SEARCH_CONFIG.MAX_SEARCH_ITERATIONS; iteration++) {
    if (leads.length >= targetCount) {
      console.log(`[LeadSearch] BigQuery target reached: ${leads.length}/${targetCount}`)
      break
    }

    console.log(
      `[LeadSearch] BigQuery iteration ${iteration + 1}/${SEARCH_CONFIG.MAX_SEARCH_ITERATIONS}`,
    )

    for (const targetIndustry of targetIndustries) {
      // Generate unique query for this industry
      const query = generateUniqueQuery(
        targetIndustry,
        countryName,
        SEARCH_CONFIG.BIGQUERY_BATCH_SIZE,
        iteration + 1,
        usedQueries,
      )

      if (!query) {
        console.warn(`[LeadSearch] No more unique queries for "${targetIndustry}"`)
        continue
      }

      console.log(`[LeadSearch] Querying BigQuery: "${query}"`)

      const result = await searchBigQuery(query, APOLLO_LEADS_DATA_DICTIONARY, {
        limitOverride: SEARCH_CONFIG.BIGQUERY_BATCH_SIZE,
      })

      if (!result.results.length) {
        console.log(`[LeadSearch] No results for "${targetIndustry}"`)
        continue
      }

      console.log(`[LeadSearch] Found ${result.results.length} results for "${targetIndustry}"`)
      totalQueried += result.results.length

      // Filter results
      for (const row of result.results) {
        const website = row.website as string
        if (!website) continue

        // Filter 1: Skip duplicates
        if (processedWebsites.has(website.toLowerCase())) {
          skippedDuplicates++
          continue
        }

        // Filter 2: Skip large companies
        const employeeCount = parseInt(row.employees?.toString() || "0", 10)
        if (isCompanyTooLarge(employeeCount)) {
          console.log(
            `[LeadSearch] Skipping large company (${employeeCount} employees): ${row.company}`,
          )
          skippedLargeCompanies++
          continue
        }

        processedWebsites.add(website.toLowerCase())

        leads.push({
          company: row.company as string,
          website,
          industry: row.industry as string,
          employees: row.employees?.toString() || "",
          country: row.country as string,
        })
      }

      // Report progress
      if (onProgress) {
        await onProgress({
          phase: "bigquery",
          message: `Found ${leads.length}/${targetCount} leads from BigQuery`,
          currentCount: leads.length,
          targetCount,
        })
      }

      if (leads.length >= targetCount) break
    }
  }

  console.log(
    `[LeadSearch] BigQuery complete: ${leads.length} leads (${skippedDuplicates} duplicates, ${skippedLargeCompanies} large companies skipped)`,
  )

  return {
    leads,
    stats: {
      totalQueried,
      skippedDuplicates,
      skippedLargeCompanies,
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
  const { naturalLanguageQuery, existingDomains, currentCount, targetCount, onProgress } = options
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
    // 1. Generate Hunter.io params from natural language query
    console.log(`[LeadSearch] Hunter.io query: "${naturalLanguageQuery}"`)

    // Parse the query to extract industry and country for Hunter.io
    const { industry, country } = await parseNaturalLanguageQuery(naturalLanguageQuery)

    const surveyData = {
      industry,
      country,
      target: `${industry} companies`,
      experience: "intermediate",
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

        // 4. Get emails via Domain Search API
        const emailResult = await searchDomainWithHunter({ domain: company.domain })

        if (emailResult.genericEmail) {
          leads.push({
            companyName: company.organization,
            websiteUrl: `https://${company.domain}`,
            primaryEmail: emailResult.genericEmail,
            businessType: emailResult.industry || undefined,
            country: emailResult.country || undefined,
            employeeCount: emailResult.headcount || undefined,
            description: emailResult.description || undefined,
          })
          existingDomains.add(company.domain.toLowerCase())

          console.log(
            `[LeadSearch] Added lead from Hunter.io: ${company.organization} (${emailResult.genericEmail})`,
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

  const totalBatches = Math.ceil(rawLeads.length / SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE)

  for (let i = 0; i < rawLeads.length; i += SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE) {
    const batch = rawLeads.slice(i, i + SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE)
    const batchNum = Math.floor(i / SEARCH_CONFIG.ENRICHMENT_BATCH_SIZE) + 1

    console.log(`[LeadSearch] Enriching batch ${batchNum}/${totalBatches} (${batch.length} leads)`)

    const enrichedBatch = await enrichLeadsForOnboarding(batch)

    const withEmails = enrichedBatch.filter((l) => l.primaryEmail)
    console.log(
      `[LeadSearch] Batch ${batchNum}: ${withEmails.length}/${enrichedBatch.length} have emails`,
    )

    // Map to expected format (primaryEmail?: string -> primaryEmail: string | null)
    const mappedBatch = enrichedBatch.map((lead) => ({
      ...lead,
      primaryEmail: lead.primaryEmail || null,
    }))

    enrichedLeads.push(...mappedBatch)

    if (onProgress) {
      await onProgress({
        phase: "enrichment",
        message: `Enriched ${i + batch.length}/${rawLeads.length} leads`,
        currentCount: i + batch.length,
        targetCount: rawLeads.length,
      })
    }
  }

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
 * @returns Search results with enriched leads and statistics
 */
export async function searchAndEnrichLeads(
  targetLeadCount: number,
  query: string,
  minimumMatchScore = 0,
  onProgress?: ProgressCallback,
): Promise<SearchResult> {
  console.log("=".repeat(60))
  console.log("[LeadSearch] Starting lead search and enrichment")
  console.log(`[LeadSearch] Target: ${targetLeadCount} qualifying leads`)
  console.log(`[LeadSearch] Query: "${query}"`)
  console.log(`[LeadSearch] Minimum match score: ${minimumMatchScore}`)
  console.log("=".repeat(60))

  const startTime = Date.now()

  // Step 1: Parse natural language query
  const { industry: industryName, country: countryName } = await parseNaturalLanguageQuery(query)

  // Step 2: Get target B2B customer industries
  const targetIndustries = await getB2BCustomerIndustries(industryName, countryName)

  // Track qualified leads and statistics
  const qualifiedLeads: EnrichedLead[] = []
  let totalBigQueryLeads = 0
  let totalHunterIOLeads = 0
  let totalSkippedDuplicates = 0
  let totalSkippedLargeCompanies = 0
  let totalSkippedLowScoring = 0

  // Step 3: BigQuery search with iterative scoring
  console.log("[LeadSearch] Phase 1: BigQuery search with scoring")

  if (onProgress) {
    await onProgress({
      phase: "bigquery",
      message: "Searching BigQuery for leads",
      currentCount: 0,
      targetCount: targetLeadCount,
    })
  }

  // We'll fetch more leads than the target to account for filtering
  // Use 2x multiplier if scoring is enabled to reduce iterations
  const bigQueryTargetCount = minimumMatchScore > 0 ? targetLeadCount * 2 : targetLeadCount

  const bigQueryResult = await searchWithBigQuery({
    targetIndustries,
    countryName,
    targetCount: bigQueryTargetCount,
    onProgress,
  })

  totalSkippedDuplicates += bigQueryResult.stats.skippedDuplicates
  totalSkippedLargeCompanies += bigQueryResult.stats.skippedLargeCompanies

  // Step 4: Enrich BigQuery leads
  if (onProgress) {
    await onProgress({
      phase: "enrichment",
      message: "Enriching BigQuery leads with contact information",
      currentCount: 0,
      targetCount: bigQueryResult.leads.length,
    })
  }

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
      leadSource: "bigquery-auto" as const,
    }))

  console.log(
    `[LeadSearch] BigQuery: ${bigQueryLeadsWithEmails.length} leads with valid emails (from ${bigQueryResult.leads.length} raw leads)`,
  )

  // Step 5: Score BigQuery leads if threshold is set
  if (minimumMatchScore > 0) {
    console.log("[LeadSearch] Scoring BigQuery leads")

    if (onProgress) {
      await onProgress({
        phase: "scoring",
        message: `Scoring ${bigQueryLeadsWithEmails.length} BigQuery leads`,
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

      // Progress update every 10 leads
      if (onProgress && (i + 1) % 10 === 0) {
        await onProgress({
          phase: "scoring",
          message: `Scored ${i + 1}/${bigQueryLeadsWithEmails.length} BigQuery leads, ${qualifiedLeads.length} qualified`,
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

  // Step 6: Hunter.io fallback if needed
  if (qualifiedLeads.length < targetLeadCount) {
    console.log(
      `[LeadSearch] Phase 2: Hunter.io fallback (need ${targetLeadCount - qualifiedLeads.length} more leads)`,
    )

    if (onProgress) {
      await onProgress({
        phase: "hunterio",
        message: "Searching Hunter.io for additional leads",
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
    })

    totalSkippedDuplicates += hunterIOResult.stats.skippedDuplicates
    totalSkippedLargeCompanies += hunterIOResult.stats.skippedLargeCompanies

    const hunterIOLeadsWithSource = hunterIOResult.leads.map((lead) => ({
      ...lead,
      leadSource: "hunterio-discover" as const,
    }))

    console.log(`[LeadSearch] Hunter.io: ${hunterIOLeadsWithSource.length} leads with emails`)

    // Step 7: Score Hunter.io leads if threshold is set
    if (minimumMatchScore > 0) {
      console.log("[LeadSearch] Scoring Hunter.io leads")

      if (onProgress) {
        await onProgress({
          phase: "scoring",
          message: `Scoring ${hunterIOLeadsWithSource.length} Hunter.io leads`,
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

  // Step 8: Limit to target count (in case we exceeded)
  const finalLeads = qualifiedLeads.slice(0, targetLeadCount)

  const elapsed = Date.now() - startTime
  console.log("=".repeat(60))
  console.log("[LeadSearch] Search and enrichment complete")
  console.log(`[LeadSearch] Total time: ${(elapsed / 1000).toFixed(2)}s`)
  console.log(`[LeadSearch] Qualified leads: ${finalLeads.length}/${targetLeadCount}`)
  console.log(`[LeadSearch]   - From BigQuery: ${totalBigQueryLeads}`)
  console.log(`[LeadSearch]   - From Hunter.io: ${totalHunterIOLeads}`)
  if (minimumMatchScore > 0) {
    console.log(`[LeadSearch]   - Filtered by score: ${totalSkippedLowScoring}`)
  }
  console.log(`[LeadSearch]   - Skipped duplicates: ${totalSkippedDuplicates}`)
  console.log(`[LeadSearch]   - Skipped large companies: ${totalSkippedLargeCompanies}`)
  console.log("=".repeat(60))

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
