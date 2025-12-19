import PQueue from "p-queue"
import { z } from "zod"
import { config } from "../config"
import logger from "../utils/logger"
import { hashString, RedisCache } from "./redis-cache.service"

// ==================== ZOD SCHEMAS ====================

/**
 * Headcount enum values
 */
const HeadcountEnum = z.enum([
  "1-10",
  "11-50",
  "51-200",
  "201-500",
  "501-1000",
  "1001-5000",
  "5001-10000",
  "10001+",
])

/**
 * Company type enum values
 */
const CompanyTypeEnum = z.enum([
  "educational",
  "educational institution",
  "government agency",
  "non profit",
  "partnership",
  "privately held",
  "public company",
  "self employed",
  "self owned",
  "sole proprietorship",
])

/**
 * Location object for headquarters filtering
 */
const LocationSchema = z.object({
  continent: z
    .enum(["Europe", "Asia", "North America", "Africa", "Antarctica", "South America", "Oceania"])
    .optional(),
  business_region: z.enum(["AMER", "EMEA", "APAC", "LATAM"]).optional(),
  country: z.string().optional().describe("ISO 3166-1 alpha-2 country code"),
  state: z.string().optional().describe("US state code (only when country=US)"),
  city: z.string().optional().describe("City name (requires country)"),
})

/**
 * Funding series enum
 */
const FundingSeriesEnum = z.enum([
  "pre_seed",
  "seed",
  "pre_series_a",
  "series_a",
  "pre_series_b",
  "series_b",
  "pre_series_c",
  "series_c+",
  "other",
])

/**
 * Hunter.io Discover API parameter schema
 * Matches the exact API structure with objects and arrays
 */
export const HunterioDiscoverParamsSchema = z
  .object({
    // Natural language query
    query: z.string().optional().describe("Natural language search description"),

    // Organization filter
    organization: z
      .object({
        domain: z.array(z.string()).optional().describe("Company domains"),
        name: z.array(z.string()).optional().describe("Company names"),
      })
      .optional()
      .describe("Organization domain/name filter"),

    // Similar companies (Premium)
    similar_to: z
      .object({
        domain: z.string().optional().describe("Domain to find similar companies"),
        name: z.string().optional().describe("Company name to match"),
      })
      .optional()
      .describe("Find companies similar to (Premium only)"),

    // Headquarters location
    headquarters_location: z
      .object({
        include: z.array(LocationSchema).optional().describe("Locations to include"),
        exclude: z.array(LocationSchema).optional().describe("Locations to exclude"),
      })
      .optional()
      .describe("Company headquarters location filter"),

    // Industry filter
    industry: z
      .object({
        include: z.array(z.string()).optional().describe("Industries to include"),
        exclude: z.array(z.string()).optional().describe("Industries to exclude"),
      })
      .optional()
      .describe("Industry filter"),

    // Headcount (array of ranges)
    headcount: z
      .array(HeadcountEnum)
      .optional()
      .describe("Company size ranges (can specify multiple)"),

    // Company type
    company_type: z
      .object({
        include: z.array(CompanyTypeEnum).optional().describe("Company types to include"),
        exclude: z.array(CompanyTypeEnum).optional().describe("Company types to exclude"),
      })
      .optional()
      .describe("Company type filter"),

    // Year founded (Premium)
    year_founded: z
      .object({
        include: z.array(z.number().int()).optional().describe("Specific years to include"),
        exclude: z.array(z.number().int()).optional().describe("Specific years to exclude"),
        from: z.number().int().optional().describe("From year (inclusive)"),
        to: z.number().int().optional().describe("To year (inclusive)"),
      })
      .optional()
      .describe("Year founded filter (Premium only)"),

    // Keywords
    keywords: z
      .object({
        include: z.array(z.string()).optional().describe("Keywords to include"),
        exclude: z.array(z.string()).optional().describe("Keywords to exclude"),
        match: z
          .enum(["any", "all"])
          .optional()
          .default("all")
          .describe("Match any or all keywords"),
      })
      .optional()
      .describe("Keyword filter"),

    // Technology (Premium)
    technology: z
      .object({
        include: z.array(z.string()).optional().describe("Technologies to include"),
        exclude: z.array(z.string()).optional().describe("Technologies to exclude"),
        match: z
          .enum(["any", "all"])
          .optional()
          .default("all")
          .describe("Match any or all technologies"),
      })
      .optional()
      .describe("Technology filter (Premium only)"),

    // Funding (Premium)
    funding: z
      .object({
        series: z.array(FundingSeriesEnum).optional().describe("Funding series"),
        amount: z
          .object({
            from: z.number().optional().describe("Minimum funding amount"),
            to: z.number().optional().describe("Maximum funding amount"),
          })
          .optional()
          .describe("Funding amount range"),
        date: z
          .object({
            from: z.string().optional().describe("From date (ISO 8601)"),
            to: z.string().optional().describe("To date (ISO 8601)"),
          })
          .optional()
          .describe("Funding date range"),
      })
      .optional()
      .describe("Funding filter (Premium only)"),

    // Pagination
    limit: z.number().int().min(1).max(100).default(100).describe("Maximum results to return"),
    offset: z.number().int().min(0).default(0).describe("Pagination offset (Premium only)"),
  })
  .refine(
    (data) =>
      data.query ||
      data.organization ||
      data.similar_to ||
      data.headquarters_location ||
      data.industry ||
      data.headcount ||
      data.company_type ||
      data.year_founded ||
      data.keywords ||
      data.technology ||
      data.funding,
    { message: "At least one search parameter must be provided" },
  )
  .describe("Hunter.io Discover API parameters")

