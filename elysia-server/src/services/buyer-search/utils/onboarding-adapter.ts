/**
 * Buyer Search ↔ Onboarding 시스템 연동 어댑터
 *
 * 기존 onboarding 시스템의 surveyData를 buyer-search input으로 변환하고,
 * buyer-search 결과를 leads 테이블 형식으로 변환합니다.
 */

import type { Buyer, BuyerSearchInput, CompanySize, Country, Industry } from "../types"

// ============================================================================
// Type Mappings
// ============================================================================

/**
 * 기존 onboarding surveyData 타입
 */
export interface OnboardingSurveyData {
  industry: string // 기존: "beauty", "manufacturing" 등
  target: string // 기존: "b2b", "b2c", "both"
  country: string // 기존: "jp", "us", "eu" 등
  experience: string // 기존: "none", "some", "experienced"
  lang?: string // "ko" | "en"
}

/**
 * 기존 industry 코드 → buyer-search Industry 매핑
 */
const INDUSTRY_MAP: Record<string, Industry> = {
  beauty: "beauty_cosmetics",
  fashion: "fashion_apparel",
  food: "food_supplements",
  it_saas: "it_software",
  manufacturing: "manufacturing_parts",
  manufacturing_parts: "manufacturing_parts",
  retail: "other",
  healthcare: "healthcare",
  education: "other",
  electronics: "electronics",
  other: "other",
}

/**
 * 기존 country 코드 → buyer-search Country 매핑
 */
const COUNTRY_MAP: Record<string, Country> = {
  jp: "japan",
  japan: "japan",
  us: "usa",
  usa: "usa",
  cn: "china",
  china: "china",
  sea: "southeast_asia",
  southeast_asia: "southeast_asia",
  eu: "europe",
  europe: "europe",
  ae: "middle_east",
  middle_east: "middle_east",
  kr: "japan", // 한국은 일본으로 매핑 (가장 가까운 시장)
  other: "usa", // 기타는 미국으로 매핑
}

/**
 * 기존 experience → CompanySize 매핑
 * 경험이 많을수록 더 큰 규모의 바이어를 찾는다고 가정
 */
const EXPERIENCE_TO_SIZE: Record<string, CompanySize> = {
  none: "small", // 경험 없음 → 소기업 타겟
  some: "medium", // 약간 경험 → 중기업 타겟
  experienced: "large", // 경험 있음 → 대기업 타겟
}

// ============================================================================
// Conversion Functions
// ============================================================================

/**
 * OnboardingSurveyData → BuyerSearchInput 변환
 *
 * @param surveyData 기존 onboarding 설문 데이터
 * @param workspaceInfo 워크스페이스 정보 (회사명, 설명)
 */
export function toBuyerSearchInput(
  surveyData: OnboardingSurveyData,
  workspaceInfo: {
    companyName: string
    companyNameEn?: string
    companyDescription?: string
  },
): BuyerSearchInput {
  // Industry 매핑 (없으면 기본값)
  const industry: Industry = INDUSTRY_MAP[surveyData.industry] || "other"

  // Country 매핑 (복수 국가 지원)
  const countries: Country[] = []
  const countryCode = surveyData.country.toLowerCase()

  // 매핑된 국가 추가
  const mappedCountry = COUNTRY_MAP[countryCode]
  if (mappedCountry) {
    countries.push(mappedCountry)
  } else {
    // 알 수 없는 경우 기본값
    countries.push("usa")
  }

  // Target 매핑
  const target = surveyData.target as "b2b" | "b2c" | "both"

  // CompanySize 매핑 (experience 기반)
  const companySize: CompanySize = EXPERIENCE_TO_SIZE[surveyData.experience] || "small"

  // 언어 매핑
  const locale = surveyData.lang === "en" ? "en" : "ko"

  // 회사 설명 구성
  const companyDescription =
    workspaceInfo.companyDescription ||
    `${workspaceInfo.companyName || "Company"} - ${industry} industry`

  return {
    companyName: workspaceInfo.companyNameEn || workspaceInfo.companyName || "My Company",
    companyDescription,
    industry,
    target,
    country: countries,
    locale,
    companySize,
  }
}

