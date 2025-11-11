import type { Result } from "neverthrow"
import { err, ok } from "neverthrow"
import pRetry from "p-retry"
import { config } from "../../../config"
import { prepareRequestBody, prepareRequestHeaders } from "../core/prepare"
import type { WebReaderError, WebReaderResponse } from "../core/types"
import { validateWebReaderParams } from "../core/validate"
import { webReaderQueue } from "./rate-limit"

/**
 * Configuration for Web Reader (optional overrides)
 */
export interface WebReaderConfig {
  retries?: number
  timeout?: number
}

/**
 * Context for logging
 */
export interface WebReaderContext {
  logger?: {
    error: (msg: string, meta?: unknown) => void
    info: (msg: string, meta?: unknown) => void
  }
}

/**
 * Execute Web Reader with rate limiting and retries
 * Shell layer - orchestrates I/O operations
 */
export async function executeWebReader(
  params: unknown,
  options?: WebReaderConfig,
  context?: WebReaderContext,
): Promise<Result<WebReaderResponse, WebReaderError>> {
  const logger = context?.logger

  // Validate parameters using Zod
  const validationResult = validateWebReaderParams(params)
  if (!validationResult.success) {
    const error: WebReaderError = {
      type: "VALIDATION_ERROR",
      message: "Invalid web reader parameters",
      details: validationResult.error,
    }
    logger?.error("Web Reader validation failed", { error })
    return err(error)
  }

  const validatedParams = validationResult.data

  // Add to rate limit queue
  return webReaderQueue.add(async () => {
    logger?.info("Starting Web Reader", { url: validatedParams.url })

    try {
      // Prepare request using core logic (use centralized config with optional overrides)
      const apiKey = config.apis.jina.apiKey
      const baseUrl = "https://r.jina.ai/"
      const retries = options?.retries ?? 3
      const timeout = options?.timeout

      const body = prepareRequestBody(validatedParams)
      const headers = prepareRequestHeaders(apiKey)

      // Execute with retry logic
      const response = await pRetry(
        async () => {
          const controller = new AbortController()
          const timeoutId = timeout ? setTimeout(() => controller.abort(), timeout) : undefined

          try {
            const res = await fetch(baseUrl, {
              method: "POST",
              headers,
              body: JSON.stringify(body),
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
                const error: WebReaderError = {
                  type: "RATE_LIMIT_ERROR",
                  message: `Rate limit exceeded: ${errorBody}`,
                  retryAfter: retryAfter ? Number.parseInt(retryAfter, 10) : undefined,
                }
                throw error
              }

              const error: WebReaderError = {
                type: "HTTP_ERROR",
                status: res.status,
                message: `Jina Reader failed with status ${res.status}. Error: ${errorBody}`,
              }
              throw error
            }

            const text = await res.text()
            return text
          } catch (error) {
            if (timeoutId) {
              clearTimeout(timeoutId)
            }

            if (error instanceof Error && error.name === "AbortError") {
              const timeoutError: WebReaderError = {
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
              `Web Reader Attempt ${context.attemptNumber} failed for URL '${validatedParams.url}'`,
              {
                error: String(context.error),
                retriesLeft: context.retriesLeft,
              },
            )
          },
        },
      )

      logger?.info("Web Reader completed successfully", {
        url: validatedParams.url,
        contentLength: response.length,
      })
      return ok(response)
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
        logger?.error("Web Reader failed", { error })
        return err(error as WebReaderError)
      }

      // Handle network errors
      if (error instanceof TypeError && error.message.includes("fetch")) {
        logger?.error("Web Reader network error", { error })
        return err({
          type: "NETWORK_ERROR",
          message: `Network error: ${error.message}`,
        })
      }

      // Unknown error
      logger?.error("Web Reader unknown error", { error })
      return err({
        type: "UNKNOWN_ERROR",
        message: error instanceof Error ? error.message : "Unknown error occurred",
        cause: error,
      })
    }
  })
}
