import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import logger from "../../../../../utils/logger"
import { createSequenceEmailAgent } from "../../agents/sequence-email-agent"
import {
  buildEnrichedSequenceEmailPrompt,
  generateSequenceEmailPrompt,
} from "../../agents/sequence-email-agent/prompts"
import { structuredExtractionAgent } from "../../agents/structured-extraction-agent"
import { SequenceEmailContextSchema } from "./types"

/**
 * Sequence Email Generation Workflow
 * Generates Korean business emails using AI with quality judgment and structured extraction
 * Shell layer - handles orchestration of generation and parsing
 */

const generateSequenceEmailStep = createStep({
  id: "generate-sequence-email",
  description: "Generate Korean business email with AI quality assessment and parsing",
  inputSchema: z.object({
    context: SequenceEmailContextSchema,
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    subject: z.string().optional().describe("Email subject line"),
    bodyText: z.string().optional().describe("Email body content"),
    error: z.string().optional().describe("Error message if failed"),
  }),
  execute: async ({ inputData }) => {
    const { context } = inputData

    logger.info(
      {
        companyName: context.companyName,
        contactName: context.contactName,
        industry: context.industry,
      },
      "📋 [SEQ-EMAIL-WORKFLOW] Received context for sequence email generation",
    )

    try {
      logger.info("🔄 [SEQ-EMAIL-WORKFLOW] Starting Korean sequence email generation")

      // Build enriched custom prompt using prompt builder function
      logger.info("📝 [SEQ-EMAIL-WORKFLOW] Building enriched context from lead data")
      const customPrompt = buildEnrichedSequenceEmailPrompt(context)

      logger.info(
        {
          hasContacts: !!context.contacts?.length,
          hasSocialMedia: !!context.socialMedia?.length,
          hasProducts: !!context.products?.length,
          promptLength: customPrompt.length,
        },
        "✅ [SEQ-EMAIL-WORKFLOW] Built enriched custom prompt",
      )

      // Create agent instance
      logger.info("🤖 [SEQ-EMAIL-WORKFLOW] Creating sequence email agent")
      const agent = createSequenceEmailAgent()
      logger.info("✅ [SEQ-EMAIL-WORKFLOW] Agent created successfully")

      // Generate email using agent (agent handles quality judgment with emailJudgeTool)
      logger.info("📝 [SEQ-EMAIL-WORKFLOW] Generating final prompt from context")
      const userPrompt = generateSequenceEmailPrompt({
        companyName: context.companyName,
        contactName: context.contactName,
        industry: context.industry,
        website: context.website,
        customPrompt,
      })
      logger.info(
        { promptLength: userPrompt.length, promptPreview: `${userPrompt.substring(0, 200)}...` },
        "✅ [SEQ-EMAIL-WORKFLOW] Final prompt generated",
      )

      logger.info({ maxSteps: 5 }, "🚀 [SEQ-EMAIL-WORKFLOW] Calling agent.generate()")
      const agentResponse = await agent.generate(userPrompt, {
        maxSteps: 5,
      })

      logger.info(
        {
          stepCount: agentResponse.steps?.length || 0,
        },
        "📊 [SEQ-EMAIL-WORKFLOW] Agent response steps",
      )

      const emailResponseText = agentResponse.text

      logger.info(
        {
          responseLength: emailResponseText?.length || 0,
          responsePreview: `${emailResponseText?.substring(0, 300)}...`,
        },
        "🤖 [SEQ-EMAIL-WORKFLOW] Email response received",
      )

      if (!emailResponseText || emailResponseText.trim().length === 0) {
        throw new Error("Empty response from AI")
      }

      // Use structured extraction agent to parse the response
      logger.info("🔄 [SEQ-EMAIL-WORKFLOW] Starting structured extraction of email")

      const extractionPrompt = `
            Extract the email subject and body from the following text:
            ${emailResponseText}
            `

      logger.info(
        { extractionPromptLength: extractionPrompt.length },
        "📝 [SEQ-EMAIL-WORKFLOW] Extraction prompt prepared",
      )

      logger.info("🚀 [SEQ-EMAIL-WORKFLOW] Calling structured extraction agent")
      const parseStructured = await structuredExtractionAgent.generate(
        [
          {
            role: "user",
            content: extractionPrompt,
          },
        ],
        {
          output: z.object({
            subject: z.string().describe("Email subject line"),
            bodyText: z.string().describe("Email body content"),
          }),
        },
      )

      logger.info("✅ [SEQ-EMAIL-WORKFLOW] Extraction completed successfully")

      const parsedEmail = parseStructured.object

      if (!parsedEmail || !parsedEmail.subject || !parsedEmail.bodyText) {
        throw new Error("Email parsing failed")
      }

      logger.info(
        {
          subject: parsedEmail.subject,
          bodyLength: parsedEmail.bodyText.length,
          bodyPreview: `${parsedEmail.bodyText.substring(0, 150)}...`,
        },
        "✅ [SEQ-EMAIL-WORKFLOW] Email parsed successfully",
      )

      logger.info(
        {
          success: true,
          hasSubject: !!parsedEmail.subject,
          hasBody: !!parsedEmail.bodyText,
        },
        "🎉 [SEQ-EMAIL-WORKFLOW] Workflow completed successfully",
      )

      return {
        success: true,
        subject: parsedEmail.subject,
        bodyText: parsedEmail.bodyText,
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      logger.error(
        { err: error, errorMessage },
        "❌ [SEQ-EMAIL-WORKFLOW] AI email generation failed",
      )

      return {
        success: false,
        error: errorMessage,
      }
    }
  },
})

/**
 * Main workflow: Generate sequence email
 */
export const sequenceEmailGenerationWorkflow = createWorkflow({
  id: "sequence-email-generation",
  inputSchema: z.object({
    context: SequenceEmailContextSchema,
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    subject: z.string().optional().describe("Email subject line"),
    bodyText: z.string().optional().describe("Email body content"),
    error: z.string().optional().describe("Error message if failed"),
  }),
})
  .then(generateSequenceEmailStep)
  .commit()
