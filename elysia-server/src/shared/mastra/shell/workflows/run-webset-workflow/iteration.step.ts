import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
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

    // Get webset criterias for validation
    const [webset] = await db
      .select({
        criterias: websets.criterias,
      })
      .from(websets)
      .where(eq(websets.id, inputData.websetId))
      .limit(1)

    if (!webset) {
      throw new Error("Webset not found")
    }

    // Check if there are unvalidated rows
    const existingRows = await db
      .select({
        id: websetRows.id,
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.websetId, inputData.websetId))

    const unvalidatedRows = existingRows.filter((row) => {
      const answers = row.criteriaAnswers
      return !answers || answers.length === 0
    })

    let companiesSearched = 0
    let rowsAdded = 0

    // Step 1: Search companies only if no unvalidated rows exist
    if (unvalidatedRows.length === 0) {
      console.log("🔍 No unvalidated companies found, searching for new companies...\n")

      // Generate query
      const queryResult = await generateQueryStep.execute({ ...params, inputData })

      // Search companies
      const searchResult = await searchCompaniesStep.execute({ ...params, inputData: queryResult })
      companiesSearched = searchResult.companiesSearched
      rowsAdded = searchResult.rowsAdded
    } else {
      console.log(
        `  ⏭️  Skipping search step - ${unvalidatedRows.length} unvalidated companies already exist\n`,
      )
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

    console.log(
      `🔄 Processing ${rowsToProcess.length} companies through enrichment → validation pipeline...\n`,
    )

    // Step 3: Process each company sequentially through the pipeline
    let rowsEnriched = 0
    let rowsValidated = 0
    let enrichmentErrors = 0
    let validationErrors = 0

    for (const row of rowsToProcess) {
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
        if (result.enrichmentError) enrichmentErrors++
        if (result.validationError) validationErrors++
      } catch (_error) {
        console.log(`  ❌ Failed to process row ${row.id}`)
        // Assume it's a general error, count as validation error
        validationErrors++
      }
    }

    console.log(`  💾 Enriched ${rowsEnriched} companies`)
    console.log(`  💾 Validated ${rowsValidated} companies`)
    if (enrichmentErrors > 0) {
      console.log(`  ⚠️  ${enrichmentErrors} enrichment errors`)
    }
    if (validationErrors > 0) {
      console.log(`  ⚠️  ${validationErrors} validation errors`)
    }
    console.log()

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
