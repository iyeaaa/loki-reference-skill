/**
 * BigQuery Parameter Generator Node
 * Generates natural language query and parameters for BigQuery search
 */

import { ChatOpenAI } from "@langchain/openai"
import { leadDiscoveryLogger } from "../logger"
import type { BigQuerySearchParams, LeadDiscoveryState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0.2,
})

// Map industry names to BigQuery format
const INDUSTRY_MAPPING: Record<string, string> = {
  "Business Services": "Business Services",
  "Software & Internet": "Software & Internet",
  Healthcare: "Healthcare",
  "Financial Services": "Financial Services",
  Manufacturing: "Manufacturing",
  Retail: "Retail",
  "Food & Beverage": "Food & Beverage",
  "Real Estate & Construction": "Real Estate & Construction",
  Education: "Education",
  "Media & Entertainment": "Media & Entertainment",
  Telecommunications: "Telecommunications",
  "Transportation & Storage": "Transportation & Storage",
  "Agriculture & Mining": "Agriculture & Mining",
  "Computers & Electronics": "Computers & Electronics",
  Government: "Government",
  // Korean mappings
  비즈니스서비스: "Business Services",
  소프트웨어: "Software & Internet",
  IT: "Software & Internet",
  헬스케어: "Healthcare",
  의료: "Healthcare",
  금융: "Financial Services",
  제조업: "Manufacturing",
  제조: "Manufacturing",
  소매: "Retail",
  식음료: "Food & Beverage",
  음식: "Food & Beverage",
  부동산: "Real Estate & Construction",
  건설: "Real Estate & Construction",
  교육: "Education",
  미디어: "Media & Entertainment",
  엔터테인먼트: "Media & Entertainment",
  통신: "Telecommunications",
  운송: "Transportation & Storage",
  물류: "Transportation & Storage",
  농업: "Agriculture & Mining",
  전자: "Computers & Electronics",
  정부: "Government",
}

// Country mapping
const COUNTRY_MAPPING: Record<string, string> = {
  USA: "USA",
  미국: "USA",
  "United States": "USA",
  Canada: "Canada",
  캐나다: "Canada",
}

// Parse employee range from natural language
function parseEmployeeRange(input: string): string | undefined {
  const lower = input.toLowerCase().replaceAll(",", "")

  // Explicit patterns: "51-200명", "51~200 employees", "1000+", "직원 200명 이상"
  const plusMatch = lower.match(/(\d{1,5})\s*\+\s*(?:명|employees?)?/)
  if (plusMatch?.[1]) {
    const min = Number.parseInt(plusMatch[1], 10)
    if (Number.isFinite(min)) {
      if (min >= 10000) return "10K - 50K"
      if (min >= 1000) return "1K - 10K"
      if (min >= 250) return "250 - 1K"
      if (min >= 100) return "100 - 250"
      if (min >= 25) return "25 - 100"
      return "0 - 25"
    }
  }

  const rangeMatch = lower.match(/(\d{1,5})\s*(?:-|~|–|—|to)\s*(\d{1,5})\s*(?:명|employees?)?/)
  if (rangeMatch?.[1] && rangeMatch[2]) {
    const max = Number.parseInt(rangeMatch[2], 10)
    if (Number.isFinite(max)) {
      if (max <= 25) return "0 - 25"
      if (max <= 100) return "25 - 100"
      if (max <= 250) return "100 - 250"
      if (max <= 1000) return "250 - 1K"
      if (max <= 10000) return "1K - 10K"
      return "10K - 50K"
    }
  }

  const atLeastMatch = lower.match(/(\d{1,5})\s*(?:명\s*)?(?:이상|over|above|more than)/)
  if (atLeastMatch?.[1]) {
    const min = Number.parseInt(atLeastMatch[1], 10)
    if (Number.isFinite(min)) {
      if (min >= 10000) return "10K - 50K"
      if (min >= 1000) return "1K - 10K"
      if (min >= 250) return "250 - 1K"
      if (min >= 100) return "100 - 250"
      if (min >= 25) return "25 - 100"
      return "0 - 25"
    }
  }

  // Keyword-based
  if (lower.includes("대기업") || lower.includes("10000") || lower.includes("10k")) {
    return "10K - 50K"
  }
  if (lower.includes("중견") || lower.includes("1000") || lower.includes("1k")) {
    return "1K - 10K"
  }
  if (lower.includes("중소") || lower.includes("100명")) {
    return "100 - 250"
  }
  if (lower.includes("스타트업") || lower.includes("소규모")) {
    return "0 - 25"
  }

  return undefined
}

