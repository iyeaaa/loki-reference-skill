import { createTool } from "@mastra/core"
import { z } from "zod"
import { executeWebReader } from "../../../../web-reader"

export const jinaReaderTool = createTool({
  id: "jina-reader",
  description: "Scrape a website for information using Jina Reader",
  inputSchema: z.object({
    url: z.string().describe("The URL to scrape"),
  }),
  outputSchema: z.string().describe("The scraped results"),
  execute: async ({ context }) => {
    const result = await executeWebReader({ url: context.url })

    if (result.isErr()) {
      throw new Error(`Web Reader failed: ${result.error.type} - ${result.error.message}`)
    }

    return result.value
  },
})
