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

// 동의어/유사어 → 산업 매핑 (자연어 파싱용)
const INDUSTRY_SYNONYMS: Array<{ synonyms: string[]; industry: string }> = [
  // Healthcare & Life Sciences
  {
    synonyms: [
      "건강기능식품",
      "건기식",
      "영양제",
      "보충제",
      "웰니스",
      "웰빙",
      "건강식품",
      "기능성식품",
      "프로바이오틱스",
      "유산균",
      "비타민",
      "오메가3",
      "홍삼",
      "건강보조식품",
      "다이어트식품",
      "병원",
      "클리닉",
      "의원",
      "의료",
      "건강",
      "헬스",
    ],
    industry: "Healthcare",
  },
  {
    synonyms: ["의약품", "약품", "신약", "제네릭", "바이오의약품", "의약", "제약"],
    industry: "Pharmaceuticals",
  },
  {
    synonyms: ["바이오", "생명공학", "유전자", "세포치료", "진단", "바이오테크"],
    industry: "Biotechnology",
  },
  {
    synonyms: ["의료장비", "진단기기", "치료기기", "헬스케어기기", "의료용품", "의료기기"],
    industry: "Medical Devices",
  },
  // Beauty & Cosmetics
  {
    synonyms: [
      "화장품",
      "코스메틱",
      "스킨케어",
      "마스크팩",
      "메이크업",
      "색조",
      "기초화장품",
      "더마",
      "더마코스메틱",
      "클렌저",
      "세럼",
      "에센스",
      "로션",
      "크림",
      "선크림",
      "자외선차단",
      "미백",
      "주름개선",
      "안티에이징",
      "K뷰티",
      "K-Beauty",
      "헤어케어",
      "바디케어",
      "네일",
      "향수",
      "퍼퓸",
      "미용",
      "에스테틱",
      "피부과",
      "피부",
      "뷰티",
    ],
    industry: "Beauty",
  },
  // Technology & Software
  {
    synonyms: ["테크", "tech", "아이티", "정보통신", "ICT", "디지털", "하이테크", "기술"],
    industry: "Software & Internet",
  },
  {
    synonyms: ["SW", "앱", "애플리케이션", "프로그램", "솔루션", "플랫폼"],
    industry: "Software & Internet",
  },
  {
    synonyms: [
      "B2B SaaS",
      "클라우드서비스",
      "구독서비스",
      "서비스형소프트웨어",
      "B2B",
      "기업용솔루션",
      "SaaS",
    ],
    industry: "Software & Internet",
  },
  {
    synonyms: [
      "전자상거래",
      "온라인쇼핑",
      "쇼핑몰",
      "온라인마켓",
      "마켓플레이스",
      "D2C",
      "온라인판매",
      "이커머스",
    ],
    industry: "Software & Internet",
  },
  {
    synonyms: [
      "인공지능",
      "딥러닝",
      "ML",
      "자동화",
      "로보틱스",
      "챗봇",
      "생성AI",
      "GenAI",
      "AI",
      "머신러닝",
    ],
    industry: "Software & Internet",
  },
  // Manufacturing
  {
    synonyms: ["생산", "공장", "산업재", "OEM", "ODM", "가공"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["전자제품", "가전", "반도체", "디스플레이", "PCB", "전자부품", "LED", "배터리"],
    industry: "Computers & Electronics",
  },
  {
    synonyms: ["기계장비", "산업기계", "공작기계", "중장비", "설비", "기계"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["자동차부품", "모빌리티", "EV", "전기차", "자동차제조", "차량", "자동차"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["화학제품", "석유화학", "정밀화학", "화공", "원료", "화학"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["원단", "직물", "봉제", "의류제조", "니트", "패브릭", "섬유"],
    industry: "Manufacturing",
  },
  // Finance
  {
    synonyms: ["핀테크", "자산관리", "투자", "증권", "펀드", "금융서비스"],
    industry: "Financial Services",
  },
  {
    synonyms: ["뱅킹", "저축은행", "신용협동조합", "금고", "은행"],
    industry: "Financial Services",
  },
  {
    synonyms: ["보험사", "생명보험", "손해보험", "인슈어테크", "보험"],
    industry: "Financial Services",
  },
  // Retail & Consumer & Distribution
  {
    synonyms: ["리테일", "매장", "판매점", "오프라인매장", "편의점", "백화점", "마트"],
    industry: "Retail",
  },
  {
    synonyms: [
      "유통",
      "유통업체",
      "도매업",
      "수입유통",
      "수출입",
      "무역",
      "수입상",
      "수출상",
      "디스트리뷰터",
      "대리점",
      "총판",
      "공급업체",
      "도매",
    ],
    industry: "Retail",
  },
  {
    synonyms: ["소비용품", "생활용품", "일용품", "FMCG", "생활소비재", "소비재"],
    industry: "Retail",
  },
  // Food & Beverage
  {
    synonyms: [
      "식품",
      "음료",
      "F&B",
      "식자재",
      "가공식품",
      "베이커리",
      "제과",
      "냉동식품",
      "유기농",
      "푸드테크",
    ],
    industry: "Food & Beverage",
  },
  // Fashion
  {
    synonyms: [
      "의류",
      "옷",
      "브랜드",
      "어패럴",
      "스포츠웨어",
      "캐주얼",
      "잡화",
      "액세서리",
      "패션",
    ],
    industry: "Retail",
  },
  // Real Estate & Construction
  {
    synonyms: ["리얼에스테이트", "프롭테크", "임대", "분양", "개발"],
    industry: "Real Estate & Construction",
  },
  {
    synonyms: ["건축", "시공", "토목", "인테리어", "리모델링", "플랜트"],
    industry: "Real Estate & Construction",
  },
  // Energy
  {
    synonyms: ["전력", "발전", "유틸리티", "전기", "에너지"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["정유", "석유", "천연가스", "LNG", "정유사"],
    industry: "Manufacturing",
  },
  {
    synonyms: ["신재생에너지", "태양광", "풍력", "ESS", "그린에너지", "친환경에너지", "재생에너지"],
    industry: "Manufacturing",
  },
  // Media & Entertainment
  {
    synonyms: ["방송", "콘텐츠", "영상", "게임", "음악", "OTT", "스트리밍", "엔터"],
    industry: "Media & Entertainment",
  },
  {
    synonyms: [
      "광고대행사",
      "마케팅대행",
      "디지털마케팅",
      "PR",
      "홍보",
      "퍼포먼스마케팅",
      "광고",
      "마케팅",
    ],
    industry: "Business Services",
  },
  // Education
  {
    synonyms: ["에듀테크", "이러닝", "학원", "온라인교육", "직업훈련", "연수"],
    industry: "Education",
  },
  // Hospitality & Travel
  {
    synonyms: ["호텔", "숙박", "리조트", "펜션", "게스트하우스", "호스피탈리티"],
    industry: "Business Services",
  },
  {
    synonyms: ["여행사", "투어", "관광", "항공", "OTA", "여행"],
    industry: "Business Services",
  },
  // Logistics
  {
    synonyms: ["배송", "택배", "창고", "풀필먼트", "3PL", "포워딩"],
    industry: "Transportation & Storage",
  },
  {
    synonyms: ["통신사", "텔레콤", "모바일", "네트워크", "5G"],
    industry: "Telecommunications",
  },
  // Agriculture
  {
    synonyms: ["농산물", "축산", "수산", "애그테크", "스마트팜", "원예"],
    industry: "Agriculture & Mining",
  },
  // Business Services
  {
    synonyms: ["경영컨설팅", "전략컨설팅", "IT컨설팅", "자문", "컨설팅"],
    industry: "Business Services",
  },
  {
    synonyms: ["법률", "로펌", "법무", "변호사", "특허"],
    industry: "Business Services",
  },
  {
    synonyms: ["세무", "회계법인", "감사", "재무", "회계"],
    industry: "Business Services",
  },
  {
    synonyms: ["HR", "인사관리", "채용대행", "헤드헌팅", "HRD", "HRM", "인사", "채용"],
    industry: "Business Services",
  },
]

/**
 * 자연어 입력에서 동의어를 검색하여 산업을 찾습니다.
 */
function findIndustryFromSynonyms(input: string): string | undefined {
  const lower = input.toLowerCase()
  for (const { synonyms, industry } of INDUSTRY_SYNONYMS) {
    for (const synonym of synonyms) {
      if (lower.includes(synonym.toLowerCase())) {
        return industry
      }
    }
  }
  return undefined
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

      // 산업이 아직 없으면 동의어로 검색
      if (!existingParams.industry) {
        const industryFromSynonyms = findIndustryFromSynonyms(state.userInput)
        if (industryFromSynonyms) {
          existingParams.industry = industryFromSynonyms
          leadDiscoveryLogger.info(`[검색 조건] 동의어로 산업 감지: ${industryFromSynonyms}`)
        }
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
