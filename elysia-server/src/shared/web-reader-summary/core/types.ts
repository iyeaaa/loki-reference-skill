import { z } from "zod"

/**
 * Input parameters for Web Reader Summary
 */
export const WebReaderSummaryParamsSchema = z.object({
  url: z.string().url().describe("URL to fetch and summarize"),
  query: z.string().min(1).describe("Query or question to answer about the content"),
})

export type WebReaderSummaryParams = z.infer<typeof WebReaderSummaryParamsSchema>

/**
 * Successful response from Web Reader Summary
 */
export type WebReaderSummaryResponse = string

/**
 * Error types for Web Reader Summary
 */
export type WebReaderSummaryError =
  | {
      type: "VALIDATION_ERROR"
      message: string
      details: unknown
    }
  | {
      type: "WEB_READER_ERROR"
      message: string
      cause?: unknown
    }
  | {
      type: "LLM_ERROR"
      message: string
      cause?: unknown
    }
  | {
      type: "UNKNOWN_ERROR"
      message: string
      cause?: unknown
    }
