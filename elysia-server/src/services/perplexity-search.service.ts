/**
 * Perplexity Sonar API Search Service
 * 실시간 웹 검색으로 리드 정보 가져오기
 */

import logger from "../utils/logger"

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

// 검색 결과 타입
export interface PerplexityLead {
  companyName: string
  website: string
  industry: string
  description: string
  country: string
}

export interface PerplexitySearchResult {
  leads: PerplexityLead[]
  totalCount: number
  source: "perplexity"
}

/**
 * Perplexity Sonar API로 리드 검색
 */
export async function searchLeadsWithPerplexity(
  query: string,
  count: number = 10,
): Promise<PerplexitySearchResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY

  if (!apiKey) {
    logger.warn("[Perplexity] API key not configured - skipping Perplexity search")
    return { leads: [], totalCount: 0, source: "perplexity" }
  }

  const startTime = Date.now()
  logger.info(`[Perplexity] Starting search: "${query}" (count: ${count})`)

  try {
    // 프롬프트 구성 - 회사 목록을 JSON으로 요청
    const systemPrompt = `You are a B2B lead research assistant. 
When asked about companies, search the web and return ONLY a valid JSON array of companies.
Each company object must have these exact fields:
- companyName: string (company name)
- website: string (company website URL, must start with http or https)
- industry: string (main industry/sector)
- description: string (brief description in English, max 100 chars)
- country: string (country name)

IMPORTANT:
- Return ONLY the JSON array, no markdown, no explanation
- Focus on real, active companies with valid websites
- Prioritize distributors, wholesalers, and suppliers
- Exclude retailers, salons, and service providers unless specifically requested`

    const userPrompt = `Find ${count} companies matching this criteria: "${query}"

Return as JSON array. Example format:
[{"companyName":"Example Inc","website":"https://example.com","industry":"Distribution","description":"Leading distributor of products","country":"United States"}]`

    const response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "sonar", // 웹 검색 포함 모델
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1, // 낮은 temperature로 일관성 높이기
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`[Perplexity] API error: ${response.status} - ${errorText}`)
      return { leads: [], totalCount: 0, source: "perplexity" }
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
    }
    const content = data.choices?.[0]?.message?.content || ""

    const duration = Date.now() - startTime
    logger.info(`[Perplexity] Response received in ${duration}ms`)
    logger.debug(`[Perplexity] Raw response: ${content.substring(0, 500)}...`)

    // JSON 파싱 시도
    const leads = parseLeadsFromResponse(content)

    logger.info(`[Perplexity] Parsed ${leads.length} leads from response`)

    return {
      leads,
      totalCount: leads.length,
      source: "perplexity",
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`[Perplexity] Search failed: ${errorMsg}`)
    return { leads: [], totalCount: 0, source: "perplexity" }
  }
}

/**
 * Perplexity 응답에서 JSON 배열 파싱
 */
function parseLeadsFromResponse(content: string): PerplexityLead[] {
  try {
    // JSON 배열 추출 시도
    let jsonStr = content.trim()

    // 마크다운 코드블록 제거
    if (jsonStr.includes("```json")) {
      jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (jsonStr.includes("```")) {
      jsonStr = jsonStr.replace(/```\n?/g, "")
    }

    // [ 로 시작하는 부분 찾기
    const startIdx = jsonStr.indexOf("[")
    const endIdx = jsonStr.lastIndexOf("]")

    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      jsonStr = jsonStr.substring(startIdx, endIdx + 1)
    }

    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) {
      logger.warn("[Perplexity] Response is not an array")
      return []
    }

    // 유효한 리드만 필터링
    const validLeads: PerplexityLead[] = parsed
      .filter(
        (item: Record<string, unknown>) =>
          item.companyName && typeof item.companyName === "string" && item.companyName.length > 0,
      )
      .map((item: Record<string, unknown>) => ({
        companyName: String(item.companyName || ""),
        website: String(item.website || ""),
        industry: String(item.industry || ""),
        description: String(item.description || ""),
        country: String(item.country || ""),
      }))

    return validLeads
  } catch (error) {
    logger.warn(`[Perplexity] JSON parsing failed: ${error}`)
    return []
  }
}

/**
 * 자연어 쿼리를 Perplexity 검색용으로 최적화
 */
export function optimizeQueryForPerplexity(query: string): string {
  // 한국어 키워드를 영어로 변환
  const translations: Record<string, string> = {
    미국: "United States USA",
    유통업체: "distributors wholesalers",
    유통: "distribution wholesale",
    도매: "wholesale",
    제조업체: "manufacturers",
    수입업체: "importers",
    수출업체: "exporters",
    뷰티: "beauty cosmetics",
    뷰티디바이스: "beauty device skincare device",
    화장품: "cosmetics beauty products",
    건축자재: "building materials construction supplies",
    인테리어: "interior design materials",
    바닥재: "flooring materials",
    타일: "tile ceramic",
    "에 위치한": "located in",
    찾아줘: "",
    검색: "",
  }

  let optimized = query
  for (const [korean, english] of Object.entries(translations)) {
    optimized = optimized.replace(new RegExp(korean, "gi"), english)
  }

  // 중복 공백 제거
  optimized = optimized.replace(/\s+/g, " ").trim()

  return optimized
}

/**
 * Perplexity 리드를 BigQuery 결과 형식으로 변환
 */
export function convertPerplexityToBigQueryFormat(leads: PerplexityLead[]): Array<{
  companyName: string
  webAddress: string
  email?: string
  country: string
  mainIndustry: string
  subIndustry?: string
  category?: string
  employee?: string
  revenue?: string
  source: "perplexity"
}> {
  return leads.map((lead) => ({
    companyName: lead.companyName,
    webAddress: lead.website,
    country: lead.country,
    mainIndustry: lead.industry,
    subIndustry: lead.description,
    source: "perplexity" as const,
  }))
}
