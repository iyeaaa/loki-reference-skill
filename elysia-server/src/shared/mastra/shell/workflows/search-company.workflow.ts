import { createStep, createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import { dbSearchCompanyTool } from "../tools/db-search-company"

/**
 * Search Company Workflow
 * Orchestrates company search from database
 * Shell layer - handles orchestration of search operation
 */

const searchStep = createStep({
  id: "search-company-step",
  description: "Search for companies in the database using full-text search",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search query to find companies"),
  }),
  outputSchema: z.object({
    companies: z.array(z.unknown()),
    count: z.number(),
    executionTime: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const { query } = inputData

    const result = await dbSearchCompanyTool.execute({
      context: {
        searchTerm: query,
      },
      runtimeContext,
    })

    if (!result.success) {
      return {
        companies: [],
        count: 0,
        executionTime: 0,
        success: false,
        message: result.message,
      }
    }

    return {
      companies: result.data?.rows || [],
      count: result.data?.rowCount || 0,
      executionTime: result.data?.executionTime || 0,
      success: true,
      message: result.message,
    }
  },
})

export const searchCompanyWorkflow = createWorkflow({
  id: "search-company-from-database",
  inputSchema: z.object({
    query: z.string().min(1).describe("Search query to find companies"),
  }),
  outputSchema: z.object({
    companies: z.array(z.unknown()),
    count: z.number(),
    executionTime: z.number(),
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(searchStep)
  .commit()
