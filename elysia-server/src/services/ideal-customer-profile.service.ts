/**
 * Ideal Customer Profile (ICP) Service
 *
 * 본인 회사 설명을 기반으로 이상적인 고객 프로필(ICP)을 생성합니다.
 * "우리 회사의 제품/서비스를 필요로 할 고객사는 어떤 특성을 가지는가?"
 *
 * 예시:
 * - 입력: "탈모 샴푸를 제조하는 회사입니다"
 * - 출력: "미용실, 헤어샵, 화장품 유통업체, 약국 체인, 온라인 뷰티 리테일러"
 */

import { GoogleGenAI } from "@google/genai"
import { config } from "../config"
import logger from "../utils/logger"

/**
 * ICP 생성 결과
 */
export interface IdealCustomerProfile {
  // 이상적인 고객 유형 목록
  customerTypes: string[]
  // 검색에 사용할 산업 키워드
  industryKeywords: string[]
  // 제외할 회사 유형
  excludeTypes: string[]
  // ICP 요약 설명 (Perplexity 검색용)
  searchQuery: string
  // AI가 생성한 이유
  reasoning: string
}

/**
 * 회사 설명에서 핵심 정보 추출
 */
export interface CompanyProfile {
  // 회사 설명
  description: string
  // 산업군 (선택)
  industry?: string
  // 타겟 시장 (b2b, b2c, both)
  target?: string
  // 진출하고자 하는 국가
  country?: string
}

/**
 * 본인 회사 설명 → 이상적인 고객 프로필(ICP) 생성
 *
 * @example
 * ```typescript
 * const icp = await generateIdealCustomerProfile({
 *   description: "탈모 샴푸를 제조하는 K-뷰티 브랜드",
 *   industry: "beauty",
 *   target: "b2b",
 *   country: "Japan",
 * })
 *
 * // 결과:
 * // {
 * //   customerTypes: ["화장품 유통업체", "드럭스토어 체인", "헤어샵/미용실", "온라인 뷰티 리테일러"],
 * //   industryKeywords: ["cosmetics distributor", "drugstore chain", "beauty wholesaler"],
 * //   excludeTypes: ["탈모 샴푸 제조업체", "원료 공급업체"],
 * //   searchQuery: "cosmetics distributors, drugstore chains, beauty product wholesalers that import Korean beauty products",
 * //   reasoning: "탈모 샴푸를 구매할 B2B 고객은..."
 * // }
 * ```
 */
export async function generateIdealCustomerProfile(
  profile: CompanyProfile,
): Promise<IdealCustomerProfile> {
  const startTime = Date.now()
  logger.info(
    `[ICP] Generating ideal customer profile for: "${profile.description.slice(0, 50)}..."`,
  )

  const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey })

  const prompt = buildICPPrompt(profile)

  try {
    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    })
    const responseText = (result.text ?? "").trim()

    // JSON 파싱
    const icp = parseICPResponse(responseText, profile)

    const elapsed = Date.now() - startTime
    logger.info(`[ICP] Generated in ${elapsed}ms: ${icp.customerTypes.length} customer types`)
    logger.debug(`[ICP] Customer types: ${icp.customerTypes.join(", ")}`)
    logger.debug(`[ICP] Search query: ${icp.searchQuery}`)

    return icp
  } catch (error) {
    logger.error(`[ICP] Failed to generate ICP: ${error}`)

    // 폴백: 기본 ICP 생성
    return createFallbackICP(profile)
  }
}

/**
 * ICP 생성 프롬프트 빌드
 */
function buildICPPrompt(profile: CompanyProfile): string {
  const countryContext = profile.country ? ` in ${profile.country}` : ""
  const targetContext =
    profile.target === "b2b" ? " (B2B focus)" : profile.target === "b2c" ? " (B2C focus)" : ""

  return `You are a B2B sales strategist. Analyze this company and identify their IDEAL CUSTOMER PROFILE (ICP).

**COMPANY INFORMATION:**
- Description: ${profile.description}
- Industry: ${profile.industry || "Not specified"}
- Target Market: ${profile.target || "B2B"}
- Target Country: ${profile.country || "Global"}

**YOUR TASK:**
Think about: "Who would BUY this company's products/services?"

NOT: "What similar companies exist?"
BUT: "What CUSTOMERS need these products/services?"

**EXAMPLE 1:**
Company: "탈모 샴푸를 제조하는 K-뷰티 브랜드"
❌ Wrong (Finding competitors): Hair loss shampoo manufacturers
✅ Correct (Finding customers): 
- Cosmetics distributors/wholesalers
- Drugstore chains (Matsumoto Kiyoshi, etc.)
- Beauty product importers
- Online beauty retailers (Qoo10, Rakuten, etc.)
- Dermatology clinics with retail

**EXAMPLE 2:**
Company: "B2B 마케팅 자동화 SaaS"
❌ Wrong: Other SaaS companies
✅ Correct:
- Enterprise sales teams
- Marketing agencies
- E-commerce companies with sales teams
- Consulting firms

**EXAMPLE 3:**
Company: "고양이 모래를 제조하는 친환경 펫푸드 회사"
❌ Wrong: Cat litter manufacturers
✅ Correct:
- Pet product distributors
- Pet store chains
- Online pet product retailers
- Pet product importers

**OUTPUT FORMAT (JSON only, no markdown):**
{
  "customerTypes": ["Customer type 1", "Customer type 2", "Customer type 3", "Customer type 4", "Customer type 5"],
  "industryKeywords": ["keyword1 for search", "keyword2 for search", "keyword3 for search"],
  "excludeTypes": ["Competitor type to exclude", "Another type to exclude"],
  "searchQuery": "A natural language search query to find these customers${countryContext}${targetContext}",
  "reasoning": "1-2 sentence explanation of why these are ideal customers"
}

**RULES:**
1. customerTypes: 5-7 specific types of companies that would BUY from this company
2. industryKeywords: 3-5 keywords to use in search (in English)
3. excludeTypes: 2-3 types to exclude (competitors, unrelated industries)
4. searchQuery: A search query optimized for finding B2B customers${countryContext}
5. Focus on DISTRIBUTORS, RETAILERS, RESELLERS, IMPORTERS, or END-USER BUSINESSES

Return ONLY the JSON object, no explanation.`
}

