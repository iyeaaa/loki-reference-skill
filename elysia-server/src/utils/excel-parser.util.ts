/**
 * Excel 파일 파싱 유틸리티
 * 뷰티 DB 데이터 임포트를 위한 파싱 로직
 */

/**
 * Unknown 타입을 안전하게 string | null로 변환
 */
function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null
  }
  if (typeof value === "string") {
    return value
  }
  return String(value)
}

export interface ParsedLeadData {
  // Lead 메인 정보
  companyName: string | null
  foundCompanyName: string | null
  websiteUrl: string | null
  finalUrl: string | null
  httpStatus: number | null
  nameUrlMatch: boolean | null
  businessType: string | null
  isBusinessTypeMatched: boolean | null
  description: string | null
  address: string | null
  country: string | null
  city: string | null
  state: string | null
  foundedYear: number | null
  employeeCount: string | null
  leadSource: string
  crawlTimeSeconds: number | null
  gptTimeSeconds: number | null
  collectedAt: Date | null
  errorMessage: string | null

  // 관계형 데이터 (콤마 구분 또는 복수 값)
  phoneNumbers: string[]
  emails: string[]
  facebookUrl: string | null
  instagramUrl: string | null
  twitterUrl: string | null
  linkedinUrl: string | null
  products: string[]
  businessSectors: string[]
  productCategories: string[]
  industryTypes: string[]
}

/**
 * 콤마로 구분된 문자열을 배열로 파싱 (단순 버전)
 */
export function parseCommaSeparatedSimple(value: unknown): string[] {
  if (!value || value === null || value === undefined || value === "") {
    return []
  }

  const items = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  return items
}

/**
 * 괄호 안의 콤마는 무시하고 파싱 (고급 버전)
 * products 필드 전용
 */
export function parseCommaSeparatedAdvanced(value: unknown): string[] {
  if (!value || value === null || value === undefined || value === "") {
    return []
  }

  const str = String(value)
  const items: string[] = []
  let currentItem: string[] = []
  let depth = 0

  for (const char of str) {
    if (char === "(") {
      depth++
      currentItem.push(char)
    } else if (char === ")") {
      depth--
      currentItem.push(char)
    } else if (char === "," && depth === 0) {
      // 괄호 밖의 콤마 - 항목 구분자
      const item = currentItem.join("").trim()
      if (item) {
        items.push(item)
      }
      currentItem = []
    } else {
      currentItem.push(char)
    }
  }

  // 마지막 항목 추가
  const item = currentItem.join("").trim()
  if (item) {
    items.push(item)
  }

  return items
}

/**
 * Boolean 값 파싱
 */
export function parseBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  const strValue = String(value).toLowerCase().trim()

  if (["true", "yes", "1", "t", "y"].includes(strValue)) {
    return true
  }
  if (["false", "no", "0", "f", "n"].includes(strValue)) {
    return false
  }

  return null
}

/**
 * 정수 파싱
 */
export function parseInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  try {
    const num = Number.parseInt(String(value), 10)
    return Number.isNaN(num) ? null : num
  } catch {
    return null
  }
}

/**
 * Float 파싱 (숫자 값 파싱)
 */
export function parseFloatValue(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null
  }

  try {
    const num = Number.parseFloat(String(value))
    return Number.isNaN(num) ? null : num
  } catch {
    return null
  }
}

/**
 * 설립연도 파싱 및 검증
 */
export function parseFoundedYear(value: unknown): number | null {
  const year = parseInteger(value)
  if (year === null) {
    return null
  }

  const currentYear = new Date().getFullYear()
  if (year < 1800 || year > currentYear + 1) {
    return null
  }

  return year
}

/**
 * 이메일 유효성 검증
 */
export function validateEmail(email: string): boolean {
  if (!email || email.trim() === "") {
    return false
  }

  const trimmed = email.trim()

  // 기본 검증
  if (trimmed.includes("..") || trimmed.startsWith(".") || !trimmed.includes("@")) {
    return false
  }

  // 정규식 검증
  const pattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  return pattern.test(trimmed)
}

/**
 * URL에서 소셜 미디어 username 추출
 */
export function extractUsername(url: string, platform: string): string | null {
  if (!url || url.trim() === "") {
    return null
  }

  const trimmed = url.trim()

  const patterns: Record<string, RegExp> = {
    facebook: /facebook\.com\/([^/?]+)/i,
    instagram: /instagram\.com\/([^/?]+)/i,
    twitter: /twitter\.com\/([^/?]+)/i,
    linkedin: /linkedin\.com\/(?:company|in)\/([^/?]+)/i,
  }

  const pattern = patterns[platform]
  if (!pattern) {
    return null
  }

  const match = trimmed.match(pattern)
  return match?.[1] ?? null
}

/**
 * Date 파싱
 */
export function parseDate(value: unknown): Date | null {
  if (!value || value === null || value === undefined || value === "") {
    return null
  }

  try {
    const date = new Date(value as string | number | Date)
    return Number.isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

/**
 * Excel 행 데이터를 ParsedLeadData로 변환
 */
export function parseExcelRowToLeadData(row: Record<string, unknown>): ParsedLeadData {
  // 전화번호 파싱 (복수 값 지원)
  const phoneNumbers = parseCommaSeparatedSimple(row.phone_number).filter(
    (phone) => phone.length > 0,
  )

  // 이메일 파싱 (복수 값 지원, 유효성 검증)
  const emails = parseCommaSeparatedSimple(row.email).filter((email) => validateEmail(email))

  return {
    // Lead 메인 정보
    companyName: toStringOrNull(row.company_name),
    foundCompanyName: toStringOrNull(row.found_company_name),
    websiteUrl: toStringOrNull(row.website_url),
    finalUrl: toStringOrNull(row.final_url),
    httpStatus: parseInteger(row.http_status),
    nameUrlMatch: parseBoolean(row.name_url_match),
    businessType: toStringOrNull(row.business_type),
    isBusinessTypeMatched: parseBoolean(row.is_business_type_matched),
    description: toStringOrNull(row.description),
    address: toStringOrNull(row.address),
    country: toStringOrNull(row.country),
    city: toStringOrNull(row.city),
    state: toStringOrNull(row.state),
    foundedYear: parseFoundedYear(row.founded_year),
    employeeCount: toStringOrNull(row.employee_count),
    leadSource: toStringOrNull(row.lead_source) || "뷰티DB",
    crawlTimeSeconds: parseFloatValue(row.crawl_time_seconds),
    gptTimeSeconds: parseFloatValue(row.gpt_time_seconds),
    collectedAt: parseDate(row.collected_at),
    errorMessage: toStringOrNull(row.error_message),

    // 연락처
    phoneNumbers,
    emails,

    // 소셜 미디어
    facebookUrl: toStringOrNull(row.facebook_url),
    instagramUrl: toStringOrNull(row.instagram_url),
    twitterUrl: toStringOrNull(row.twitter_url),
    linkedinUrl: toStringOrNull(row.linkedin_url),

    // 콤마 구분 필드
    products: parseCommaSeparatedAdvanced(row.products), // 괄호 처리
    businessSectors: parseCommaSeparatedSimple(row.business_sectors),
    productCategories: parseCommaSeparatedSimple(row.product_categories),
    industryTypes: parseCommaSeparatedSimple(row.industry_types),
  }
}
