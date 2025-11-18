// Node.js 18+ has fetch as global
import pRetry from "p-retry"
// import { CacheService } from "@/server/services/cache";
import { config } from "../../../../../config"

export const jinaSearch = async (params: {
  query: string
  location?: string
  language?: string
  page?: number
}) => {
  const url = "https://s.jina.ai/"

  // Build request body
  // biome-ignore lint/suspicious/noExplicitAny: We need to use any for dynamic body structure
  const body: any = {
    q: params.query,
  }

  if (params.location) {
    body.location = params.location
  }
  if (params.language) {
    body.hl = params.language // hl is for language (not gl)
  }
  if (params.page && params.page > 1) {
    body.page = params.page
  }

  // // Create cache key from search parameters
  // const cacheKeyParts = [`jina-search:${params.query}`]
  // if (params.location) cacheKeyParts.push(`location:${params.location}`);
  // if (params.language) cacheKeyParts.push(`lang:${params.language}`);
  // if (params.page) cacheKeyParts.push(`page:${params.page}`);
  // const cacheKey = cacheKeyParts.join(":");

  // // Check cache
  // const cacheService = new CacheService();
  // const cachedResponse = await cacheService.get({ key: cacheKey });
  // if (cachedResponse) {
  // 	jinaSearchLogger.info(`Cache hit for query: ${params.query}`);
  // 	return cachedResponse;
  // }

  // jinaSearchLogger.info(`Cache miss for query: ${params.query}`);

  const options = {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apis.jina.apiKey}`,
      "Content-Type": "application/json",
      "X-Respond-With": "no-content",
    },
    body: JSON.stringify(body),
  }

  const response = await pRetry(
    async () => {
      const response = await fetch(url, options)
      if (!response.ok) {
        // jinaSearchLogger.warn(
        // 	`Jina Search failed with status ${response.status}. Error: ${response.statusText}`,
        // );
        return `Jina Search failed with status ${response.status}.Error: ${response.statusText}`
      }
      return await response.text()
    },
    {
      onFailedAttempt: (error) => {
        console.error(
          `Jina Search Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`,
        )
      },
    },
  )

  // // Cache the response for 30 days
  // await cacheService.set({
  // 	key: cacheKey,
  // 	value: response,
  // 	exSeconds: 30 * 24 * 60 * 60, // 30 days in seconds
  // });

  // jinaSearchLogger.info(`Cached response for query: ${params.query}`);

  return response
}
