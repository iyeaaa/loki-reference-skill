import { createStep, createWorkflow } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../db"
import { websetRows, websets } from "../../../../db/schema/websets"
import { validateCriteriaWorkflow } from "./validate-criteria.workflow"
import { webCompanySearchV2Workflow } from "./web-company-search-v2.workflow"

// Step 1: Check if target validated count is satisfied
const _checkTargetCountStep = createStep({
  id: "check-target-validated-count",
  description:
    "Check if the webset has met its target validated row count and count rows without validation",
  inputSchema: z.object({
    websetId: z.string().uuid().describe("The ID of the webset to check"),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { websetId } = inputData

    try {
      // Get webset configuration
      const [webset] = await db
        .select({
          id: websets.id,
          targetValidatedRows: websets.targetValidatedRows,
          criterias: websets.criterias,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        return {
          websetId,
          targetValidatedRows: null,
          currentValidatedRows: 0,
          rowsWithoutValidation: 0,
          targetSatisfied: false,
          message: "Webset not found",
          success: false,
        }
      }

      // Get all rows for this webset
      const rows = await db
        .select({
          id: websetRows.id,
          criteriaAnswers: websetRows.criteriaAnswers,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      // Count rows where ALL criteria are validated (all answers are true)
      const validatedRows = rows.filter((row) => {
        const answers = row.criteriaAnswers
        // A row is validated if it has criteria answers and ALL of them are true
        if (!answers || answers.length === 0) return false
        return answers.every((answer) => answer === true)
      })

      // Count rows without validation answers (null or empty array)
      const rowsWithoutValidation = rows.filter((row) => {
        const answers = row.criteriaAnswers
        return !answers || answers.length === 0
      }).length

      const currentValidatedRows = validatedRows.length
      const targetValidatedRows = webset.targetValidatedRows ?? null

      // Check if target is satisfied
      const targetSatisfied =
        targetValidatedRows !== null && currentValidatedRows >= targetValidatedRows

      let message = ""
      if (targetValidatedRows === null) {
        message = `No target set. Current validated rows: ${currentValidatedRows}, rows without validation: ${rowsWithoutValidation}`
      } else if (targetSatisfied) {
        message = `Target satisfied: ${currentValidatedRows}/${targetValidatedRows} validated rows, rows without validation: ${rowsWithoutValidation}`
      } else {
        message = `Target not satisfied: ${currentValidatedRows}/${targetValidatedRows} validated rows (need ${targetValidatedRows - currentValidatedRows} more), rows without validation: ${rowsWithoutValidation}`
      }

      return {
        websetId,
        targetValidatedRows,
        currentValidatedRows,
        rowsWithoutValidation,
        targetSatisfied,
        message,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        websetId,
        targetValidatedRows: null,
        currentValidatedRows: 0,
        rowsWithoutValidation: 0,
        targetSatisfied: false,
        message: `Failed to check target count: ${errorMessage}`,
        success: false,
      }
    }
  },
})

// Step 2: Search for companies and save as webset rows
const _searchAndSaveStep = createStep({
  id: "search-and-save-companies",
  description: "Search for companies using web search and save results as webset rows",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    message: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const {
      websetId,
      targetValidatedRows,
      currentValidatedRows,
      rowsWithoutValidation,
      targetSatisfied,
    } = inputData

    // If target is already satisfied, skip search
    if (targetSatisfied) {
      return {
        websetId,
        targetValidatedRows,
        currentValidatedRows,
        rowsWithoutValidation,
        targetSatisfied,
        companiesSearched: 0,
        rowsAdded: 0,
        message: "Target already satisfied, skipping search",
        success: true,
      }
    }

    try {
      // Get webset to retrieve query
      const [webset] = await db
        .select({
          id: websets.id,
          query: websets.query,
          targetValidatedRows: websets.targetValidatedRows,
          criterias: websets.criterias,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        return {
          websetId,
          targetValidatedRows,
          currentValidatedRows,
          rowsWithoutValidation,
          targetSatisfied: false,
          companiesSearched: 0,
          rowsAdded: 0,
          message: "Webset not found",
          success: false,
        }
      }

      // Calculate target count for web search
      const targetCount = targetValidatedRows
        ? Math.max(150, targetValidatedRows - currentValidatedRows)
        : 150

      // Call web-company-search-v2 workflow
      const searchRun = await webCompanySearchV2Workflow.createRunAsync()

      const searchResult = await searchRun.start({
        inputData: {
          query: webset.query,
          targetCount,
        },
      })

      if (searchResult.status === "failed") {
        return {
          websetId,
          targetValidatedRows,
          currentValidatedRows,
          rowsWithoutValidation,
          targetSatisfied: false,
          companiesSearched: 0,
          rowsAdded: 0,
          message: `Web search failed: ${searchResult.error.message}`,
          success: false,
        }
      }

      // Extract the final step result
      const formatStepResult = searchResult.steps["format-results"]

      if (!formatStepResult || formatStepResult.status !== "success") {
        return {
          websetId,
          targetValidatedRows,
          currentValidatedRows,
          rowsWithoutValidation,
          targetSatisfied: false,
          companiesSearched: 0,
          rowsAdded: 0,
          message: "Web search step failed",
          success: false,
        }
      }

      const searchOutput = formatStepResult.output as {
        companies: Array<{
          name: string
          website?: string | null
          email?: string | null
          foundedYear?: number | null
          location?: string | null
          source: string
          sourceType: string
          extractedAt: string
        }>
        totalCompanies: number
        success: boolean
      }

      // Save each company as a webset row
      const rowsToInsert = searchOutput.companies.map((company) => ({
        websetId,
        data: {
          name: company.name,
          website: company.website ?? null,
          email: company.email ?? null,
          foundedYear: company.foundedYear ?? null,
          location: company.location ?? null,
          source: company.source,
          sourceType: company.sourceType,
          extractedAt: company.extractedAt,
        },
        criteriaAnswers: webset.criterias ? new Array(webset.criterias.length).fill(false) : null,
      }))

      // Batch insert all rows
      if (rowsToInsert.length > 0) {
        await db.insert(websetRows).values(rowsToInsert)
      }

      return {
        websetId,
        targetValidatedRows,
        currentValidatedRows,
        rowsWithoutValidation: rowsWithoutValidation + rowsToInsert.length,
        targetSatisfied: false,
        companiesSearched: searchOutput.totalCompanies,
        rowsAdded: rowsToInsert.length,
        message: `Searched and added ${rowsToInsert.length} companies from web search`,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        websetId,
        targetValidatedRows,
        currentValidatedRows,
        rowsWithoutValidation,
        targetSatisfied: false,
        companiesSearched: 0,
        rowsAdded: 0,
        message: `Failed to search and save companies: ${errorMessage}`,
        success: false,
      }
    }
  },
})

// Step for when target is satisfied (early exit)
const _targetSatisfiedStep = createStep({
  id: "target-satisfied-end",
  description: "Target is satisfied, end workflow",
  inputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    message: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => ({
    ...inputData,
    companiesSearched: 0,
    rowsAdded: 0,
  }),
})

// Step for when we have sufficient rows (no need to search)
const _sufficientRowsStep = createStep({
  id: "sufficient-rows-end",
  description: "Sufficient rows available, end workflow",
  inputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    message: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => ({
    ...inputData,
    companiesSearched: 0,
    rowsAdded: 0,
    message: `${inputData.message}. Sufficient rows available (${inputData.rowsWithoutValidation} unvalidated + ${inputData.currentValidatedRows} validated)`,
  }),
})

// Step 3: Validate all unverified rows
const _validateRowsStep = createStep({
  id: "validate-unverified-rows",
  description: "Validate all rows with unverified criteria answers",
  inputSchema: z.object({
    websetId: z.string(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    rowsValidated: z.number(),
    validationErrors: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { websetId } = inputData

    try {
      // Get webset to retrieve criterias
      const [webset] = await db
        .select({
          id: websets.id,
          criterias: websets.criterias,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        return {
          websetId,
          rowsValidated: 0,
          validationErrors: 0,
          message: "Webset not found",
          success: false,
        }
      }

      if (!webset.criterias || webset.criterias.length === 0) {
        return {
          websetId,
          rowsValidated: 0,
          validationErrors: 0,
          message: "No criterias defined for this webset",
          success: true,
        }
      }

      // Get all rows without validation (null or empty criteriaAnswers)
      const unverifiedRows = await db
        .select({
          id: websetRows.id,
          data: websetRows.data,
          criteriaAnswers: websetRows.criteriaAnswers,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      const rowsToValidate = unverifiedRows.filter((row) => {
        const answers = row.criteriaAnswers
        return !answers || answers.length === 0
      })

      if (rowsToValidate.length === 0) {
        return {
          websetId,
          rowsValidated: 0,
          validationErrors: 0,
          message: "No unverified rows to validate",
          success: true,
        }
      }

      // Validate each row's criteria concurrently
      const validationPromises = rowsToValidate.map(async (row) => {
        try {
          // Validate each criteria for this row
          const criteriaValidationPromises =
            webset.criterias?.map(async (criteria, index) => {
              // Convert row data to string for validation
              const dataString = JSON.stringify(row.data, null, 2)

              // Call validate-criteria workflow
              const validationRun = await validateCriteriaWorkflow.createRunAsync()
              const validationResult = await validationRun.start({
                inputData: {
                  criteria,
                  data: dataString,
                },
              })

              if (validationResult.status === "failed") {
                return { index, isValidated: false, error: validationResult.error.message }
              }

              // Get the result from the final step
              const stepResult = validationResult.steps["structured-extraction-step"]
              if (!stepResult || stepResult.status !== "success") {
                return { index, isValidated: false, error: "Validation step failed" }
              }

              const output = stepResult.output as {
                isValidated: boolean
                success: boolean
              }

              return { index, isValidated: output.isValidated, error: null }
            }) || []

          const criteriaResults = await Promise.all(criteriaValidationPromises)

          // Build the criteriaAnswers array
          const criteriaAnswers = new Array(webset.criterias?.length || 0).fill(false)
          let hasError = false

          for (const result of criteriaResults) {
            if (result.error) {
              hasError = true
            } else {
              criteriaAnswers[result.index] = result.isValidated
            }
          }

          // Update the row with validation results
          await db
            .update(websetRows)
            .set({
              criteriaAnswers,
              updatedAt: new Date(),
            })
            .where(eq(websetRows.id, row.id))

          return { success: !hasError, rowId: row.id }
        } catch (error) {
          return { success: false, rowId: row.id, error }
        }
      })

      const validationResults = await Promise.all(validationPromises)

      const successCount = validationResults.filter((r) => r.success).length
      const errorCount = validationResults.filter((r) => !r.success).length

      return {
        websetId,
        rowsValidated: successCount,
        validationErrors: errorCount,
        message: `Validated ${successCount} rows (${errorCount} errors)`,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        websetId,
        rowsValidated: 0,
        validationErrors: 0,
        message: `Failed to validate rows: ${errorMessage}`,
        success: false,
      }
    }
  },
})

// Combined step: check target, branch, and validate (for looping)
const checkSearchValidateStep = createStep({
  id: "check-search-validate-loop",
  description: "Check target, optionally search for companies, and validate rows",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number().default(0),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    totalCompaniesSearched: z.number(),
    totalRowsAdded: z.number(),
    totalRowsValidated: z.number(),
    totalValidationErrors: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { websetId, iterationCount } = inputData
    const currentIteration = iterationCount + 1

    try {
      // Step 1: Check target count
      const [webset] = await db
        .select({
          id: websets.id,
          targetValidatedRows: websets.targetValidatedRows,
          criterias: websets.criterias,
          query: websets.query,
        })
        .from(websets)
        .where(eq(websets.id, websetId))
        .limit(1)

      if (!webset) {
        return {
          websetId,
          iterationCount: currentIteration,
          targetValidatedRows: null,
          currentValidatedRows: 0,
          rowsWithoutValidation: 0,
          targetSatisfied: false,
          totalCompaniesSearched: 0,
          totalRowsAdded: 0,
          totalRowsValidated: 0,
          totalValidationErrors: 0,
          message: "Webset not found",
          success: false,
        }
      }

      // Get all rows for this webset
      const rows = await db
        .select({
          id: websetRows.id,
          criteriaAnswers: websetRows.criteriaAnswers,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      // Count validated rows
      const validatedRows = rows.filter((row) => {
        const answers = row.criteriaAnswers
        if (!answers || answers.length === 0) return false
        return answers.every((answer) => answer === true)
      })

      // Count rows without validation
      const unverifiedRows = rows.filter((row) => {
        const answers = row.criteriaAnswers
        return !answers || answers.length === 0
      })

      const currentValidatedRows = validatedRows.length
      const rowsWithoutValidation = unverifiedRows.length
      const targetValidatedRows = webset.targetValidatedRows ?? null
      const targetSatisfied =
        targetValidatedRows !== null && currentValidatedRows >= targetValidatedRows

      let companiesSearched = 0
      let rowsAdded = 0

      // Step 2: Conditionally search for companies if needed
      if (
        !targetSatisfied &&
        targetValidatedRows !== null &&
        rowsWithoutValidation + currentValidatedRows < targetValidatedRows
      ) {
        const targetCount = Math.max(150, targetValidatedRows - currentValidatedRows)

        const searchRun = await webCompanySearchV2Workflow.createRunAsync()
        const searchResult = await searchRun.start({
          inputData: {
            query: webset.query,
            targetCount,
          },
        })

        if (searchResult.status === "success") {
          const formatStepResult = searchResult.steps["format-results"]
          if (formatStepResult && formatStepResult.status === "success") {
            const searchOutput = formatStepResult.output as {
              companies: Array<{
                name: string
                website?: string | null
                email?: string | null
                foundedYear?: number | null
                location?: string | null
                source: string
                sourceType: string
                extractedAt: string
              }>
              totalCompanies: number
            }

            companiesSearched = searchOutput.totalCompanies

            // Save companies as webset rows
            const rowsToInsert = searchOutput.companies.map((company) => ({
              websetId,
              data: {
                name: company.name,
                website: company.website ?? null,
                email: company.email ?? null,
                foundedYear: company.foundedYear ?? null,
                location: company.location ?? null,
                source: company.source,
                sourceType: company.sourceType,
                extractedAt: company.extractedAt,
              },
              criteriaAnswers: webset.criterias
                ? new Array(webset.criterias.length).fill(false)
                : null,
            }))

            if (rowsToInsert.length > 0) {
              await db.insert(websetRows).values(rowsToInsert)
              rowsAdded = rowsToInsert.length
            }
          }
        }
      }

      // Step 3: Validate unverified rows
      let rowsValidated = 0
      let validationErrors = 0

      if (!targetSatisfied && webset.criterias && webset.criterias.length > 0) {
        // Re-fetch unverified rows after potential search additions
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

        if (rowsToValidate.length > 0) {
          const validationPromises = rowsToValidate.map(async (row) => {
            try {
              const criteriaValidationPromises =
                webset.criterias?.map(async (criteria, index) => {
                  const dataString = JSON.stringify(row.data, null, 2)

                  const validationRun = await validateCriteriaWorkflow.createRunAsync()
                  const validationResult = await validationRun.start({
                    inputData: { criteria, data: dataString },
                  })

                  if (validationResult.status === "failed") {
                    return { index, isValidated: false, error: validationResult.error.message }
                  }

                  const stepResult = validationResult.steps["structured-extraction-step"]
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
        }
      }

      // Re-check target satisfaction after validation
      const finalRows = await db
        .select({
          id: websetRows.id,
          criteriaAnswers: websetRows.criteriaAnswers,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      const finalValidatedRows = finalRows.filter((row) => {
        const answers = row.criteriaAnswers
        if (!answers || answers.length === 0) return false
        return answers.every((answer) => answer === true)
      }).length

      const finalUnverified = finalRows.filter((row) => {
        const answers = row.criteriaAnswers
        return !answers || answers.length === 0
      }).length

      const finalTargetSatisfied =
        targetValidatedRows !== null && finalValidatedRows >= targetValidatedRows

      let message = `Iteration ${currentIteration}: `
      if (finalTargetSatisfied) {
        message += `Target satisfied (${finalValidatedRows}/${targetValidatedRows})`
      } else {
        message += `Validated ${rowsValidated} rows, added ${rowsAdded} companies. Current: ${finalValidatedRows}/${targetValidatedRows || "no target"}, unverified: ${finalUnverified}`
      }

      return {
        websetId,
        iterationCount: currentIteration,
        targetValidatedRows,
        currentValidatedRows: finalValidatedRows,
        rowsWithoutValidation: finalUnverified,
        targetSatisfied: finalTargetSatisfied,
        totalCompaniesSearched: companiesSearched,
        totalRowsAdded: rowsAdded,
        totalRowsValidated: rowsValidated,
        totalValidationErrors: validationErrors,
        message,
        success: true,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      return {
        websetId,
        iterationCount: currentIteration,
        targetValidatedRows: null,
        currentValidatedRows: 0,
        rowsWithoutValidation: 0,
        targetSatisfied: false,
        totalCompaniesSearched: 0,
        totalRowsAdded: 0,
        totalRowsValidated: 0,
        totalValidationErrors: 0,
        message: `Iteration ${currentIteration} failed: ${errorMessage}`,
        success: false,
      }
    }
  },
})

// Main workflow
export const runWebsetWorkflow = createWorkflow({
  id: "run-webset",
  description:
    "Execute webset: repeatedly check target, search for companies if needed, validate rows until target satisfied",
  inputSchema: z.object({
    websetId: z.string().uuid().describe("The ID of the webset to run"),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    targetValidatedRows: z.number().nullable(),
    currentValidatedRows: z.number(),
    rowsWithoutValidation: z.number(),
    targetSatisfied: z.boolean(),
    totalCompaniesSearched: z.number(),
    totalRowsAdded: z.number(),
    totalRowsValidated: z.number(),
    totalValidationErrors: z.number(),
    message: z.string(),
    success: z.boolean(),
  }),
})
  .map(async ({ inputData }) => ({
    websetId: inputData.websetId,
    iterationCount: 0,
  }))
  .dowhile(checkSearchValidateStep, async ({ inputData, iterationCount }) => {
    // Continue while target is not satisfied AND we have unverified rows AND under max iterations
    const maxIterations = 10
    return (
      !inputData.targetSatisfied &&
      inputData.rowsWithoutValidation > 0 &&
      iterationCount < maxIterations
    )
  })
  .commit()
