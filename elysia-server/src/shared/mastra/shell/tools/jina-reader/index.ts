import { createTool } from "@mastra/core"
import { z } from "zod"
import { jinaReader } from "./jina"

export const jinaReaderTool = createTool({
  id: "jina-reader",
  description: "Scrape a website for information using Jina Reader",
  inputSchema: z.object({
    url: z.string().describe("The URL to scrape"),
  }),
  outputSchema: z.string().describe("The scraped results"),
  execute: async ({ context }) => {
    return await jinaReader({ url: context.url })
  },
})
