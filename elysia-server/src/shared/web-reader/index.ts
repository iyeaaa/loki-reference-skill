/**
 * Web Reader shared slice
 * Provides resilient web content reading functionality with rate limiting
 * Uses Jina Reader API to extract clean content from web pages
 */

export { DEFAULT_VIEWPORT, prepareRequestBody, prepareRequestHeaders } from "./core/prepare"
// Export types
export type { WebReaderError, WebReaderParams, WebReaderResponse } from "./core/types"
export { WebReaderParamsSchema } from "./core/types"
// Export core functions (for testing)
export { validateWebReaderParams } from "./core/validate"
export type { WebReaderConfig, WebReaderContext } from "./shell/execute"
// Export shell functions (main API)
export { executeWebReader } from "./shell/execute"
export { getQueueStats, webReaderQueue } from "./shell/rate-limit"