export type HunterioDiscoverParams = z.infer<typeof HunterioDiscoverParamsSchema>

/**
 * Hunter.io Discover API response schema
 */
export const HunterioDiscoverResponseSchema = z.object({
  data: z.array(
    z.object({
      domain: z.string(),
      organization: z.string(),
      emails_count: z.object({
        personal: z.number(),
        generic: z.number(),
        total: z.number(),
      }),
    }),
  ),
  meta: z.object({
    results: z.number(),
    limit: z.number(),
    offset: z.number(),
    params: z.record(z.string(), z.unknown()),
    filters: z.record(z.string(), z.unknown()).optional(),
  }),
})

export type HunterioDiscoverResponse = z.infer<typeof HunterioDiscoverResponseSchema>

/**
 * Simplified company result type
 */
export interface HunterioCompany {
  domain: string
  organization: string
  emailsCount: {
    personal: number
    generic: number
    total: number
  }
}

// ==================== CACHE INITIALIZATION ====================

const cache = RedisCache.fromConfig(config.cache.leadDiscovery)

// ==================== RATE LIMITING SETUP ====================

/**
 * Two-tier rate limiting for Hunter.io Discover API:
 * - Primary queue: 50 requests per minute
 * - Secondary queue: 5 requests per second
 *
 * Strategy: Nest the second-level rate limit inside the first
 */

// Tier 1: Limit to 50 requests per minute
const minuteQueue = new PQueue({
  intervalCap: 50,
  interval: 60000, // 60 seconds
  carryoverConcurrencyCount: true,
})

// Tier 2: Limit to 5 requests per second
const secondQueue = new PQueue({
  intervalCap: 5,
  interval: 1000, // 1 second
  carryoverConcurrencyCount: true,
})

/**
 * Execute a function with dual rate limiting
 * Requests must pass through BOTH queues
 */
async function executeWithDualRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return minuteQueue.add(() => secondQueue.add(fn))
}

// ==================== CACHE KEY GENERATION ====================

/**
 * Generate cache key from search parameters
 * Uses stable JSON stringification to ensure consistent keys
 */
function generateCacheKey(params: HunterioDiscoverParams): string {
  // Sort keys for stable hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key as keyof HunterioDiscoverParams]
        return acc
      },
      {} as Record<string, unknown>,
    )

  const paramsString = JSON.stringify(sortedParams)
  const hash = hashString(paramsString)
  return `hunter_discover:${hash}`
}

// ==================== MAIN SERVICE FUNCTION ====================

