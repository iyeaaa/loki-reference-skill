import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import logger from "../../../../../utils/logger"
import { createEmailDraftAgent } from "../../agents/email-draft-agent"
import { generateEmailDraftPrompt } from "../../agents/email-draft-agent/prompts"
import { structuredExtractionAgent } from "../../agents/structured-extraction-agent"
import { EmailGenerationContextSchema, ParsedEmailDataSchema } from "./types"

/**
 * Email Generation Workflow
 * Generates personalized emails using AI with quality assessment and parsing
 * Shell layer - handles orchestration of generation, judgment, and parsing
 */

const generatePersonalizedEmailStep = createStep({
  id: "generate-personalized-email",
  description: "Generate personalized email with AI quality assessment and parsing",
  inputSchema: z.object({
    context: EmailGenerationContextSchema,
    openaiApiKey: z.string().describe("OpenAI API key"),
    maxRetries: z.number().default(3).describe("Maximum retry attempts"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    parsedEmail: ParsedEmailDataSchema.optional().describe("Parsed email data"),
    error: z.string().optional().describe("Error message if failed"),
    attempts: z.number().optional().describe("Number of attempts made"),
  }),
  execute: async ({ inputData }) => {
    const { context, openaiApiKey, maxRetries } = inputData

    // Create agent instance
    const agent = createEmailDraftAgent({
      openaiApiKey,
      model: "gpt-4o-2024-08-06",
      maxTokens: 4000,
      temperature: 0.7,
      rindaLeadPgUrl: "",
      jinaApiKey: "",
      hasdataApiKey: "",
    })

    let attempts = 0
    let lastError = ""

    while (attempts < maxRetries) {
      attempts++

      try {
        logger.info({ attempt: attempts, maxRetries }, "🔄 Starting personalized email generation")

        // Step 1: Generate email draft with judgment using agent
        const userPrompt = generateEmailDraftPrompt(context)

        const draftResponse = await agent.generate(userPrompt, {
          maxSteps: 3, // Simple generation, no tool calls needed
        })

        const draftText = draftResponse.text

        logger.info({ responseLength: draftText?.length || 0 }, "🤖 Draft response received")

        if (!draftText || draftText.trim().length === 0) {
          throw new Error("Empty response from AI")
        }

        // Use structured extraction agent to parse EMAIL and JUDGMENT
        const extractionPrompt = `Extract the email content and quality judgment from this response.

Response:
${draftText}

The response should contain:
1. EMAIL: [email content]
2. JUDGMENT: {quality assessment JSON}

Extract both the email content and the judgment object accurately.`

        const draftStructured = await structuredExtractionAgent.generate(
          [
            {
              role: "user",
              content: extractionPrompt,
            },
          ],
          {
            output: z.object({
              emailContent: z.string().describe("The email content"),
              judgment: z.object({
                pass: z.boolean().describe("Whether email passed quality check"),
                qualityScore: z.number().min(0).max(10).describe("Quality/tone score"),
                accuracyScore: z.number().min(0).max(10).describe("Accuracy/relevance score"),
                feedback: z.string().describe("Brief feedback message"),
              }),
            }),
          },
        )

        const parsedDraft = draftStructured.object

        if (!parsedDraft) {
          throw new Error("Failed to extract email and judgment")
        }

        const judgment = parsedDraft.judgment

        logger.info(
          {
            qualityScore: judgment.qualityScore,
            accuracyScore: judgment.accuracyScore,
          },
          "✅ Draft with assessment",
        )

        if (!judgment.pass) {
          lastError = `Quality assessment failed: ${judgment.feedback}`
          logger.warn({ feedback: judgment.feedback, attempt: attempts }, "❌ Quality check failed")

          if (attempts < maxRetries) {
            logger.info("🔄 Retrying generation...")
            continue
          }

          return {
            success: false,
            error: `${lastError} (${attempts} attempts)`,
            attempts,
          }
        }

        // Step 2: Parse email content using structured extraction
        const emailContent = parsedDraft.emailContent
        logger.info("📝 Parsing email content...")

        const parsePrompt = `Analyze the following email and extract structured data:

${emailContent}

Extract:
- subject: Email subject line (or "Reply" if none)
- body: Full email body
- greeting: Greeting section (e.g., "Hi John,")
- signature: Signature/closing section
- metadata: sentiment, intent, topics, actionItems`

        const parseStructured = await structuredExtractionAgent.generate(
          [
            {
              role: "user",
              content: parsePrompt,
            },
          ],
          {
            output: z.object({
              subject: z.string().describe("Email subject line"),
              body: z.string().describe("Email body content"),
              greeting: z.string().describe("Greeting section"),
              signature: z.string().describe("Signature/closing section"),
              metadata: z.object({
                sentiment: z
                  .enum(["positive", "neutral", "negative"])
                  .describe("Overall tone of email"),
                intent: z.array(z.string()).describe("Main purposes of the email"),
                topics: z.array(z.string()).describe("Key subjects discussed"),
                actionItems: z.array(z.string()).describe("Next steps or actions"),
              }),
            }),
          },
        )

        const parsedEmail = parseStructured.object

        if (!parsedEmail) {
          throw new Error("Email content parsing failed")
        }

        logger.info("✅ Email parsed successfully")

        return {
          success: true,
          parsedEmail,
          attempts,
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error"
        lastError = errorMessage
        logger.error({ err: error, attempt: attempts }, `❌ Attempt ${attempts} failed`)

        // Handle specific errors that shouldn't retry
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "insufficient_quota"
        ) {
          return {
            success: false,
            error: "OpenAI API quota exceeded",
            attempts,
          }
        }

        if (error && typeof error === "object" && "status" in error && error.status === 401) {
          return {
            success: false,
            error: "OpenAI API authentication failed",
            attempts,
          }
        }

        if (attempts >= maxRetries) {
          return {
            success: false,
            error: `${errorMessage} (${attempts} attempts)`,
            attempts,
          }
        }

        logger.info("🔄 Retrying after error...")
      }
    }

    return {
      success: false,
      error: lastError || "Unknown error after all retries",
      attempts,
    }
  },
})

/**
 * Main workflow: Generate personalized email
 */
export const emailGenerationWorkflow = createWorkflow({
  id: "email-generation",
  inputSchema: z.object({
    context: EmailGenerationContextSchema,
    openaiApiKey: z.string().describe("OpenAI API key"),
    maxRetries: z.number().default(3).describe("Maximum retry attempts"),
  }),
  outputSchema: z.object({
    success: z.boolean().describe("Whether generation succeeded"),
    parsedEmail: ParsedEmailDataSchema.optional().describe("Parsed email data"),
    error: z.string().optional().describe("Error message if failed"),
    attempts: z.number().optional().describe("Number of attempts made"),
  }),
})
  .then(generatePersonalizedEmailStep)
  .commit()
