/**
 * Domain Extraction and Normalization Utilities
 */

/**
 * URL 또는 도메인 문자열에서 도메인 추출
 * @example
 * extractDomain("https://example.com/page") // "example.com"
 * extractDomain("www.example.com") // "example.com"
 * extractDomain("example.com") // "example.com"
 */
export function extractDomain(urlOrDomain: string | null | undefined): string | null {
  if (!urlOrDomain) return null

  try {
    let domain = urlOrDomain.trim().toLowerCase()

    // URL인 경우 호스트 추출
    if (domain.startsWith("http://") || domain.startsWith("https://")) {
      const url = new URL(domain)
      domain = url.hostname
    }

    // www. 제거
    if (domain.startsWith("www.")) {
      domain = domain.slice(4)
    }

    // 포트 제거
    domain = domain.split(":")[0] || domain

    // 경로 제거 (URL이 아닌 경우를 위해)
    domain = domain.split("/")[0] || domain

    // 유효성 검사 (최소한 점이 하나 있어야 함)
    if (!domain.includes(".")) {
      return null
    }

    return domain
  } catch {
    return null
  }
}

/**
 * 도메인 정규화 (비교용)
 * @example
 * normalizeDomain("Example.COM") // "example.com"
 */
export function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase()
}

/**
 * 두 도메인이 같은지 비교
 */
export function isSameDomain(domain1: string | null, domain2: string | null): boolean {
  if (!domain1 || !domain2) return false
  return normalizeDomain(domain1) === normalizeDomain(domain2)
}

/**
 * 도메인에서 회사명 추측
 * @example
 * guessCo mpanyNameFromDomain("stripe.com") // "Stripe"
 * guessCompanyNameFromDomain("aws.amazon.com") // "Amazon"
 */
export function guessCompanyNameFromDomain(domain: string): string {
  const parts = domain.split(".")

  // 서브도메인이 있는 경우 (예: blog.company.com)
  if (parts.length > 2) {
    // 일반적인 서브도메인은 제외
    const commonSubdomains = ["www", "api", "blog", "shop", "store", "app", "admin"]
    const filtered = parts.filter((p) => !commonSubdomains.includes(p.toLowerCase()))
    if (filtered.length >= 2) {
      // 두 번째 마지막 부분을 회사명으로 사용
      const companyPart = filtered[filtered.length - 2]
      return companyPart ? capitalize(companyPart) : capitalize(parts[0] || "Unknown")
    }
  }

  // 기본: 첫 부분을 회사명으로
  const companyPart = parts[0]
  return companyPart ? capitalize(companyPart) : "Unknown"
}

/**
 * 문자열 첫 글자를 대문자로
 */
function capitalize(str: string): string {
  if (!str) return ""
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}
