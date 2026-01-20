import createClient from "openapi-fetch"
import type { paths } from "./schema"

export type RindaSearchClientOptions = {
  baseUrl: string
  apiKey: string
}

/**
 * Create a typed Rinda Search API client
 */
export function createRindaSearchClient(options: RindaSearchClientOptions) {
  return createClient<paths>({
    baseUrl: options.baseUrl,
    headers: {
      "X-API-Key": options.apiKey,
    },
  })
}

export type RindaSearchClient = ReturnType<typeof createRindaSearchClient>
