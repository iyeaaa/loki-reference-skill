import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows } from "../../../../../db/schema/websets"
import { checkQuotaStep } from "./check-quota.step"
import { enrichCompaniesStep } from "./enrich-companies.step"
import { generateQueryStep } from "./generate-query.step"
import { searchCompaniesStep } from "./search-companies.step"
import { validateCompaniesStep } from "./validate-companies.step"

/**
 * Combined iteration step that orchestrates all sub-steps
 * This is a wrapper that calls each step sequentially
 */
export const iterationStep = createStep({
  id: "iteration",
  description: "Run one complete iteration: generate query, search, enrich, validate, check quota",
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

    // Check if there are unvalidated rows
    const existingRows = await db
      .select({
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.websetId, inputData.websetId))

    const unvalidatedCount = existingRows.filter((row) => {
      const answers = row.criteriaAnswers
      return !answers || answers.length === 0
    }).length

    let queryResult: { websetId: string; iterationCount: number; searchQuery: string }
    let searchResult: {
      websetId: string
      iterationCount: number
      searchQuery: string
      companiesSearched: number
      rowsAdded: number
    }

    // Skip search if there are already unvalidated companies
    if (unvalidatedCount > 0) {
      console.log(
        `  ⏭️  Skipping search step - ${unvalidatedCount} unvalidated companies already exist\n`,
      )
      queryResult = {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        searchQuery: "",
      }
      searchResult = {
        websetId: inputData.websetId,
        iterationCount: inputData.iterationCount,
        searchQuery: "",
        companiesSearched: 0,
        rowsAdded: 0,
      }
    } else {
      // Step 0: Generate query
      queryResult = await generateQueryStep.execute({ ...params, inputData })

      // Step 1: Search companies
      searchResult = await searchCompaniesStep.execute({ ...params, inputData: queryResult })
    }

    // Step 2: Enrich companies
    const enrichResult = await enrichCompaniesStep.execute({ ...params, inputData: searchResult })

    // Step 3: Validate companies
    const validateResult = await validateCompaniesStep.execute({
      ...params,
      inputData: enrichResult,
    })

    // Step 4: Check quota
    const quotaResult = await checkQuotaStep.execute({ ...params, inputData: validateResult })

    return quotaResult
  },
})
