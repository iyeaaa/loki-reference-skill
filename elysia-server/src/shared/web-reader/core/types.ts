import { z } from "zod"

/**
 * Web Reader parameter schema
 * Core types - pure type definitions
 */
export const WebReaderParamsSchema = z
  .object({
    url: z
      .string()
      .url("Invalid URL format")
      .refine(
        (url) => {
          const parsed = new URL(url)
          return ["http:", "https:"].includes(parsed.protocol)
        },
        { message: "URL must use HTTP or HTTPS protocol" },
      )
      .describe("The URL to read and extract content from."),
    viewport: z
      .object({
        width: z
          .number()
          .int()
          .min(1, "Viewport width must be at least 1")
          .max(10000, "Viewport width must be at most 10000")
          .optional()
          .describe("Viewport width in pixels"),
        height: z
          .number()
          .int()
          .min(1, "Viewport height must be at least 1")
          .max(10000, "Viewport height must be at most 10000")
          .optional()
          .describe("Viewport height in pixels"),
      })
      .optional()
      .describe("Optional viewport configuration for rendering"),
  })
  .describe("Web Reader parameters")

export type WebReaderParams = z.infer<typeof WebReaderParamsSchema>

/**
 * Web Reader response type
 */
export type WebReaderResponse = string

/**
 * Web Reader error types
 */
export type WebReaderError =
  | { type: "VALIDATION_ERROR"; message: string; details?: unknown }
  | { type: "HTTP_ERROR"; status: number; message: string }
  | { type: "NETWORK_ERROR"; message: string }
  | { type: "RATE_LIMIT_ERROR"; message: string; retryAfter?: number }
  | { type: "TIMEOUT_ERROR"; message: string }
  | { type: "INVALID_URL_ERROR"; message: string; url: string }
  | { type: "UNKNOWN_ERROR"; message: string; cause?: unknown }
