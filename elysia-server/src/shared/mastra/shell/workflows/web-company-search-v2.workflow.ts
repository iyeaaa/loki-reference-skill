import { createOpenAI } from "@ai-sdk/openai"
import { createStep, createWorkflow } from "@mastra/core/workflows"
import { generateObject } from "ai"
import { z } from "zod"
import { mastraConfig } from "../config"
import { enrichDataWorkflow } from "./enrich-data.workflow"
import { googleSearch, jinaReader } from "./web-search/api-clients"
import {
  APIStatsSchema,
  CompanyInfoSchema,
  SearchIterationSchema,
  SearchQuerySchema,
} from "./web-search/types"
import { cleanCompanies, deduplicateCompanies } from "./web-search/utils"

/**
 * Web Company Search Workflow V2
 * Multi-step workflow with proper data flow between steps
 *
 * Flow:
 * 1. Generate queries
 * 2. Search and extract (CONCURRENT)
 * 3. Clean and deduplicate
 * 4. Format results
 */

type CompanyInfo = z.infer<typeof CompanyInfoSchema>

/**
 * Step 1: Generate diverse search queries using AI
 */
const generateQueriesStep = createStep({
  id: "generate-queries",
  description: "Generate diverse search queries using AI",
  inputSchema: z.object({
    query: z.string().min(1),
    targetCount: z.number().default(150),
  }),
  outputSchema: z.object({
    queries: z.array(SearchQuerySchema),
    targetCount: z.number(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { query, targetCount } = inputData
    const searchQueryCount = 5 // Always generate 5 queries

    const openai = createOpenAI({ apiKey: mastraConfig.openaiApiKey })
    const startTime = new Date().toISOString()

    console.log("🚀 Web Company Search V2")
    console.log(`Query: "${query}"`)
    console.log(`Target: ${targetCount} companies`)
    console.log(`📝 Generating ${searchQueryCount} search queries...\n`)

    const { object } = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        queries: z.array(SearchQuerySchema),
      }),
      prompt: `Generate ${searchQueryCount} unique SERP search queries for: "${query}"

Each query should approach from a different angle. Vary search terms and synonyms.`,
      temperature: 0.8,
    })

    console.log(`✅ Generated ${object.queries.length} queries\n`)

    return {
      queries: object.queries,
      targetCount,
      startTime,
    }
  },
})

/**
 * Step 2: Execute searches and extract companies (CONCURRENT)
 */
