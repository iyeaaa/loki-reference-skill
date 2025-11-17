import { createOpenAI } from "@ai-sdk/openai"
import { createTool } from "@mastra/core"
import { generateText } from "ai"
import pRetry from "p-retry"
import { z } from "zod"
import { config } from "../../../../../config"
import { model } from "../../agents/sequence-email-agent/constants"
import { emailJudgeSystemPrompt } from "./prompts"

export const emailJudgeTool = createTool({
  id: "email-judge",
  description: "Judge a generated email draft for conversion optimization quality",
  inputSchema: z.object({
    generatedEmail: z.string().describe("The generated email draft to evaluate"),
  }),
  outputSchema: z.string().describe("The judge feedback with score and recommendations"),
  execute: async ({ context }) => {
    const retries = 3
    const openai = createOpenAI({
      apiKey: config.openai.apiKey,
    })

    console.info("🚀 Email Judge input : \n", context.generatedEmail)

    try {
      // Execute with retry logic
      const response = await pRetry(
        async () => {
          try {
            // OpenAI call
            const { text } = await generateText({
              model: openai(model),
              system: emailJudgeSystemPrompt,
              prompt: context.generatedEmail,
              temperature: 0.7,
            })

            return text
          } catch (error) {
            console.log("error", error)
            throw error
          }
        },
        {
          retries,
          onFailedAttempt: (c) => {
            console.error(
              `Email Judge Attempt ${c.attemptNumber} failed for generated email: '${context.generatedEmail.substring(0, 100)}'`,
              {
                error: String(c.error),
                retriesLeft: c.retriesLeft,
              },
            )
          },
        },
      )

      console.info("Email judged successfully", typeof response === "string" ? response : "...")
      return typeof response === "string" ? response : JSON.stringify(response)
    } catch (error) {
      console.error("Email Judge Failed", { error })
      return typeof error === "string" ? error : JSON.stringify(error)
    }
  },
})
