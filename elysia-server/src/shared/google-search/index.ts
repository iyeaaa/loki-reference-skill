/**
 * Google Search shared slice
 * Provides resilient Google Search functionality with rate limiting
 */

export { prepareSearchHeaders, prepareSearchUrl } from "./core/prepare"
// Export types
export type {
  GoogleSearchError,
  GoogleSearchParams,
  GoogleSearchResponse,
} from "./core/types"
export { GoogleSearchParamsSchema, GoogleSearchResponseSchema } from "./core/types"
// Export core functions (for testing)
export { validateSearchParams } from "./core/validate"
export type { GoogleSearchConfig, GoogleSearchContext } from "./shell/execute"
// Export shell functions (main API)
export { executeGoogleSearch } from "./shell/execute"
export { getQueueStats, googleSearchQueue } from "./shell/rate-limit"