const searchAndExtractStep = createStep({
  id: "search-and-extract",
  description: "Execute searches and extract companies using three-tier strategy",
  inputSchema: z.object({
    queries: z.array(SearchQuerySchema),
    targetCount: z.number(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    iterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { queries, targetCount, startTime } = inputData

    const openai = createOpenAI({ apiKey: mastraConfig.openaiApiKey })

    console.log("🔄 Processing queries concurrently...\n")

    // Process all queries in parallel
    const queryResults = await Promise.allSettled(
      queries.map(async (searchQuery, index) => {
        console.log(`[Query ${index + 1}/${queries.length}] 🔍 "${searchQuery.query}"`)

        const queryCompanies: CompanyInfo[] = []
        let querySerpCalls = 0
        let queryJinaReaderCalls = 0
        let queryOpenaiCalls = 0

        try {
          const searchResults = await googleSearch({
            query: searchQuery.query,
            location: searchQuery.location,
            language: searchQuery.language,
            hasdataApiKey: mastraConfig.hasdataApiKey,
          })
          querySerpCalls++
          console.log(`  Found ${searchResults.length} results`)

          // TIER 1: Extract from snippets
          const relevantResults = searchResults.filter(
            (r) => r.snippet && (r.snippet.length > 50 || r.title.length > 20),
          )

          if (relevantResults.length > 0) {
            const snippetsCtx = relevantResults
              .slice(0, 20)
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.link}\n${r.snippet || ""}`)
              .join("\n\n")

            const { object: snippetRes } = await generateObject({
              model: openai("gpt-4o-mini"),
              schema: z.object({
                contacts: z.array(
                  z.object({
                    name: z.string(),
                    website: z.string().optional().nullable(),
                    email: z.string().optional().nullable(),
                    foundedYear: z.number().optional().nullable(),
                    location: z.string().optional().nullable(),
                    resultIndex: z.number(),
                  }),
                ),
              }),
              prompt: `Extract companies:\n\n${snippetsCtx}\n\nExtract: name, website, email, foundedYear, location, resultIndex. Set fields to null if not found.`,
              temperature: 0.3,
            })
            queryOpenaiCalls++

            const snippetCompanies: CompanyInfo[] = snippetRes.contacts.map((c) => ({
              name: c.name,
              website: c.website ?? null,
              email: c.email ?? null,
              foundedYear: c.foundedYear ?? null,
              location: c.location ?? null,
              source: relevantResults[c.resultIndex - 1]?.link || searchQuery.query,
              sourceType: "snippet" as const,
              extractedAt: new Date().toISOString(),
            }))

            queryCompanies.push(...snippetCompanies)
            console.log(`  ✓ ${snippetCompanies.length} from snippets`)
          }

          // TIER 2: Detect and extract from directories
          const candidates = searchResults.slice(0, 10)
          if (candidates.length > 0) {
            const candidatesCtx = candidates
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.link}`)
              .join("\n\n")

            const { object: dirRes } = await generateObject({
              model: openai("gpt-4o-mini"),
              schema: z.object({
                directories: z.array(
                  z.object({
                    resultIndex: z.number(),
                    confidence: z.enum(["high", "medium", "low"]),
                  }),
                ),
              }),
              prompt: `Which are directory/list pages?\n\n${candidatesCtx}\n\nReturn MEDIUM or HIGH confidence only.`,
              temperature: 0.2,
            })
            queryOpenaiCalls++

            const directories = dirRes.directories
              .filter((d) => d.confidence !== "low")
              .map((d) => candidates[d.resultIndex - 1])
              .filter((r): r is NonNullable<typeof r> => !!r)
              .slice(0, 3)

            if (directories.length > 0) {
              console.log(`  Found ${directories.length} directories`)

              const dirExtractions = await Promise.allSettled(
                directories.map(async (dir) => {
                  queryJinaReaderCalls++
                  const content = await jinaReader({
                    url: dir.link,
                    jinaApiKey: mastraConfig.jinaApiKey,
                  })
                  const truncated = content.length > 15_000 ? content.slice(0, 15_000) : content

                  const { object } = await generateObject({
                    model: openai("gpt-4o"),
                    schema: z.object({
                      companies: z.array(
                        z.object({
                          name: z.string(),
                          website: z.string().optional().nullable(),
                          email: z.string().optional().nullable(),
                          foundedYear: z.number().optional().nullable(),
                          location: z.string().optional().nullable(),
                        }),
                      ),
                    }),
                    prompt: `Extract ALL companies:\n\n${dir.title}\n${dir.link}\n\n${truncated}\n\nExtract: name, website, email, foundedYear, location. Set fields to null if not found.`,
                    temperature: 0.3,
                  })
                  queryOpenaiCalls++

                  return object.companies.map(
                    (c): CompanyInfo => ({
                      name: c.name,
                      website: c.website ?? null,
                      email: c.email ?? null,
                      foundedYear: c.foundedYear ?? null,
                      location: c.location ?? null,
                      source: dir.link,
                      sourceType: "directory" as const,
                      extractedAt: new Date().toISOString(),
                    }),
                  )
                }),
              )

              for (const res of dirExtractions) {
                if (res.status === "fulfilled") {
                  queryCompanies.push(...res.value)
                }
              }

              const dirCount = dirExtractions
                .filter((r) => r.status === "fulfilled")
                .reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value.length : 0), 0)
              console.log(`  ✓ ${dirCount} from directories`)
            }
          }

          // TIER 3: Extract from individual pages
          const extracted = new Set(queryCompanies.map((c) => c.source))
          const newResults = searchResults.filter((r) => !extracted.has(r.link)).slice(0, 15)

          if (newResults.length > 0) {
            const newCtx = newResults.map((r, i) => `[${i + 1}] ${r.title}\n${r.link}`).join("\n\n")

            const { object: evalRes } = await generateObject({
              model: openai("gpt-4o-mini"),
              schema: z.object({
                worthOpening: z.array(
                  z.object({
                    resultIndex: z.number(),
                    priority: z.number().min(0).max(3),
                  }),
                ),
              }),
              prompt: `Which pages worth opening?\n\n${newCtx}\n\nPriority: 3=High, 2=Medium. Return >= 2 only.`,
              temperature: 0.3,
            })
            queryOpenaiCalls++

            const pagesToOpen = evalRes.worthOpening
              .filter((p) => p.priority >= 2)
              .map((p) => newResults[p.resultIndex - 1])
              .filter((r): r is NonNullable<typeof r> => !!r)
              .slice(0, 5)

            if (pagesToOpen.length > 0) {
              const pageExtractions = await Promise.allSettled(
                pagesToOpen.map(async (page) => {
                  queryJinaReaderCalls++
                  const content = await jinaReader({
                    url: page.link,
                    jinaApiKey: mastraConfig.jinaApiKey,
                  })
                  const truncated = content.length > 8000 ? content.slice(0, 8000) : content

                  const { object } = await generateObject({
                    model: openai("gpt-4o-mini"),
                    schema: z.object({
                      found: z.boolean(),
                      company: z
                        .object({
                          name: z.string(),
                          website: z.string().optional().nullable(),
                          email: z.string().optional().nullable(),
                          foundedYear: z.number().optional().nullable(),
                          location: z.string().optional().nullable(),
                        })
                        .nullable()
                        .optional(),
                    }),
                    prompt: `Extract company:\n\n${page.title}\n${page.link}\n\n${truncated}\n\nExtract: name, website, email, foundedYear, location. Set fields to null if not found. Set found=false if not single company page.`,
                    temperature: 0.2,
                  })
                  queryOpenaiCalls++

                  if (object.found && object.company) {
                    return {
                      name: object.company.name,
                      website: object.company.website ?? page.link,
                      email: object.company.email ?? null,
                      foundedYear: object.company.foundedYear ?? null,
                      location: object.company.location ?? null,
                      source: page.link,
                      sourceType: "individual" as const,
                      extractedAt: new Date().toISOString(),
                    } as CompanyInfo
                  }
                  return null
                }),
              )

              for (const res of pageExtractions) {
                if (res.status === "fulfilled" && res.value) {
                  queryCompanies.push(res.value)
                }
              }

              const pageCount = pageExtractions.filter(
                (r) => r.status === "fulfilled" && r.value,
              ).length
              console.log(`  ✓ ${pageCount} from pages`)
            }
          }

          console.log(`  ✅ ${queryCompanies.length} companies\n`)

          return {
            companies: queryCompanies,
            iteration: {
              query: searchQuery.query,
              companiesFound: queryCompanies.length,
              bestSource: queryCompanies[queryCompanies.length - 1]?.source,
              timestamp: new Date().toISOString(),
            },
            serpCalls: querySerpCalls,
            jinaReaderCalls: queryJinaReaderCalls,
            openaiCalls: queryOpenaiCalls,
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          console.error(`  ❌ Error processing query "${searchQuery.query}":`)
          console.error(`     ${errorMessage}\n`)

          return {
            companies: [],
            iteration: {
              query: searchQuery.query,
              companiesFound: 0,
              timestamp: new Date().toISOString(),
            },
            serpCalls: querySerpCalls,
            jinaReaderCalls: queryJinaReaderCalls,
            openaiCalls: queryOpenaiCalls,
          }
        }
      }),
    )

    // Aggregate results from all queries
    const allCompanies: CompanyInfo[] = []
    const allIterations: z.infer<typeof SearchIterationSchema>[] = []
    let totalSerpCalls = 0
    let totalJinaReaderCalls = 0
    let totalOpenaiCalls = 1 // Query generation

    for (const result of queryResults) {
      if (result.status === "fulfilled") {
        allCompanies.push(...result.value.companies)
        allIterations.push(result.value.iteration)
        totalSerpCalls += result.value.serpCalls
        totalJinaReaderCalls += result.value.jinaReaderCalls
        totalOpenaiCalls += result.value.openaiCalls
      }
    }

    return {
      companies: allCompanies,
      iterations: allIterations,
      targetCount,
      serpCalls: totalSerpCalls,
      jinaReaderCalls: totalJinaReaderCalls,
      openaiCalls: totalOpenaiCalls,
      startTime,
    }
  },
})

