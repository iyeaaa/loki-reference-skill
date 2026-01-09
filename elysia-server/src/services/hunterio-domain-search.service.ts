import PQueue from "p-queue"
import pRetry, { AbortError } from "p-retry"
import { z } from "zod"
import { config } from "../config"
import { shouldFilterGenericEmail } from "../utils/email-provider.util"
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
 * Simplified result type - returns best available email (personal executive or generic) plus rich company data
 */
export interface HunterioDomainSearchResult {
  domain: string
  organization: string | null
  /** Best available email (personal executive or generic company email) */
  email: string | null
  /** Type of the email: 'personal' for executives, 'generic' for company emails */
  emailType: "personal" | "generic" | null
  /** @deprecated Use 'email' field instead. Kept for backward compatibility. */
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
 *
 * @param validatedParams - Validated search parameters
 * @param limit - Maximum number of emails to fetch
 * @param offset - Offset for pagination
 * @param options - Optional filters for type and seniority
 */
async function fetchDomainEmails(
  validatedParams: HunterioDomainSearchParams,
  limit: number,
  offset: number = 0,
  options?: {
    type?: "personal" | "generic"
    seniority?: "junior" | "senior" | "executive"
  },
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

        // Set type parameter (generic, personal, or unspecified)
        if (options?.type) {
          url.searchParams.set("type", options.type)
        } else {
          // Default to generic for backward compatibility
          url.searchParams.set("type", "generic")
        }

        url.searchParams.set("limit", limit.toString())
        if (offset > 0) {
          url.searchParams.set("offset", offset.toString())
        }

        // Add optional filters
        // Explicit seniority from options takes precedence over validatedParams
        const seniority = options?.seniority || validatedParams.seniority
        if (seniority) {
          url.searchParams.set("seniority", seniority)
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
    email: null,
    emailType: null,
    genericEmail: null, // deprecated, kept for backward compatibility
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
      email: validGenericEmail?.value || null,
      emailType: validGenericEmail ? "generic" : null,
      genericEmail: validGenericEmail?.value || null, // deprecated, kept for backward compatibility
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

// ==================== SMART EMAIL SELECTION ====================

/**
 * Maximum number of attempts to fetch and validate an email before giving up
 */
const MAX_EMAIL_FETCH_ATTEMPTS = 5

/**
 * Helper to iteratively fetch emails one at a time with offset retry
 * Fetches 1 email, validates it, and retries with next offset if filtered
 *
 * @param validatedParams - Validated search parameters
 * @param options - Search options (type, seniority)
 * @param validator - Function to validate if email should be accepted
 * @param maxAttempts - Maximum number of fetch attempts
 * @returns First valid email data or null
 */
async function fetchValidEmailIteratively(
  validatedParams: HunterioDomainSearchParams,
  options: {
    type?: "personal" | "generic"
    seniority?: "junior" | "senior" | "executive"
  },
  validator: (email: HunterioDomainSearchResponse["data"]["emails"][number]) => boolean,
  maxAttempts: number = MAX_EMAIL_FETCH_ATTEMPTS,
): Promise<{
  email: HunterioDomainSearchResponse["data"]["emails"][number]
  data: HunterioDomainSearchResponse["data"]
} | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const offset = attempt // Each attempt checks the next email
    const data = await fetchDomainEmails(validatedParams, 1, offset, options)

    if (!data || data.emails.length === 0) {
      // No more emails available
      console.log(
        `[Hunter.io Smart] No more emails available after ${attempt + 1} attempt(s) (type: ${options.type})`,
      )
      return null
    }

    const email = data.emails[0]
    if (!email) {
      // Should never happen since we checked length > 0, but satisfy TypeScript
      console.log(`[Hunter.io Smart] Unexpected: email at index 0 is undefined`)
      return null
    }

    // Validate the email
    if (validator(email)) {
      console.log(
        `[Hunter.io Smart] Found valid email on attempt ${attempt + 1}: ${email.value} ` +
          `(confidence: ${email.confidence}%)`,
      )
      return { email, data }
    }

    console.log(
      `[Hunter.io Smart] Email ${email.value} filtered out, trying next (attempt ${attempt + 1}/${maxAttempts})`,
    )
  }

  console.log(
    `[Hunter.io Smart] Exhausted ${maxAttempts} attempts without finding valid email (type: ${options.type})`,
  )
  return null
}

/**
 * Search for the most relevant email address using smart selection logic
 *
 * This function prioritizes C-level personal emails over generic company emails,
 * with intelligent fallback and filtering logic.
 *
 * **Selection Strategy:**
 * 1. **First choice**: Personal C-level/executive emails (confidence ≥70%)
 *    - Uses `type=personal&seniority=executive` API filter
 *    - Fetches 1 email at a time, retries with offset if filtered
 *    - Returns first high-confidence email from C-level executives
 *
 * 2. **Fallback**: Generic company emails (contact@, info@, etc.)
 *    - Uses `type=generic` API filter
 *    - Fetches 1 email at a time, retries with offset if filtered
 *    - Filters out free email providers (Gmail, Yahoo, Hotmail, etc.)
 *    - Filters out invalid emails (noreply@, postmaster@, etc.)
 *    - Returns first valid company email
 *
 * **Optimization Benefits:**
 * - Minimal API calls: Fetches 1 email at a time instead of batches
 * - Smaller responses: Reduces bandwidth usage
 * - Early termination: Stops as soon as valid email found
 * - Typically requires only 1-2 API calls total
 *
 * @param domain - Domain name to search
 * @param minPersonalConfidence - Minimum confidence threshold for personal emails (default: 70)
 * @returns Best available email result, or null fields if no valid email found
 *
 * @example
 * ```typescript
 * // Returns C-level email if found
 * const result = await searchDomainWithSmartSelection("stripe.com")
 * // result.email = "ceo@stripe.com"
 * // result.emailType = "personal"
 *
 * // Falls back to company email if no C-level
 * const result2 = await searchDomainWithSmartSelection("example.com")
 * // result2.email = "contact@example.com"
 * // result2.emailType = "generic"
 * ```
 */
export async function searchDomainWithSmartSelection(
  domain: string,
  minPersonalConfidence: number = 70,
): Promise<HunterioDomainSearchResult> {
  const emptyResult: HunterioDomainSearchResult = {
    domain,
    organization: null,
    email: null,
    emailType: null,
    genericEmail: null, // deprecated, kept for backward compatibility
    pattern: null,
  }

  if (!domain) {
    console.error("[Hunter.io Smart] [ERROR] Domain is required")
    return emptyResult
  }

  // Validate confidence range
  if (minPersonalConfidence < 0 || minPersonalConfidence > 100) {
    console.warn(`[Hunter.io Smart] Invalid confidence ${minPersonalConfidence}, using default 70`)
    minPersonalConfidence = 70
  }

  // Check cache with smart selection specific key
  const cacheKey = `hunter_domain_smart:${hashString(domain)}:${minPersonalConfidence}`
  const cached = await cache.get<HunterioDomainSearchResult>(cacheKey)
  if (cached) {
    console.log(`[Hunter.io Smart] [CACHE] Cache hit for ${domain}`)
    return cached
  }

  console.log(
    `[Hunter.io Smart] Starting smart email selection for ${domain} (min confidence: ${minPersonalConfidence}%)`,
  )
  const startTime = Date.now()

  // Validate domain parameter
  const validationResult = HunterioDomainSearchParamsSchema.safeParse({ domain })
  if (!validationResult.success) {
    console.error("[Hunter.io Smart] [ERROR] Invalid domain:", validationResult.error)
    return emptyResult
  }
  const validatedParams = validationResult.data

  try {
    // ====================
    // STEP 1: Try to find C-level personal emails (excluding HR)
    // ====================
    console.log(
      "[Hunter.io Smart] Step 1: Searching for personal executive emails (excluding HR, iterative)",
    )

    const executiveResult = await fetchValidEmailIteratively(
      validatedParams,
      {
        type: "personal",
        seniority: "executive",
      },
      (email) => {
        // Accept if personal type, meets confidence threshold, AND not from HR department
        return (
          email.type === "personal" &&
          email.confidence >= minPersonalConfidence &&
          email.department !== "hr"
        )
      },
    )

    if (executiveResult) {
      const { email: bestExecutive, data: executiveData } = executiveResult
      const elapsed = Date.now() - startTime

      console.log(
        `[Hunter.io Smart] ✓ Selected C-level executive email: ${bestExecutive.value} ` +
          `(confidence: ${bestExecutive.confidence}%, first_name: ${bestExecutive.first_name}, ` +
          `last_name: ${bestExecutive.last_name}, position: ${bestExecutive.position}, ` +
          `department: ${bestExecutive.department}) [${elapsed}ms]`,
      )

      const result: HunterioDomainSearchResult = {
        domain: executiveData.domain,
        organization: executiveData.organization,
        email: bestExecutive.value,
        emailType: "personal",
        genericEmail: bestExecutive.value, // deprecated, kept for backward compatibility
        pattern: executiveData.pattern,
        description: executiveData.description,
        industry: executiveData.industry,
        country: executiveData.country,
        headcount: executiveData.headcount,
        companyType: executiveData.company_type,
      }

      // Cache successful result
      await cache.set(cacheKey, result)

      return result
    }

    console.log(
      `[Hunter.io Smart] No high-confidence non-HR executives found (threshold: ${minPersonalConfidence}%)`,
    )

    // ====================
    // STEP 1.5: Fallback to HR executive if no other executives available
    // ====================
    console.log("[Hunter.io Smart] Step 1.5: Searching for HR executive emails as fallback")

    const hrExecutiveResult = await fetchValidEmailIteratively(
      validatedParams,
      {
        type: "personal",
        seniority: "executive",
      },
      (email) => {
        // Accept HR executives as last resort for personal emails
        return (
          email.type === "personal" &&
          email.confidence >= minPersonalConfidence &&
          email.department === "hr"
        )
      },
    )

    if (hrExecutiveResult) {
      const { email: bestHRExecutive, data: hrExecutiveData } = hrExecutiveResult
      const elapsed = Date.now() - startTime

      console.warn(
        `[Hunter.io Smart] ⚠ Selected HR executive email as fallback: ${bestHRExecutive.value} ` +
          `(confidence: ${bestHRExecutive.confidence}%, first_name: ${bestHRExecutive.first_name}, ` +
          `last_name: ${bestHRExecutive.last_name}, position: ${bestHRExecutive.position}) [${elapsed}ms]`,
      )

      const result: HunterioDomainSearchResult = {
        domain: hrExecutiveData.domain,
        organization: hrExecutiveData.organization,
        email: bestHRExecutive.value,
        emailType: "personal",
        genericEmail: bestHRExecutive.value, // deprecated, kept for backward compatibility
        pattern: hrExecutiveData.pattern,
        description: hrExecutiveData.description,
        industry: hrExecutiveData.industry,
        country: hrExecutiveData.country,
        headcount: hrExecutiveData.headcount,
        companyType: hrExecutiveData.company_type,
      }

      // Cache successful result
      await cache.set(cacheKey, result)

      return result
    }

    console.log(`[Hunter.io Smart] No high-confidence executives found at all`)

    // ====================
    // STEP 2: Fallback to generic company email
    // ====================
    console.log("[Hunter.io Smart] Step 2: Searching for generic company emails (iterative)")

    const genericResult = await fetchValidEmailIteratively(
      validatedParams,
      {
        type: "generic",
      },
      (email) => {
        // Accept if generic, not invalid, and not on free provider
        return (
          email.type === "generic" &&
          !isInvalidEmail(email.value) &&
          !shouldFilterGenericEmail(email.value, "generic")
        )
      },
    )

    if (genericResult) {
      const { email: bestGeneric, data: genericData } = genericResult
      const elapsed = Date.now() - startTime

      console.log(
        `[Hunter.io Smart] ✓ Selected generic email: ${bestGeneric.value} ` +
          `(confidence: ${bestGeneric.confidence}%) [${elapsed}ms]`,
      )

      const result: HunterioDomainSearchResult = {
        domain: genericData.domain,
        organization: genericData.organization,
        email: bestGeneric.value,
        emailType: "generic",
        genericEmail: bestGeneric.value, // deprecated, kept for backward compatibility
        pattern: genericData.pattern,
        description: genericData.description,
        industry: genericData.industry,
        country: genericData.country,
        headcount: genericData.headcount,
        companyType: genericData.company_type,
      }

      // Cache successful result
      await cache.set(cacheKey, result)

      return result
    }

    // ====================
    // STEP 3: Last resort - use any generic email even if on free provider
    // ====================
    console.log("[Hunter.io Smart] Step 3: Last resort - any generic email (iterative)")

    const lastResortResult = await fetchValidEmailIteratively(
      validatedParams,
      {
        type: "generic",
      },
      (email) => {
        // Accept any generic email that's not invalid (even on free providers)
        return email.type === "generic" && !isInvalidEmail(email.value)
      },
    )

    if (lastResortResult) {
      const { email: lastResort, data: genericData } = lastResortResult
      const elapsed = Date.now() - startTime

      console.warn(
        `[Hunter.io Smart] ⚠ Using generic email on free provider as last resort: ${lastResort.value} ` +
          `(confidence: ${lastResort.confidence}%) - no better options available [${elapsed}ms]`,
      )

      const result: HunterioDomainSearchResult = {
        domain: genericData.domain,
        organization: genericData.organization,
        email: lastResort.value,
        emailType: "generic",
        genericEmail: lastResort.value, // deprecated, kept for backward compatibility
        pattern: genericData.pattern,
        description: genericData.description,
        industry: genericData.industry,
        country: genericData.country,
        headcount: genericData.headcount,
        companyType: genericData.company_type,
      }

      // Cache result
      await cache.set(cacheKey, result)

      return result
    }

    // No valid emails found at all
    const elapsed = Date.now() - startTime
    console.log(`[Hunter.io Smart] No valid emails found after exhaustive search [${elapsed}ms]`)
    return emptyResult
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(
      `[Hunter.io Smart] [ERROR] Failed smart selection for ${domain} (${elapsed}ms):`,
      error,
    )
    logger.error({ error, domain }, "Failed smart email selection with Hunter.io")
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
