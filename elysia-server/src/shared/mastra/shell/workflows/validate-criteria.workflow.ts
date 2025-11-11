import { createOpenAI } from "@ai-sdk/openai"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import { config } from "../../../../config"

const openai = createOpenAI({ apiKey: config.openai.apiKey })

/**
 * Validate Criteria Workflow
 * Uses research agent to validate data against criteria and extracts structured validation result
 * Shell layer - handles orchestration of validation operation
 */

const researchValidationStep = createStep({
  id: "research-validation-step",
  description: "Research criteria and data using web research agent",
  inputSchema: z.object({
    criteria: z.string().describe("Validation criteria to check against"),
    data: z.string().describe("Data to be validated"),
  }),
  outputSchema: z.object({
    researchResult: z.string(),
    criteria: z.string(),
    data: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { criteria, data } = inputData

    try {
      // Get the research agent from Mastra instance
      const researchAgent = mastra.getAgent("researchAgent")

      if (!researchAgent) {
        return {
          researchResult: "",
          criteria,
          data,
          success: false,
          message: "Research agent not found in Mastra instance",
        }
      }

      // Construct the validation research prompt
      const validationPrompt = `
Validation Task:

Criteria to Validate Against:
${criteria}

Data to Validate:
${data}

Please research and analyze whether the provided data meets the specified criteria.
Use web search to gather relevant information if needed to make an informed validation decision.
Provide a detailed analysis explaining why the data does or does not meet the criteria.
`

      // Call the research agent to analyze the validation
      const response = await researchAgent.generate(validationPrompt, {
        maxSteps: 5, // Allow multiple tool calls for thorough research
      })

      const researchResult = response.text

      return {
        researchResult,
        criteria,
        data,
        success: true,
        message: "Successfully completed research validation",
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        researchResult: "",
        criteria,
        data,
        success: false,
        message: `Research validation failed: ${errorMessage}`,
      }
    }
  },
})

const structuredExtractionStep = createStep({
  id: "structured-extraction-step",
  description: "Extract structured validation boolean from research result",
  inputSchema: z.object({
    researchResult: z.string(),
    criteria: z.string(),
    data: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  outputSchema: z.object({
    isValidated: z.boolean(),
    criteria: z.string(),
    data: z.string(),
    researchResult: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { researchResult, criteria, data, success, message } = inputData

    // If research step failed, return false validation
    if (!success) {
      return {
        isValidated: false,
        criteria,
        data,
        researchResult,
        success: false,
        message,
      }
    }

    try {
      // Get the research agent for structured extraction
      const researchAgent = mastra.getAgent("researchAgent")

      if (!researchAgent) {
        return {
          isValidated: false,
          criteria,
          data,
          researchResult,
          success: false,
          message: "Research agent not found for structured extraction",
        }
      }

      // Define the structured output schema
      const validationSchema = z.object({
        isValidated: z.boolean().describe("Whether the data meets the criteria"),
        reasoning: z.string().describe("Brief explanation of the validation result"),
      })

      // Use structured extraction to get validation boolean
      const extractionPrompt = `
Based on the following research analysis, determine if the data is valid according to the criteria.

Research Analysis:
${researchResult}

Provide a structured response with:
1. isValidated: boolean indicating if data meets criteria
2. reasoning: brief explanation of your decision
`

      const response = await researchAgent.generate(extractionPrompt, {
        maxSteps: 1,
        structuredOutput: {
          schema: validationSchema,
          model: openai("gpt-4o-mini"),
        },
      })

      const structuredOutput = response.object as z.infer<typeof validationSchema>

      return {
        isValidated: structuredOutput.isValidated,
        criteria,
        data,
        researchResult: `${researchResult}\n\nValidation Decision: ${structuredOutput.reasoning}`,
        success: true,
        message: `Validation complete: ${structuredOutput.isValidated ? "Valid" : "Invalid"}`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        isValidated: false,
        criteria,
        data,
        researchResult,
        success: false,
        message: `Structured extraction failed: ${errorMessage}`,
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
  .then(researchValidationStep)
  .then(structuredExtractionStep)
  .commit()