/**
 * Step 3: Clean and deduplicate companies
 */
const cleanAndDeduplicateStep = createStep({
  id: "clean-and-deduplicate",
  description: "Clean and deduplicate extracted companies",
  inputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    iterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    targetReached: z.boolean(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const {
      companies,
      iterations,
      targetCount,
      serpCalls,
      jinaReaderCalls,
      openaiCalls,
      startTime,
    } = inputData

    console.log(`📊 Aggregated ${companies.length} raw companies`)
    console.log("🧹 Cleaning and deduplicating...\n")

    const rawCount = companies.length
    const cleaned = cleanCompanies(companies)
    const deduplicated = deduplicateCompanies(cleaned)

    console.log(`Raw: ${rawCount}`)
    console.log(`Cleaned: ${cleaned.length} (-${rawCount - cleaned.length})`)
    console.log(`Final: ${deduplicated.length} (-${cleaned.length - deduplicated.length})`)

    return {
      companies: deduplicated,
      totalCompanies: deduplicated.length,
      searchIterations: iterations,
      targetCount,
      targetReached: deduplicated.length >= targetCount,
      serpCalls,
      jinaReaderCalls,
      openaiCalls,
      startTime,
    }
  },
})

/**
 * Step 4: Enrich missing fields using research agent
 */
