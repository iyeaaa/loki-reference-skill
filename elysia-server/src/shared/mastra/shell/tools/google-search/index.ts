import { createTool } from "@mastra/core"
import pRetry from "p-retry"
import { z } from "zod"
import { mastraConfig } from "../../config"

export const GoogleSearchParamsSchema = z
  .object({
    query: z.string().describe("The search query."),
    location: z
      .string()
      .optional()
      .describe('The location for the search, e.g., "Austin,Texas,United States".'),
    language: z.string().optional().describe('Language restriction, e.g., "en" for English.'),
    page: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Page number for search results pagination."),
  })
  .describe("Google Search parameters")

export type GoogleSearchParams = z.infer<typeof GoogleSearchParamsSchema>

export const GoogleSearchResponseSchema = z.object({
  requestMetadata: z.object({
    id: z.string(),
    status: z.string(),
    html: z.string(),
    url: z.string(),
  }),
  organicResults: z.array(
    z.object({
      position: z.number(),
      title: z.string(),
      link: z.string(),
      displayedLink: z.string(),
      snippet: z.string().optional(),
      sitelinks: z.array(z.object({ title: z.string(), link: z.string() })).optional(),
      date: z.string().optional(),
    }),
  ),
  relatedSearches: z.array(z.object({ query: z.string(), link: z.string() })),
})

export type GoogleSearchResponse = z.infer<typeof GoogleSearchResponseSchema>

const googleSearch = async (params: GoogleSearchParams) => {
  const url = new URL("https://api.hasdata.com/scrape/google-light/serp")
  url.searchParams.append("q", params.query)

  if (params.location) {
    url.searchParams.append("location", params.location)
  }
  if (params.language) {
    url.searchParams.append("lr", params.language)
  }
  if (params.page && params.page > 1) {
    url.searchParams.append("page", params.page.toString())
  }

  const response = await pRetry(
    async () => {
      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": mastraConfig.hasdataApiKey,
        },
      })

      if (!res.ok) {
        const errorBody = await res.text()
        throw new Error(`HTTP error! Status: ${res.status}. Body: ${errorBody}`)
      }

      const data = await res.json()
      return data
    },
    {
      onFailedAttempt: (error) => {
        console.error(
          `Google Search Attempt ${error.attemptNumber} failed for query '${params.query}'. Error: ${error.message}. Retries left: ${error.retriesLeft}.`,
        )
      },
    },
  )

  return GoogleSearchResponseSchema.parse(response)
}

export const googleSearchTool = createTool({
  id: "google-search",
  description:
    "Performs a Google search using the HasData API and returns SERP results. Useful for finding general information, news, articles, or company websites.",
  inputSchema: GoogleSearchParamsSchema,
  outputSchema: GoogleSearchResponseSchema,
  execute: async ({ context }) => {
    return googleSearch(context)
  },
})
