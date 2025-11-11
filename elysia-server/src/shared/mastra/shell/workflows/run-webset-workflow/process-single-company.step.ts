import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows } from "../../../../../db/schema/websets"
import { validateCriteriaWorkflow } from "../validate-criteria.workflow"
import { webCompanyEnrichmentSingleWorkflow } from "../web-company-enrichment-single.workflow"
import type { CompanyInfoSchema } from "../web-search/types"

type CompanyData = z.infer<typeof CompanyInfoSchema>

/**
 * Pipeline: Enrich single company → Validate single company
 * Processes one company through both enrichment and validation atomically
 */
export const processSingleCompanyStep = createStep({
  id: "process-single-company",
  description: "Enrich and validate a single company in a pipeline",
  inputSchema: z.object({
    rowId: z.string().uuid(),
    criterias: z.array(z.any()).nullable(),
  }),
  outputSchema: z.object({
    rowId: z.string().uuid(),
    enriched: z.boolean(),
    validated: z.boolean(),
    fieldsEnriched: z.array(z.string()),
    enrichmentError: z.boolean(),
    validationError: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const { rowId, criterias } = inputData

    // Get the row data
    const [row] = await db
      .select({
        id: websetRows.id,
        data: websetRows.data,
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.id, rowId))
      .limit(1)

    if (!row) {
      throw new Error(`Row ${rowId} not found`)
    }

    let company = row.data as CompanyData
    let enriched = false
    let fieldsEnriched: string[] = []
    let enrichmentError = false

    // ===== STEP 1: ENRICHMENT =====
    const needsEnrichment =
      !company.email || !company.website || !company.foundedYear || !company.location

    if (needsEnrichment) {
      try {
        const enrichRun = await webCompanyEnrichmentSingleWorkflow.createRunAsync()
        const enrichResult = await enrichRun.start({
          inputData: { company },
        })

        if (enrichResult.status === "success") {
          const formatStepResult = enrichResult.steps["format-result"]
          if (formatStepResult && formatStepResult.status === "success") {
            const enrichOutput = formatStepResult.output as {
              company: CompanyData
              fieldsEnriched: string[]
              enrichmentCount: number
            }

            company = enrichOutput.company
            fieldsEnriched = enrichOutput.fieldsEnriched
            enriched = enrichOutput.enrichmentCount > 0

            // Update database with enriched data
            await db
              .update(websetRows)
              .set({
                data: company,
                updatedAt: new Date(),
              })
              .where(eq(websetRows.id, rowId))
          }
        }
      } catch (_error) {
        enrichmentError = true
      }
    }

    // ===== STEP 2: VALIDATION =====
    let validated = false
    let validationError = false

    // Refetch criteriaAnswers after enrichment to ensure we have fresh data
    const [updatedRow] = await db
      .select({
        criteriaAnswers: websetRows.criteriaAnswers,
      })
      .from(websetRows)
      .where(eq(websetRows.id, rowId))
      .limit(1)

    if (!updatedRow) {
      throw new Error(`Row ${rowId} not found after enrichment`)
    }

    // Check if validation is needed using fresh data
    const answers = updatedRow.criteriaAnswers
    const needsValidation = !answers || answers.length === 0

    if (needsValidation && criterias && criterias.length > 0) {
      try {
        const dataString = JSON.stringify(company, null, 2)

        // Validate each criteria for this company
        const criteriaValidationPromises = criterias.map(async (criteria, index) => {
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
        })

        const criteriaResults = await Promise.all(criteriaValidationPromises)
        const criteriaAnswers = new Array(criterias.length).fill(false)
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
          .where(eq(websetRows.id, rowId))

        validated = true
        validationError = hasError
      } catch (_error) {
        validationError = true
      }
    }

    return {
      rowId,
      enriched,
      validated,
      fieldsEnriched,
      enrichmentError,
      validationError,
    }
  },
})