/**
 * AI 응답 파싱
 */
function parseICPResponse(responseText: string, profile: CompanyProfile): IdealCustomerProfile {
  // JSON 추출 (마크다운 코드 블록 제거)
  let jsonText = responseText
  if (responseText.includes("```json")) {
    jsonText = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "")
  } else if (responseText.includes("```")) {
    jsonText = responseText.replace(/```\n?/g, "")
  }

  try {
    const parsed = JSON.parse(jsonText.trim())

    // 필수 필드 검증
    if (!parsed.customerTypes || !Array.isArray(parsed.customerTypes)) {
      throw new Error("Missing or invalid customerTypes")
    }

    return {
      customerTypes: parsed.customerTypes.slice(0, 7),
      industryKeywords: parsed.industryKeywords || [],
      excludeTypes: parsed.excludeTypes || [],
      searchQuery: parsed.searchQuery || "",
      reasoning: parsed.reasoning || "",
    }
  } catch (parseError) {
    logger.warn(`[ICP] Failed to parse AI response: ${parseError}`)
    logger.debug(`[ICP] Raw response: ${responseText.slice(0, 500)}`)

    // 폴백
    return createFallbackICP(profile)
  }
}

/**
 * 폴백 ICP 생성 (AI 실패 시)
 */
function createFallbackICP(profile: CompanyProfile): IdealCustomerProfile {
  const industry = profile.industry || "general"
  const country = profile.country || "Global"

  // 산업별 기본 고객 유형 매핑
  const industryCustomerMap: Record<string, string[]> = {
    beauty: [
      "cosmetics distributors",
      "beauty product wholesalers",
      "drugstore chains",
      "online beauty retailers",
      "beauty product importers",
    ],
    food: [
      "food distributors",
      "grocery wholesalers",
      "restaurant chains",
      "food service companies",
      "food importers",
    ],
    fashion: [
      "fashion distributors",
      "clothing wholesalers",
      "department stores",
      "fashion retailers",
      "apparel importers",
    ],
    it_saas: [
      "enterprise companies",
      "mid-size businesses",
      "tech companies",
      "consulting firms",
      "marketing agencies",
    ],
    manufacturing: [
      "industrial distributors",
      "B2B buyers",
      "trading companies",
      "procurement departments",
      "manufacturing resellers",
    ],
    healthcare: [
      "medical distributors",
      "hospital groups",
      "pharmacy chains",
      "medical equipment dealers",
      "healthcare providers",
    ],
    general: ["distributors", "wholesalers", "retailers", "B2B buyers", "trading companies"],
  }

  const customerTypes: string[] = industryCustomerMap[industry] ??
    industryCustomerMap.general ?? [
      "distributors",
      "wholesalers",
      "retailers",
      "B2B buyers",
      "trading companies",
    ]

  return {
    customerTypes,
    industryKeywords: customerTypes.slice(0, 3),
    excludeTypes: ["competitors", "unrelated industries"],
    searchQuery: `${customerTypes.join(", ")} in ${country}`,
    reasoning: `Fallback ICP generated based on ${industry} industry in ${country}`,
  }
}

/**
 * ICP 기반 검색 쿼리 생성
 *
 * Perplexity 검색에 최적화된 자연어 쿼리 생성
 */
export function buildSearchQueryFromICP(
  icp: IdealCustomerProfile,
  options: {
    country?: string
    additionalContext?: string
  } = {},
): string {
  const { country, additionalContext } = options

  let query = icp.searchQuery

  // 국가 컨텍스트 추가
  if (country && !query.toLowerCase().includes(country.toLowerCase())) {
    query = `${query} in ${country}`
  }

  // 추가 컨텍스트
  if (additionalContext) {
    query = `${additionalContext} - ${query}`
  }

  return query
}

/**
 * ICP 기반 리랭킹 점수 계산용 컨텍스트 생성
 *
 * lead-scoring.service.ts의 rerankLeadsByRelevance에서 사용
 */
export function buildRerankingContextFromICP(
  icp: IdealCustomerProfile,
  myCompanyDescription: string,
): string {
  return `
**MY COMPANY (Seller):**
${myCompanyDescription}

**IDEAL CUSTOMERS (Who should buy from us):**
${icp.customerTypes.join(", ")}

**SEARCH CRITERIA:**
${icp.reasoning}

**EXCLUDE:**
${icp.excludeTypes.join(", ")}

**SCORING GUIDELINES:**
- High score (70-100): Company is a distributor, wholesaler, retailer, or importer that would BUY our products
- Medium score (40-69): Company might be a potential customer but not a perfect fit
- Low score (0-39): Company is a competitor, manufacturer, or unrelated industry
`.trim()
}

export const ICP_CONFIG = {
  // ICP 캐시 TTL (1시간)
  CACHE_TTL_MS: 60 * 60 * 1000,
}