function parseTaggedFiltersFromUserQuery(input: string): Partial<BigQuerySearchParams> {
  const result: Partial<BigQuerySearchParams> = {}
  const normalized = input.replace(/\s+/g, " ").trim()

  const countryMatch = normalized.match(/국가\s*:\s*([^,]+)(?:,|$)/)
  if (countryMatch?.[1]) {
    const raw = countryMatch[1].trim()
    result.country = COUNTRY_MAPPING[raw] || raw
  }

  const industryMatch = normalized.match(/산업\s*:\s*([^,]+)(?:,|$)/)
  if (industryMatch?.[1]) {
    const raw = industryMatch[1].trim()
    result.industry = INDUSTRY_MAPPING[raw] || raw
  }

  const subIndustryMatch = normalized.match(/세부\s*산업\s*:\s*([^,]+)(?:,|$)/)
  if (subIndustryMatch?.[1]) {
    result.subIndustry = subIndustryMatch[1].trim()
  }

  const employeeMatch = normalized.match(/직원\s*수\s*:\s*([^,]+)(?:,|$)/)
  if (employeeMatch?.[1]) {
    const parsed = parseEmployeeRange(employeeMatch[1].trim())
    if (parsed) result.employeeRange = parsed
  }

  return result
}

// Generate optimized search query from recommendation
function buildQueryFromRecommendation(
  recommendation: {
    country: string
    industry: string
    subIndustry?: string
    keywords?: string[]
  },
  companyContext?: {
    companyName?: string
    products?: string[]
    businessModel?: string
  },
): string {
  const parts: string[] = []

  // Add country
  parts.push(recommendation.country)

  // Add industry
  parts.push(recommendation.industry)

  // Add sub-industry if available
  if (recommendation.subIndustry) {
    parts.push(recommendation.subIndustry)
  }

  // Add context from company analysis
  if (companyContext?.businessModel === "B2B") {
    parts.push("companies")
  }

  // Add keywords if available
  if (recommendation.keywords && recommendation.keywords.length > 0) {
    parts.push(recommendation.keywords.slice(0, 3).join(" "))
  }

  return parts.join(" ")
}

