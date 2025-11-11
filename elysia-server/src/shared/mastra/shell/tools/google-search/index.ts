import { createTool } from "@mastra/core"
import {
  executeGoogleSearch,
  GoogleSearchParamsSchema,
  GoogleSearchResponseSchema,
} from "../../../../google-search"

export { GoogleSearchParamsSchema, GoogleSearchResponseSchema } from "../../../../google-search"
export type {
  GoogleSearchParams,
  GoogleSearchResponse,
} from "../../../../google-search/core/types"

export const googleSearchTool = createTool({
  id: "google-search",
  description:
    "Performs a Google search using the HasData API and returns SERP results. Useful for finding general information, news, articles, or company websites.",
  inputSchema: GoogleSearchParamsSchema,
  outputSchema: GoogleSearchResponseSchema,
  execute: async ({ context }) => {
    const result = await executeGoogleSearch(context)

    if (result.isErr()) {
      throw new Error(`Google Search failed: ${result.error.type} - ${result.error.message}`)
    }

    return result.value
  },
})
