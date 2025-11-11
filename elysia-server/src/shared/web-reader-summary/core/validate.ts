import { WebReaderSummaryParamsSchema } from "./types"

/**
 * Validate Web Reader Summary parameters
 * Pure function - Core layer
 *
 * @param params - Raw input parameters to validate
 * @returns Zod SafeParseReturnType with validated data or errors
 */
export function validateWebReaderSummaryParams(params: unknown) {
  return WebReaderSummaryParamsSchema.safeParse(params)
}
