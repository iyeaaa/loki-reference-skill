/**
 * BigQuery Executor Node
 * Executes BigQuery search using the bigquery-search service
 */

import { InvalidQueryError, searchBigQuery } from "../../bigquery-search.service"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState } from "../state"

// Default data dictionary for BigQuery
const DEFAULT_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.b2b_leads_enriched.leads_table",
  columns: [
    "email",
    "first_name",
    "last_name",
    "company_name",
    "phone",
    "country",
    "city",
    "industry",
    "sub_industry",
    "web_address",
    "employee",
    "revenue",
  ],
  industries: [
    "Business Services",
    "Software & Internet",
    "Healthcare",
    "Financial Services",
    "Manufacturing",
    "Retail",
    "Food & Beverage",
    "Real Estate & Construction",
    "Education",
    "Media & Entertainment",
    "Telecommunications",
    "Transportation & Storage",
    "Agriculture & Mining",
    "Computers & Electronics",
    "Government",
  ],
  countries: ["USA", "Canada"],
  employeeRanges: [
    "0 - 25",
    "25 - 100",
    "100 - 250",
    "250 - 1K",
    "1K - 10K",
    "10K - 50K",
    "50K - 100K",
    "> 100K",
  ],
  revenueRanges: ["< $1M", "$1M - $10M", "$10M - $100M", "$100M - $1B", "> $1B"],
}

// Build natural language query from parameters
function buildNaturalLanguageQuery(params: {
  query: string
  country?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string
  revenueRange?: string
  limit?: number
}): string {
  const parts: string[] = []

  // Start with base query or build from parameters
  if (
    params.query &&
    !params.query.includes(params.country || "") &&
    !params.query.includes(params.industry || "")
  ) {
    // User's raw query - let BigQuery service handle it
    return params.query
  }

  // Build structured query
  if (params.country) {
    parts.push(params.country)
  }

  if (params.industry) {
    parts.push(params.industry)
  }

  if (params.subIndustry) {
    parts.push(params.subIndustry)
  }

  // Add company type
  parts.push("회사")

  if (params.employeeRange) {
    parts.push(`직원 수 ${params.employeeRange}`)
  }

  if (params.revenueRange) {
    parts.push(`매출 ${params.revenueRange}`)
  }

  // Add limit
  const limit = params.limit || 100
  parts.push(`${limit}개`)

  return parts.join(" ")
}

// Transform BigQuery results to our format
function transformResults(results: Record<string, unknown>[]): BigQueryResult[] {
  return results.map((row) => ({
    email: row.email as string | undefined,
    firstName: row.first_name as string | undefined,
    lastName: row.last_name as string | undefined,
    companyName: row.company_name as string | undefined,
    phone: row.phone as string | undefined,
    country: row.country as string | undefined,
    city: row.city as string | undefined,
    industry: row.industry as string | undefined,
    subIndustry: row.sub_industry as string | undefined,
    webAddress: row.web_address as string | undefined,
    employee: row.employee as string | undefined,
    revenue: row.revenue as string | undefined,
    // Include any additional fields
    ...row,
  }))
}

export async function executeBigQuery(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  const params = state.bigQueryParams

  if (!params) {
    leadDiscoveryLogger.nodeError("executeBigQuery", "No search parameters provided", 0)
    return {
      error: "Search parameters are required",
    }
  }

  leadDiscoveryLogger.nodeStart("executeBigQuery", {
    query: params.query,
    country: params.country,
    industry: params.industry,
  })

  if (emitter) {
    emitter.nodeStart("executeBigQuery", "Searching leads database...")
  }

  try {
    // Build the natural language query
    const nlQuery = buildNaturalLanguageQuery(params)

    leadDiscoveryLogger.bigQueryExecutionStart(nlQuery)

    if (emitter) {
      emitter.progress("executeBigQuery", "Converting to SQL...", 20)
    }

    // Execute BigQuery search
    const result = await searchBigQuery(nlQuery, DEFAULT_DATA_DICTIONARY)

    const duration = Date.now() - startTime

    leadDiscoveryLogger.bigQueryExecutionComplete(
      duration,
      result.results.length,
      result.totalCount,
    )

    if (emitter) {
      emitter.progress("executeBigQuery", "Processing results...", 80)
    }

    // Transform results
    const transformedResults = transformResults(result.results)

    if (emitter) {
      emitter.nodeComplete("executeBigQuery", `Found ${result.totalCount} leads`, {
        resultCount: transformedResults.length,
        totalCount: result.totalCount,
        sql: result.sql,
      })
    }

    leadDiscoveryLogger.nodeSuccess("executeBigQuery", duration, {
      resultCount: transformedResults.length,
      totalCount: result.totalCount,
    })

    return {
      searchResults: transformedResults,
      totalResultCount: result.totalCount,
      bigQuerySQL: result.sql,
      bigQueryExplanation: result.explanation,
      executionTime: duration,
    }
  } catch (error) {
    const duration = Date.now() - startTime

    if (error instanceof InvalidQueryError) {
      // Handle invalid query (help request, greeting, etc.)
      leadDiscoveryLogger.warn(`Invalid query: ${error.message}`)

      if (emitter) {
        emitter.nodeComplete("executeBigQuery", "Query clarification", {
          isInvalidQuery: true,
          message: error.message,
        })
      }

      return {
        error: error.message,
        searchResults: [],
        totalResultCount: 0,
        executionTime: duration,
      }
    }

    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.bigQueryExecutionError(errorMessage)
    leadDiscoveryLogger.nodeError("executeBigQuery", errorMessage, duration)

    if (emitter) {
      emitter.error("executeBigQuery", errorMessage)
    }

    return {
      error: `Search failed: ${errorMessage}`,
      searchResults: [],
      totalResultCount: 0,
      executionTime: duration,
    }
  }
}
