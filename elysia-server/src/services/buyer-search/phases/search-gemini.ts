/**
 * Phase 2B: Gemini Search
 * Google Gemini Flash를 활용한 실시간 웹 검색
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { COUNTRY_NAMES } from "../constants"
import type { BuyerIntelligence, CompanySize, Country, RawCompany } from "../types"

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.1,
  apiKey: config.gemini.apiKey,
})

/**
 * Gemini estimatedSize → CompanySize 매핑
 */
function mapGeminiSizeToCompanySize(
  estimatedSize: "Startup" | "SMB" | "Enterprise" | undefined,
): CompanySize | undefined {
  if (!estimatedSize) return undefined

  const lower = estimatedSize.toLowerCase()
  if (lower === "startup") return "startup"
  if (lower === "smb") return "small" // SMB → small로 매핑
  if (lower === "enterprise") return "enterprise"

  return undefined
}

/**
 * Gemini 검색 프롬프트 생성
 */
function buildGeminiSearchPrompt(
  productSummary: string,
  personaType: string,
  personaKeywords: string[],
  country: string,
  excludeKeywords: string[],
  count: number,
  targetCompanySize?: CompanySize[],
): string {
  const sizeGuidance =
    targetCompanySize && targetCompanySize.length > 0
      ? `\n**TARGET COMPANY SIZE PREFERENCE:**
Prioritize companies with these sizes: ${targetCompanySize.join(", ")}
- startup: Small startups or new businesses (1-10 employees)
- small: Small businesses (10-50 employees)
- medium: Medium-sized companies (50-250 employees)
- large: Large enterprises (250-1000 employees)
- enterprise: Global enterprises (1000+ employees)

If a company's size cannot be determined, still include it but note in estimatedSize field.`
      : ""

  return `You are a B2B buyer research expert. Search the web and find exactly ${count} companies matching these criteria:

**Target Buyer Profile:**
- Type: ${personaType}
- Keywords: ${personaKeywords.join(", ")}
- Country: ${country}
- Product/Service Context: ${productSummary}
${sizeGuidance}

**CRITICAL SEARCH RULES:**
1. Find companies that would BUY/DISTRIBUTE/RESELL the products described in the context
2. Focus on: distributors, wholesalers, importers, retailers, trading companies
3. Each company MUST have an official corporate website (no blogs, social media, marketplaces)
4. Companies must be located in or operate primarily in ${country}

**EXCLUDE (DO NOT INCLUDE):**
${excludeKeywords.length > 0 ? excludeKeywords.map((k) => `- ${k}`).join("\n") : "- Competitors or manufacturers of the same product"}
- Retail stores (unless they are distributors/wholesalers)
- Social media pages, blogs, or marketplaces
- Companies without official websites

**OUTPUT FORMAT:**
Return ONLY a valid JSON array with this exact structure:

[
  {
    "companyName": "Official company name",
    "website": "https://official-company-website.com",
    "industry": "Specific industry (e.g., Electronics Distribution, Beauty Wholesaler)",
    "description": "2-3 sentences describing what the company does, their products/services, and target customers. Max 200 chars.",
    "country": "${country}",
    "businessModel": "B2B" or "B2C" or "Both",
    "estimatedSize": "Startup" or "SMB" or "Enterprise"
  }
]

**QUALITY REQUIREMENTS:**
- Search thoroughly using web search capabilities
- Verify each company is real and active
- Ensure website URLs are official corporate sites
- Provide detailed, accurate descriptions
- Return exactly ${count} companies
- Output ONLY the JSON array, no markdown, no explanation, no extra text`
}

/**
 * Gemini 응답에서 JSON 배열 파싱
 */
