import type { Result } from "neverthrow"
import { err, ok } from "neverthrow"
import pRetry from "p-retry"
import { config } from "../../../config"
import { prepareSearchHeaders, prepareSearchUrl } from "../core/prepare"
import type { GoogleSearchError, GoogleSearchResponse } from "../core/types"
import { GoogleSearchResponseSchema } from "../core/types"
import { validateSearchParams } from "../core/validate"
import { googleSearchQueue } from "./rate-limit"

/**
 * Configuration for Google Search (optional overrides)
 */
export interface GoogleSearchConfig {
  retries?: number
  timeout?: number
}

/**
 * Context for logging
 */
export interface GoogleSearchContext {
  logger?: {
    error: (msg: string, meta?: unknown) => void
    info: (msg: string, meta?: unknown) => void
  }
}

/**
 * Execute Google Search with rate limiting and retries
 * Shell layer - orchestrates I/O operations
 */
export async function executeGoogleSearch(
  params: unknown,
  options?: GoogleSearchConfig,
  context?: GoogleSearchContext,
): Promise<Result<GoogleSearchResponse, GoogleSearchError>> {
  const logger = context?.logger

  // Validate parameters using Zod
  const validationResult = validateSearchParams(params)
  if (!validationResult.success) {
    const error: GoogleSearchError = {
      type: "VALIDATION_ERROR",
      message: "Invalid search parameters",
      details: validationResult.error,
    }
    logger?.error("Google Search validation failed", { error })
    return err(error)
  }

  const validatedParams = validationResult.data

  // Add to rate limit queue
  return googleSearchQueue.add(async () => {
    logger?.info("Starting Google Search", { query: validatedParams.query })

    try {
      // Prepare request using core logic (use centralized config with optional overrides)
      const apiKey = config.apis.hasdata.apiKey
      const baseUrl = "https://api.hasdata.com/scrape/google-light/serp"
      const retries = options?.retries ?? 3
      const timeout = options?.timeout

      const url = prepareSearchUrl(validatedParams, baseUrl)
      const headers = prepareSearchHeaders(apiKey)

      // Execute with retry logic
      const response = await pRetry(
        async () => {
          const controller = new AbortController()
          const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined

          try {
            const res = await fetch(url.toString(), {
              method: "GET",
              headers,
              signal: controller.signal,
            })

            if (timeoutId) {
              clearTimeout(timeoutId)
            }

            if (!res.ok) {
              const errorBody = await res.text()

              // Check for rate limit
              if (res.status === 429) {
                const retryAfter = res.headers.get("Retry-After")
                const error: GoogleSearchError = {
                  type: "RATE_LIMIT_ERROR",
                  message: `Rate limit exceeded: ${errorBody}`,
                  retryAfter: retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
                }
                throw error
              }

              const error: GoogleSearchError = {
                type: "HTTP_ERROR",
                status: res.status,
                message: `HTTP error! Status: ${res.status}. Body: ${errorBody}`,
              }
              throw error
            }

            const data = await res.json()
            return data
          } catch (error) {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }

            if (error instanceof Error && error.name === "AbortError") {
              const timeoutError: GoogleSearchError = {
                type: "TIMEOUT_ERROR",
                message: `Request timeout after ${timeout}ms`,
              }
              throw timeoutError
            }

            throw error
          }
        },
        {
          retries,
          onFailedAttempt: (context) => {
            logger?.error(
              `Google Search Attempt ${context.attemptNumber} failed for query '${validatedParams.query}'`,
              {
                error: String(context.error),
                retriesLeft: context.retriesLeft,
              },
            )
          },
        },
      )

      // Validate response schema
      try {
        const validatedResponse = GoogleSearchResponseSchema.parse(response)
        logger?.info("Google Search completed successfully", {
          query: validatedParams.query,
          resultsCount: validatedResponse.organicResults.length,
        })
        return ok(validatedResponse)
      } catch (parseError) {
        logger?.error("Google Search response validation failed", {
          error: parseError,
          rawResponse: response,
        })
        return err({
          type: "VALIDATION_ERROR",
          message: "Invalid response format from API",
          details: parseError,
        })
      }
    } catch (error) {
      // Handle known error types
      if (
        error &&
        typeof error === "object" &&
        "type" in error &&
        (error.type === "RATE_LIMIT_ERROR" ||
          error.type === "HTTP_ERROR" ||
          error.type === "TIMEOUT_ERROR")
      ) {
        logger?.error("Google Search failed", { error })
        return err(error as GoogleSearchError)
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        logger?.error("Google Search network error", { error })
        return err({
          type: "NETWORK_ERROR",
          message: `Network error: ${error.message}`,
        })
      }

      // Unknown error
      logger?.error("Google Search unknown error", { error })
      return err({
        type: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        cause: error,
      })
    }
  })
}
