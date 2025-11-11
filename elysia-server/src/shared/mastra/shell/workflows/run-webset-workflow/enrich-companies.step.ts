import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows } from "../../../../../db/schema/websets"
import { webCompanyEnrichmentSingleWorkflow } from "../web-company-enrichment-single.workflow"
import type { CompanyInfoSchema } from "../web-search/types"

type CompanyData = z.infer<typeof CompanyInfoSchema>

/**
 * Step 2: Enrich companies with missing fields
 */
export const enrichCompaniesStep = createStep({
  id: "enrich-companies",
  description: "Enrich companies with missing fields using web research",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
    rowsEnriched: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { websetId } = inputData

    console.log("🔬 Step 2: Enriching companies with missing fields...")

    try {
      // Get all rows without complete enrichment (missing email, website, foundedYear, or location)
      const allRows = await db
        .select({
          id: websetRows.id,
          data: websetRows.data,
        })
        .from(websetRows)
        .where(eq(websetRows.websetId, websetId))

      const allRowsNeedingEnrichment = allRows.filter((row) => {
        const data = row.data as CompanyData
        return !data.email || !data.website || !data.foundedYear || !data.location
      })

      // Limit enrichment to prevent excessive processing per iteration
      const ENRICH_BATCH_SIZE = 10
      const rowsToEnrich = allRowsNeedingEnrichment.slice(0, ENRICH_BATCH_SIZE)

      console.log(
        `  Found ${allRowsNeedingEnrichment.length} rows needing enrichment, processing ${rowsToEnrich.length} in this iteration`,
      )

      let rowsEnriched = 0

      if (rowsToEnrich.length > 0) {
        // Enrich each company sequentially (to avoid rate limits)
        for (const row of rowsToEnrich) {
          try {
            const company = row.data as CompanyData

            const enrichRun = await webCompanyEnrichmentSingleWorkflow.createRunAsync()
            const enrichResult = await enrichRun.start({
              inputData: {
                company,
              },
            })

            if (enrichResult.status === "success") {
              const formatStepResult = enrichResult.steps["format-result"]
              if (formatStepResult && formatStepResult.status === "success") {
                const enrichOutput = formatStepResult.output as {
                  company: CompanyData
                  fieldsEnriched: string[]
                  enrichmentCount: number
                }

                // Update database with enriched data
                await db
                  .update(websetRows)
                  .set({
                    data: enrichOutput.company,
                    updatedAt: new Date(),
                  })
                  .where(eq(websetRows.id, row.id))

                if (enrichOutput.enrichmentCount > 0) {
                  rowsEnriched++
                  console.log(
                    `  ✅ Enriched "${company.name}": ${enrichOutput.fieldsEnriched.join(", ")}`,
                  )
                }
              }
            }
          } catch (_error) {
            console.log(`  ⚠️  Failed to enrich row ${row.id}`)
          }
        }

        console.log(`  💾 Updated ${rowsEnriched} enriched rows in database\n`)
      }

      return {
        ...inputData,
        rowsEnriched,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`  ❌ Enrichment step failed: ${errorMessage}\n`)
      throw error
    }
  },
})
