import PQueue from "p-queue"
import { z } from "zod"
import { config } from "../config"
import logger from "../utils/logger"
import { hashString, RedisCache } from "./redis-cache.service"

// ==================== ZOD SCHEMAS ====================

/**
 * Email verification status enum
 */
const EmailStatusEnum = z.enum([
  "valid",
  "invalid",
  "accept_all",
  "webmail",
  "disposable",
  "unknown",
])

/**
 * Email verification result enum (deprecated, use status)
 */
const EmailResultEnum = z.enum(["deliverable", "undeliverable", "risky"])

/**
 * Source where the email was found
 */
const EmailSourceSchema = z.object({
  domain: z.string(),
  uri: z.string(),
  extracted_on: z.string(),
  last_seen_on: z.string(),
  still_on_page: z.boolean(),
})

/**
 * Hunter.io Email Verifier API response schema
 */
export const EmailVerifierResponseSchema = z.object({
  data: z.object({
    status: EmailStatusEnum,
    result: EmailResultEnum.optional(),
    score: z.number(),
    email: z.string(),
    regexp: z.boolean(),
    gibberish: z.boolean(),
    disposable: z.boolean(),
    webmail: z.boolean(),
    mx_records: z.boolean(),
    smtp_server: z.boolean(),
    smtp_check: z.boolean(),
    accept_all: z.boolean(),
    block: z.boolean(),
    sources: z.array(EmailSourceSchema).optional(),
  }),
  meta: z.object({
    params: z.object({
      email: z.string(),
    }),
  }),
})

export type EmailVerifierResponse = z.infer<typeof EmailVerifierResponseSchema>

/**
 * Simplified email verification result
 */
export interface EmailVerificationResult {
  email: string
  status: z.infer<typeof EmailStatusEnum>
  result?: "deliverable" | "undeliverable" | "risky"
  score: number
  isValid: boolean
  isDeliverable: boolean
  checks: {
    regexp: boolean
    gibberish: boolean
    disposable: boolean
    webmail: boolean
    mxRecords: boolean
    smtpServer: boolean
    smtpCheck: boolean
    acceptAll: boolean
    block: boolean
  }
  sources?: Array<{
    domain: string
    uri: string
    extractedOn: string
    lastSeenOn: string
    stillOnPage: boolean
  }>
}

/**
 * Batch verification result
 */
export interface BatchVerificationResult {
  results: EmailVerificationResult[]
  summary: {
    total: number
    valid: number
    invalid: number
    unknown: number
    cached: number
  }
}

// ==================== CACHE INITIALIZATION ====================

const cache = RedisCache.fromConfig(config.cache.emailVerification)

// ==================== RATE LIMITING SETUP ====================

/**
 * Two-tier rate limiting for Hunter.io Email Verifier API:
 * - Primary queue: 300 requests per minute
 * - Secondary queue: 10 requests per second
 */

// Tier 1: Limit to 300 requests per minute
const minuteQueue = new PQueue({
  intervalCap: 300,
  interval: 60000, // 60 seconds
  carryoverConcurrencyCount: true,
})

// Tier 2: Limit to 10 requests per second
const secondQueue = new PQueue({
  intervalCap: 10,
  interval: 1000, // 1 second
  carryoverConcurrencyCount: true,
})

/**
 * Execute a function with dual rate limiting
 */
async function executeWithDualRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  return minuteQueue.add(() => secondQueue.add(fn))
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Generate cache key from email address
 */
function generateCacheKey(email: string): string {
  const normalizedEmail = email.toLowerCase().trim()
  const hash = hashString(normalizedEmail)
  return `hunter_email_verify:${hash}`
}

/**
 * Sleep helper for polling
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Transform API response to simplified result
 */
function transformResponse(data: EmailVerifierResponse["data"]): EmailVerificationResult {
  return {
    email: data.email,
    status: data.status,
    result: data.result,
    score: data.score,
    isValid: data.status === "valid",
    isDeliverable: data.status === "valid" || data.status === "accept_all",
    checks: {
      regexp: data.regexp,
      gibberish: data.gibberish,
      disposable: data.disposable,
      webmail: data.webmail,
      mxRecords: data.mx_records,
      smtpServer: data.smtp_server,
      smtpCheck: data.smtp_check,
      acceptAll: data.accept_all,
      block: data.block,
    },
    sources: data.sources?.map((source) => ({
      domain: source.domain,
      uri: source.uri,
      extractedOn: source.extracted_on,
      lastSeenOn: source.last_seen_on,
      stillOnPage: source.still_on_page,
    })),
  }
}

// ==================== MAIN SERVICE FUNCTIONS ====================

/**
 * Verify a single email address using Hunter.io Email Verifier API
 *
 * @param email - The email address to verify
 * @returns Verification result or null on error
 *
 * Features:
 * - Redis caching with 7-day TTL
 * - Dual rate limiting (10/sec AND 300/min)
 * - Automatic polling for 202 responses
 * - Zod validation for response
 * - Graceful error handling
 *
 * @example
 * ```typescript
 * const result = await verifyEmail("patrick@stripe.com")
 * if (result?.isValid) {
 *   console.log("Email is valid with score:", result.score)
 * }
 * ```
 */
