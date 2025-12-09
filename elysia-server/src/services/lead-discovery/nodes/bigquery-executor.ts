/**
 * BigQuery Executor Node
 * Executes BigQuery search using the bigquery-search service
 * Analyzes random 50 results with GPT and streams analysis
 */

import { InvalidQueryError, searchBigQuery } from "../../bigquery-search.service"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState } from "../state"

// Default data dictionary for BigQuery
// 와일드카드 테이블로 lead_csv_data + lead_csv_data_02 모두 검색
const DEFAULT_DATA_DICTIONARY = {
  tableName: "gen-lang-client-0140658679.test_lead_01.lead_csv_data*",
  columns: [
    "email",
    "first_name",
    "last_name",
    "company_name",
    "phone",
    "country",
    "primary_city",
    "primary_state",
    "industry",
    "sub_industry",
    "web_address",
    "employee",
    "revenue",
    "title",
    "mailing_address",
    "zip_code",
    "middle_name",
  ],
  industries: [
    "Business Services",
    "Manufacturing",
    "Retail",
    "Financial Services",
    "Healthcare",
    "Real Estate & Construction",
    "Computers & Electronics",
    "Software & Internet",
    "Education",
    "Media & Entertainment",
    "Consumer Services",
    "Travel, Recreation, and Leisure",
    "Telecommunications",
    "Non-Profit",
    "Transportation & Storage",
    "Other",
    "Energy & Utilities",
    "Wholesale & Distribution",
    "Government",
    "Agriculture & Mining",
    "Retail & Wholesale",
    "Services (Miscellaneous)",
    "Food & Beverage",
    "Travel & Accommodation",
    "Recreation & Leisure",
    "Conglomerates",
  ],
  countries: ["USA", "Canada"],
  employeeRanges: [
    "0 - 25",
    "25 - 100",
    "100 - 250",
    "250 - 1000",
    "1K - 10K",
    "10K - 50K",
    "50K - 100K",
    "> 100K",
  ],
  revenueRanges: [
    "$0 - $1M",
    "$0 - 1M",
    "$1 - $10M",
    "$1 - 10M",
    "$10 - $50M",
    "$10 - 50M",
    "$50 - $100M",
    "$50 - 100M",
    "$100 - $250M",
    "$100 - 250M",
    "$250 - $500M",
    "$250 - 500M",
    "$500M - $1B",
    "$500M - 1B",
    "> $1B",
  ],
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

  // NOTE: subIndustry는 Data Dictionary에 없는 값일 수 있으므로
  // 자연어 쿼리에 포함하지 않음 (LLM이 잘못된 LIKE 조건을 생성하는 문제 방지)
  // subIndustry는 UI 표시용으로만 사용

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
    middleName: row.middle_name as string | undefined,
    lastName: row.last_name as string | undefined,
    title: row.title as string | undefined,
    companyName: row.company_name as string | undefined,
    phone: row.phone as string | undefined,
    country: row.country as string | undefined,
    primaryCity: row.primary_city as string | undefined,
    primaryState: row.primary_state as string | undefined,
    mailingAddress: row.mailing_address as string | undefined,
    zipCode: row.zip_code as string | undefined,
    industry: row.industry as string | undefined,
    subIndustry: row.sub_industry as string | undefined,
    webAddress: row.web_address as string | undefined,
    employee: row.employee as string | undefined,
    revenue: row.revenue as string | undefined,
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
      error: "검색 조건이 없어요",
    }
  }

  // 상세 로그: 검색 시작
  leadDiscoveryLogger.info(`[리드 검색] 시작`)
  leadDiscoveryLogger.info(`  - 국가: ${params.country || "전체"}`)
  leadDiscoveryLogger.info(`  - 산업: ${params.industry || "전체"}`)
  leadDiscoveryLogger.info(`  - 쿼리: ${params.query}`)
  leadDiscoveryLogger.nodeStart("executeBigQuery", {
    query: params.query,
    country: params.country,
    industry: params.industry,
  })

  if (emitter) {
    const targetInfo =
      params.country && params.industry ? `${params.country} ${params.industry}` : "전 세계"
    emitter.nodeStart("executeBigQuery", `${targetInfo} 바이어를 검색하고 있어요`)
  }

  try {
    // Build the natural language query
    const nlQuery = buildNaturalLanguageQuery(params)

    leadDiscoveryLogger.info(`[리드 검색] 자연어 쿼리: "${nlQuery}"`)
    leadDiscoveryLogger.bigQueryExecutionStart(nlQuery)

    if (emitter) {
      emitter.progress("executeBigQuery", "검색 쿼리를 준비하고 있어요", 20)
    }

    // Execute BigQuery search
    leadDiscoveryLogger.info(`[리드 검색] BigQuery 실행 중...`)
    const result = await searchBigQuery(nlQuery, DEFAULT_DATA_DICTIONARY)

    const duration = Date.now() - startTime

    // 상세 로그: 검색 결과
    leadDiscoveryLogger.info(`[리드 검색] 검색 완료:`)
    leadDiscoveryLogger.info(`  - 총 결과: ${result.totalCount.toLocaleString()}개`)
    leadDiscoveryLogger.info(`  - 반환 결과: ${result.results.length}개`)
    leadDiscoveryLogger.info(`  - 소요시간: ${(duration / 1000).toFixed(1)}초`)
    leadDiscoveryLogger.bigQueryExecutionComplete(
      duration,
      result.results.length,
      result.totalCount,
    )

    if (emitter) {
      emitter.progress(
        "executeBigQuery",
        `${result.totalCount.toLocaleString()}개 리드를 찾았어요`,
        80,
      )
    }

    // Transform results
    const transformedResults = transformResults(result.results)

    // 고객군 분석 없이 바로 결과 반환
    if (emitter) {
      emitter.nodeComplete(
        "executeBigQuery",
        `${result.totalCount.toLocaleString()}개 리드 검색 완료`,
        {
          resultCount: transformedResults.length,
          totalCount: result.totalCount,
          sql: result.sql,
        },
      )
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
      leadDiscoveryLogger.warn(`[리드 검색] 잘못된 쿼리: ${error.message}`)

      if (emitter) {
        emitter.nodeComplete("executeBigQuery", "검색 조건을 다시 확인해주세요", {
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

    leadDiscoveryLogger.error(`[리드 검색] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.bigQueryExecutionError(errorMessage)
    leadDiscoveryLogger.nodeError("executeBigQuery", errorMessage, duration)

    if (emitter) {
      emitter.error("executeBigQuery", `검색 중 문제가 발생했어요: ${errorMessage}`)
    }

    return {
      error: `검색에 실패했어요: ${errorMessage}`,
      searchResults: [],
      totalResultCount: 0,
      executionTime: duration,
    }
  }
}
