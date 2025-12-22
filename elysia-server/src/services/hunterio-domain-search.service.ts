import PQueue from "p-queue"
import pRetry, { AbortError } from "p-retry"
import { z } from "zod"
import { config } from "../config"
import logger from "../utils/logger"
import { hashString, RedisCache } from "./redis-cache.service"

// ==================== ZOD SCHEMAS ====================

/**
 * Seniority levels for filtering
 */
const SeniorityEnum = z.enum(["junior", "senior", "executive"])

/**
 * Department filter values
 */
const DepartmentEnum = z.enum([
  "executive",
  "it",
  "finance",
  "management",
  "sales",
  "legal",
  "support",
  "hr",
  "marketing",
  "communication",
  "education",
  "design",
  "health",
  "operations",
])

/**
 * Email type filter
 */
const EmailTypeEnum = z.enum(["personal", "generic"])

/**
 * Verification status filter
 */
const VerificationStatusEnum = z.enum(["valid", "accept_all", "unknown"])

/**
 * Required field filter
 */
const RequiredFieldEnum = z.enum(["full_name", "position", "phone_number"])

/**
 * Hunter.io Domain Search API parameter schema
 * Note: This service always fetches type=generic and limit=1 to return a single generic email
 */
export const HunterioDomainSearchParamsSchema = z
  .object({
    // Required: at least one of domain or company
    domain: z.string().optional().describe("Domain name to search (takes precedence over company)"),
    company: z.string().optional().describe("Company name to search"),

    // Optional filters
    seniority: SeniorityEnum.optional().describe("Filter by seniority level"),
    department: DepartmentEnum.optional().describe("Filter by department"),
    required_field: RequiredFieldEnum.optional().describe("Filter by required field"),
    verification_status: VerificationStatusEnum.optional().describe(
      "Filter by verification status",
    ),
    job_titles: z.string().optional().describe("Comma-delimited job title filters"),
  })
  .refine((data) => data.domain || data.company, {
    message: "At least one of 'domain' or 'company' must be provided",
  })
  .describe("Hunter.io Domain Search API parameters")

export type HunterioDomainSearchParams = z.infer<typeof HunterioDomainSearchParamsSchema>

/**
 * Email source schema
 */
const EmailSourceSchema = z.object({
  domain: z.string(),
  uri: z.string(),
  extracted_on: z.string(),
  last_seen_on: z.string(),
  still_on_page: z.boolean(),
})

/**
 * Email object schema from API response
 */
const EmailSchema = z.object({
  value: z.string().email(),
  type: EmailTypeEnum,
  confidence: z.number(),
  sources: z.array(EmailSourceSchema),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  position: z.string().nullable(),
  seniority: z.string().nullable(),
  department: z.string().nullable(),
  linkedin: z.string().nullable().optional(),
  twitter: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
  verification: z
    .object({
      date: z.string().nullable(),
      status: z.string().nullable(),
    })
    .optional(),
})

/**
 * Hunter.io Domain Search API response schema
 */
export const HunterioDomainSearchResponseSchema = z.object({
  data: z.object({
    domain: z.string(),
    disposable: z.boolean(),
    webmail: z.boolean(),
    accept_all: z.boolean(),
    pattern: z.string().nullable(),
    organization: z.string().nullable(),
    description: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    twitter: z.string().nullable().optional(),
    facebook: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
    youtube: z.string().nullable().optional(),
    technologies: z.array(z.string()).optional(),
    country: z.string().nullable().optional(),
    state: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    postal_code: z.string().nullable().optional(),
    street: z.string().nullable().optional(),
    headcount: z.string().nullable().optional(),
    company_type: z.string().nullable().optional(),
    emails: z.array(EmailSchema),
  }),
  meta: z.object({
    results: z.number(),
    limit: z.number(),
    offset: z.number(),
    params: z.record(z.string(), z.unknown()),
  }),
})

export type HunterioDomainSearchResponse = z.infer<typeof HunterioDomainSearchResponseSchema>

/**
 * Simplified result type - returns single generic email
 */
export interface HunterioDomainSearchResult {
  domain: string
  organization: string | null
  genericEmail: string | null
  pattern: string | null
}

// ==================== CACHE INITIALIZATION ====================

const cache = RedisCache.fromConfig(config.cache.leadDiscovery)

// ==================== RATE LIMITING SETUP ====================

/**
 * Two-tier rate limiting for Hunter.io Domain Search API:
 * - Primary queue: 500 requests per minute
 * - Secondary queue: 15 requests per second
 *
 * Strategy: Nest the second-level rate limit inside the first
 *
 * NOTE: Domain Search has higher rate limits than Discover API (Lead Search):
 * - Domain Search: 15/sec, 500/min (this service)
 * - Discover API:  5/sec, 50/min (hunterio-lead-search.service.ts)
 * See: https://hunter.io/api-documentation/v2#rate-limiting
 */

// Tier 1: Limit to 500 requests per minute
const minuteQueue = new PQueue({
  intervalCap: 500,
  interval: 60000, // 60 seconds
  carryoverConcurrencyCount: true,
})

// Tier 2: Limit to 15 requests per second
const secondQueue = new PQueue({
  intervalCap: 15,
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
function generateCacheKey(params: HunterioDomainSearchParams): string {
  // Sort keys for stable hashing
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key as keyof HunterioDomainSearchParams]
        return acc
      },
      {} as Record<string, unknown>,
    )

  const paramsString = JSON.stringify(sortedParams)
  const hash = hashString(paramsString)
  return `hunter_domain:${hash}`
}

