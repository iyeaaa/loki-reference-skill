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
 * Simplified result type - returns single generic email plus rich company data
 */
export interface HunterioDomainSearchResult {
  domain: string
  organization: string | null
  genericEmail: string | null
  pattern: string | null
  description?: string | null
  industry?: string | null
  country?: string | null
  headcount?: string | null
  companyType?: string | null
  emails?: Array<{
    value: string
    type: "personal" | "generic"
    confidence: number
  }>
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

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if an email is invalid (noreply, abuse, postmaster, etc.)
 */
function isInvalidEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const emailLower = email.toLowerCase()

  const invalidPrefixes = [
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "postmaster",
    "abuse",
    "webmaster",
    "mailer-daemon",
    "bounce",
  ]

  return invalidPrefixes.some((prefix) => emailLower.startsWith(`${prefix}@`))
}

/**
 * Fetch domain emails with custom limit and offset
 */
async function fetchDomainEmails(
  validatedParams: HunterioDomainSearchParams,
  limit: number,
  offset: number = 0,
): Promise<HunterioDomainSearchResponse["data"] | null> {
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
        url.searchParams.set("limit", limit.toString())
        if (offset > 0) {
          url.searchParams.set("offset", offset.toString())
        }

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

  const parsedResponse = HunterioDomainSearchResponseSchema.safeParse(response)
  if (!parsedResponse.success) {
    console.error("[Hunter.io Domain] [ERROR] Invalid API response:", parsedResponse.error)
    logger.error(
      { error: parsedResponse.error },
      "Hunter.io Domain Search response validation failed",
    )
    return null
  }

  return parsedResponse.data.data
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
 * - Returns first valid generic email (skips noreply/abuse/postmaster)
 * - Automatically retries with larger limit if first email is invalid
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
    console.error("[Hunter.io Domain] [ERROR] Invalid parameters:", validationResult.error)
    logger.warn({ error: validationResult.error }, "Hunter.io Domain Search validation failed")
    return emptyResult
  }
  const validatedParams = validationResult.data

  // 2. Check cache
  const cacheKey = generateCacheKey(validatedParams)
  const cached = await cache.get<HunterioDomainSearchResult>(cacheKey)
  if (cached) {
    console.log(
      `[Hunter.io Domain] [CACHE] Cache hit for ${validatedParams.domain || validatedParams.company}`,
    )
    return cached
  }

  console.log(
    "[Hunter.io Domain] Starting domain search:",
    validatedParams.domain || validatedParams.company,
  )
  const startTime = Date.now()

  try {
    // 3. Try with limit=1 first (fast path)
    console.log("[Hunter.io Domain] Fetching with limit=1 (fast path)")
    let data = await fetchDomainEmails(validatedParams, 1, 0)

    if (!data) {
      return emptyResult
    }

    // 4. Check if the first generic email is invalid
    const firstGenericEmail = data.emails.find((e) => e.type === "generic")

    if (firstGenericEmail && isInvalidEmail(firstGenericEmail.value)) {
      console.log(
        `[Hunter.io Domain] [WARN] First email is invalid (${firstGenericEmail.value}), fetching more...`,
      )

      // Retry with limit=5 to get more options
      const retryData = await fetchDomainEmails(validatedParams, 5, 0)

      if (retryData) {
        data = retryData
        console.log(
          `[Hunter.io Domain] Fetched ${retryData.emails.length} emails to find valid one`,
        )
      }
    }

    // 5. Find first valid generic email
    const validGenericEmail = data.emails
      .filter((e) => e.type === "generic")
      .find((e) => !isInvalidEmail(e.value))

    if (validGenericEmail) {
      console.log(`[Hunter.io Domain] [OK] Found valid generic email: ${validGenericEmail.value}`)
    } else if (data.emails.some((e) => e.type === "generic")) {
      console.log("[Hunter.io Domain] [WARN] Only invalid generic emails found (noreply/abuse/etc)")
    } else {
      console.log("[Hunter.io Domain] [INFO] No generic emails found")
    }

    const result: HunterioDomainSearchResult = {
      domain: data.domain,
      organization: data.organization,
      genericEmail: validGenericEmail?.value || null,
      pattern: data.pattern,
      description: data.description,
      industry: data.industry,
      country: data.country,
      headcount: data.headcount,
      companyType: data.company_type,
      emails: data.emails.map((e) => ({
        value: e.value,
        type: e.type,
        confidence: e.confidence,
      })),
    }

    const elapsed = Date.now() - startTime
    console.log(`[Hunter.io Domain] [OK] Completed search for ${data.domain} in ${elapsed}ms`)

    // 6. Cache successful results
    await cache.set(cacheKey, result)

    return result
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[Hunter.io Domain] [ERROR] Failed to search domain (${elapsed}ms):`, error)
    logger.error({ error, params: validatedParams }, "Failed to search domain with Hunter.io")
    return emptyResult
  }
}

// ==================== ALL EMAILS SEARCH ====================

/**
 * Email with role information for prioritization
 */
export interface DomainEmailWithRole {
  value: string
  type: "personal" | "generic"
  confidence: number
  firstName?: string | null
  lastName?: string | null
  position?: string | null
  seniority?: string | null
  department?: string | null
}

/**
 * Result type for searchDomainAllEmails - returns all emails with role info
 */
export interface DomainSearchAllEmailsResult {
  domain: string
  organization: string | null
  pattern: string | null
  emails: DomainEmailWithRole[]
}

/**
 * Fetch all domain emails (both generic and personal) with role info
 */
async function fetchDomainAllEmails(
  domain: string,
  limit: number = 10,
): Promise<HunterioDomainSearchResponse["data"] | null> {
  const response = await executeWithDualRateLimit(() =>
    pRetry(
      async () => {
        const url = new URL("https://api.hunter.io/v2/domain-search")
        url.searchParams.set("api_key", config.hunter.apiKey)
        url.searchParams.set("domain", domain)
        // Don't set type - this fetches both generic and personal emails
        url.searchParams.set("limit", limit.toString())

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
        })

        if (!res.ok) {
          const errorText = await res.text()
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
            `[Hunter.io Domain All] Retry attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`,
          )
        },
      },
    ),
  )

  const parsedResponse = HunterioDomainSearchResponseSchema.safeParse(response)
  if (!parsedResponse.success) {
    console.error("[Hunter.io Domain All] [ERROR] Invalid API response:", parsedResponse.error)
    logger.error(
      { error: parsedResponse.error },
      "Hunter.io Domain Search (all emails) response validation failed",
    )
    return null
  }

  return parsedResponse.data.data
}

/**
 * Search for all email addresses (generic + personal) using Hunter.io Domain Search API
 *
 * @param domain - Domain name to search
 * @param limit - Maximum number of emails to fetch (default: 10)
 * @returns All emails with role information for prioritization
 *
 * Features:
 * - Fetches both generic and personal emails (no type filter)
 * - Includes seniority, department, position for prioritization
 * - Dual rate limiting (15/sec AND 500/min)
 * - Automatic retry with exponential backoff
 * - Filters out invalid emails (noreply, abuse, etc.)
 *
 * @example
 * ```typescript
 * const result = await searchDomainAllEmails("stripe.com")
 * // Returns all emails with role info for sorting by priority
 * ```
 */
export async function searchDomainAllEmails(
  domain: string,
  limit: number = 10,
): Promise<DomainSearchAllEmailsResult> {
  const emptyResult: DomainSearchAllEmailsResult = {
    domain,
    organization: null,
    pattern: null,
    emails: [],
  }

  if (!domain) {
    console.error("[Hunter.io Domain All] [ERROR] Domain is required")
    return emptyResult
  }

  // Check cache with special key for all-emails search
  const cacheKey = `hunter_domain_all:${hashString(domain)}:${limit}`
  const cached = await cache.get<DomainSearchAllEmailsResult>(cacheKey)
  if (cached) {
    console.log(`[Hunter.io Domain All] [CACHE] Cache hit for ${domain}`)
    return cached
  }

  console.log(`[Hunter.io Domain All] Starting search for all emails: ${domain}`)
  const startTime = Date.now()

  try {
    const data = await fetchDomainAllEmails(domain, limit)

    if (!data) {
      return emptyResult
    }

    // Filter out invalid emails and transform to DomainEmailWithRole
    const validEmails: DomainEmailWithRole[] = data.emails
      .filter((e) => !isInvalidEmail(e.value))
      .map((e) => ({
        value: e.value,
        type: e.type,
        confidence: e.confidence,
        firstName: e.first_name,
        lastName: e.last_name,
        position: e.position,
        seniority: e.seniority,
        department: e.department,
      }))

    const result: DomainSearchAllEmailsResult = {
      domain: data.domain,
      organization: data.organization,
      pattern: data.pattern,
      emails: validEmails,
    }

    const elapsed = Date.now() - startTime
    console.log(
      `[Hunter.io Domain All] [OK] Found ${validEmails.length} valid emails for ${domain} in ${elapsed}ms`,
    )

    // Cache successful results
    await cache.set(cacheKey, result)

    return result
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(`[Hunter.io Domain All] [ERROR] Failed to search domain (${elapsed}ms):`, error)
    logger.error({ error, domain }, "Failed to search domain (all emails) with Hunter.io")
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
