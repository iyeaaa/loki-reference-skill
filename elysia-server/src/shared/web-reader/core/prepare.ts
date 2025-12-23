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
 * Jina Reader API 추가 옵션
 */
export interface JinaReaderOptions {
  /** Jina 서버측 타임아웃 (밀리초) - 기본: 30000 (30초) */
  timeout?: number
  /** CSS 셀렉터가 나타날 때까지 대기 - 예: "#main, .content" */
  waitForSelector?: string
  /** iframe 콘텐츠 포함 여부 - 기본: false */
  withIframe?: boolean
  /** 캐시 사용 안함 (최신 콘텐츠) - 기본: false */
  noCache?: boolean
  /** 특정 요소만 추출 - CSS 셀렉터 */
  targetSelector?: string
  /** 제거할 요소 - CSS 셀렉터 (광고, 팝업 등) */
  removeSelector?: string
}

/**
 * Prepares headers for Jina Reader API request
 * Core logic - pure function
 */
export function prepareRequestHeaders(
  apiKey: string,
  options?: JinaReaderOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Engine": "browser",
  }

  // 추가 옵션들
  if (options?.timeout) {
    headers["X-Timeout"] = options.timeout.toString()
  }

  if (options?.waitForSelector) {
    headers["X-Wait-For-Selector"] = options.waitForSelector
  }

  if (options?.withIframe) {
    headers["X-With-Iframe"] = "true"
  }

  if (options?.noCache) {
    headers["X-No-Cache"] = "true"
  }

  if (options?.targetSelector) {
    headers["X-Target-Selector"] = options.targetSelector
  }

  if (options?.removeSelector) {
    headers["X-Remove-Selector"] = options.removeSelector
  }

  return headers
}
