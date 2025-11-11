import { createOpenAI } from "@ai-sdk/openai"
import { createTool } from "@mastra/core"
import { generateText } from "ai"
import { z } from "zod"
import { config } from "../../../../../config"
import { mastraConfig } from "../../config"
import { jinaReader } from "../jina-reader/jina"

const openai = createOpenAI({
  apiKey: config.openai.apiKey,
})
/**
 * Web Reader Agent Tool
 * Combines Jina Reader with LLM to answer queries based on web content
 * Shell layer - handles web scraping and LLM summarization
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
 */
async function webReaderAgent(params: WebReaderAgentParams): Promise<WebReaderAgentResponse> {
  try {
    // Step 1: Fetch web page content using Jina Reader
    const content = await jinaReader({ url: params.url })

    if (!content || typeof content !== "string") {
      return {
        success: false,
        url: params.url,
        query: params.query,
        error: "Failed to fetch content from URL",
      }
    }

    // Step 2: Use LLM to answer the query based on the content
    const response = await generateText({
      model: openai("gpt-4o-mini"),
      temperature: mastraConfig.temperature,
      system: `You are a helpful assistant that analyzes web page content and answers questions based on that content.

Guidelines:
- Answer the query based solely on the provided web page content
- Be concise and accurate
- If the content doesn't contain information to answer the query, clearly state that
- Cite specific parts of the content when relevant
- Use markdown formatting for better readability`,
      prompt: `Web Page Content (from ${params.url}):
---
${content}
---

Query: ${params.query}

Please answer the query based on the web page content above.`,
    })

    return {
      success: true,
      answer: response.text,
      url: params.url,
      query: params.query,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

    return {
      success: false,
      url: params.url,
      query: params.query,
      error: errorMessage,
    }
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
