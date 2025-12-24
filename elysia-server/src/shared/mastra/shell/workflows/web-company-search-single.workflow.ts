import { createStep, createWorkflow } from "@mastra/core/workflows"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import pRetry from "p-retry"
import { z } from "zod"
import { config } from "../../../../config"
import { googleSearch, jinaReader } from "./web-search/api-clients"
import { APIStatsSchema, CompanyInfoSchema, SearchIterationSchema } from "./web-search/types"
import { cleanCompanies, deduplicateCompanies } from "./web-search/utils"

/**
 * Web Company Search Single Query Workflow
 * Simplified workflow for single SERP query
 *
 * Flow:
 * 1. Search and extract (three-tier strategy)
 * 2. Clean and deduplicate
 * 3. Format results
 */

type CompanyInfo = z.infer<typeof CompanyInfoSchema>

/**
 * Step 1: Execute search and extract companies using three-tier strategy
 */
const searchAndExtractStep = createStep({
  id: "search-and-extract",
  description: "Execute search and extract companies using three-tier strategy",
  inputSchema: z.object({
    query: z.string().min(1),
    location: z.string().optional(),
    language: z.string().optional(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    iteration: SearchIterationSchema,
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { query, location, language, startTime } = inputData

    const openaiClient = new OpenAI({ apiKey: config.openai.apiKey })

    console.log("🚀 Web Company Search (Single Query)")
    console.log(`Query: "${query}"`)
    if (location) console.log(`Location: ${location}`)
    if (language) console.log(`Language: ${language}`)
    console.log("")

    const queryCompanies: CompanyInfo[] = []
    let serpCalls = 0
    let jinaReaderCalls = 0
    let openaiCalls = 0

    try {
      const searchResults = await googleSearch({
        query,
        location,
        language,
        hasdataApiKey: config.apis.hasdata.apiKey,
      })
      serpCalls++
      console.log(`Found ${searchResults.length} results`)

      // TIER 1: Extract from snippets
      const relevantResults = searchResults.filter(
        (r) => r.snippet && (r.snippet.length > 50 || r.title.length > 20),
      )

      if (relevantResults.length > 0) {
        const snippetsCtx = relevantResults
          .slice(0, 20)
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.link}\n${r.snippet || ""}`)
          .join("\n\n")

        const snippetSchema = z.object({
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
        })

        // Note: gpt-5-mini does not support temperature
        const snippetResponse = await pRetry(
          () =>
            openaiClient.responses.parse({
              model: "gpt-5-mini",
              input: [
                {
                  role: "user",
                  content: `Extract companies:\n\n${snippetsCtx}\n\nExtract: name, website, email, foundedYear, location, resultIndex. Set fields to null if not found.`,
                },
              ],
              text: {
                format: zodTextFormat(snippetSchema, "SnippetExtraction"),
              },
            }),
          { retries: 3 },
        )
        openaiCalls++

        const snippetRes = snippetResponse.output_parsed
        if (!snippetRes) {
          throw new Error("Failed to parse snippet extraction response")
        }

        const snippetCompanies: CompanyInfo[] = snippetRes.contacts.map((c) => ({
          name: c.name,
          website: c.website ?? null,
          email: c.email ?? null,
          foundedYear: c.foundedYear ?? null,
          location: c.location ?? null,
          source: relevantResults[c.resultIndex - 1]?.link || query,
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

        const directoryDetectSchema = z.object({
          directories: z.array(
            z.object({
              resultIndex: z.number(),
              confidence: z.enum(["high", "medium", "low"]),
            }),
          ),
        })

        // Note: gpt-5-mini does not support temperature
        const dirDetectResponse = await pRetry(
          () =>
            openaiClient.responses.parse({
              model: "gpt-5-mini",
              input: [
                {
                  role: "user",
                  content: `Which are directory/list pages?\n\n${candidatesCtx}\n\nReturn MEDIUM or HIGH confidence only.`,
                },
              ],
              text: {
                format: zodTextFormat(directoryDetectSchema, "DirectoryDetection"),
              },
            }),
          { retries: 3 },
        )
        openaiCalls++

        const dirRes = dirDetectResponse.output_parsed
        if (!dirRes) {
          throw new Error("Failed to parse directory detection response")
        }

        const directories = dirRes.directories
          .filter((d) => d.confidence !== "low")
          .map((d) => candidates[d.resultIndex - 1])
          .filter((r): r is NonNullable<typeof r> => !!r)
          .slice(0, 3)

        if (directories.length > 0) {
          console.log(`  Found ${directories.length} directories`)

          const dirExtractions = await Promise.allSettled(
            directories.map(async (dir) => {
              jinaReaderCalls++
              const content = await jinaReader({
                url: dir.link,
                jinaApiKey: config.apis.jina.apiKey,
              })
              const truncated = content.length > 15_000 ? content.slice(0, 15_000) : content

              const dirCompaniesSchema = z.object({
                companies: z.array(
                  z.object({
                    name: z.string(),
                    website: z.string().optional().nullable(),
                    email: z.string().optional().nullable(),
                    foundedYear: z.number().optional().nullable(),
                    location: z.string().optional().nullable(),
                  }),
                ),
              })

              // Note: gpt-5-mini does not support temperature
              const dirExtractResponse = await pRetry(
                () =>
                  openaiClient.responses.parse({
                    model: "gpt-5-mini",
                    input: [
                      {
                        role: "user",
                        content: `Extract ALL companies:\n\n${dir.title}\n${dir.link}\n\n${truncated}\n\nExtract: name, website, email, foundedYear, location. Set fields to null if not found.`,
                      },
                    ],
                    text: {
                      format: zodTextFormat(dirCompaniesSchema, "DirectoryCompanies"),
                    },
                  }),
                { retries: 3 },
              )
              openaiCalls++

              const object = dirExtractResponse.output_parsed
              if (!object) {
                throw new Error("Failed to parse directory companies response")
              }

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

        const evalSchema = z.object({
          worthOpening: z.array(
            z.object({
              resultIndex: z.number(),
              priority: z.number().min(0).max(3),
            }),
          ),
        })

        // Note: gpt-5-mini does not support temperature
        const evalResponse = await pRetry(
          () =>
            openaiClient.responses.parse({
              model: "gpt-5-mini",
              input: [
                {
                  role: "user",
                  content: `Which pages worth opening?\n\n${newCtx}\n\nPriority: 3=High, 2=Medium. Return >= 2 only.`,
                },
              ],
              text: {
                format: zodTextFormat(evalSchema, "PageEvaluation"),
              },
            }),
          { retries: 3 },
        )
        openaiCalls++

        const evalRes = evalResponse.output_parsed
        if (!evalRes) {
          throw new Error("Failed to parse page evaluation response")
        }

        const pagesToOpen = evalRes.worthOpening
          .filter((p) => p.priority >= 2)
          .map((p) => newResults[p.resultIndex - 1])
          .filter((r): r is NonNullable<typeof r> => !!r)
          .slice(0, 5)

        if (pagesToOpen.length > 0) {
          const pageExtractions = await Promise.allSettled(
            pagesToOpen.map(async (page) => {
              jinaReaderCalls++
              const content = await jinaReader({
                url: page.link,
                jinaApiKey: config.apis.jina.apiKey,
              })
              const truncated = content.length > 8000 ? content.slice(0, 8000) : content

              const pageCompanySchema = z.object({
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
              })

              // Note: gpt-5-mini does not support temperature
              const pageResponse = await pRetry(
                () =>
                  openaiClient.responses.parse({
                    model: "gpt-5-mini",
                    input: [
                      {
                        role: "user",
                        content: `Extract company:\n\n${page.title}\n${page.link}\n\n${truncated}\n\nExtract: name, website, email, foundedYear, location. Set fields to null if not found. Set found=false if not single company page.`,
                      },
                    ],
                    text: {
                      format: zodTextFormat(pageCompanySchema, "PageCompany"),
                    },
                  }),
                { retries: 3 },
              )
              openaiCalls++

              const object = pageResponse.output_parsed
              if (!object) {
                throw new Error("Failed to parse page company response")
              }

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
          query,
          companiesFound: queryCompanies.length,
          bestSource: queryCompanies[queryCompanies.length - 1]?.source,
          timestamp: new Date().toISOString(),
        },
        serpCalls,
        jinaReaderCalls,
        openaiCalls,
        startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.error(`  ❌ Error processing query "${query}":`)
      console.error(`     ${errorMessage}\n`)

      return {
        companies: [],
        iteration: {
          query,
          companiesFound: 0,
          timestamp: new Date().toISOString(),
        },
        serpCalls,
        jinaReaderCalls,
        openaiCalls,
        startTime,
      }
    }
  },
})

/**
 * Step 2: Clean and deduplicate companies
 */
const cleanAndDeduplicateStep = createStep({
  id: "clean-and-deduplicate",
  description: "Clean and deduplicate extracted companies",
  inputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    iteration: SearchIterationSchema,
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIteration: SearchIterationSchema,
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { companies, iteration, serpCalls, jinaReaderCalls, openaiCalls, startTime } = inputData

    console.log(`📊 Extracted ${companies.length} raw companies`)
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
      searchIteration: iteration,
      serpCalls,
      jinaReaderCalls,
      openaiCalls,
      startTime,
    }
  },
})

/**
 * Step 3: Format final results with statistics
 */
const formatResultsStep = createStep({
  id: "format-results",
  description: "Format final results with complete statistics",
  inputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIteration: SearchIterationSchema,
    serpCalls: z.number(),
    jinaReaderCalls: z.number(),
    openaiCalls: z.number(),
    startTime: z.string(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIteration: SearchIterationSchema,
    completedAt: z.string().datetime(),
    apiStats: APIStatsSchema,
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ({ inputData }) => {
    const {
      companies,
      totalCompanies,
      searchIteration,
      serpCalls,
      jinaReaderCalls,
      openaiCalls,
      startTime,
    } = inputData

    const endTime = new Date().toISOString()
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime()

    console.log(`\n${"=".repeat(60)}`)
    console.log("🎉 WEB COMPANY SEARCH COMPLETE")
    console.log(`${"=".repeat(60)}`)
    console.log(`Companies: ${totalCompanies}`)
    console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`)
    console.log(`SERP calls: ${serpCalls}`)
    console.log(`Jina calls: ${jinaReaderCalls}`)
    console.log(`OpenAI calls: ${openaiCalls}`)
    console.log(`${"=".repeat(60)}\n`)

    return {
      companies,
      totalCompanies,
      searchIteration,
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
      message: `Found ${totalCompanies} companies`,
    }
  },
})

/**
 * Adapter step to add startTime to input
 */
const prepareInputStep = createStep({
  id: "prepare-input",
  description: "Prepare input with startTime",
  inputSchema: z.object({
    query: z.string().min(1),
    location: z.string().optional(),
    language: z.string().optional(),
  }),
  outputSchema: z.object({
    query: z.string().min(1),
    location: z.string().optional(),
    language: z.string().optional(),
    startTime: z.string(),
  }),
  execute: async ({ inputData }) => {
    return {
      ...inputData,
      startTime: new Date().toISOString(),
    }
  },
})

/**
 * Main workflow composition
 */
export const webCompanySearchSingleWorkflow = createWorkflow({
  id: "web-company-search-single",
  inputSchema: z.object({
    query: z.string().min(1),
    location: z.string().optional(),
    language: z.string().optional(),
  }),
  outputSchema: z.object({
    companies: z.array(CompanyInfoSchema),
    totalCompanies: z.number(),
    searchIteration: SearchIterationSchema,
    completedAt: z.string().datetime(),
    apiStats: APIStatsSchema,
    success: z.boolean(),
    message: z.string(),
  }),
})
  .then(prepareInputStep)
  .then(searchAndExtractStep)
  .then(cleanAndDeduplicateStep)
  .then(formatResultsStep)
  .commit()