/**
 * Search for companies using Hunter.io Discover API
 *
 * @param params - Search parameters (must include at least one filter)
 * @returns Array of companies (up to 100), or empty array on error
 *
 * Features:
 * - Redis caching with 24-hour TTL
 * - Dual rate limiting (5/sec AND 50/min)
 * - Zod validation for input/output
 * - Graceful error handling
 *
 * @example
 * ```typescript
 * // Simple query search
 * const companies = await searchLeadsWithHunter({
 *   query: "AI startups in San Francisco",
 *   headcount: ["51-200", "201-500"],
 *   limit: 50
 * })
 *
 * // Complex filter with organization and location
 * const companies2 = await searchLeadsWithHunter({
 *   organization: { domain: ["stripe.com", "google.com"] },
 *   headquarters_location: {
 *     include: [{ country: "US", state: "CA" }]
 *   },
 *   industry: { include: ["Technology", "Software"] },
 *   limit: 100
 * })
 * ```
 */
export async function searchLeadsWithHunter(
  params: z.input<typeof HunterioDiscoverParamsSchema>,
): Promise<HunterioCompany[]> {
  // 1. Validate input parameters (runtime validation for safety)
  const validationResult = HunterioDiscoverParamsSchema.safeParse(params)
  if (!validationResult.success) {
    console.error("[Hunter.io Discover] ❌ Invalid parameters:", validationResult.error)
    logger.warn({ error: validationResult.error }, "Hunter.io Discover validation failed")
    return []
  }
  const validatedParams = validationResult.data

  // 2. Check cache
  const cacheKey = generateCacheKey(validatedParams)
  const cached = await cache.get<HunterioCompany[]>(cacheKey)
  if (cached) {
    console.log(`[Hunter.io Discover] ✅ Cache hit (${cached.length} companies)`)
    return cached
  }

  console.log("[Hunter.io Discover] Starting lead search:", validatedParams)
  const startTime = Date.now()

  try {
    // 3. Execute API call with dual rate limiting
    const response = await executeWithDualRateLimit(async () => {
      const url = new URL("https://api.hunter.io/v2/discover")
      url.searchParams.set("api_key", config.hunter.apiKey)

      // Remove limit and offset from body params as they're not standard filters
      const { limit, offset, ...bodyParams } = validatedParams

      // Add limit and offset as query params if not default
      if (limit !== 100) {
        url.searchParams.set("limit", String(limit))
      }
      if (offset !== 0) {
        url.searchParams.set("offset", String(offset))
      }

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyParams),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Hunter.io API error (${res.status}): ${errorText}`)
      }

      return res.json()
    })

    // 4. Validate response schema
    const parsedResponse = HunterioDiscoverResponseSchema.safeParse(response)
    if (!parsedResponse.success) {
      console.error("[Hunter.io Discover] ❌ Invalid API response:", parsedResponse.error)
      logger.error({ error: parsedResponse.error }, "Hunter.io Discover response validation failed")
      return []
    }

    // 5. Transform to simplified format
    const companies: HunterioCompany[] = parsedResponse.data.data.map((company) => ({
      domain: company.domain,
      organization: company.organization,
      emailsCount: {
        personal: company.emails_count.personal,
        generic: company.emails_count.generic,
        total: company.emails_count.total,
      },
    }))

    const elapsed = Date.now() - startTime
    console.log(`[Hunter.io Discover] ✅ Found ${companies.length} companies (${elapsed}ms)`)

    // 6. Cache successful results
    await cache.set(cacheKey, companies)

    return companies
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[Hunter.io Discover] ❌ Failed to search leads (${elapsed}ms):`, error)
    logger.error({ error, params: validatedParams }, "Failed to search leads with Hunter.io")
    return []
  }
}

// ==================== QUEUE STATISTICS ====================

/**
 * Get current queue statistics for monitoring
 */
export function getQueueStats() {
  return {
    minuteQueue: {
      size: minuteQueue.size,
      pending: minuteQueue.pending,
    },
    secondQueue: {
      size: secondQueue.size,
      pending: secondQueue.pending,
    },
  }
}
