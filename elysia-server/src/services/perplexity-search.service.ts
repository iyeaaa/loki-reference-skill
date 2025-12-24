/**
 * Perplexity Sonar API Search Service
 * 실시간 웹 검색으로 리드 정보 가져오기
 *
 * Enhanced Features:
 * - 국가별 분할 검색으로 글로벌 커버리지 향상
 * - 개선된 프롬프트로 B2B 관련성 강화
 * - description 기반 리드 품질 향상
 */

import { config } from "../config"
import logger from "../utils/logger"

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions"

// 기본 검색 설정
const DEFAULT_SEARCH_COUNT = 30 // 기본 검색 수 (10 → 30)
const MAX_SEARCH_COUNT_PER_REQUEST = 50 // API 요청당 최대 검색 수
const NON_US_SEARCH_MULTIPLIER = 2 // 비미국 국가 검색량 배수

// BigQuery 데이터가 풍부한 국가 목록
const BIGQUERY_RICH_COUNTRIES = [
  "United States",
  "USA",
  "US",
  "United Kingdom",
  "UK",
  "Canada",
  "Australia",
]

// 지역 → 국가 매핑 (분할 검색용)
const REGION_TO_COUNTRIES: Record<string, string[]> = {
  asia: ["Japan", "South Korea", "China", "Singapore", "Taiwan", "Hong Kong"],
  "southeast asia": ["Thailand", "Vietnam", "Indonesia", "Malaysia", "Philippines", "Singapore"],
  europe: [
    "Germany",
    "France",
    "United Kingdom",
    "Italy",
    "Spain",
    "Netherlands",
    "Belgium",
    "Sweden",
  ],
  "latin america": ["Brazil", "Mexico", "Argentina", "Colombia", "Chile"],
  "middle east": ["United Arab Emirates", "Saudi Arabia", "Israel", "Turkey", "Qatar"],
}

// 검색 결과 타입
export interface PerplexityLead {
  companyName: string
  website: string
  industry: string
  description: string
  country: string
  businessModel?: "B2B" | "B2C" | "Both"
  estimatedSize?: "Startup" | "SMB" | "Enterprise"
}

export interface PerplexitySearchResult {
  leads: PerplexityLead[]
  totalCount: number
  source: "perplexity"
}

/**
 * 개선된 시스템 프롬프트 생성
 */
function getEnhancedSystemPrompt(): string {
  return `You are a B2B lead research expert specializing in finding business-to-business companies.
Search the web thoroughly and return ONLY a valid JSON array of companies.

Each company object MUST have these exact fields:
- companyName: string (official company name)
- website: string (OFFICIAL company website URL only)
- industry: string (primary industry sector - be specific, e.g., "Building Materials Distribution" not just "Distribution")
- description: string (2-3 sentences describing: what the company does, their main products/services, and who their target customers are. Max 200 chars)
- country: string (country name where headquarters is located)
- businessModel: string ("B2B", "B2C", or "Both")
- estimatedSize: string ("Startup", "SMB", or "Enterprise")

CRITICAL RULES FOR WEBSITE:
- ONLY official corporate websites (e.g., companyname.com, company.co.jp)
- NEVER include: blogs (naver.com, blog.*, ameblo.jp), social media (facebook, instagram, linkedin, twitter), marketplaces (amazon, alibaba, rakuten), directories (yelp, yellowpages)
- If no official website exists, set website to empty string ""

B2B FOCUS RULES:
- PRIORITIZE: distributors, wholesalers, manufacturers, suppliers, B2B service providers
- INCLUDE companies that sell to other businesses
- EXCLUDE: retail stores, salons, restaurants, individual service providers (unless they serve B2B)
- Look for companies with corporate clients, wholesale operations, or B2B sales channels

QUALITY RULES:
- Return ONLY the JSON array, no markdown, no explanation, no extra text
- Each company must be real, active, and verifiable
- Focus on companies with clear B2B business models
- Provide detailed, accurate descriptions based on actual company information`
}

