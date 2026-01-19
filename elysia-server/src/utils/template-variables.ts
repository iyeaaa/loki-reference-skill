/**
 * 이메일 템플릿 변수 치환 유틸리티
 *
 * 영문 변수 ({{company_name}}, {{website}}, ...)와
 * 한글 변수 ({{회사명}}, {{웹사이트}}, ...) 모두 지원
 */

export interface TemplateContext {
  companyName?: string
  contactName?: string
  contactEmail?: string
  industry?: string
  businessType?: string
  website?: string
  description?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: string
  employeeCount?: string
  leadSource?: string
  leadStatus?: string
  leadScore?: string
  [key: string]: string | undefined
}

/**
 * 템플릿 변수를 실제 값으로 치환
 * @param template - 변수가 포함된 템플릿 문자열
 * @param context - 치환할 값들을 담은 객체
 * @returns 변수가 치환된 결과 문자열
 */
export function replaceTemplateVariables(template: string, context: TemplateContext): string {
  let result = template

  // 영문 변수 매핑 (snake_case)
  const englishMap: Record<string, string> = {
    // 회사 정보
    company_name: context.companyName || "",
    companyName: context.companyName || "",
    website: context.website || "",
    industry: context.industry || "",
    business_type: context.businessType || "",
    businessType: context.businessType || "",
    description: context.description || "",
    employee_count: context.employeeCount || "",
    employeeCount: context.employeeCount || "",
    founded_year: context.foundedYear || "",
    foundedYear: context.foundedYear || "",

    // 위치 정보
    country: context.country || "",
    city: context.city || "",
    state: context.state || "",
    address: context.address || "",

    // 연락처
    contact_name: context.contactName || "",
    contactName: context.contactName || "",
    contact_email: context.contactEmail || "",
    contactEmail: context.contactEmail || "",
    email: context.contactEmail || "",

    // 리드 관리
    lead_source: context.leadSource || "",
    leadSource: context.leadSource || "",
    lead_status: context.leadStatus || "",
    leadStatus: context.leadStatus || "",
    lead_score: context.leadScore || "",
    leadScore: context.leadScore || "",
  }

  // 한글 변수 매핑
  const koreanMap: Record<string, string> = {
    // 회사 정보
    회사명: context.companyName || "",
    웹사이트: context.website || "",
    업종: context.businessType || "",
    설명: context.description || "",
    직원수: context.employeeCount || "",
    설립연도: context.foundedYear || "",

    // 위치 정보
    국가: context.country || "",
    도시: context.city || "",
    주: context.state || "",
    "주/도": context.state || "",
    주소: context.address || "",

    // 연락처
    담당자명: context.contactName || "",
    이름: context.contactName || "",
    이메일: context.contactEmail || "",

    // 리드 관리
    리드소스: context.leadSource || "",
    리드상태: context.leadStatus || "",
    리드점수: context.leadScore || "",
  }

  // 영문 변수 치환 (대소문자 구분 없음)
  for (const [key, value] of Object.entries(englishMap)) {
    const regex = new RegExp(`{{${key}}}`, "gi")
    result = result.replace(regex, value)
  }

  // 한글 변수 치환 (대소문자 구분)
  for (const [key, value] of Object.entries(koreanMap)) {
    const regex = new RegExp(`{{${key}}}`, "g")
    result = result.replace(regex, value)
  }

  return result
}
