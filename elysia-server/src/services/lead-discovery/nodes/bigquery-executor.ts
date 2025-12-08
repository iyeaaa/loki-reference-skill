/**
 * BigQuery Executor Node
 * Executes BigQuery search using the bigquery-search service
 * Analyzes random 50 results with GPT and streams analysis
 */

import { ChatOpenAI } from "@langchain/openai"
import { InvalidQueryError, searchBigQuery } from "../../bigquery-search.service"
import type { NodeEventEmitter } from "../../chatbot/sse-context"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState, WebsiteAnalysis } from "../state"

// 스트리밍용 LLM
const streamingLlm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.5,
  streaming: true,
})

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

// 랜덤 샘플 추출
function getRandomSample<T>(array: T[], sampleSize: number): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(sampleSize, array.length))
}

// 검색 결과 GPT 분석 (스트리밍)
async function streamCustomerAnalysis(
  results: BigQueryResult[],
  totalCount: number,
  websiteAnalysis: WebsiteAnalysis | undefined,
  emitter: NodeEventEmitter,
): Promise<string> {
  // 랜덤 50개 샘플 추출
  const sampleSize = 50
  const sampleResults = getRandomSample(results, sampleSize)

  // 샘플 데이터 요약 생성
  const sampleSummary = sampleResults
    .map((r, i) => {
      const parts = []
      if (r.companyName) parts.push(`회사: ${r.companyName}`)
      if (r.title) parts.push(`직책: ${r.title}`)
      if (r.industry) parts.push(`산업: ${r.industry}`)
      if (r.subIndustry) parts.push(`세부산업: ${r.subIndustry}`)
      if (r.country) parts.push(`국가: ${r.country}`)
      if (r.primaryCity) parts.push(`도시: ${r.primaryCity}`)
      if (r.employee) parts.push(`직원수: ${r.employee}`)
      if (r.revenue) parts.push(`매출: ${r.revenue}`)
      return `${i + 1}. ${parts.join(" | ")}`
    })
    .join("\n")

  // 산업 분포 분석
  const industryCount: Record<string, number> = {}
  const countryCount: Record<string, number> = {}
  const titleCount: Record<string, number> = {}

  for (const r of results) {
    if (r.industry) industryCount[r.industry] = (industryCount[r.industry] || 0) + 1
    if (r.country) countryCount[r.country] = (countryCount[r.country] || 0) + 1
    if (r.title) {
      // 직책 그룹화 (CEO, Director, Manager 등)
      const titleGroup = r.title.split(/[,/]/)[0]?.trim() || r.title
      titleCount[titleGroup] = (titleCount[titleGroup] || 0) + 1
    }
  }

  // 상위 항목 추출
  const topIndustries = Object.entries(industryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}명`)
    .join(", ")

  const topCountries = Object.entries(countryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}명`)
    .join(", ")

  const topTitles = Object.entries(titleCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([k, v]) => `${k}: ${v}명`)
    .join(", ")

  // 웹사이트 분석 정보 (있는 경우)
  const companyContext = websiteAnalysis
    ? `
## 분석 대상 회사 정보
- 회사명: ${websiteAnalysis.companyName || "알 수 없음"}
- 산업: ${websiteAnalysis.industry || "알 수 없음"}
- 주요 제품/서비스: ${websiteAnalysis.products?.join(", ") || "알 수 없음"}
- 비즈니스 모델: ${websiteAnalysis.businessModel || "알 수 없음"}
`
    : ""

  const prompt = `당신은 B2B 수출 바이어 발굴 전문가입니다. 아래 검색 결과 데이터를 분석하여 잠재 바이어 고객군에 대한 인사이트를 작성해주세요.
${companyContext}
## 검색 결과 통계
- 총 발견된 리드 수: ${totalCount.toLocaleString()}명
- 분석 샘플 수: ${sampleResults.length}명

## 전체 결과 분포
- 산업별: ${topIndustries || "정보 없음"}
- 국가별: ${topCountries || "정보 없음"}
- 직책별: ${topTitles || "정보 없음"}

## 샘플 데이터 (${sampleResults.length}명)
${sampleSummary}

## 작성 요구사항
위 데이터를 바탕으로 전문적인 고객군 분석 보고서를 작성해주세요.

## 보고서 구조 (Markdown 형식)

### 1. 검색 결과 요약
- 발견된 잠재 바이어 수와 의미
- 검색 품질 평가

### 2. 고객군 특성 분석
- 산업 분포 특성
- 지역/국가 분포 특성
- 주요 직책/의사결정권자 분석

### 3. 타겟 접근 전략
- 우선 접촉 추천 그룹
- 효과적인 접근 방법 제안

### 4. 주의사항 및 권장사항
- 데이터 품질 관련 참고사항
- 추가 검색/필터링 제안

## 작성 스타일
- 한국어로 작성
- 전문 컨설팅 업체의 보고서 어투 사용
- Markdown 문법 활용 (헤더, 볼드, 리스트 등)
- 구체적인 숫자와 인사이트 기반 서술
- 각 섹션별 2-3문장 이상 충실히 작성

## 중요
- 코드 블록(\`\`\`markdown 또는 \`\`\`)으로 감싸지 마세요
- 마크다운 문법을 직접 사용하여 바로 작성하세요

분석 결과:`

  let accumulated = ""

  try {
    const stream = await streamingLlm.stream(prompt)

    for await (const chunk of stream) {
      const textContent = typeof chunk.content === "string" ? chunk.content : ""
      if (textContent) {
        accumulated += textContent
        emitter.textChunk("executeBigQuery", textContent, accumulated)
      }
    }

    return accumulated
  } catch (error) {
    leadDiscoveryLogger.error(`[리드 검색] 고객군 분석 스트리밍 실패: ${error}`)
    return ""
  }
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

    // 결과가 있으면 GPT로 고객군 분석 스트리밍
    let customerAnalysisSummary = ""
    if (emitter && transformedResults.length > 0) {
      leadDiscoveryLogger.info(`[리드 검색] 고객군 분석 시작 (${transformedResults.length}개 결과)`)
      emitter.progress("executeBigQuery", "AI가 고객군을 분석하고 있어요", 90)

      customerAnalysisSummary = await streamCustomerAnalysis(
        transformedResults,
        result.totalCount,
        state.websiteAnalysis,
        emitter,
      )

      leadDiscoveryLogger.info(`[리드 검색] 고객군 분석 완료: ${customerAnalysisSummary.length}자`)
    }

    if (emitter) {
      emitter.nodeComplete(
        "executeBigQuery",
        `${result.totalCount.toLocaleString()}개 리드 검색 완료`,
        {
          resultCount: transformedResults.length,
          totalCount: result.totalCount,
          sql: result.sql,
          customerAnalysisSummary,
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
      customerAnalysisSummary,
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
