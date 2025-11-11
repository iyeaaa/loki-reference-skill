import pRetry from "p-retry"
import { z } from "zod"
import type { GoogleSearchResult } from "./types"
import { GoogleSearchResultSchema } from "./types"

/**
 * Google Search API client
 * Shell layer - handles external API call
 */
export async function googleSearch(params: {
  query: string
  location?: string
  language?: string
  page?: number
  hasdataApiKey: string
}): Promise<GoogleSearchResult[]> {
  const url = new URL("https://api.hasdata.com/scrape/google-light/serp")
  url.searchParams.append("q", params.query)

  if (params.location) {
    url.searchParams.append("location", params.location)
  }
  // Language parameter removed - causes validation issues with API
  // if (params.language) {
  //   const formattedLang = formatLanguageCode(params.language)
  //   url.searchParams.append("lr[]", formattedLang)
  // }
  if (params.page && params.page > 1) {
    url.searchParams.append("page", params.page.toString())
  }

  url.searchParams.append("num", "100")

  console.log(`[Google Search API] Calling: ${url.toString().split("?")[0]}?q=${params.query}...`)

  const response = await pRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": params.hasdataApiKey,
        },
      })

      if (!res.ok) {
        const errorBody = await res.text()
        console.error(`[Google Search API] HTTP ${res.status}: ${errorBody}`)
        throw new Error(`HTTP ${res.status}: ${errorBody}`)
      }

      const data = await res.json()
      return data
    },
    {
      retries: 5,
      minTimeout: 2000,
      maxTimeout: 10000,
      onFailedAttempt: (error) => {
        console.error(
          `Google Search Attempt ${error.attemptNumber} failed for query '${params.query}'. Retries left: ${error.retriesLeft}. Error: ${error.message}`,
        )
      },
    },
  )

  // Validate the full API response structure
  const GoogleSearchAPIResponseSchema = z.object({
    requestMetadata: z.object({
      id: z.string(),
      status: z.string(),
      html: z.string(),
      url: z.string(),
    }),
    organicResults: z.array(GoogleSearchResultSchema),
    relatedSearches: z.array(z.object({ query: z.string(), link: z.string() })),
  })

  const validatedResponse = GoogleSearchAPIResponseSchema.parse(response)

  // Return only organic results
  return validatedResponse.organicResults
}

/**
 * Jina Reader API client
 * Shell layer - reads webpage content
 */
export async function jinaReader(params: { url: string; jinaApiKey: string }): Promise<string> {
  const url = "https://r.jina.ai/"

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.jinaApiKey}`,
      "Content-Type": "application/json",
      "X-Engine": "browser",
    },
    body: JSON.stringify({
      url: params.url,
      viewport: {
        width: 390,
        height: 844,
      },
    }),
  }

  const response = await pRetry(
    async () => {
      const response = await fetch(url, options)
      if (!response.ok) {
        throw new Error(
          `Jina Reader failed with status ${response.status}. Error: ${response.statusText}`,
        )
      }
      return await response.text()
    },
    {
      onFailedAttempt: (err) => {
        console.error(
          `Jina Reader Attempt ${err.attemptNumber} failed. There are ${err.retriesLeft} retries left.`,
        )
      },
    },
  )

  return response
}
