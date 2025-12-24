import { createStep, createWorkflow } from "@mastra/core/workflows"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"
import { config } from "../../../../config"

const openai = new OpenAI({ apiKey: config.openai.apiKey })

/**
 * Validate Criteria Workflow
 * Validates data against criteria using direct LLM analysis
 * Shell layer - handles orchestration of validation operation
 */

const directValidationStep = createStep({
  id: "direct-validation-step",
  description: "Validate data against criteria using direct LLM analysis",
  inputSchema: z.object({
    criteria: z.string().describe("Validation criteria to check against"),
    data: z.string().describe("Data to be validated"),
  }),
  outputSchema: z.object({
    isValidated: z.boolean(),
    criteria: z.string(),
    data: z.string(),
    researchResult: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { criteria, data } = inputData

    try {
      // Define the validation schema
      const validationSchema = z.object({
        isValidated: z.boolean().describe("Whether the data meets the criteria"),
        reasoning: z.string().describe("Brief explanation of the validation result"),
        confidence: z
          .enum(["high", "medium", "low"])
          .describe("Confidence level in the validation decision"),
      })

      // Direct validation prompt - analyze data against criteria
      const validationPrompt = `
You are a data validation assistant. Analyze the following data against the given criteria and determine if it meets the requirements.

Criteria:
${criteria}

Data to Validate:
${data}

Instructions:
1. Carefully read the criteria and understand what is being asked
2. Examine the data provided and determine if it satisfies the criteria
3. Base your decision ONLY on the information present in the data
4. If the data clearly satisfies the criteria, set isValidated to true
5. If the data does NOT satisfy the criteria or the information is not present, set isValidated to false
6. Provide a brief reasoning for your decision
7. Indicate your confidence level (high/medium/low)

Important:
- Be literal and straightforward in your interpretation
- "Is X a Y?" should return true if X is indeed a Y based on the name/description
- "Is the location in Z?" should return true if the location field mentions Z
- Don't overthink simple questions - if it looks like a duck and quacks like a duck, it's a duck

Provide your validation result:
`

      // Note: gpt-5-mini does not support temperature
      const response = await pRetry(
        () =>
          openai.responses.parse({
            model: "gpt-5-mini",
            input: [
              {
                role: "user",
                content: validationPrompt,
              },
            ],
            text: {
              format: zodTextFormat(validationSchema, "ValidationResult"),
            },
          }),
        { retries: 3 },
      )

      const validationResult = response.output_parsed
      if (!validationResult) {
        throw new Error("Failed to parse validation response")
      }

      const researchResult = `
Criteria: ${criteria}
Data: ${data}

Validation Result: ${validationResult.isValidated ? "✅ VALID" : "❌ INVALID"}
Reasoning: ${validationResult.reasoning}
Confidence: ${validationResult.confidence.toUpperCase()}
`

      return {
        isValidated: validationResult.isValidated,
        criteria,
        data,
        researchResult,
        success: true,
        message: `Validation complete: ${validationResult.isValidated ? "Valid" : "Invalid"} (${validationResult.confidence} confidence)`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        isValidated: false,
        criteria,
        data,
        researchResult: `Validation failed: ${errorMessage}`,
        success: false,
        message: `Validation failed: ${errorMessage}`,
      }
    }
  },
})

export const validateCriteriaWorkflow = createWorkflow({
  id: "validate-criteria",
  inputSchema: z.object({
    criteria: z.string().describe("Validation criteria to check against"),
    data: z.string().describe("Data to be validated"),
  }),
  outputSchema: z.object({
    isValidated: z.boolean(),
    criteria: z.string(),
    data: z.string(),
    researchResult: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(directValidationStep)
  .commit()
