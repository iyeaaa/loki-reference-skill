/**
 * Collect Buyer Info Node
 * Parses user input with AI to extract BuyerSearchInput fields
 * Triggers interrupt if required fields are missing
 */

import { type Command, GraphInterrupt, interrupt } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import type {
  BuyerSearchInput,
  CompanySize,
  Country,
  Industry,
  SearchMode,
  TargetCustomer,
} from "../../buyer-search/types"
import { createErrorContext } from "../error-classifier"
import { leadDiscoveryLogger } from "../logger"
import type { LeadDiscoveryState } from "../state"

const llm = new ChatOpenAI({
  model: "gpt-4.1-mini",
  temperature: 0,
})

// Country mapping (user input → Country type)
const COUNTRY_MAPPINGS: Record<string, Country> = {
  // Korean
  미국: "usa",
  일본: "japan",
  중국: "china",
  동남아: "southeast_asia",
  동남아시아: "southeast_asia",
  유럽: "europe",
  중동: "middle_east",
  // English
  usa: "usa",
  "united states": "usa",
  america: "usa",
  japan: "japan",
  china: "china",
  "southeast asia": "southeast_asia",
  europe: "europe",
  "middle east": "middle_east",
}

// Industry mapping (user input → Industry type)
const INDUSTRY_MAPPINGS: Record<string, Industry> = {
  // Korean
  제조: "manufacturing_parts",
  부품: "manufacturing_parts",
  "제조 부품": "manufacturing_parts",
  it: "it_software",
  소프트웨어: "it_software",
  뷰티: "beauty_cosmetics",
  화장품: "beauty_cosmetics",
  코스메틱: "beauty_cosmetics",
  식품: "food_supplements",
  건기식: "food_supplements",
  건강기능식품: "food_supplements",
  패션: "fashion_apparel",
  의류: "fashion_apparel",
  전자: "electronics",
  전자제품: "electronics",
  헬스케어: "healthcare",
  의료: "healthcare",
  // English
  manufacturing: "manufacturing_parts",
  parts: "manufacturing_parts",
  software: "it_software",
  beauty: "beauty_cosmetics",
  cosmetics: "beauty_cosmetics",
  food: "food_supplements",
  supplements: "food_supplements",
  fashion: "fashion_apparel",
  apparel: "fashion_apparel",
  electronics: "electronics",
  healthcare: "healthcare",
}

// Available options for interrupt questions
const COUNTRY_OPTIONS: { value: Country; label: string; labelKo: string }[] = [
  { value: "usa", label: "USA", labelKo: "미국" },
  { value: "japan", label: "Japan", labelKo: "일본" },
  { value: "china", label: "China", labelKo: "중국" },
  { value: "southeast_asia", label: "Southeast Asia", labelKo: "동남아시아" },
  { value: "europe", label: "Europe", labelKo: "유럽" },
  { value: "middle_east", label: "Middle East", labelKo: "중동" },
]

const INDUSTRY_OPTIONS: { value: Industry; label: string; labelKo: string }[] = [
  { value: "manufacturing_parts", label: "Manufacturing & Parts", labelKo: "제조/부품" },
  { value: "it_software", label: "IT & Software", labelKo: "IT/소프트웨어" },
  { value: "beauty_cosmetics", label: "Beauty & Cosmetics", labelKo: "뷰티/화장품" },
  { value: "food_supplements", label: "Food & Supplements", labelKo: "식품/건기식" },
  { value: "fashion_apparel", label: "Fashion & Apparel", labelKo: "패션/의류" },
  { value: "electronics", label: "Electronics", labelKo: "전자제품" },
  { value: "healthcare", label: "Healthcare", labelKo: "헬스케어" },
  { value: "other", label: "Other", labelKo: "기타" },
]

// Helper functions to convert labels back to values
function labelToCountry(label: string): Country | null {
  const option = COUNTRY_OPTIONS.find((o) => o.label === label || o.labelKo === label)
  return option?.value || null
}

function labelToIndustry(label: string): Industry | null {
  const option = INDUSTRY_OPTIONS.find((o) => o.label === label || o.labelKo === label)
  return option?.value || null
}

