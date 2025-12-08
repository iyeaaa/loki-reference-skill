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
  const lower = input.toLowerCase()

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

  leadDiscoveryLogger.nodeStart("generateBigQueryParams", {
    mode: state.searchMode,
    hasRecommendation: !!state.selectedRecommendation,
    hasExistingParams: !!state.bigQueryParams,
  })

  if (emitter) {
    emitter.nodeStart("generateBigQueryParams", "Generating search parameters...")
  }

  try {
    let params: BigQuerySearchParams

    if (state.searchMode === "basic" && state.selectedRecommendation) {
      // Basic mode: Build query from selected recommendation
      const recommendation = state.selectedRecommendation
      const analysis = state.websiteAnalysis

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

      leadDiscoveryLogger.info(`Built query from recommendation: "${query}"`)
    } else {
      // Advanced mode: Optimize user query with LLM
      const existingParams = state.bigQueryParams

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
      }

      params = await optimizeSearchQuery(state.userInput, existingParams)

      leadDiscoveryLogger.info(`Optimized query: "${params.query}"`)
    }

    const duration = Date.now() - startTime

    leadDiscoveryLogger.bigQueryParamsGenerated({
      query: params.query,
      country: params.country,
      industry: params.industry,
      subIndustry: params.subIndustry,
      employeeRange: params.employeeRange,
      limit: params.limit,
    })

    if (emitter) {
      emitter.nodeComplete("generateBigQueryParams", "Parameters generated", {
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

    leadDiscoveryLogger.nodeError("generateBigQueryParams", errorMessage, duration)

    if (emitter) {
      emitter.error("generateBigQueryParams", errorMessage)
    }

    return {
      error: `Failed to generate search parameters: ${errorMessage}`,
    }
  }
}