/**
 * Buyer → Lead 생성 데이터로 변환
 *
 * bulkCreateLeads에 전달할 형식으로 변환
 */
export function buyerToLeadData(buyer: Buyer): {
  companyName: string
  foundCompanyName: string
  websiteUrl?: string
  businessType?: string
  country?: string
  employeeCount?: string
  description?: string
  primaryEmail?: string
  leadSource: string
  leadStatus: "new"
  leadScore?: number
} {
  // CompanySize → employeeCount 문자열 변환
  const sizeToEmployeeCount: Record<CompanySize, string> = {
    startup: "1-10",
    small: "10-50",
    medium: "50-250",
    large: "250-1000",
    enterprise: "1000+",
  }

  return {
    companyName: buyer.companyName,
    foundCompanyName: buyer.companyName,
    websiteUrl: buyer.website || undefined,
    businessType: buyer.industry || undefined,
    country: buyer.country || undefined,
    employeeCount: buyer.size ? sizeToEmployeeCount[buyer.size] : undefined,
    description: buyer.description || undefined,
    primaryEmail: buyer.email || undefined,
    leadSource: "buyer-search",
    leadStatus: "new" as const,
    leadScore: buyer.score, // LLM 평가 점수 (0-100)
  }
}

/**
 * Buyer 배열 → Lead 생성 데이터 배열로 변환
 */
export function buyersToLeadDataArray(buyers: Buyer[]): Array<{
  companyName: string
  foundCompanyName: string
  websiteUrl?: string
  businessType?: string
  country?: string
  employeeCount?: string
  description?: string
  primaryEmail?: string
  leadSource: string
  leadStatus: "new"
  leadScore?: number
}> {
  return buyers.map(buyerToLeadData)
}

// ============================================================================
// Reverse Mappings (for display)
// ============================================================================

/**
 * CompanySize → 표시 문자열
 */
export const COMPANY_SIZE_DISPLAY: Record<CompanySize, { ko: string; en: string }> = {
  startup: { ko: "스타트업 (1-10명)", en: "Startup (1-10)" },
  small: { ko: "소기업 (10-50명)", en: "Small (10-50)" },
  medium: { ko: "중기업 (50-250명)", en: "Medium (50-250)" },
  large: { ko: "대기업 (250-1000명)", en: "Large (250-1000)" },
  enterprise: { ko: "글로벌 대기업 (1000명+)", en: "Enterprise (1000+)" },
}

/**
 * Industry → 표시 문자열
 */
export const INDUSTRY_DISPLAY: Record<Industry, { ko: string; en: string }> = {
  manufacturing_parts: { ko: "제조 부품", en: "Manufacturing Parts" },
  it_software: { ko: "IT/소프트웨어", en: "IT/Software" },
  beauty_cosmetics: { ko: "뷰티/화장품", en: "Beauty/Cosmetics" },
  food_supplements: { ko: "식품/건기식", en: "Food/Supplements" },
  fashion_apparel: { ko: "패션/의류", en: "Fashion/Apparel" },
  electronics: { ko: "전자제품", en: "Electronics" },
  healthcare: { ko: "헬스케어", en: "Healthcare" },
  other: { ko: "기타", en: "Other" },
}

/**
 * Country → 표시 문자열
 */
export const COUNTRY_DISPLAY: Record<Country, { ko: string; en: string }> = {
  japan: { ko: "일본", en: "Japan" },
  usa: { ko: "미국", en: "United States" },
  china: { ko: "중국", en: "China" },
  southeast_asia: { ko: "동남아시아", en: "Southeast Asia" },
  europe: { ko: "유럽", en: "Europe" },
  middle_east: { ko: "중동", en: "Middle East" },
}