/**
 * 사용자 프롬프트 생성
 * @param query - 검색 쿼리 (예: "탈모 샴푸 beauty cosmetics companies in Japan")
 * @param count - 찾을 회사 수
 * @param productFocus - 특정 제품/서비스 강조 (선택)
 */
function getEnhancedUserPrompt(query: string, count: number, productFocus?: string): string {
  // 쿼리에서 핵심 키워드 추출 (첫 번째 부분이 주로 제품/서비스)
  const queryParts = query.split(" companies in ")
  const mainCriteria = queryParts[0] || query
  const location = queryParts[1] || ""

  // productFocus가 있으면 그것을 강조, 없으면 mainCriteria에서 추출
  const focusProduct = productFocus || mainCriteria.split(" ").slice(0, 3).join(" ")

  return `Find exactly ${count} B2B companies matching this criteria: "${query}"

⚠️ CRITICAL PRODUCT/SERVICE FOCUS:
- Companies MUST specialize in, manufacture, distribute, or sell: "${focusProduct}"
- ONLY include companies directly related to: ${focusProduct}
- Do NOT include unrelated industries (hotels, travel agencies, restaurants, etc.)
${location ? `- Companies must be located in or operate in: ${location}` : ""}

REQUIREMENTS:
1. Each company MUST have an official corporate website (no blogs, social media, or marketplaces)
2. Focus on B2B companies: manufacturers, wholesalers, distributors, OEM suppliers, or ingredient providers
3. Companies must be DIRECTLY related to the product/service: "${focusProduct}"
4. Provide detailed descriptions including: what they do, their products/services, and target customers
5. Include businessModel (B2B/B2C/Both) and estimatedSize (Startup/SMB/Enterprise)

EXCLUDED COMPANIES (DO NOT INCLUDE):
- Hotels, resorts, travel agencies
- Restaurants, cafes, bars
- General retailers not specialized in the product
- Companies with no clear connection to "${focusProduct}"

Return as JSON array. Example format:
[{
  "companyName": "Example Distribution Inc",
  "website": "https://example-dist.com",
  "industry": "Hair Care Products Manufacturing",
  "description": "Manufacturer and B2B distributor of hair loss treatment products and shampoos. Supplies to pharmacies, clinics, and beauty distributors.",
  "country": "Japan",
  "businessModel": "B2B",
  "estimatedSize": "SMB"
}]`
}

/**
 * Perplexity API 단일 요청 실행
 */
async function executePerplexityRequest(
  query: string,
  count: number,
  apiKey: string,
): Promise<PerplexityLead[]> {
  const systemPrompt = getEnhancedSystemPrompt()
  const userPrompt = getEnhancedUserPrompt(query, count)

  // max_tokens를 count에 비례해서 조정 (리드당 약 150 토큰)
  const maxTokens = Math.min(count * 150, 8000)

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "sonar-pro", // 웹 검색 포함 모델
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1, // 낮은 temperature로 일관성 높이기
      max_tokens: maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error(`[Perplexity] API error: ${response.status} - ${errorText}`)
    return []
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = data.choices?.[0]?.message?.content || ""

  return parseLeadsFromResponse(content)
}

/**
 * Perplexity Sonar API로 리드 검색 (기본 함수)
 */