// Parsed query result interface
interface ParsedQuery {
  country: Country[] | null
  description: string | null
  industry: Industry | null
  target: TargetCustomer | null
  companySize: CompanySize | null
  companyName: string | null
  searchMode: SearchMode | null // "direct" = 찾을 기업 직접 설명, "seller" = 내 회사/제품 기반 바이어 찾기
}

/**
 * Parse user input with AI to extract BuyerSearchInput fields
 */
async function parseUserQuery(query: string, locale: string): Promise<ParsedQuery> {
  const prompt = `Analyze the following user input and extract buyer search parameters.

User Input: "${query}"
Locale: ${locale}

Extract the following information in JSON format:
{
  "country": ["usa" | "japan" | "china" | "southeast_asia" | "europe" | "middle_east"] or null,
  "description": "extracted buyer/company description in the original language" or null,
  "industry": "manufacturing_parts" | "it_software" | "beauty_cosmetics" | "food_supplements" | "fashion_apparel" | "electronics" | "healthcare" | "other" or null,
  "target": "b2b" | "b2c" | "both" or null,
  "companySize": "startup" | "small" | "medium" | "large" | "enterprise" or null,
  "companyName": "user's company name if mentioned" or null,
  "searchMode": "direct" | "seller"
}

Guidelines:
- For country: Extract mentioned countries. "미국" = "usa", "일본" = "japan", "중국" = "china", "동남아" = "southeast_asia", "유럽" = "europe", "중동" = "middle_east"
- For description: Extract what kind of buyer/company the user is looking for (e.g., "실링팬 유통 업체", "화장품 바이어")
- For industry: Map to the closest industry type. "실링팬" → "manufacturing_parts", "화장품" → "beauty_cosmetics"
- For target: "유통 업체", "수입상", "도매상" → "b2b". "소매", "소비자" → "b2c". Default to "b2b" for B2B-sounding queries.
- For companySize: Only if explicitly mentioned (e.g., "대기업", "스타트업")
- For companyName: Only if the user mentions their own company name
- For searchMode: Determine the search intent:
  * "direct": The user is directly describing the type of company they want to find
    - Examples: "동남아 실링팬 유통 기업 찾아줘", "미국 헬스케어 스타트업", "일본 화장품 수입상"
    - Pattern: Direct company type/characteristics description
  * "seller": The user is describing their own company/product and wants to find buyers for it
    - Examples: "실링팬 제조사의 바이어", "우리 화장품의 해외 수입상", "우리 제품을 구매할 바이어"
    - Patterns: "~의 바이어", "~의 고객사", "~의 수입상", "우리 ~", "내 ~"
  * Default to "direct" if the input directly describes what company to find without mentioning "buyer" or seller's perspective

Return JSON only, no markdown.`

  try {
    const response = await llm.invoke(prompt)
    const content = (response.content as string).trim()

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      // Normalize country to always be an array (AI may return string or array)
      let country = parsed.country
      if (country && !Array.isArray(country)) {
        country = [country]
      }
      return {
        country: country || null,
        description: parsed.description || null,
        industry: parsed.industry || null,
        target: parsed.target || null,
        companySize: parsed.companySize || null,
        companyName: parsed.companyName || null,
        searchMode: parsed.searchMode || "direct",
      }
    }

    // Fallback: try simple keyword extraction
    return extractKeywords(query)
  } catch (error) {
    leadDiscoveryLogger.warn(`[collectBuyerInfo] AI parsing failed: ${error}`)
    return extractKeywords(query)
  }
}

/**
 * Simple keyword extraction fallback
 */
