import { createOpenAI } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { config } from "../../../../../config"
import { memory } from "../../memory"
import { stepsJudgeTool } from "../../tools/steps-judge/index"
import { model } from "./constants"
import { CAMPAIGN_STRATEGY_SYSTEM_PROMPT } from "./prompts"

export function createCampaignStepsAgent(): Agent {
  const openai = createOpenAI({ apiKey: config.openai.apiKey })

  return new Agent({
    name: "Campaign Steps Strategist",
    instructions: CAMPAIGN_STRATEGY_SYSTEM_PROMPT,
    model: openai(model),
    tools: { stepsJudgeTool },
    memory,
    defaultGenerateOptions: {
      maxSteps: 10,
      temperature: 0.7,
    },
  })
}