export async function searchLeadsWithPerplexity(
  query: string,
  count: number = DEFAULT_SEARCH_COUNT,
): Promise<PerplexitySearchResult> {
  const apiKey = config.perplexity.apiKey

  if (!apiKey) {
    logger.warn("[Perplexity] API key not configured - skipping Perplexity search")
    return { leads: [], totalCount: 0, source: "perplexity" }
  }

  const startTime = Date.now()
  logger.info(`[Perplexity] Starting search: "${query}" (count: ${count})`)

  try {
    const leads = await executePerplexityRequest(query, count, apiKey)

    const duration = Date.now() - startTime
    logger.info(`[Perplexity] Parsed ${leads.length} leads in ${duration}ms`)

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
 * 쿼리에서 국가/지역 정보 추출
 */
function extractCountryFromQuery(query: string): {
  country: string | null
  isRegion: boolean
  regionCountries: string[]
} {
  const lowerQuery = query.toLowerCase()

  // 지역 체크
  for (const [region, countries] of Object.entries(REGION_TO_COUNTRIES)) {
    if (lowerQuery.includes(region)) {
      return { country: region, isRegion: true, regionCountries: countries }
    }
  }

  // 개별 국가 체크
  const countryPatterns: Record<string, string[]> = {
    "United States": ["united states", "usa", "us", "미국", "america"],
    "United Kingdom": ["united kingdom", "uk", "영국", "britain"],
    Canada: ["canada", "캐나다"],
    Australia: ["australia", "호주"],
    Germany: ["germany", "독일"],
    France: ["france", "프랑스"],
    Japan: ["japan", "일본"],
    "South Korea": ["south korea", "korea", "한국"],
    China: ["china", "중국"],
    India: ["india", "인도"],
    Singapore: ["singapore", "싱가포르"],
    Netherlands: ["netherlands", "네덜란드", "holland"],
    Belgium: ["belgium", "벨기에"],
    Thailand: ["thailand", "태국"],
    Vietnam: ["vietnam", "베트남"],
    Indonesia: ["indonesia", "인도네시아"],
    Malaysia: ["malaysia", "말레이시아"],
    Philippines: ["philippines", "필리핀"],
    Brazil: ["brazil", "브라질"],
    Mexico: ["mexico", "멕시코"],
  }

  for (const [country, patterns] of Object.entries(countryPatterns)) {
    for (const pattern of patterns) {
      if (lowerQuery.includes(pattern)) {
        return { country, isRegion: false, regionCountries: [] }
      }
    }
  }

  return { country: null, isRegion: false, regionCountries: [] }
}

/**
 * 국가가 BigQuery 데이터가 풍부한 국가인지 확인
 */
function isBigQueryRichCountry(country: string | null): boolean {
  if (!country) return false
  return BIGQUERY_RICH_COUNTRIES.some((rich) => rich.toLowerCase() === country.toLowerCase())
}

/**
 * Enhanced Perplexity 검색 - 국가별 분할 검색 및 검색량 자동 조절
 *
 * - 비미국 국가: 검색량 2배 (BigQuery 데이터 부족 보완)
 * - 지역 검색: 개별 국가로 분할하여 병렬 검색
 * - 더 상세한 description 요청
 */
export async function searchLeadsWithPerplexityEnhanced(
  query: string,
  baseCount: number = DEFAULT_SEARCH_COUNT,
  options?: {
    forceParallelSearch?: boolean
    maxCountPerCountry?: number
  },
): Promise<PerplexitySearchResult> {
  const apiKey = config.perplexity.apiKey

  if (!apiKey) {
    logger.warn("[Perplexity] API key not configured - skipping Perplexity search")
    return { leads: [], totalCount: 0, source: "perplexity" }
  }

  const startTime = Date.now()
  const { country, isRegion, regionCountries } = extractCountryFromQuery(query)
  const isBigQueryRich = isBigQueryRichCountry(country)

  // 검색량 결정: 비미국 국가는 2배
  let adjustedCount = baseCount
  if (!isBigQueryRich && country) {
    adjustedCount = Math.min(baseCount * NON_US_SEARCH_MULTIPLIER, 100)
    logger.info(
      `[Perplexity] Non-BigQuery-rich country detected (${country}), increasing count to ${adjustedCount}`,
    )
  }

  logger.info(
    `[Perplexity] Enhanced search: "${query}" (count: ${adjustedCount}, region: ${isRegion}, country: ${country})`,
  )

  try {
    let allLeads: PerplexityLead[] = []

    if (isRegion && regionCountries.length > 0) {
      // 지역 검색: 개별 국가로 분할하여 병렬 검색
      const countPerCountry = Math.min(
        options?.maxCountPerCountry || Math.ceil(adjustedCount / regionCountries.length),
        MAX_SEARCH_COUNT_PER_REQUEST,
      )

      logger.info(
        `[Perplexity] Splitting into ${regionCountries.length} country searches (${countPerCountry} each)`,
      )

      // 쿼리에서 지역명 제거하고 국가명으로 대체
      const baseQuery = query
        .toLowerCase()
        .replace(/\b(asia|southeast asia|europe|latin america|middle east)\b/gi, "")
        .trim()

      const countryQueries = regionCountries.map((c) =>
        `${baseQuery} in ${c}`.replace(/\s+/g, " ").trim(),
      )

      // 병렬 검색 실행
      const results = await Promise.allSettled(
        countryQueries.map((q) => executePerplexityRequest(q, countPerCountry, apiKey)),
      )

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const countryName = regionCountries[i]
        if (result?.status === "fulfilled") {
          logger.info(`[Perplexity] ${countryName}: ${result.value.length} leads`)
          allLeads.push(...result.value)
        } else if (result?.status === "rejected") {
          logger.warn(`[Perplexity] ${countryName} search failed: ${result.reason}`)
        }
      }
    } else {
      // 단일 국가 또는 국가 미지정: 일반 검색
      allLeads = await executePerplexityRequest(query, adjustedCount, apiKey)
    }

    // 중복 제거 (website 기준)
    const uniqueLeads = deduplicateLeads(allLeads)

    const duration = Date.now() - startTime
    logger.info(
      `[Perplexity] Enhanced search complete: ${uniqueLeads.length} unique leads in ${duration}ms`,
    )

    return {
      leads: uniqueLeads,
      totalCount: uniqueLeads.length,
      source: "perplexity",
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`[Perplexity] Enhanced search failed: ${errorMsg}`)
    return { leads: [], totalCount: 0, source: "perplexity" }
  }
}

/**
 * 리드 중복 제거 (website 기준)
 */
function deduplicateLeads(leads: PerplexityLead[]): PerplexityLead[] {
  const seen = new Set<string>()
  return leads.filter((lead) => {
    const key = lead.website
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
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

    // 유효한 리드만 필터링 (비공식 URL 제외)
    const validLeads: PerplexityLead[] = parsed
      .filter(
        (item: Record<string, unknown>) =>
          item.companyName && typeof item.companyName === "string" && item.companyName.length > 0,
      )
      .map((item: Record<string, unknown>) => {
        // businessModel 파싱
        let businessModel: "B2B" | "B2C" | "Both" | undefined
        const bm = String(item.businessModel || "").toUpperCase()
        if (bm === "B2B" || bm === "B2C" || bm === "BOTH") {
          businessModel = bm === "BOTH" ? "Both" : (bm as "B2B" | "B2C")
        }

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
          industry: String(item.industry || ""),
          description: String(item.description || ""),
          country: String(item.country || ""),
          businessModel,
          estimatedSize,
        }
      })
      .filter((lead) => lead.website.length > 0) // 공식 웹사이트 없는 경우 제외

    return validLeads
  } catch (error) {
    logger.warn(`[Perplexity] JSON parsing failed: ${error}`)
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
      logger.debug(`[Perplexity] Filtered out non-official URL: ${url}`)
      return ""
    }
  }

  return url
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
  description?: string
  businessModel?: string
  estimatedSize?: string
  source: "perplexity"
}> {
  return leads.map((lead) => ({
    companyName: lead.companyName,
    webAddress: lead.website,
    country: lead.country,
    mainIndustry: lead.industry,
    subIndustry: lead.industry, // industry를 subIndustry에도 복사
    description: lead.description, // 상세 설명 추가
    businessModel: lead.businessModel,
    estimatedSize: lead.estimatedSize,
    source: "perplexity" as const,
  }))
}

/**
 * 검색 설정 내보내기 (테스트/오버라이드용)
 */
export const PERPLEXITY_CONFIG = {
  DEFAULT_SEARCH_COUNT,
  MAX_SEARCH_COUNT_PER_REQUEST,
  NON_US_SEARCH_MULTIPLIER,
  BIGQUERY_RICH_COUNTRIES,
  REGION_TO_COUNTRIES,
}