function extractKeywords(query: string): ParsedQuery {
  const lowerQuery = query.toLowerCase()
  const result: ParsedQuery = {
    country: null,
    description: query,
    industry: null,
    target: "b2b",
    companySize: null,
    companyName: null,
    searchMode: "direct",
  }

  // Extract country
  const countries: Country[] = []
  for (const [keyword, country] of Object.entries(COUNTRY_MAPPINGS)) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      if (!countries.includes(country)) {
        countries.push(country)
      }
    }
  }
  if (countries.length > 0) {
    result.country = countries
  }

  // Extract industry
  for (const [keyword, industry] of Object.entries(INDUSTRY_MAPPINGS)) {
    if (lowerQuery.includes(keyword.toLowerCase())) {
      result.industry = industry
      break
    }
  }

  // Determine searchMode based on patterns
  // "seller" mode patterns: 바이어, 고객사, 수입상 (with possessive), 우리, 내
  const sellerPatterns = [
    /의\s*바이어/,
    /의\s*고객/,
    /의\s*수입상/,
    /우리\s*(회사|제품|상품)/,
    /내\s*(회사|제품|상품)/,
    /buyer\s*for/i,
    /our\s*(company|product)/i,
    /my\s*(company|product)/i,
  ]

  const isSellerMode = sellerPatterns.some((pattern) => pattern.test(query))
  result.searchMode = isSellerMode ? "seller" : "direct"

  return result
}

/**
 * Build interrupt questions for missing fields
 */
function buildQuestions(
  missingFields: string[],
  locale: string,
): Array<{
  field: string
  label: string
  options: Array<{ value: string; label: string }>
  required: boolean
}> {
  const questions: Array<{
    field: string
    label: string
    options: Array<{ value: string; label: string }>
    required: boolean
  }> = []

  if (missingFields.includes("country")) {
    questions.push({
      field: "country",
      label:
        locale === "ko"
          ? "어느 국가의 바이어를 찾으시나요?"
          : "Which country's buyers are you looking for?",
      options: COUNTRY_OPTIONS.map((c) => ({
        value: c.value,
        label: locale === "ko" ? c.labelKo : c.label,
      })),
      required: true,
    })
  }

  if (missingFields.includes("description")) {
    questions.push({
      field: "description",
      label:
        locale === "ko"
          ? "어떤 바이어를 찾고 계신가요? (예: 화장품 유통업체, 전자부품 수입상)"
          : "What kind of buyers are you looking for? (e.g., cosmetics distributors, electronics importers)",
      options: [], // Free text input
      required: true,
    })
  }

  if (missingFields.includes("industry")) {
    questions.push({
      field: "industry",
      label: locale === "ko" ? "어떤 산업의 바이어인가요?" : "What industry?",
      options: INDUSTRY_OPTIONS.map((i) => ({
        value: i.value,
        label: locale === "ko" ? i.labelKo : i.label,
      })),
      required: false,
    })
  }

  return questions
}

/**
 * Collect Buyer Info Node
 * Main entry point for parsing user input and building BuyerSearchInput
 */
