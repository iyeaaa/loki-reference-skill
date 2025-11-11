import { createStep } from "@mastra/core/workflows"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "../../../../../db"
import { websetRows } from "../../../../../db/schema/websets"
import { webCompanySearchSingleWorkflow } from "../web-company-search-single.workflow"
import type { CompanyInfoSchema } from "../web-search/types"

type CompanyData = z.infer<typeof CompanyInfoSchema>

/**
 * Step 1: Search for companies using generated query
 */
export const searchCompaniesStep = createStep({
  id: "search-companies",
  description: "Search for companies using the generated query",
  inputSchema: z.object({
    websetId: z.string().uuid(),
    iterationCount: z.number(),
    searchQuery: z.string(),
  }),
  outputSchema: z.object({
    websetId: z.string(),
    iterationCount: z.number(),
    searchQuery: z.string(),
    companiesSearched: z.number(),
    rowsAdded: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { websetId, searchQuery, iterationCount } = inputData

    console.log("🔍 Step 1: Searching for companies...")
    console.log(`  Using query: "${searchQuery}"`)

    try {
      const searchRun = await webCompanySearchSingleWorkflow.createRunAsync()
      const searchResult = await searchRun.start({
        inputData: {
          query: searchQuery,
        },
      })

      let companiesSearched = 0
      let rowsAdded = 0

      if (searchResult.status === "success") {
        const formatStepResult = searchResult.steps["format-results"]
        if (formatStepResult && formatStepResult.status === "success") {
          const searchOutput = formatStepResult.output as {
            companies: CompanyData[]
            totalCompanies: number
          }

          companiesSearched = searchOutput.totalCompanies
          console.log(`  ✅ Found ${companiesSearched} companies`)

          // Helper function to normalize website URL
          const normalizeWebsite = (url: string | null | undefined): string | null => {
            if (!url) return null
            return url
              .toLowerCase()
              .trim()
              .replace(/^https?:\/\//, "")
              .replace(/\/$/, "")
          }

          // Helper function to normalize name+location key
          const normalizeNameLocation = (
            name: string | null | undefined,
            location: string | null | undefined,
          ): string | null => {
            if (!name) return null
            const normalizedName = name.toLowerCase().trim()
            const normalizedLocation = location ? location.toLowerCase().trim() : ""
            return `${normalizedName}|${normalizedLocation}`
          }

          // Get existing rows to check for duplicates
          const existingRows = await db
            .select({
              data: websetRows.data,
            })
            .from(websetRows)
            .where(eq(websetRows.websetId, websetId))

          // Create Sets for fast duplicate lookup
          const existingWebsites = new Set<string>()
          const existingNameLocations = new Set<string>()

          for (const row of existingRows) {
            const data = row.data as CompanyData

            // Add normalized website if exists
            const normalizedWebsite = normalizeWebsite(data.website)
            if (normalizedWebsite) {
              existingWebsites.add(normalizedWebsite)
            }

            // Add normalized name+location as fallback
            const normalizedNameLocation = normalizeNameLocation(data.name, data.location)
            if (normalizedNameLocation) {
              existingNameLocations.add(normalizedNameLocation)
            }
          }

          // Filter out companies that already exist
          const newCompanies = searchOutput.companies.filter((company) => {
            // Check by website first (most reliable)
            const normalizedWebsite = normalizeWebsite(company.website)
            if (normalizedWebsite && existingWebsites.has(normalizedWebsite)) {
              return false // Duplicate website found
            }

            // If no website, check by name+location
            if (!normalizedWebsite) {
              const normalizedNameLocation = normalizeNameLocation(company.name, company.location)
              if (normalizedNameLocation && existingNameLocations.has(normalizedNameLocation)) {
                return false // Duplicate name+location found
              }
            }

            return true // Not a duplicate
          })

          console.log(
            `  📋 Filtered: ${newCompanies.length} new companies (${searchOutput.companies.length - newCompanies.length} duplicates skipped)`,
          )

          // Only insert new companies (with null criteriaAnswers to indicate not validated yet)
          // Normalize and lowercase all data before saving
          const rowsToInsert = newCompanies.map((company) => ({
            websetId,
            data: {
              name: company.name?.trim().toLowerCase() || null,
              website: normalizeWebsite(company.website),
              email: company.email?.trim()?.toLowerCase() || null,
              foundedYear: company.foundedYear ?? null,
              location: company.location?.trim().toLowerCase() || null,
              source: company.source?.toLowerCase() || null,
              sourceType: company.sourceType?.toLowerCase() || null,
              extractedAt: company.extractedAt,
            },
            criteriaAnswers: null, // Null indicates not validated yet
          }))

          if (rowsToInsert.length > 0) {
            await db.insert(websetRows).values(rowsToInsert)
            rowsAdded = rowsToInsert.length
            console.log(`  💾 Inserted ${rowsAdded} new rows to database\n`)
          } else {
            console.log(`  ℹ️  No new companies to insert (all duplicates)\n`)
          }
        }
      } else if (searchResult.status === "failed") {
        console.log(`  ❌ Search failed: ${searchResult.error.message}\n`)
      } else {
        console.log(`  ⚠️  Search suspended\n`)
      }

      return {
        websetId,
        iterationCount,
        searchQuery,
        companiesSearched,
        rowsAdded,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      console.error(`  ❌ Search step failed: ${errorMessage}\n`)
      throw error
    }
  },
})