// ==================== MAIN SERVICE FUNCTION ====================

/**
 * Search for a generic email address using Hunter.io Domain Search API
 *
 * @param params - Search parameters (must include domain or company)
 * @returns Single generic email result, or null fields on error/not found
 *
 * Features:
 * - Redis caching with 24-hour TTL
 * - Dual rate limiting (15/sec AND 500/min)
 * - Automatic retry with exponential backoff (pRetry)
 * - Zod validation for input/output
 * - Returns only 1 generic email address
 *
 * @example
 * ```typescript
 * const result = await searchDomainWithHunter({ domain: "stripe.com" })
 * // { domain: "stripe.com", organization: "Stripe", genericEmail: "info@stripe.com", pattern: "{first}" }
 *
 * const result2 = await searchDomainWithHunter({ company: "Google" })
 * // { domain: "google.com", organization: "Google", genericEmail: "support@google.com", pattern: "{first}.{last}" }
 * ```
 */
export async function searchDomainWithHunter(
  params: z.input<typeof HunterioDomainSearchParamsSchema>,
): Promise<HunterioDomainSearchResult> {
  const emptyResult: HunterioDomainSearchResult = {
    domain: params.domain || "",
    organization: null,
    genericEmail: null,
    pattern: null,
  }

  // 1. Validate input parameters
  const validationResult = HunterioDomainSearchParamsSchema.safeParse(params)
  if (!validationResult.success) {
    console.error("[Hunter.io Domain] ❌ Invalid parameters:", validationResult.error)
    logger.warn({ error: validationResult.error }, "Hunter.io Domain Search validation failed")
    return emptyResult
  }
  const validatedParams = validationResult.data

  // 2. Check cache
  const cacheKey = generateCacheKey(validatedParams)
  const cached = await cache.get<HunterioDomainSearchResult>(cacheKey)
  if (cached) {
    console.log(
      `[Hunter.io Domain] ✅ Cache hit for ${validatedParams.domain || validatedParams.company}`,
    )
    return cached
  }

  console.log(
    "[Hunter.io Domain] Starting domain search:",
    validatedParams.domain || validatedParams.company,
  )
  const startTime = Date.now()

  try {
    // 3. Execute API call with dual rate limiting and retry
    const response = await executeWithDualRateLimit(() =>
      pRetry(
        async () => {
          const url = new URL("https://api.hunter.io/v2/domain-search")
          url.searchParams.set("api_key", config.hunter.apiKey)

          // Add search parameters
          if (validatedParams.domain) {
            url.searchParams.set("domain", validatedParams.domain)
          }
          if (validatedParams.company) {
            url.searchParams.set("company", validatedParams.company)
          }

          // Force type to generic to only get generic emails
          url.searchParams.set("type", "generic")
          url.searchParams.set("limit", "1") // Only need 1 generic email

          // Add optional filters
          if (validatedParams.seniority) {
            url.searchParams.set("seniority", validatedParams.seniority)
          }
          if (validatedParams.department) {
            url.searchParams.set("department", validatedParams.department)
          }
          if (validatedParams.required_field) {
            url.searchParams.set("required_field", validatedParams.required_field)
          }
          if (validatedParams.verification_status) {
            url.searchParams.set("verification_status", validatedParams.verification_status)
          }
          if (validatedParams.job_titles) {
            url.searchParams.set("job_titles", validatedParams.job_titles)
          }

          const res = await fetch(url.toString(), {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          })

          if (!res.ok) {
            const errorText = await res.text()
            // Don't retry on 4xx errors (except 429)
            if (res.status >= 400 && res.status < 500 && res.status !== 429) {
              throw new AbortError(`Hunter.io API error (${res.status}): ${errorText}`)
            }
            throw new Error(`Hunter.io API error (${res.status}): ${errorText}`)
          }

          return res.json()
        },
        {
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          onFailedAttempt: (error) => {
            console.log(
              `[Hunter.io Domain] Retry attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
            )
          },
        },
      ),
    )

    // 4. Validate response schema
    const parsedResponse = HunterioDomainSearchResponseSchema.safeParse(response)
    if (!parsedResponse.success) {
      console.error("[Hunter.io Domain] ❌ Invalid API response:", parsedResponse.error)
      logger.error(
        { error: parsedResponse.error },
        "Hunter.io Domain Search response validation failed",
      )
      return emptyResult
    }

    // 5. Extract single generic email
    const data = parsedResponse.data.data
    const genericEmail = data.emails.find((e) => e.type === "generic")

    const result: HunterioDomainSearchResult = {
      domain: data.domain,
      organization: data.organization,
      genericEmail: genericEmail?.value || null,
      pattern: data.pattern,
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[Hunter.io Domain] ✅ Found ${genericEmail ? "generic email" : "no generic email"} for ${data.domain} (${elapsed}ms)`,
    )

    // 6. Cache successful results
    await cache.set(cacheKey, result)

    return result
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[Hunter.io Domain] ❌ Failed to search domain (${elapsed}ms):`, error)
    logger.error({ error, params: validatedParams }, "Failed to search domain with Hunter.io")
    return emptyResult
  }
}

// ==================== QUEUE STATISTICS ====================

/**
 * Get current queue statistics for monitoring
 */
export function getDomainSearchQueueStats() {
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