export async function collectBuyerInfo(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState> | Command> {
  const startTime = Date.now()
  const emitter = state._emitter
  const locale = state.locale || "ko"

  leadDiscoveryLogger.info(`[collectBuyerInfo] 시작 - 입력: "${state.userInput}"`)
  leadDiscoveryLogger.nodeStart("collectBuyerInfo", {
    userInput: state.userInput,
    websiteAnalysis: !!state.websiteAnalysis,
    existingBuyerSearchInput: !!state.buyerSearchInput,
  })

  if (emitter) {
    emitter.nodeStart(
      "collectBuyerInfo",
      locale === "ko" ? "검색 조건을 분석하고 있어요" : "Analyzing search criteria",
    )
  }

  try {
    // If we already have answers from interrupt, apply them
    if (state.clarification?.answers && Object.keys(state.clarification.answers).length > 0) {
      leadDiscoveryLogger.info(`[collectBuyerInfo] 사용자 답변 적용 중`)

      const answers = state.clarification.answers
      const existingInput = state.buyerSearchInput || {}

      // Apply answers to BuyerSearchInput
      // Convert label strings back to enum values
      const countryValue = answers.country ? labelToCountry(answers.country as string) : null
      const industryValue = answers.industry ? labelToIndustry(answers.industry as string) : null

      const updatedInput: Partial<BuyerSearchInput> = {
        ...existingInput,
        country: countryValue ? [countryValue] : existingInput.country,
        companyDescription: answers.description || existingInput.companyDescription,
        industry: industryValue || existingInput.industry || "other",
        target: existingInput.target || "b2b",
        companySize: existingInput.companySize || "medium",
        locale: (locale as "en" | "ko") || "ko",
        companyName: existingInput.companyName || "My Company",
        searchMode: existingInput.searchMode || "direct",
      }

      const duration = Date.now() - startTime
      leadDiscoveryLogger.info(
        `[collectBuyerInfo] 답변 적용 완료 - 국가: ${updatedInput.country}, 설명: ${updatedInput.companyDescription}`,
      )
      leadDiscoveryLogger.nodeSuccess("collectBuyerInfo", duration, { status: "answers_applied" })

      if (emitter) {
        emitter.nodeComplete(
          "collectBuyerInfo",
          locale === "ko" ? "검색 조건이 확정되었어요" : "Search criteria confirmed",
          {
            country: updatedInput.country,
            description: updatedInput.companyDescription,
          },
        )
      }

      return {
        buyerSearchInput: updatedInput as BuyerSearchInput,
        needsClarification: false,
        clarification: {
          ...state.clarification,
          needed: false,
        },
      }
    }

    // Parse user query with AI
    const parsed = await parseUserQuery(state.userInput, locale)

    leadDiscoveryLogger.info(`[collectBuyerInfo] 파싱 결과:`)
    leadDiscoveryLogger.info(`  - 국가: ${parsed.country?.join(", ") || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 설명: ${parsed.description || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 산업: ${parsed.industry || "(없음)"}`)
    leadDiscoveryLogger.info(`  - 타겟: ${parsed.target || "(없음)"}`)

    // Merge with website analysis if available
    let companyDescription = parsed.description
    let industry = parsed.industry

    if (state.websiteAnalysis) {
      // Use website analysis to enrich the description
      const wa = state.websiteAnalysis
      if (!companyDescription && wa.description) {
        companyDescription = wa.description
      }
      if (!industry && wa.industry) {
        // Try to map website industry to our industry type
        const waIndustryLower = wa.industry.toLowerCase()
        for (const [keyword, ind] of Object.entries(INDUSTRY_MAPPINGS)) {
          if (waIndustryLower.includes(keyword.toLowerCase())) {
            industry = ind
            break
          }
        }
      }
      leadDiscoveryLogger.info(
        `[collectBuyerInfo] 웹사이트 분석 결과 병합: description=${companyDescription}, industry=${industry}`,
      )
    }

    // Auto-generate description from industry if not provided
    const industryDescriptions: Record<Industry, { ko: string; en: string }> = {
      manufacturing_parts: { ko: "제조/부품 바이어", en: "Manufacturing & Parts buyers" },
      it_software: { ko: "IT/소프트웨어 바이어", en: "IT & Software buyers" },
      beauty_cosmetics: { ko: "뷰티/화장품 바이어", en: "Beauty & Cosmetics buyers" },
      food_supplements: { ko: "식품/건기식 바이어", en: "Food & Supplements buyers" },
      fashion_apparel: { ko: "패션/의류 바이어", en: "Fashion & Apparel buyers" },
      electronics: { ko: "전자제품 바이어", en: "Electronics buyers" },
      healthcare: { ko: "헬스케어 바이어", en: "Healthcare buyers" },
      other: { ko: "바이어", en: "buyers" },
    }

    // Use parsed description, or auto-generate from industry
    const finalDescription =
      companyDescription ||
      (industry
        ? industryDescriptions[industry]?.[locale as "ko" | "en"] ||
          industryDescriptions[industry]?.ko
        : "")

    // Determine searchMode: if websiteAnalysis is present, use "seller" mode (basic mode)
    // Otherwise, use the parsed searchMode from user query (advanced mode)
    const searchMode: SearchMode = state.websiteAnalysis ? "seller" : parsed.searchMode || "direct"

    leadDiscoveryLogger.info(
      `[collectBuyerInfo] searchMode 결정: ${searchMode} (웹사이트 분석: ${!!state.websiteAnalysis})`,
    )

    // Build BuyerSearchInput
    const input: Partial<BuyerSearchInput> = {
      companyName: parsed.companyName || state.websiteAnalysis?.companyName || "My Company",
      companyDescription: finalDescription || "",
      industry: industry || "other",
      target: parsed.target || "b2b",
      country: parsed.country || [],
      companySize: parsed.companySize || "medium",
      locale: (locale as "en" | "ko") || "ko",
      searchMode,
    }

    if (emitter) {
      emitter.progress(
        "collectBuyerInfo",
        locale === "ko" ? "검색 조건 확인 중" : "Verifying search criteria",
        50,
      )
    }

    // Check for missing required fields
    const missingFields: string[] = []
    if (!input.country || input.country.length === 0) {
      missingFields.push("country")
    }
    if (!input.companyDescription) {
      missingFields.push("description")
    }

    if (missingFields.length > 0) {
      leadDiscoveryLogger.info(
        `[collectBuyerInfo] 누락된 필드: ${missingFields.join(", ")} - 사용자 확인 필요`,
      )

      // Build questions for interrupt
      const questions = buildQuestions(missingFields, locale)

      // Send progress before interrupt
      if (emitter) {
        emitter.nodeComplete(
          "collectBuyerInfo",
          locale === "ko" ? "추가 정보가 필요해요" : "Additional information needed",
          {
            requiresClarification: true,
            questionCount: questions.length,
          },
        )
      }

      const duration = Date.now() - startTime
      leadDiscoveryLogger.nodeSuccess("collectBuyerInfo", duration, {
        status: "waiting_clarification",
        questionCount: questions.length,
      })

      // Interrupt for user clarification
      // Transform options to string labels for frontend compatibility
      const questionsForInterrupt = questions.map((q) => ({
        field: q.field,
        label: q.label,
        options: q.options.map((o) => o.label), // Convert {value, label} to just label string
        required: q.required,
      }))

      interrupt({
        type: "buyer_info_required",
        message:
          locale === "ko"
            ? "바이어 검색을 위해 추가 정보가 필요합니다"
            : "Additional information needed for buyer search",
        questions: questionsForInterrupt,
        currentInput: input,
      })

      // This won't be reached due to interrupt, but TypeScript needs it
      return {
        buyerSearchInput: input,
        needsClarification: true,
        clarification: {
          needed: true,
          questions: questions.map((q) => ({
            field: q.field as "country" | "industry" | "employeeRange",
            label: q.label,
            options: q.options.map((o) => o.label),
            required: q.required,
          })),
          answers: {},
          confidence: 50,
          understood: {
            country: input.country?.[0],
            industry: input.industry,
          },
        },
      }
    }

    // All required fields present
    const duration = Date.now() - startTime
    leadDiscoveryLogger.info(
      `[collectBuyerInfo] 모든 필수 필드 확인 완료 - 국가: ${input.country}, 설명: ${input.companyDescription}`,
    )
    leadDiscoveryLogger.nodeSuccess("collectBuyerInfo", duration, { status: "complete" })

    if (emitter) {
      emitter.nodeComplete(
        "collectBuyerInfo",
        locale === "ko" ? "검색 조건 확인 완료" : "Search criteria confirmed",
        {
          country: input.country,
          description: input.companyDescription,
          industry: input.industry,
        },
      )
    }

    return {
      buyerSearchInput: input as BuyerSearchInput,
      needsClarification: false,
    }
  } catch (error) {
    // GraphInterrupt is normal interrupt behavior
    if (error instanceof GraphInterrupt) {
      leadDiscoveryLogger.info(`[collectBuyerInfo] Interrupt 발생 - 사용자 확인 대기`)
      throw error
    }

    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Create structured error context
    const errorContext = createErrorContext(error, "collectBuyerInfo", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
      details: {
        userInput: state.userInput,
        executionTimeMs: duration,
      },
    })

    leadDiscoveryLogger.error(`[collectBuyerInfo] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("collectBuyerInfo", errorMessage, duration)

    if (emitter) {
      emitter.error(
        "collectBuyerInfo",
        locale === "ko"
          ? `검색 조건 분석 중 문제가 발생했어요: ${errorMessage}`
          : `Error analyzing search criteria: ${errorMessage}`,
      )
    }

    return {
      error: errorContext.message,
      errorContext,
    }
  }
}