// Use LLM to optimize search query for advanced mode
async function optimizeSearchQuery(
  userInput: string,
  existingParams?: Partial<BigQuerySearchParams>,
): Promise<BigQuerySearchParams> {
  const prompt = `Optimize the following user search query for a B2B lead database search.

User Query: "${userInput}"
${existingParams?.country ? `Detected Country: ${existingParams.country}` : ""}
${existingParams?.industry ? `Detected Industry: ${existingParams.industry}` : ""}
${existingParams?.subIndustry ? `Detected Sub-Industry: ${existingParams.subIndustry}` : ""}
${existingParams?.employeeRange ? `Detected Employee Range: ${existingParams.employeeRange}` : ""}

## Available Options:
Countries: USA, Canada
Industries: Business Services, Software & Internet, Healthcare, Financial Services, Manufacturing, Retail, Food & Beverage, Real Estate & Construction, Education, Media & Entertainment, Telecommunications, Transportation & Storage, Agriculture & Mining, Computers & Electronics, Government

Employee Ranges: 0 - 25, 25 - 100, 100 - 250, 250 - 1K, 1K - 10K, 10K - 50K, 50K - 100K, > 100K

Revenue Ranges: < $1M, $1M - $10M, $10M - $100M, $100M - $1B, > $1B

## Task:
Generate an optimized natural language search query that will work well with the BigQuery NL-to-SQL system.

## Response Format (JSON):
{
  "query": "Optimized natural language query in Korean",
  "country": "USA or Canada (if specified, otherwise null)",
  "industry": "Matched industry (if detected, otherwise null)",
  "subIndustry": "Specific sub-industry term (if relevant)",
  "employeeRange": "Employee range (if specified)",
  "revenueRange": "Revenue range (if specified)",
  "limit": 100
}

Rules:
- The query should be clear and specific
- Match user intent to available industries
- Default limit is 100 unless user specifies
- If the user explicitly includes tags like "국가: ...", "산업: ...", "세부산업: ...", "직원수: ...", treat them as authoritative.
- Detect employee range even when written like "51-200명", "1000+", "직원 200명 이상".
- Respond with JSON only

JSON:`

  const response = await llm.invoke(prompt)
  const responseText = (response.content as string).trim()

  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      query: parsed.query || userInput,
      country: parsed.country || existingParams?.country,
      industry: parsed.industry || existingParams?.industry,
      subIndustry: parsed.subIndustry,
      employeeRange: parsed.employeeRange || existingParams?.employeeRange,
      revenueRange: parsed.revenueRange || existingParams?.revenueRange,
      limit: parsed.limit || 100,
    }
  }

  // Fallback
  return {
    query: userInput,
    ...existingParams,
    limit: 100,
  }
}

