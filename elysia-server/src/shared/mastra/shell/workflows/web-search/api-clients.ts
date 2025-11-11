import { executeGoogleSearch } from "../../../../google-search"
import type { GoogleSearchResult } from "./types"

/**
 * Google Search API client
 * Shell layer - handles external API call
 * Uses shared google-search slice
 */
export async function googleSearch(params: {
  query: string
  location?: string
  language?: string
  page?: number
  hasdataApiKey?: string // Not used anymore, keeping for backward compatibility
}): Promise<GoogleSearchResult[]> {
  console.log(`[Google Search API] Calling: ?q=${params.query}...`)

  const result = await executeGoogleSearch(
    {
      query: params.query,
      location: params.location,
      language: params.language,
      page: params.page,
    },
    {
      retries: 5,
    },
    {
      logger: console,
    },
  )

  if (result.isErr()) {
    const error = result.error
    console.error(`[Google Search API] ${error.type}: ${error.message}`)
    throw new Error(`${error.type}: ${error.message}`)
  }

  // Return only organic results
  return result.value.organicResults as unknown as GoogleSearchResult[]
}

import { executeWebReader } from "../../../../web-reader"

/**
 * Jina Reader API client
 * Shell layer - reads webpage content
 * Uses shared web-reader slice
 */
export async function jinaReader(params: {
  url: string
  jinaApiKey?: string // Not used anymore, keeping for backward compatibility
}): Promise<string> {
  const result = await executeWebReader({ url: params.url }, undefined, { logger: console })

  if (result.isErr()) {
    const error = result.error
    throw new Error(`${error.type}: ${error.message}`)
  }

  return result.value
}
