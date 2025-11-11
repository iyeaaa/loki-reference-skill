import { GoogleSearchParamsSchema } from "./types"

/**
 * Validates Google Search parameters using Zod
 * Core validation - pure function
 */
export function validateSearchParams(params: unknown) {
  return GoogleSearchParamsSchema.safeParse(params)
}
