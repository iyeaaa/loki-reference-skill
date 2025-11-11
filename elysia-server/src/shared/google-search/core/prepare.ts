import type { GoogleSearchParams } from "./types"

/**
 * Prepares URL for Google Search API
 * Core logic - pure function
 */
export function prepareSearchUrl(params: GoogleSearchParams, baseUrl: string): URL {
  const url = new URL(baseUrl)
  url.searchParams.append("q", params.query)

  if (params.location) {
    url.searchParams.append("location", params.location)
  }
  // Language parameter temporarily disabled - causes API errors
  // if (params.language) {
  //   url.searchParams.append("lr", params.language)
  // }
  if (params.page && params.page > 1) {
    url.searchParams.append("page", params.page.toString())
  }

  return url
}

/**
 * Prepares headers for Google Search API request
 * Core logic - pure function
 */
export function prepareSearchHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  }
}
