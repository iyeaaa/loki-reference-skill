import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { config } from "../../../../../config"
import { memory } from "../../memory"
import { model } from "./constants"
import { B2B_HUNTER_INDUSTRY_SYSTEM_PROMPT } from "./prompts"

export function createB2BHunterIndustryAgent(): Agent {
  const openai = createOpenAI({ apiKey: config.openai.apiKey })

  return new Agent({
    name: "B2B Hunter Industry Analyst",
    instructions: B2B_HUNTER_INDUSTRY_SYSTEM_PROMPT,
    model: openai(model),
    memory,
    defaultGenerateOptions: {
      maxSteps: 3,
      temperature: 0.3,
    },
  })
}

export { generateB2BHunterIndustryPrompt } from "./prompts"
