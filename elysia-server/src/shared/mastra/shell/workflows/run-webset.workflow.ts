import { createWorkflow } from "@mastra/core/workflows"
import { z } from "zod"
import { iterationStep } from "./run-webset-workflow/iteration.step"

/**
 * Main Run Webset Workflow
 * Orchestrates: generate query → search → enrich → validate → check quota loop
 *
 * Flow per iteration:
 * 1. Generate unique search query (avoids duplicates)
 * 2. Search companies using query
 * 3. Enrich missing company fields
 * 4. Validate companies against criteria
 * 5. Check if quota is satisfied
 *
 * Loops until target validated rows are met or max iterations reached.
 */
export const runWebsetWorkflow = createWorkflow({
  id: "run-webset",
  description:
    "Execute webset: generate query, search companies, enrich missing fields, validate criteria - repeat until quota fulfilled",
  inputSchema: z.object({
    websetId: z.string().uuid().describe("The ID of the webset to run"),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    rowsWithoutEnrichment: z.number(),
    targetSatisfied: z.boolean(),
    totalCompaniesSearched: z.number(),
    totalRowsAdded: z.number(),
    totalRowsEnriched: z.number(),
    totalRowsValidated: z.number(),
    totalValidationErrors: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
})
  // Initialize with iteration count 0
  .map(async ({ inputData }) => ({
    websetId: inputData.websetId,
    iterationCount: 0,
  }))
  // Loop: generate query → search → enrich → validate → check quota
  .dowhile(iterationStep, async ({ inputData, iterationCount }) => {
    // Continue while target is not satisfied AND under max iterations
    const maxIterations = 10
    return !inputData.targetSatisfied && iterationCount < maxIterations
  })
  .commit()
