/**
 * Web Reader Summary - Shared Slice
 * Fetches web content and uses LLM to answer queries about it
 */

export { prepareLLMPrompt, truncateContent } from "./core/prepare"
// Core exports (pure types and functions)
export type {
  WebReaderSummaryError,
  WebReaderSummaryParams,
  WebReaderSummaryResponse,
} from "./core/types"
export { WebReaderSummaryParamsSchema } from "./core/types"
export { validateWebReaderSummaryParams } from "./core/validate"
export type {
  WebReaderSummaryConfig,
  WebReaderSummaryContext,
} from "./shell/execute"
// Shell exports (I/O operations)
export { executeWebReaderSummary } from "./shell/execute"