export async function generateBigQueryParams(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  // 상세 로그: 검색 조건 생성 시작
  leadDiscoveryLogger.info(`[검색 조건] 생성 시작`)
  leadDiscoveryLogger.info(
    `  - 모드: ${state.searchMode === "basic" ? "웹사이트 분석" : "고급 검색"}`,
  )
  leadDiscoveryLogger.info(`  - 추천 선택됨: ${state.selectedRecommendation ? "예" : "아니오"}`)
  leadDiscoveryLogger.nodeStart("generateBigQueryParams", {
    mode: state.searchMode,
    hasRecommendation: !!state.selectedRecommendation,
    hasExistingParams: !!state.bigQueryParams,
  })

  if (emitter) {
    emitter.nodeStart("generateBigQueryParams", "검색 조건을 만들고 있어요")
  }

  try {
    let params: BigQuerySearchParams

    if (state.searchMode === "basic" && state.selectedRecommendation) {
      // Basic mode: Build query from selected recommendation
      const recommendation = state.selectedRecommendation
      const analysis = state.websiteAnalysis

      leadDiscoveryLogger.info(`[검색 조건] 선택된 추천으로 쿼리 생성 중`)
      leadDiscoveryLogger.info(`  - 국가: ${recommendation.country}`)
      leadDiscoveryLogger.info(`  - 산업: ${recommendation.industry}`)

      if (emitter) {
        emitter.progress(
          "generateBigQueryParams",
          `${recommendation.country} ${recommendation.industry} 검색을 준비하고 있어요`,
          30,
        )
      }

      const query = buildQueryFromRecommendation(
        {
          country: recommendation.country,
          industry: recommendation.industry,
          subIndustry: recommendation.subIndustry,
          keywords: recommendation.keywords,
        },
        analysis
          ? {
              companyName: analysis.companyName,
              products: analysis.products,
              businessModel: analysis.businessModel,
            }
          : undefined,
      )

      params = {
        query,
        country: COUNTRY_MAPPING[recommendation.country] || recommendation.country,
        industry: INDUSTRY_MAPPING[recommendation.industry] || recommendation.industry,
        subIndustry: recommendation.subIndustry,
        limit: 100,
      }

      leadDiscoveryLogger.info(`[검색 조건] 추천 기반 쿼리 생성 완료: "${query}"`)
    } else {
      // Advanced mode: Optimize user query with LLM
      const existingParams = state.bigQueryParams ?? { query: state.userInput }

      leadDiscoveryLogger.info(`[검색 조건] 고급 검색 - AI로 쿼리 최적화 중`)
      if (emitter) {
        emitter.progress("generateBigQueryParams", "AI가 최적의 검색 조건을 찾고 있어요", 40)
      }

      // Natural language 입력에 태그가 포함되어 있으면 LLM 이전에 우선 반영
      const tagged = parseTaggedFiltersFromUserQuery(state.userInput)
      if (tagged.country && !existingParams.country) existingParams.country = tagged.country
      if (tagged.industry && !existingParams.industry) existingParams.industry = tagged.industry
      if (tagged.subIndustry && !existingParams.subIndustry)
        existingParams.subIndustry = tagged.subIndustry
      if (tagged.employeeRange && !existingParams.employeeRange)
        existingParams.employeeRange = tagged.employeeRange

      // Apply mappings to existing params
      if (existingParams?.country) {
        existingParams.country = COUNTRY_MAPPING[existingParams.country] || existingParams.country
      }
      if (existingParams?.industry) {
        existingParams.industry =
          INDUSTRY_MAPPING[existingParams.industry] || existingParams.industry
      }

      // Parse employee range from user input
      const employeeRange = parseEmployeeRange(state.userInput)
      if (employeeRange && existingParams && !existingParams.employeeRange) {
        existingParams.employeeRange = employeeRange
        leadDiscoveryLogger.info(`[검색 조건] 직원 수 범위 감지: ${employeeRange}`)
      }

      params = await optimizeSearchQuery(state.userInput, existingParams)

      leadDiscoveryLogger.info(`[검색 조건] AI 최적화 쿼리: "${params.query}"`)
    }

    const duration = Date.now() - startTime

    // 최종 검색 조건 상세 로그
    leadDiscoveryLogger.info(`[검색 조건] 생성 완료:`)
    leadDiscoveryLogger.info(`  - 쿼리: "${params.query}"`)
    leadDiscoveryLogger.info(`  - 국가: ${params.country || "전체"}`)
    leadDiscoveryLogger.info(`  - 산업: ${params.industry || "전체"}`)
    leadDiscoveryLogger.info(`  - 세부 산업: ${params.subIndustry || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 직원 수: ${params.employeeRange || "제한 없음"}`)
    leadDiscoveryLogger.info(`  - 검색 수: ${params.limit}개`)
    leadDiscoveryLogger.info(`  - 소요시간: ${(duration / 1000).toFixed(1)}초`)

    leadDiscoveryLogger.bigQueryParamsGenerated({
      query: params.query,
      country: params.country,
      industry: params.industry,
      subIndustry: params.subIndustry,
      employeeRange: params.employeeRange,
      limit: params.limit,
    })

    if (emitter) {
      const targetDesc =
        params.country && params.industry ? `${params.country} ${params.industry}` : "검색 대상"
      emitter.nodeComplete("generateBigQueryParams", `${targetDesc} 검색 조건 준비 완료`, {
        query: params.query,
        country: params.country,
        industry: params.industry,
      })
    }

    leadDiscoveryLogger.nodeSuccess("generateBigQueryParams", duration, {
      query: params.query.substring(0, 50),
      country: params.country || "any",
      industry: params.industry || "any",
    })

    return {
      bigQueryParams: params,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    leadDiscoveryLogger.error(`[검색 조건] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("generateBigQueryParams", errorMessage, duration)

    if (emitter) {
      emitter.error(
        "generateBigQueryParams",
        `검색 조건 생성 중 문제가 발생했어요: ${errorMessage}`,
      )
    }

    return {
      error: `검색 조건을 만드는 데 실패했어요: ${errorMessage}`,
    }
  }
}
