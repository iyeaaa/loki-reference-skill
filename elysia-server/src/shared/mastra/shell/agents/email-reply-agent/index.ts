import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import type { MastraConfig } from "../../../core/validate"
import { memory } from "../../memory"
import { EMAIL_REPLY_SYSTEM_PROMPT } from "./prompts"

/**
 * Email Reply Agent
 * Specialized in Rinda Expert customer service email replies
 * Shell layer - handles agent configuration and instantiation
 */

/**
 * Create the email reply agent
 * Uses GPT-4o for customer service replies
 */
export function createEmailReplyAgent(config: MastraConfig): Agent {
  const openai = createOpenAI({ apiKey: config.openaiApiKey })

  return new Agent({
    name: "Email Reply Writer",
    instructions: EMAIL_REPLY_SYSTEM_PROMPT,
    model: openai("gpt-4o-2024-08-06"),
    tools: {}, // No tools needed - pure reply writing
    memory,
    defaultGenerateOptions: {
      maxSteps: 3,
      temperature: 0.7, // Friendly but consistent responses
    },
  })
}
