import { createTool } from "@mastra/core"
import { z } from "zod"
import { executeWebReaderSummary } from "../../../../web-reader-summary"

/**
 * Web Reader Agent Tool
 * Delegates to web-reader-summary shared slice for fetching and analyzing web content
 */

export const WebReaderAgentParamsSchema = z.object({
  url: z.string().url().describe("The URL of the web page to read and analyze"),
  query: z
    .string()
    .min(1)
    .describe("The specific query or question to answer based on the web page content"),
})

export type WebReaderAgentParams = z.infer<typeof WebReaderAgentParamsSchema>

export const WebReaderAgentResponseSchema = z.object({
  success: z.boolean(),
  answer: z.string().optional(),
  url: z.string(),
  query: z.string(),
  error: z.string().optional(),
})

export type WebReaderAgentResponse = z.infer<typeof WebReaderAgentResponseSchema>

/**
 * Reads a web page and answers a query using LLM
 * Delegates to web-reader-summary shared slice
 */
async function webReaderAgent(params: WebReaderAgentParams): Promise<WebReaderAgentResponse> {
  // Call web-reader-summary shared slice which handles:
  // 1. Fetching web content
  // 2. LLM summarization with query
  const result = await executeWebReaderSummary({
    url: params.url,
    query: params.query,
  })

  if (result.isErr()) {
    return {
      success: false,
      url: params.url,
      query: params.query,
      error: `${result.error.type}: ${result.error.message}`,
    }
  }

  return {
    success: true,
    answer: result.value,
    url: params.url,
    query: params.query,
  }
}

/**
 * Mastra tool for web reader agent
 */
export const webReaderAgentTool = createTool({
  id: "web-reader-agent",
  description: `Reads a web page using Jina Reader and answers a specific query about the content using AI.

  This tool is perfect for:
  - Extracting specific information from a web page
  - Answering questions based on article content
  - Summarizing parts of a web page relevant to a query
  - Getting targeted insights from long-form content

  Examples:
  - URL: "https://company.com/about", Query: "What is the company's mission?"
  - URL: "https://blog.com/article", Query: "What are the main benefits mentioned?"
  - URL: "https://docs.com/guide", Query: "How do I install this package?"`,
  inputSchema: WebReaderAgentParamsSchema,
  outputSchema: WebReaderAgentResponseSchema,
  execute: async ({ context }) => {
    return await webReaderAgent(context)
  },
})
