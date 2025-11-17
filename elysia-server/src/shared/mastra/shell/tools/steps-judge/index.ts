import { createOpenAI } from "@ai-sdk/openai"
import { createTool } from "@mastra/core"
import { generateText } from "ai"
import pRetry from "p-retry"
import { z } from "zod"
import { config } from "../../../../../config"
import { model } from "../../agents/steps-agent/constants"
import { campaignStepsJudgeSystemPrompt } from "./prompts"

export const stepsJudgeTool = createTool({
  id: "steps-judge",
  description: "Judge a generated sequence of steps for a campaign",
  inputSchema: z.object({
    generatedSteps: z.string().describe("The generated campaign steps"),
  }),
  outputSchema: z.string().describe("The judge feedback"),
  execute: async ({ context }) => {
    const retries = 3
    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    })
    console.info("🚀 Steps Judge input : \n", context.generatedSteps)

    try {
      // Execute with retry logic
      const response = await pRetry(
        async () => {
          // const controller = new AbortController()

          try {
            // openai call
            const { text } = await generateText({
              model: openai(model),
              system: campaignStepsJudgeSystemPrompt,
              prompt: context.generatedSteps,
              // temperature: 0.7,
            })

            return text
          } catch (error) {
            console.log("error", error)
          }
        },
        {
          retries,
          onFailedAttempt: (c) => {
            console.error(
              `Steps Judge Attempt ${c.attemptNumber} failed for generated steps : '${context.generatedSteps.substring(0, 100)}'`,
              {
                error: String(c.error),
                retriesLeft: c.retriesLeft,
              },
            )
          },
        },
      )

      console.info(
        "🚀 Steps judge successfully",
        typeof response === "string" ? response : JSON.stringify(response),
      )
      return typeof response === "string" ? response : JSON.stringify(response)
    } catch (error) {
      console.error("Steps Judge Failed", { error })
      return typeof error === "string" ? error : JSON.stringify(error)
    }
  },
})
