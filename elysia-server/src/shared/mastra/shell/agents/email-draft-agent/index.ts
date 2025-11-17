import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import type { MastraConfig } from "../../../core/validate"
import { memory } from "../../memory"
import { EMAIL_DRAFT_SYSTEM_PROMPT } from "./prompts"

/**
 * Email Draft Agent
 * Expert business email writer for personalized outbound emails
 * Shell layer - handles agent configuration and instantiation
 */

/**
 * Create the email draft agent
 * Uses GPT-4o for high-quality personalized email generation
 */
export function createEmailDraftAgent(config: MastraConfig): Agent {
  const openai = createOpenAI({ apiKey: config.openaiApiKey })

  return new Agent({
    name: "Email Draft Writer",
    instructions: EMAIL_DRAFT_SYSTEM_PROMPT,
    model: openai("gpt-4o-2024-08-06"),
    tools: {}, // No tools needed - pure writing
    memory,
    defaultGenerateOptions: {
      maxSteps: 5,
      temperature: 0.7, // Creative but consistent email writing
    },
  })
}
