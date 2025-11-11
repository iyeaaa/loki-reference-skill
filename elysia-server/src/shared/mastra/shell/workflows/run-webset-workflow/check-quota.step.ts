import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows, websets } from "../../../../../db/schema/websets"
import type { CompanyInfoSchema } from "../web-search/types"

type CompanyData = z.infer<typeof CompanyInfoSchema>

/**
 * Step 4: Check if quota is satisfied
 */
export const checkQuotaStep = createStep({
  id: "check-quota",
  description: "Check if target validated rows quota is satisfied",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    rowsEnriched: z.number(),
    rowsValidated: z.number(),
    validationErrors: z.number(),
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
  execute: async ({ inputData }) => {
    const {
      websetId,
      iterationCount,
      companiesSearched,
      rowsAdded,
      rowsEnriched,
      rowsValidated,
      validationErrors,
    } = inputData

    console.log("📊 Step 4: Checking quota status...")

    try {
      // Get webset configuration
      const [webset] = await db
        .select({
          targetValidatedRows: websets.targetValidatedRows,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        throw new Error("Webset not found")
      }

      // Get all rows for this webset
      const finalRows = await db
        .select({
          id: websetRows.id,
          data: websetRows.data,
          criteriaAnswers: websetRows.criteriaAnswers,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      // Count rows where ALL criteria are validated (all answers are true)
      const validatedRows = finalRows.filter((row) => {
        const answers = row.criteriaAnswers
        if (!answers || answers.length === 0) return false
        return answers.every((answer) => answer === true)
      }).length

      // Count rows without validation (null or empty array)
      const unverifiedRows = finalRows.filter((row) => {
        const answers = row.criteriaAnswers
        return !answers || answers.length === 0
      }).length

      // Count rows needing enrichment
      const unenrichedRows = finalRows.filter((row) => {
        const data = row.data as CompanyData
        return !data.email || !data.website || !data.foundedYear || !data.location
      }).length

      const targetValidatedRows = webset.targetValidatedRows ?? null
      const targetSatisfied = targetValidatedRows !== null && validatedRows >= targetValidatedRows

      // Check if no progress was made in this iteration
      const noProgressMade = rowsAdded === 0 && rowsEnriched === 0 && rowsValidated === 0
      const shouldForceExit = noProgressMade && !targetSatisfied && iterationCount > 1

      let message = `Iteration ${iterationCount}: `
      if (targetSatisfied) {
        message += `🎉 Target satisfied (${validatedRows}/${targetValidatedRows})`
      } else if (shouldForceExit) {
        message += `⚠️  No progress made (added: ${rowsAdded}, enriched: ${rowsEnriched}, validated: ${rowsValidated}). Forcing early exit to prevent infinite loop.`
      } else {
        message += `Added ${rowsAdded}, enriched ${rowsEnriched}, validated ${rowsValidated}. Current: ${validatedRows}/${targetValidatedRows || "no target"}, unverified: ${unverifiedRows}, unenriched: ${unenrichedRows}`
      }

      console.log(`  ${message}\n`)

      return {
        websetId,
        iterationCount,
        targetValidatedRows,
        currentValidatedRows: validatedRows,
        rowsWithoutValidation: unverifiedRows,
        rowsWithoutEnrichment: unenrichedRows,
        targetSatisfied: targetSatisfied || shouldForceExit, // Force exit if no progress
        totalCompaniesSearched: companiesSearched,
        totalRowsAdded: rowsAdded,
        totalRowsEnriched: rowsEnriched,
        totalRowsValidated: rowsValidated,
        totalValidationErrors: validationErrors,
        message,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`  ❌ Check quota step failed: ${errorMessage}\n`)
      throw error
    }
  },
})