export async function verifyEmail(email: string): Promise<EmailVerificationResult | null> {
  // 1. Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    console.error(`[Hunter.io Verifier] ❌ Invalid email format: ${email}`)
    return null
  }

  const normalizedEmail = email.toLowerCase().trim()

  // 2. Check cache
  const cacheKey = generateCacheKey(normalizedEmail)
  const cached = await cache.get<EmailVerificationResult>(cacheKey)
  if (cached) {
    console.log(`[Hunter.io Verifier] ✅ Cache hit for ${normalizedEmail}`)
    return cached
  }

  console.log(`[Hunter.io Verifier] Starting verification for: ${normalizedEmail}`)
  const startTime = Date.now()

  try {
    // 3. Execute API call with rate limiting and polling
    const response = await executeWithDualRateLimit(async () => {
      const maxPollingAttempts = 5
      const pollingDelay = 2000 // 2 seconds

      for (let attempt = 1; attempt <= maxPollingAttempts; attempt++) {
        const url = new URL("https://api.hunter.io/v2/email-verifier")
        url.searchParams.set("email", normalizedEmail)
        url.searchParams.set("api_key", config.hunter.apiKey)

        const res = await fetch(url.toString(), { method: "GET" })

        // Handle polling for 202 status
        if (res.status === 202) {
          console.log(
            `[Hunter.io Verifier] ⏳ Verification in progress (attempt ${attempt}/${maxPollingAttempts})`,
          )
          if (attempt < maxPollingAttempts) {
            await sleep(pollingDelay)
            continue
          }
          throw new Error("Verification timeout - exceeded max polling attempts")
        }

        // Handle specific error codes
        if (res.status === 222) {
          throw new Error("SMTP server returned unexpected response - retry later")
        }

        if (res.status === 451) {
          throw new Error("Email address has been claimed - cannot process")
        }

        if (!res.ok) {
          const errorText = await res.text()
          throw new Error(`Hunter.io API error (${res.status}): ${errorText}`)
        }

        return res.json()
      }

      throw new Error("Max polling attempts exceeded")
    })

    // 4. Validate response schema
    const parsedResponse = EmailVerifierResponseSchema.safeParse(response)
    if (!parsedResponse.success) {
      console.error("[Hunter.io Verifier] ❌ Invalid API response:", parsedResponse.error)
      logger.error({ error: parsedResponse.error }, "Hunter.io Verifier response validation failed")
      return null
    }

    // 5. Transform to simplified format
    const result = transformResponse(parsedResponse.data.data)

    const elapsed = Date.now() - startTime
    console.log(
      `[Hunter.io Verifier] ✅ Verified ${normalizedEmail}: ${result.status} (score: ${result.score}) (${elapsed}ms)`,
    )

    // 6. Cache successful results
    await cache.set(cacheKey, result)

    return result
  } catch (error) {
    const elapsed = Date.now() - startTime
    console.error(
      `[Hunter.io Verifier] ❌ Failed to verify ${normalizedEmail} (${elapsed}ms):`,
      error,
    )
    logger.error({ error, email: normalizedEmail }, "Failed to verify email with Hunter.io")
    return null
  }
}

/**
 * Verify multiple email addresses in batch
 *
 * @param emails - Array of email addresses to verify
 * @param options - Batch options
 * @returns Batch verification results with summary
 *
 * @example
 * ```typescript
 * const { results, summary } = await verifyEmailBatch([
 *   "patrick@stripe.com",
 *   "john@example.com",
 *   "invalid-email"
 * ])
 *
 * console.log(`Valid: ${summary.valid}/${summary.total}`)
 * ```
 */
export async function verifyEmailBatch(
  emails: string[],
  options: {
    concurrency?: number
    continueOnError?: boolean
  } = {},
): Promise<BatchVerificationResult> {
  const { concurrency = 5, continueOnError = true } = options

  console.log(`[Hunter.io Verifier] Starting batch verification for ${emails.length} emails`)
  const startTime = Date.now()

  const results: EmailVerificationResult[] = []
  let cachedCount = 0

  // Create a queue for batch processing with concurrency limit
  const batchQueue = new PQueue({ concurrency })

  const tasks = emails.map((email) =>
    batchQueue.add(async () => {
      // Check cache first to count cached results
      const cacheKey = generateCacheKey(email.toLowerCase().trim())
      const cached = await cache.get<EmailVerificationResult>(cacheKey)
      if (cached) {
        cachedCount++
      }

      const result = await verifyEmail(email)
      if (result) {
        results.push(result)
      } else if (!continueOnError) {
        throw new Error(`Failed to verify email: ${email}`)
      }
    }),
  )

  await Promise.all(tasks)

  // Calculate summary
  const summary = {
    total: emails.length,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    unknown: results.filter((r) => r.status === "unknown").length,
    cached: cachedCount,
  }

  const elapsed = Date.now() - startTime
  console.log(
    `[Hunter.io Verifier] ✅ Batch verification completed: ${summary.valid}/${summary.total} valid (${elapsed}ms)`,
  )

  return { results, summary }
}

/**
 * Check if an email is likely deliverable (quick check)
 * Returns true for valid and accept_all statuses
 */
export async function isEmailDeliverable(email: string): Promise<boolean> {
  const result = await verifyEmail(email)
  return result?.isDeliverable ?? false
}

// ==================== QUEUE STATISTICS ====================

/**
 * Get current queue statistics for monitoring
 */
export function getVerifierQueueStats() {
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
