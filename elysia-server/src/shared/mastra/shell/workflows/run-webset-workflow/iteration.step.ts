import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import PQueue from "p-queue"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows, websets } from "../../../../../db/schema/websets"
import { checkQuotaStep } from "./check-quota.step"
import { generateQueryStep } from "./generate-query.step"
import { processSingleCompanyStep } from "./process-single-company.step"
import { searchCompaniesStep } from "./search-companies.step"

/**
 * Combined iteration step that orchestrates:
 * 1. Check for unvalidated rows
 * 2. If none exist, generate query → search companies
 * 3. For each company: enrich → validate (pipeline per company)
 * 4. Check quota
 */
export const iterationStep = createStep({
  id: "iteration",
  description:
    "Run one complete iteration: optionally search, then process each company (enrich + validate), check quota",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
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
  execute: async (params) => {
    const { inputData } = params

    // Get webset configuration and criterias
    const [webset] = await db
      .select({
        criterias: websets.criterias,
        targetValidatedRows: websets.targetValidatedRows,
      })
      .from(websets)
      .where(eq(websets.id, inputData.websetId))
      .limit(1)

    if (!webset) {
      throw new Error("Webset not found")
    }

    // ===== PROACTIVE STOP CHECK =====
    // Check current state before processing
    const existingRows = await db
      .select({
        id: websetRows.id,
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.websetId, inputData.websetId))

    // Count validated rows (all criteria answers are true)
    const validatedRows = existingRows.filter((row) => {
      const answers = row.criteriaAnswers
      if (!answers || answers.length === 0) return false
      return answers.every((answer) => answer === true)
    }).length

    const unvalidatedRows = existingRows.filter((row) => {
      const answers = row.criteriaAnswers
      return !answers || answers.length === 0
    })

    // Check if target is already satisfied
    const targetValidatedRows = webset.targetValidatedRows ?? null
    const targetAlreadySatisfied =
      targetValidatedRows !== null && validatedRows >= targetValidatedRows

    if (targetAlreadySatisfied) {
      return {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        targetValidatedRows,
        currentValidatedRows: validatedRows,
        rowsWithoutValidation: unvalidatedRows.length,
        rowsWithoutEnrichment: 0,
        targetSatisfied: true,
        totalCompaniesSearched: 0,
        totalRowsAdded: 0,
        totalRowsEnriched: 0,
        totalRowsValidated: 0,
        totalValidationErrors: 0,
        message: `Target already satisfied (${validatedRows}/${targetValidatedRows})`,
        success: true,
      }
    }

    // ===== END PROACTIVE STOP CHECK =====

    let companiesSearched = 0
    let rowsAdded = 0

    // Step 1: Search companies only if no unvalidated rows exist
    if (unvalidatedRows.length === 0) {
      // Generate query
      const queryResult = await generateQueryStep.execute({ ...params, inputData })

      // Search companies
      const searchResult = await searchCompaniesStep.execute({ ...params, inputData: queryResult })
      companiesSearched = searchResult.companiesSearched
      rowsAdded = searchResult.rowsAdded
    }

    // Step 2: Get all unvalidated rows (including newly added ones)
    const allRows = await db
      .select({
        id: websetRows.id,
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.websetId, inputData.websetId))

    const rowsToProcess = allRows.filter((row) => {
      const answers = row.criteriaAnswers
      return !answers || answers.length === 0
    })

    // ===== CHECK BEFORE CONCURRENT PROCESSING =====
    // Recheck if target is satisfied before starting expensive concurrent work
    const revalidatedRows = allRows.filter((row) => {
      const answers = row.criteriaAnswers
      if (!answers || answers.length === 0) return false
      return answers.every((answer) => answer === true)
    }).length

    if (targetValidatedRows !== null && revalidatedRows >= targetValidatedRows) {
      return {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        targetValidatedRows,
        currentValidatedRows: revalidatedRows,
        rowsWithoutValidation: rowsToProcess.length,
        rowsWithoutEnrichment: 0,
        targetSatisfied: true,
        totalCompaniesSearched: companiesSearched,
        totalRowsAdded: rowsAdded,
        totalRowsEnriched: 0,
        totalRowsValidated: 0,
        totalValidationErrors: 0,
        message: `Target satisfied before processing (${revalidatedRows}/${targetValidatedRows})`,
        success: true,
      }
    }

    if (rowsToProcess.length === 0) {
      return {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        targetValidatedRows,
        currentValidatedRows: revalidatedRows,
        rowsWithoutValidation: 0,
        rowsWithoutEnrichment: 0,
        targetSatisfied: targetValidatedRows !== null && revalidatedRows >= targetValidatedRows,
        totalCompaniesSearched: companiesSearched,
        totalRowsAdded: rowsAdded,
        totalRowsEnriched: 0,
        totalRowsValidated: 0,
        totalValidationErrors: 0,
        message: "No companies to process",
        success: true,
      }
    }

    // Step 3: Process companies concurrently using p-queue (max 5 concurrent)
    const queue = new PQueue({ concurrency: 5 })
    let rowsEnriched = 0
    let rowsValidated = 0
    let validationErrors = 0

    const processingTasks = rowsToProcess.map((row) =>
      queue.add(async () => {
        try {
          const result = await processSingleCompanyStep.execute({
            ...params,
            inputData: {
              rowId: row.id,
              criterias: webset.criterias,
            },
          })

          if (result.enriched) rowsEnriched++
          if (result.validated) rowsValidated++
          if (result.enrichmentError || result.validationError) validationErrors++
        } catch (_error) {
          // Assume it's a general error, count as validation error
          validationErrors++
        }
      }),
    )

    // Wait for all tasks to complete
    await Promise.all(processingTasks)

    // Step 4: Check quota
    const quotaResult = await checkQuotaStep.execute({
      ...params,
      inputData: {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        searchQuery: "",
        companiesSearched,
        rowsAdded,
        rowsEnriched,
        rowsValidated,
        validationErrors,
      },
    })

    return quotaResult
  },
})
