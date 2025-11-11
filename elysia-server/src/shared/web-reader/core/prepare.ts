import type { WebReaderParams } from "./types"

/**
 * Default viewport configuration
 */
export const DEFAULT_VIEWPORT = {
  width: 390,
  height: 844,
} as const

/**
 * Prepares request body for Jina Reader API
 * Core logic - pure function
 */
export function prepareRequestBody(params: WebReaderParams): {
  url: string
  viewport: { width: number; height: number }
} {
  return {
    url: params.url,
    viewport: {
      width: params.viewport?.width ?? DEFAULT_VIEWPORT.width,
      height: params.viewport?.height ?? DEFAULT_VIEWPORT.height,
    },
  }
}

/**
 * Prepares headers for Jina Reader API request
 * Core logic - pure function
 */
export function prepareRequestHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Engine": "browser",
  }
}