function parseGeminiResponse(content: string): RawCompany[] {
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
      logger.warn("[Gemini] Response is not an array")
      return []
    }

    // 유효한 리드만 필터링
    const validCompanies: RawCompany[] = parsed
      .filter(
        (item: Record<string, unknown>) =>
          item.companyName && typeof item.companyName === "string" && item.companyName.length > 0,
      )
      .map((item: Record<string, unknown>) => {
        // estimatedSize 파싱
        let estimatedSize: "Startup" | "SMB" | "Enterprise" | undefined
        const es = String(item.estimatedSize || "").toLowerCase()
        if (es.includes("startup")) estimatedSize = "Startup"
        else if (es.includes("smb") || es.includes("small") || es.includes("medium"))
          estimatedSize = "SMB"
        else if (es.includes("enterprise") || es.includes("large")) estimatedSize = "Enterprise"

        return {
          companyName: String(item.companyName || ""),
          website: filterOfficialWebsite(String(item.website || "")),
          domain: undefined,
          industry: String(item.industry || ""),
          country: String(item.country || ""),
          description: String(item.description || ""),
          size: mapGeminiSizeToCompanySize(estimatedSize),
          contacts: [],
          source: "gemini" as const,
        }
      })
      .filter((company) => company.website && company.website.length > 0) // 공식 웹사이트 없는 경우 제외

    return validCompanies
  } catch (error) {
    logger.warn(`[Gemini] JSON parsing failed: ${error}`)
    return []
  }
}

/**
 * 비공식 URL 필터링 (블로그, 소셜미디어, 마켓플레이스 제외)
 */
function filterOfficialWebsite(url: string): string {
  if (!url || url.length === 0) return ""

  const lowerUrl = url.toLowerCase()

  // 제외할 도메인 패턴
  const excludePatterns = [
    // 블로그
    "blog.",
    "naver.com",
    "ameblo.jp",
    "hatena",
    "livedoor",
    "fc2.com",
    "blogger.com",
    "wordpress.com",
    "medium.com",
    "note.com",
    // 소셜 미디어
    "facebook.com",
    "instagram.com",
    "twitter.com",
    "x.com",
    "linkedin.com",
    "tiktok.com",
    "youtube.com",
    // 마켓플레이스
    "amazon.",
    "alibaba.com",
    "rakuten.co.jp",
    "yahoo.co.jp/shopping",
    "mercari.com",
    "ebay.com",
    // 디렉토리/리뷰
    "yelp.com",
    "yellowpages",
    "hotfrog",
    "trustpilot",
    "glassdoor",
    // 기타
    "wikipedia.org",
    "wikidata.org",
  ]

  for (const pattern of excludePatterns) {
    if (lowerUrl.includes(pattern)) {
      logger.debug(`[Gemini] Filtered out non-official URL: ${url}`)
      return ""
    }
  }

  return url
}

/**
 * Gemini로 바이어 검색
 * 페르소나별 × 국가별로 쿼리 생성하여 검색
 */
export async function searchWithGemini(
  intelligence: BuyerIntelligence,
  countries: Country[],
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(
    `[Gemini] 검색 시작: ${countries.length}개 국가, ${intelligence.buyerPersonas.length}개 페르소나`,
  )

  const allResults: RawCompany[] = []
  const promises: Promise<void>[] = []

  // 각 국가별로 검색 (병렬)
  for (const country of countries) {
    const countryName = COUNTRY_NAMES[country]

    // 모든 페르소나 검색 (다양성 확보)
    const targetPersonas = intelligence.buyerPersonas

    for (const persona of targetPersonas) {
      const promise = (async () => {
        try {
          // 검색 프롬프트 구성
          const searchPrompt = buildGeminiSearchPrompt(
            intelligence.productSummary,
            persona.typeKo || persona.type,
            persona.searchKeywords.en.slice(0, 3),
            countryName,
            intelligence.industryFilters.excludeKeywords,
            9, // 페르소나당 9개 목표 (15 x 0.6)
            persona.targetCompanySize,
          )

          logger.info(`[Gemini] ${countryName} - ${persona.typeKo} 검색 중...`)

          const response = await llm.invoke(searchPrompt)
          const responseText = (response.content as string).trim()

          const companies = parseGeminiResponse(responseText)

          allResults.push(...companies)

          logger.info(`[Gemini] ${countryName} - ${persona.typeKo}: ${companies.length}개 발견`)
        } catch (error) {
          logger.error(
            { error, country: countryName, persona: persona.typeKo },
            `[Gemini] 검색 실패`,
          )
          // 실패해도 계속 진행
        }
      })()

      promises.push(promise)
    }
  }

  // 모든 검색 완료 대기
  await Promise.all(promises)

  const duration = Date.now() - startTime
  logger.info(`[Gemini] 검색 완료 (${duration}ms): 총 ${allResults.length}개 발견 (중복 포함)`)

  return allResults
}
