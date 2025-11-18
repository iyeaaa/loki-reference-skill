import { createTool } from "@mastra/core"
import { z } from "zod"
import { jinaSearch } from "./jina"
export const GoogleSearchParamsSchema = z
  .object({
    query: z.string().describe("The google search query."),
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

export const jinaSearchTool = createTool({
  id: "jina-google-search-serp",
  description:
    "Performs a Google search query using the Jina API and returns SERP results. Useful for finding general information, news, articles, or company websites.",
  inputSchema: GoogleSearchParamsSchema,
  outputSchema: z.string().describe("The search results"),
  execute: async ({ context }) => {
    return await jinaSearch({
      query: context.query,
      location: context.location,
      language: context.language,
      page: context.page,
    })
  },
})
