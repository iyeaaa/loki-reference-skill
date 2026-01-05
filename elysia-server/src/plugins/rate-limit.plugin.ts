import { Elysia } from "elysia"
import { config } from "../config"

/**
 * Simple in-memory rate limiter
 * For production, consider using Redis-based rate limiting
 */
class RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map()

  constructor(
    private max: number,
    private windowMs: number,
  ) {
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const now = Date.now()
    const record = this.requests.get(identifier)

    if (!record || now > record.resetTime) {
      // New window or expired window
      const resetTime = now + this.windowMs
      this.requests.set(identifier, { count: 1, resetTime })
      return { allowed: true, remaining: this.max - 1, resetTime }
    }

    if (record.count >= this.max) {
      // Rate limit exceeded
      return { allowed: false, remaining: 0, resetTime: record.resetTime }
    }

    // Increment count
    record.count++
    return { allowed: true, remaining: this.max - record.count, resetTime: record.resetTime }
  }

  private cleanup() {
    const now = Date.now()
    for (const [key, value] of this.requests.entries()) {
      if (now > value.resetTime) {
        this.requests.delete(key)
      }
    }
  }

  reset(identifier: string) {
    this.requests.delete(identifier)
  }

  getStats() {
    return {
      totalKeys: this.requests.size,
      maxRequests: this.max,
      windowMs: this.windowMs,
    }
  }
}

// Create rate limiter instance
const limiter = new RateLimiter(config.rateLimit.max, config.rateLimit.windowMs)

// Create AI API rate limiter (10 requests per minute to prevent abuse)
const aiApiLimiter = new RateLimiter(10, 60 * 1000)

/**
 * Rate limiting plugin
 * Limits requests based on IP address or user ID
 */
export const rateLimit = new Elysia({ name: "rate-limit" })
  .derive(({ headers }) => {
    // Extract identifier (IP address or forwarded IP)
    const identifier =
      (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (headers["x-real-ip"] as string) ||
      "unknown"

    return { rateLimitIdentifier: identifier }
  })
  .onBeforeHandle(({ rateLimitIdentifier, set, path }) => {
    // Skip rate limiting for health checks
    if (path.includes("/health")) {
      return
    }

    const result = limiter.check(rateLimitIdentifier)

    // Add rate limit headers
    set.headers["x-ratelimit-limit"] = config.rateLimit.max.toString()
    set.headers["x-ratelimit-remaining"] = result.remaining.toString()
    set.headers["x-ratelimit-reset"] = new Date(result.resetTime).toISOString()

    if (!result.allowed) {
      set.status = 429
      return {
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }
    }
  })

/**
 * Stricter rate limiting for authentication endpoints
 */
export const strictRateLimit = new Elysia({ name: "strict-rate-limit" })
  .derive(({ headers }) => {
    const identifier =
      (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (headers["x-real-ip"] as string) ||
      "unknown"
    return { rateLimitIdentifier: identifier }
  })
  .onBeforeHandle(({ rateLimitIdentifier, set }) => {
    // Stricter limits: 10 requests per 15 minutes for auth endpoints
    const authLimiter = new RateLimiter(10, 15 * 60 * 1000)
    const result = authLimiter.check(rateLimitIdentifier)

    set.headers["x-ratelimit-limit"] = "10"
    set.headers["x-ratelimit-remaining"] = result.remaining.toString()
    set.headers["x-ratelimit-reset"] = new Date(result.resetTime).toISOString()

    if (!result.allowed) {
      set.status = 429
      return {
        error: "Too Many Requests",
        message: "Too many authentication attempts. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }
    }
  })

/**
 * AI API rate limiting for expensive operations
 * Limits to 10 requests per minute
 */
export const aiApiRateLimit = new Elysia({ name: "ai-api-rate-limit" })
  .derive(({ headers }) => {
    const identifier =
      (headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (headers["x-real-ip"] as string) ||
      "unknown"
    return { rateLimitIdentifier: identifier }
  })
  .onBeforeHandle(({ rateLimitIdentifier, set }) => {
    const result = aiApiLimiter.check(rateLimitIdentifier)

    set.headers["x-ratelimit-limit"] = "10"
    set.headers["x-ratelimit-remaining"] = result.remaining.toString()
    set.headers["x-ratelimit-reset"] = new Date(result.resetTime).toISOString()

    if (!result.allowed) {
      set.status = 429
      return {
        error: "Too Many Requests",
        message: "AI API rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
      }
    }
  })

// Export limiter for testing/monitoring
export { limiter, aiApiLimiter }
