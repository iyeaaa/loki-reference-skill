import { z } from "zod"

/**
 * Google Search parameter schema
 * Core types - pure type definitions
 */
export const GoogleSearchParamsSchema = z
  .object({
    query: z.string().min(1, "Search query cannot be empty").describe("The search query."),
    location: z
      .string()
      .optional()
      .describe('The location for the search, e.g., "Austin,Texas,United States".'),
    language: z.string().optional().describe('Language restriction, e.g., "en" for English.'),
    page: z
      .number()
      .int()
      .positive()
      .max(100, "Page number too large (max 100)")
      .optional()
      .describe("Page number for search results pagination."),
  })
  .describe("Google Search parameters")

export type GoogleSearchParams = z.infer<typeof GoogleSearchParamsSchema>

/**
 * Google Search response schema
 */
export const GoogleSearchResponseSchema = z.object({
  requestMetadata: z.object({
    id: z.string(),
    status: z.string(),
    html: z.string(),
    url: z.string(),
  }),
  organicResults: z
    .array(
      z.object({
        position: z.number(),
        title: z.string(),
        link: z.string(),
        displayedLink: z.string(),
        snippet: z.string().optional(),
        sitelinks: z.array(z.object({ title: z.string(), link: z.string() })).optional(),
        date: z.string().optional(),
      }),
    )
    .default([]),
  relatedSearches: z.array(z.object({ query: z.string(), link: z.string() })).default([]),
})

export type GoogleSearchResponse = z.infer<typeof GoogleSearchResponseSchema>

/**
 * Google Search error types
 */
export type GoogleSearchError =
  | { type: "VALIDATION_ERROR"; message: string; details?: unknown }
  | { type: "HTTP_ERROR"; status: number; message: string }
  | { type: "NETWORK_ERROR"; message: string }
  | { type: "RATE_LIMIT_ERROR"; message: string; retryAfter?: number }
  | { type: "TIMEOUT_ERROR"; message: string }
  | { type: "UNKNOWN_ERROR"; message: string; cause?: unknown }
