import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { config } from "../../../../../config"
import { memory } from "../../memory"
import { emailJudgeTool } from "../../tools/email-judge"
import { model } from "./constants"
import { systemPrompt } from "./prompts"

/**
 * Sequence Email Agent
 * Expert in Korean business email generation for sequences
 * Uses email judge tool for conversion optimization
 */

export function createSequenceEmailAgent(): Agent {
  const openai = createOpenAI({ apiKey: config.openai.apiKey })

  return new Agent({
    name: "Sequence Email Writer",
    instructions: systemPrompt,
    model: openai(model),
    tools: { emailJudgeTool },
    memory,
    defaultGenerateOptions: {
      maxSteps: 5,
      temperature: 0.7,
    },
  })
}
