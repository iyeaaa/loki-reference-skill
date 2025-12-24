import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { config } from "../../../../../config"
import { memory } from "../../memory"
import { model } from "./constants"
import { B2B_CUSTOMER_INDUSTRY_SYSTEM_PROMPT } from "./prompts"

export function createB2BCustomerIndustryAgent(): Agent {
  const openai = createOpenAI({ apiKey: config.openai.apiKey })

  // Note: gpt-5-mini does not support temperature
  return new Agent({
    name: "B2B Customer Industry Analyst",
    instructions: B2B_CUSTOMER_INDUSTRY_SYSTEM_PROMPT,
    model: openai(model),
    memory,
    defaultGenerateOptions: {
      maxSteps: 3,
    },
  })
}