const enrichMissingFieldsStep = createStep({
  id: "enrich-missing-fields",
  description: "Enrich companies with missing/null fields using web research",
  inputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    targetReached: z.boolean(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    targetReached: z.boolean(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
    enrichedCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    const { companies, ...rest } = inputData

    console.log("🔍 Enriching companies with missing fields...\n")

    // Filter companies that have at least one null field (excluding location which is optional)
    const companiesToEnrich = companies.filter((c) => !c.email || !c.foundedYear || !c.website)

    console.log(`Found ${companiesToEnrich.length} companies with missing fields`)

    if (companiesToEnrich.length === 0) {
      console.log("No enrichment needed\n")
      return {
        companies,
        ...rest,
        enrichedCount: 0,
      }
    }

    // Enrich each company concurrently
    const enrichmentPromises = companiesToEnrich.map(async (company) => {
      try {
        const missingFields: string[] = []
        if (!company.email) missingFields.push("email")
        if (!company.foundedYear) missingFields.push("founded year")
        if (!company.website) missingFields.push("website")

        const companyData = `Company: ${company.name}\nLocation: ${company.location || "Unknown"}\nSource: ${company.source}`

        const query = `Find the ${missingFields.join(", ")} for this company. Return ONLY the requested information in a structured format.`

        // Call enrich-data workflow
        const enrichRun = await enrichDataWorkflow.createRunAsync()
        const enrichResult = await enrichRun.start({
          inputData: {
            markdownData: companyData,
            query,
          },
        })

        if (enrichResult.status === "failed") {
          console.log(`  ⚠️  Failed to enrich ${company.name}`)
          return company
        }

        const researchStepResult = enrichResult.steps["research-step"]
        if (!researchStepResult || researchStepResult.status !== "success") {
          console.log(`  ⚠️  Research step failed for ${company.name}`)
          return company
        }

        const output = researchStepResult.output as {
          enrichedData: string
          success: boolean
        }

        if (!output.success) {
          console.log(`  ⚠️  Enrichment unsuccessful for ${company.name}`)
          return company
        }

        // Parse enriched data to extract fields
        // Try to extract email
        let email = company.email
        if (!email) {
          const emailMatch = output.enrichedData.match(/[\w.-]+@[\w.-]+\.\w+/)
          if (emailMatch) {
            email = emailMatch[0]
          }
        }

        // Try to extract founded year
        let foundedYear = company.foundedYear
        if (!foundedYear) {
          const yearMatch = output.enrichedData.match(/(?:founded|established|started).*?(\d{4})/i)
          if (yearMatch?.[1]) {
            foundedYear = parseInt(yearMatch[1], 10)
          }
        }

        // Try to extract website
        let website = company.website
        if (!website) {
          const urlMatch = output.enrichedData.match(/https?:\/\/[\w.-]+\.\w+(?:\/[\w.-]*)?/)
          if (urlMatch) {
            website = urlMatch[0]
          }
        }

        const enrichedCompany = {
          ...company,
          email: email ?? company.email,
          foundedYear: foundedYear ?? company.foundedYear,
          website: website ?? company.website,
        }

        console.log(`  ✓ Enriched ${company.name}`)
        return enrichedCompany
      } catch (_error) {
        console.log(`  ❌ Error enriching ${company.name}`)
        return company
      }
    })

    const enrichedCompanies = await Promise.all(enrichmentPromises)

    // Create a map for quick lookup of enriched companies
    const enrichedMap = new Map(enrichedCompanies.map((c) => [c.name + c.source, c]))

    // Merge enriched data back into the full company list
    const mergedCompanies = companies.map((company) => {
      const key = company.name + company.source
      return enrichedMap.get(key) || company
    })

    const enrichedCount = enrichedCompanies.filter((c, idx) => {
      const original = companiesToEnrich[idx]
      if (!original) return false
      return (
        c.email !== original.email ||
        c.foundedYear !== original.foundedYear ||
        c.website !== original.website
      )
    }).length

    console.log(`✅ Enriched ${enrichedCount} companies\n`)

    return {
      companies: mergedCompanies,
      ...rest,
      enrichedCount,
    }
  },
})

/**
 * Step 5: Format final results with statistics
 */
const formatResultsStep = createStep({
  id: "format-results",
  description: "Format final results with complete statistics",
  inputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetCount: z.number(),
    targetReached: z.boolean(),
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
    enrichedCount: z.number(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetReached: z.boolean(),
    completedAt: z.string().datetime(),
    apiStats: APIStatsSchema,
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const {
      companies,
      totalCompanies,
      searchIterations,
      targetReached,
      serpCalls,
      jinaReaderCalls,
      openaiCalls,
      startTime,
      enrichedCount,
    } = inputData

    const endTime = new Date().toISOString()
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()

    console.log(`\n${"=".repeat(60)}`)
    console.log("🎉 WEB COMPANY SEARCH V2 COMPLETE")
    console.log(`${"=".repeat(60)}`)
    console.log(`Companies: ${totalCompanies}`)
    console.log(`Enriched: ${enrichedCount}`)
    console.log(`Target reached: ${targetReached ? "✅" : "⚠️"}`)
    console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`)
    console.log(`SERP calls: ${serpCalls}`)
    console.log(`Jina calls: ${jinaReaderCalls}`)
    console.log(`OpenAI calls: ${openaiCalls}`)
    console.log(`${"=".repeat(60)}\n`)

    return {
      companies,
      totalCompanies,
      searchIterations,
      targetReached,
      completedAt: new Date().toISOString(),
      apiStats: {
        serpCalls,
        serpTotalResults: serpCalls * 100,
        jinaReaderCalls,
        jinaReaderSuccesses: jinaReaderCalls,
        jinaReaderFailures: 0,
        openaiCalls,
        openaiTokensEstimate: openaiCalls * 1000,
        startTime,
        endTime,
        totalDurationMs: durationMs,
      },
      success: true,
      message: `Found ${totalCompanies} companies (${enrichedCount} enriched)`,
    }
  },
})

/**
 * Main workflow composition
 */
export const webCompanySearchV2Workflow = createWorkflow({
  id: "web-company-search-v2",
  inputSchema: z.object({
    query: z.string().min(1),
    targetCount: z.number().default(150),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIterations: z.array(SearchIterationSchema),
    targetReached: z.boolean(),
    completedAt: z.string().datetime(),
    apiStats: APIStatsSchema,
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(generateQueriesStep)
  .then(searchAndExtractStep)
  .then(cleanAndDeduplicateStep)
  .then(enrichMissingFieldsStep)
  .then(formatResultsStep)
  .commit()
