import { openai } from "@ai-sdk/openai"
import { Agent } from "@mastra/core/agent"
import { memory } from "../memory"

export const structuredExtractionAgent = new Agent({
  name: "Structured Extraction",
  instructions:
    "You are a structured extraction agent. Your task is to extract structured data from the given text with upmost accuracy",
  model: openai("gpt-5-mini-2025-08-07"),
  memory,
  defaultStreamOptions: {
    maxSteps: 50,
    maxRetries: 5,
    temperature: 0.1,
  },
  defaultGenerateOptions: {
    maxSteps: 50,
    maxRetries: 5,
    temperature: 0.1,
  },
})
