import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { config } from "../../../../config"
import type { MastraConfig } from "../../core/validate"
import { memory } from "../memory"
import { dbEnrichCompanyTool } from "../tools/db-enrich-company"
import { dbSearchCompanyTool } from "../tools/db-search-company"
import { postgresQueryTool } from "../tools/postgres-query"

const openai = createOpenAI({ apiKey: config.openai.apiKey })
/**
 * Creates a general purpose AI assistant agent
 * Handles general queries, analysis, and multi-purpose tasks
 */
export function createGeneralAssistantAgent(_config: MastraConfig): Agent {
  return new Agent({
    name: "General Assistant",
    instructions: `You are a helpful AI assistant that can assist with a wide range of tasks.

Your capabilities include:
- Answering questions and providing information
- Analyzing text and data
- Making recommendations
- Problem-solving and strategic thinking
- Providing explanations and tutorials
- Querying PostgreSQL database safely (read-only mode with automatic rollback)
- Searching for companies using full-text search across all company data fields
- Enriching company data by retrieving company details and all associated employees by domain
- Remembering context from previous conversations

Guidelines:
- Be helpful, accurate, and concise
- Ask clarifying questions when needed
- Provide well-structured responses
- Cite sources when applicable
- Admit when you don't know something
- When querying the database, format results in a clear and readable way
- When searching for companies, use the searchCompanyTool for easier and faster full-text search
- When enriching company data, use the dbEnrichCompanyTool to get company + employees by domain
- Use conversation history to provide contextual responses

Always aim to provide the most useful and relevant information to help users accomplish their goals.`,
    model: openai("gpt-5-mini"),
    tools: {
      postgresQueryTool,
      dbSearchCompanyTool,
      dbEnrichCompanyTool,
    },
    memory,
  })
}
