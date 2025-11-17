import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import logger from "../../../../../utils/logger"
import { createCampaignStepsAgent } from "../../agents/steps-agent"
import { generateCampaignPrompt } from "../../agents/steps-agent/prompts"
import { structuredExtractionAgent } from "../../agents/structured-extraction-agent"
import { CampaignStepGenerationContextSchema, GeneratedCampaignStepSchema } from "./types"

/**
 * Campaign Steps Generation Workflow
 * Generates optimized email campaign steps using AI
 * Shell layer - handles orchestration of generation, judgment, and parsing
 */

const generateCampaignStepsStep = createStep({
  id: "generate-campaign-steps",
  description: "Generate campaign steps with AI quality assessment and parsing",
  inputSchema: z.object({
    context: CampaignStepGenerationContextSchema,
    maxRetries: z.number().default(3).describe("Maximum retry attempts"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    steps: z.array(GeneratedCampaignStepSchema).describe("Generated campaign steps"),
    reasoning: z.string().optional().describe("Strategy explanation"),
    error: z.string().optional().describe("Error message if failed"),
    attempts: z.number().optional().describe("Number of attempts made"),
  }),
  execute: async ({ inputData }) => {
    const { context, maxRetries } = inputData

    logger.info(
      {
        campaignName: context.campaignName,
        maxRetries,
      },
      "📋 [STEPS-WORKFLOW] Received context for campaign steps generation",
    )

    // Create agent instance
    logger.info("🤖 [STEPS-WORKFLOW] Creating campaign steps agent")
    const agent = createCampaignStepsAgent()
    logger.info("✅ [STEPS-WORKFLOW] Agent created successfully")

    let attempts = 0
    let lastError = ""

    while (attempts < maxRetries) {
      attempts++

      try {
        logger.info(
          { attempt: attempts, maxRetries },
          "🔄 [STEPS-WORKFLOW] Starting generation attempt",
        )

        // Step 1: Generate steps draft with judgment tool
        logger.info("📝 [STEPS-WORKFLOW] Generating prompt from context")
        const userPrompt = generateCampaignPrompt(context)
        logger.info(
          { promptLength: userPrompt.length, promptPreview: `${userPrompt.substring(0, 200)}...` },
          "✅ [STEPS-WORKFLOW] Prompt generated",
        )

        logger.info({ maxSteps: 10 }, "🚀 [STEPS-WORKFLOW] Calling agent.generate()")
        const agentResponse = await agent.generate(userPrompt, {
          maxSteps: 10,
        })

        logger.info(
          {
            stepCount: agentResponse.steps?.length || 0,
          },
          "📊 [STEPS-WORKFLOW] Agent response steps",
        )

        const campaignStepsResponseText = agentResponse.text

        logger.info(
          {
            responseLength: campaignStepsResponseText?.length || 0,
            responsePreview: `${campaignStepsResponseText?.substring(0, 300)}...`,
          },
          "🤖 [STEPS-WORKFLOW] Draft response received",
        )

        if (!campaignStepsResponseText || campaignStepsResponseText.trim().length === 0) {
          throw new Error("Empty response from AI")
        }

        logger.info("🔄 [STEPS-WORKFLOW] Starting structured extraction of campaign steps")

        const extractionPrompt = `
              Extract the campaign steps from the following text:
              ${campaignStepsResponseText}
              `

        logger.info(
          { extractionPromptLength: extractionPrompt.length },
          "📝 [STEPS-WORKFLOW] Extraction prompt prepared",
        )

        logger.info(`🚀 [STEPS-WORKFLOW] Extraction promt: \n${extractionPrompt}`)

        // Wrap extraction with timeout (60 seconds)
        logger.info("⏱️ [STEPS-WORKFLOW] Starting extraction with 60s timeout")
        const extractionPromise = structuredExtractionAgent.generate(
          [
            {
              role: "user",
              content: extractionPrompt,
            },
          ],
          {
            output: z.object({
              reasoning: z.string().describe("Overall strategy explanation"),
              steps: z.array(
                z.object({
                  stepOrder: z.number().min(1).describe("Step order number"),
                  emailType: z.string().describe("Email type"),
                  delayDays: z.number().min(0).max(7).describe("Number of days from today"),
                  scheduledHour: z.number().min(0).max(23).describe("Scheduled hour (UTC)"),
                  scheduledMinute: z.number().min(0).max(59).describe("Scheduled minute"),
                }),
              ),
            }),
          },
        )

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Structured extraction timed out after 60s")), 60000),
        )

        const parseStructured = await Promise.race([extractionPromise, timeoutPromise])

        logger.info("✅ [STEPS-WORKFLOW] Extraction completed successfully")

        const parsedSteps = parseStructured.object

        if (!parsedSteps || !parsedSteps.steps) {
          throw new Error("Campaign steps parsing failed")
        }

        logger.info(
          {
            stepsCount: parsedSteps.steps.length,
            steps: parsedSteps.steps.map((s) => ({
              order: s.stepOrder,
              type: s.emailType,
              delay: s.delayDays,
              time: `${s.scheduledHour}:${s.scheduledMinute}`,
            })),
            reasoning: parsedSteps.reasoning,
          },
          "✅ [STEPS-WORKFLOW] Steps parsed successfully",
        )

        logger.info(
          {
            success: true,
            stepsCount: parsedSteps.steps.length,
            attempts,
          },
          "🎉 [STEPS-WORKFLOW] Workflow completed successfully",
        )

        return {
          success: true,
          steps: parsedSteps.steps,
          reasoning: parsedSteps.reasoning,
          attempts,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        lastError = errorMessage
        logger.error(
          { err: error, attempt: attempts },
          `❌ [STEPS-WORKFLOW] Attempt ${attempts} failed`,
        )

        if (attempts >= maxRetries) {
          logger.error(
            { attempts, error: errorMessage },
            "💥 [STEPS-WORKFLOW] All retries exhausted, workflow failed",
          )
          return {
            success: false,
            steps: [],
            error: `${errorMessage} (${attempts} attempts)`,
            attempts,
          }
        }

        logger.info({ nextAttempt: attempts + 1 }, "🔄 [STEPS-WORKFLOW] Retrying after error")
      }
    }

    return {
      success: false,
      steps: [],
      error: lastError || "Unknown error after all retries",
      attempts,
    }
  },
})

/**
 * Main workflow: Generate campaign steps
 */
export const campaignStepsGenerationWorkflow = createWorkflow({
  id: "campaign-steps-generation",
  inputSchema: z.object({
    context: CampaignStepGenerationContextSchema,
    maxRetries: z.number().default(3).describe("Maximum retry attempts"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    steps: z.array(GeneratedCampaignStepSchema).describe("Generated campaign steps"),
    reasoning: z.string().optional().describe("Strategy explanation"),
    error: z.string().optional().describe("Error message if failed"),
    attempts: z.number().optional().describe("Number of attempts made"),
  }),
})
  .then(generateCampaignStepsStep)
  .commit()
