import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows, websets } from "../../../../../db/schema/websets"
import { validateCriteriaWorkflow } from "../validate-criteria.workflow"

/**
 * Step 3: Validate companies against criteria
 */
export const validateCompaniesStep = createStep({
  id: "validate-companies",
  description: "Validate companies against webset criteria",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    rowsEnriched: z.number(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    rowsEnriched: z.number(),
    rowsValidated: z.number(),
    validationErrors: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { websetId } = inputData

    console.log("✅ Step 3: Validating companies against criteria...")

    try {
      // Get webset criterias
      const [webset] = await db
        .select({
          criterias: websets.criterias,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        throw new Error("Webset not found")
      }

      let rowsValidated = 0
      let validationErrors = 0

      if (webset.criterias && webset.criterias.length > 0) {
        // Get all rows without validation
        const unverifiedRowsData = await db
          .select({
            id: websetRows.id,
            data: websetRows.data,
            criteriaAnswers: websetRows.criteriaAnswers,
          })
          .from(websetRows)
          .where(eq(websetRows.websetId, websetId))

        const rowsToValidate = unverifiedRowsData.filter((row) => {
          const answers = row.criteriaAnswers
          return !answers || answers.length === 0
        })

        console.log(`  Found ${rowsToValidate.length} rows needing validation`)

        if (rowsToValidate.length > 0) {
          // Validate each row (parallel execution)
          const validationPromises = rowsToValidate.map(async (row) => {
            try {
              const dataString = JSON.stringify(row.data, null, 2)

              // Validate each criteria for this row
              const criteriaValidationPromises =
                webset.criterias?.map(async (criteria, index) => {
                  const validationRun = await validateCriteriaWorkflow.createRunAsync()
                  const validationResult = await validationRun.start({
                    inputData: { criteria, data: dataString },
                  })

                  if (validationResult.status === "failed") {
                    return { index, isValidated: false, error: validationResult.error.message }
                  }

                  const stepResult = validationResult.steps["direct-validation-step"]
                  if (!stepResult || stepResult.status !== "success") {
                    return { index, isValidated: false, error: "Validation step failed" }
                  }

                  const output = stepResult.output as { isValidated: boolean }
                  return { index, isValidated: output.isValidated, error: null }
                }) || []

              const criteriaResults = await Promise.all(criteriaValidationPromises)
              const criteriaAnswers = new Array(webset.criterias?.length || 0).fill(false)
              let hasError = false

              for (const result of criteriaResults) {
                if (result.error) {
                  hasError = true
                } else {
                  criteriaAnswers[result.index] = result.isValidated
                }
              }

              // Update database with validation results
              await db
                .update(websetRows)
                .set({ criteriaAnswers, updatedAt: new Date() })
                .where(eq(websetRows.id, row.id))

              return { success: !hasError, rowId: row.id }
            } catch (error) {
              return { success: false, rowId: row.id, error }
            }
          })

          const validationResults = await Promise.all(validationPromises)
          rowsValidated = validationResults.filter((r) => r.success).length
          validationErrors = validationResults.filter((r) => !r.success).length

          console.log(`  💾 Updated ${rowsValidated} validated rows in database`)
          if (validationErrors > 0) {
            console.log(`  ⚠️  ${validationErrors} validation errors`)
          }
        }
      }

      console.log()

      return {
        ...inputData,
        rowsValidated,
        validationErrors,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`  ❌ Validation step failed: ${errorMessage}\n`)
      throw error
    }
  },
})
