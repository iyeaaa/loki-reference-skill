import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"

/**
 * Enrich Data Workflow
 * Uses research agent to enrich markdown data with web-sourced information
 * Shell layer - handles orchestration of research operation
 */

const researchStep = createStep({
  id: "research-step",
  description: "Research and enrich data using web search via research agent",
  inputSchema: z.object({
    markdownData: z.string().describe("Markdown formatted data to be enriched"),
    query: z.string().describe("Specific query to research and answer"),
  }),
  outputSchema: z.object({
    enrichedData: z.string(),
    query: z.string(),
    originalMarkdown: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { markdownData, query } = inputData

    try {
      // Get the research agent from Mastra instance
      const researchAgent = mastra.getAgent("researchAgent")

      if (!researchAgent) {
        return {
          enrichedData: "",
          query,
          originalMarkdown: markdownData,
          success: false,
          message: "Research agent not found in Mastra instance",
        }
      }

      // Construct the research prompt with context
      const researchPrompt = `
Context (Markdown Data):
${markdownData}

Query to Research:
${query}

Please use web search to find relevant, up-to-date information to answer this query.
Consider the context provided in the markdown data when formulating your response.
Provide a well-structured answer with citations to your sources.
`

      // Call the research agent to gather information
      const response = await researchAgent.generate(researchPrompt, {
        maxSteps: 5, // Allow multiple tool calls for thorough research
      })

      const enrichedData = response.text

      return {
        enrichedData,
        query,
        originalMarkdown: markdownData,
        success: true,
        message: `Successfully researched and enriched data for query: "${query}"`,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"

      return {
        enrichedData: "",
        query,
        originalMarkdown: markdownData,
        success: false,
        message: `Research failed: ${errorMessage}`,
      }
    }
  },
})

export const enrichDataWorkflow = createWorkflow({
  id: "enrich-data",
  inputSchema: z.object({
    markdownData: z.string().describe("Markdown formatted data to be enriched"),
    query: z.string().describe("Specific query to research and answer"),
  }),
  outputSchema: z.object({
    enrichedData: z.string(),
    query: z.string(),
    originalMarkdown: z.string(),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(researchStep)
  .commit()
