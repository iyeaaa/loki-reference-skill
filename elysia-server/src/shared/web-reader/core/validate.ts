import { WebReaderParamsSchema } from "./types"

/**
 * Validates Web Reader parameters using Zod
 * Core validation - pure function
 */
export function validateWebReaderParams(params: unknown) {
  return WebReaderParamsSchema.safeParse(params)
}
