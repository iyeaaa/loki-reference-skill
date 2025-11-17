import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import logger from "../../../../../utils/logger"
import { createEmailReplyAgent } from "../../agents/email-reply-agent"
import { generateEmailReplyPrompt } from "../../agents/email-reply-agent/prompts"
import { EmailReplyContextSchema } from "./types"

/**
 * Email Reply Generation Workflow
 * Generates customer service email replies using AI
 * Shell layer - handles orchestration of reply generation
 */

const generateEmailReplyStep = createStep({
  id: "generate-email-reply",
  description: "Generate customer service email reply",
  inputSchema: z.object({
    context: EmailReplyContextSchema,
    openaiApiKey: z.string().describe("OpenAI API key"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    replyContent: z.string().optional().describe("Generated reply content"),
    error: z.string().optional().describe("Error message if failed"),
  }),
  execute: async ({ inputData }) => {
    const { context, openaiApiKey } = inputData

    try {
      logger.info("🔄 Starting email reply generation")

      // Create agent instance
      const agent = createEmailReplyAgent({
        openaiApiKey,
        model: "gpt-4o-2024-08-06",
        maxTokens: 4000,
        temperature: 0.7,
        rindaLeadPgUrl: "",
        jinaApiKey: "",
        hasdataApiKey: "",
      })

      // Generate reply using agent
      const userPrompt = generateEmailReplyPrompt(context)

      const response = await agent.generate(userPrompt, {
        maxSteps: 3,
      })

      const replyContent = response.text

      if (!replyContent || replyContent.trim().length === 0) {
        throw new Error("AI 응답 생성 실패")
      }

      logger.info({ contentLength: replyContent.length }, "✅ Reply generated successfully")

      return {
        success: true,
        replyContent,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "알 수 없는 오류 발생"
      logger.error({ err: error }, "AI response generation failed")

      // Handle specific errors
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "insufficient_quota"
      ) {
        return {
          success: false,
          error: "OpenAI API 사용량 한도 초과",
        }
      }

      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        return {
          success: false,
          error: "OpenAI API 키 인증 실패",
        }
      }

      return {
        success: false,
        error: errorMessage,
      }
    }
  },
})

/**
 * Main workflow: Generate email reply
 */
export const emailReplyGenerationWorkflow = createWorkflow({
  id: "email-reply-generation",
  inputSchema: z.object({
    context: EmailReplyContextSchema,
    openaiApiKey: z.string().describe("OpenAI API key"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    replyContent: z.string().optional().describe("Generated reply content"),
    error: z.string().optional().describe("Error message if failed"),
  }),
})
  .then(generateEmailReplyStep)
  .commit()
