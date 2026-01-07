/**
 * Hunter.io Contact Enricher - Domain Search API Wrapper
 *
 * Hunter.io Domain Search API를 사용하여 담당자 정보 수집
 * - 신뢰도 기반 최적 담당자 선택
 * - Executive 우선 → Generic 폴백
 * - 병렬 배치 처리 지원
 */

import { z } from "zod"
import { config } from "../../../../config"
import { shouldFilterGenericEmail } from "../../../../utils/email-provider.util"
import logger from "../../../../utils/logger"
import { generateContactCacheKey, getBuyerSearchCache, getOrSet } from "../../cache"
import { getDomainSearchExecutor } from "../../rate-limiter"
import type { CompanyDetails, Contact, ContactSelectionCriteria } from "../../types"
import type { ContactEnricherProvider, ContactSearchResult, ProviderResult } from "../types"

// ==================== HUNTER API TYPES ====================

/**
 * Hunter.io Domain Search API 응답 스키마
 */
const HunterEmailSchema = z.object({
  value: z.string().email(),
  type: z.enum(["personal", "generic"]),
  confidence: z.number(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  position: z.string().nullable(),
  seniority: z.string().nullable(),
  department: z.string().nullable(),
  linkedin: z.string().nullable().optional(),
  phone_number: z.string().nullable().optional(),
})

const HunterDomainSearchResponseSchema = z.object({
  data: z.object({
    domain: z.string(),
    organization: z.string().nullable(),
    description: z.string().nullable().optional(),
    industry: z.string().nullable().optional(),
    country: z.string().nullable().optional(),
    headcount: z.string().nullable().optional(),
    company_type: z.string().nullable().optional(),
    pattern: z.string().nullable(),
    emails: z.array(HunterEmailSchema),
  }),
  meta: z.object({
    results: z.number(),
    limit: z.number(),
    offset: z.number(),
  }),
})

type HunterDomainSearchResponse = z.infer<typeof HunterDomainSearchResponseSchema>
type HunterEmail = z.infer<typeof HunterEmailSchema>

// ==================== HELPER FUNCTIONS ====================

/**
 * Invalid 이메일 체크 (noreply, abuse 등)
 */
function isInvalidEmail(email: string | null | undefined): boolean {
  if (!email) return true
  const emailLower = email.toLowerCase()

  const invalidPrefixes = [
    "noreply",
    "no-reply",
    "donotreply",
    "do-not-reply",
    "postmaster",
    "abuse",
    "webmaster",
    "mailer-daemon",
    "bounce",
  ]

  return invalidPrefixes.some((prefix) => emailLower.startsWith(`${prefix}@`))
}

/**
 * Hunter 이메일을 Contact로 변환
 */
function toContact(email: HunterEmail): Contact {
  return {
    email: email.value,
    type: email.type,
    confidence: email.confidence,
    firstName: email.first_name,
    lastName: email.last_name,
    position: email.position,
    seniority: email.seniority,
    department: email.department,
    linkedin: email.linkedin,
    phone: email.phone_number,
  }
}

/**
 * Hunter 응답을 CompanyDetails로 변환
 */
function toCompanyDetails(data: HunterDomainSearchResponse["data"]): CompanyDetails {
  return {
    domain: data.domain,
    name: data.organization || data.domain,
    description: data.description,
    industry: data.industry,
    country: data.country,
    headcount: data.headcount,
    companyType: data.company_type,
    pattern: data.pattern,
  }
}

/**
 * 이메일 우선순위 정렬
 * 1. Personal Executive (신뢰도 높은 순)
 * 2. Personal Senior
 * 3. Personal Junior
 * 4. Generic (유효한 것만)
 */
function sortEmailsByPriority(
  emails: HunterEmail[],
  criteria: ContactSelectionCriteria,
): HunterEmail[] {
  const seniorityOrder: Record<string, number> = {
    executive: 0,
    senior: 1,
    junior: 2,
  }

  return [...emails]
    .filter((e) => !isInvalidEmail(e.value))
    .sort((a, b) => {
      // 1. 유형별 정렬 (personal > generic)
      const typeOrderA = criteria.preferredTypes.indexOf(a.type)
      const typeOrderB = criteria.preferredTypes.indexOf(b.type)
      if (typeOrderA !== typeOrderB) {
        return (typeOrderA === -1 ? 999 : typeOrderA) - (typeOrderB === -1 ? 999 : typeOrderB)
      }

      // 2. Personal인 경우 직급별 정렬
      if (a.type === "personal" && b.type === "personal") {
        const senA = seniorityOrder[a.seniority || ""] ?? 999
        const senB = seniorityOrder[b.seniority || ""] ?? 999
        if (senA !== senB) return senA - senB
      }

      // 3. 신뢰도 순 (내림차순)
      return b.confidence - a.confidence
    })
}

/**
 * 최적 담당자 선택
 */
function selectBestContact(
  emails: HunterEmail[],
  criteria: ContactSelectionCriteria,
): HunterEmail | null {
  const sorted = sortEmailsByPriority(emails, criteria)

  for (const email of sorted) {
    // Personal 이메일: 신뢰도 체크
    if (email.type === "personal") {
      if (email.confidence >= criteria.minConfidence) {
        return email
      }
    }
    // Generic 이메일: 무료 이메일 제공업체 필터링
    else if (email.type === "generic") {
      if (!shouldFilterGenericEmail(email.value, "generic")) {
        return email
      }
    }
  }

  // 마지막 시도: 아무 유효한 이메일이라도
  return sorted.find((e) => !shouldFilterGenericEmail(e.value, e.type)) || null
}

// ==================== HUNTER CONTACT ENRICHER ====================

/**
 * 기본 담당자 선택 기준
 */
const DEFAULT_CRITERIA: ContactSelectionCriteria = {
  minConfidence: 70,
  preferredTypes: ["personal", "generic"],
  preferredSeniorities: ["executive", "senior", "junior"],
}

/**
 * Hunter.io Contact Enricher Provider
 *
 * Hunter.io Domain Search API를 사용하여 담당자 정보 수집
 */
export class HunterContactEnricher implements ContactEnricherProvider {
  readonly name = "hunter"
  private readonly apiKey: string
  private readonly executor = getDomainSearchExecutor()

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.hunter.apiKey
  }

  /**
   * 도메인으로 담당자 정보 수집
   */
  async enrichContact(
    domain: string,
    criteria: ContactSelectionCriteria = DEFAULT_CRITERIA,
  ): Promise<ProviderResult<ContactSearchResult>> {
    const startTime = Date.now()

    // 캐시 키 생성
    const cacheKey = generateContactCacheKey(this.name, domain, {
      minConfidence: criteria.minConfidence,
    })

    try {
      const { data: result, fromCache } = await getOrSet<ContactSearchResult>(cacheKey, () =>
        this.executeEnrichment(domain, criteria),
      )

      const timeMs = Date.now() - startTime
      const contactInfo = result.contact
        ? `${result.contact.email} (${result.contact.type}, ${result.contact.confidence}%)`
        : "no contact"

      console.log(
        `[HunterContactEnricher] ${fromCache ? "✅ Cache hit" : "🔍 API call"} - ` +
          `${domain}: ${contactInfo} (${timeMs}ms)`,
      )

      return {
        success: true,
        data: result,
        fromCache,
        timeMs,
      }
    } catch (error) {
      const timeMs = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      console.error(`[HunterContactEnricher] ❌ Error for ${domain}: ${errorMessage} (${timeMs}ms)`)
      logger.error({ error, domain }, "HunterContactEnricher.enrichContact failed")

      return {
        success: false,
        data: null,
        fromCache: false,
        timeMs,
        error: errorMessage,
        retryable: this.isRetryableError(error),
      }
    }
  }

  /**
   * 여러 도메인 병렬 처리
   */
  async enrichContactsBatch(
    domains: string[],
    criteria: ContactSelectionCriteria = DEFAULT_CRITERIA,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Map<string, ProviderResult<ContactSearchResult>>> {
    const results = new Map<string, ProviderResult<ContactSearchResult>>()
    const total = domains.length
    let completed = 0

    // 캐시 일괄 조회
    const cache = getBuyerSearchCache()
    const cacheKeys = domains.map((d) =>
      generateContactCacheKey(this.name, d, { minConfidence: criteria.minConfidence }),
    )
    const cachedResults = await cache.mget<ContactSearchResult>(cacheKeys)

    // 캐시 히트 처리 및 미스 목록 수집
    const missedDomains: string[] = []
    for (let i = 0; i < domains.length; i++) {
      const domain = domains[i]
      const cacheKey = cacheKeys[i]
      if (!domain || !cacheKey) continue
      const cached = cachedResults.get(cacheKey)

      if (cached) {
        results.set(domain, {
          success: true,
          data: cached,
          fromCache: true,
          timeMs: 0,
        })
        completed++
        onProgress?.(completed, total)
      } else {
        missedDomains.push(domain)
      }
    }

    console.log(
      `[HunterContactEnricher] Batch: ${cachedResults.size} cache hits, ` +
        `${missedDomains.length} API calls needed`,
    )

    // 캐시 미스 병렬 처리
    if (missedDomains.length > 0) {
      const batchResults = await Promise.all(
        missedDomains.map(async (domain) => {
          const result = await this.enrichContact(domain, criteria)
          completed++
          onProgress?.(completed, total)
          return { domain, result }
        }),
      )

      for (const { domain, result } of batchResults) {
        results.set(domain, result)
      }
    }

    return results
  }

  /**
   * API 호출 실행
   */
  private async executeEnrichment(
    domain: string,
    criteria: ContactSelectionCriteria,
  ): Promise<ContactSearchResult> {
    // Step 1: Personal Executive 이메일 시도
    let personalEmails: HunterEmail[] = []
    try {
      const personalData = await this.fetchDomainEmails(domain, {
        type: "personal",
        seniority: "executive",
        limit: 5,
      })
      if (personalData) {
        personalEmails = personalData.emails
      }
    } catch {
      // Personal 실패 시 무시하고 계속
    }

    // Personal Executive 중 조건 충족하는 이메일 찾기
    const bestPersonal = personalEmails.find(
      (e) =>
        e.type === "personal" && e.confidence >= criteria.minConfidence && !isInvalidEmail(e.value),
    )

    if (bestPersonal) {
      // Personal Executive 찾음 - 회사 정보도 같이 반환
      const companyDetails: CompanyDetails = {
        domain,
        name: domain,
      }

      // 회사 정보 가져오기 위해 다시 조회 (캐시에서 올 가능성 높음)
      try {
        const fullData = await this.fetchDomainEmails(domain, { limit: 1 })
        if (fullData) {
          return {
            contact: toContact(bestPersonal),
            companyDetails: toCompanyDetails(fullData),
            allContacts: personalEmails.map(toContact),
          }
        }
      } catch {
        // 무시
      }

      return {
        contact: toContact(bestPersonal),
        companyDetails,
        allContacts: personalEmails.map(toContact),
      }
    }

    // Step 2: Generic 이메일로 폴백
    const genericData = await this.fetchDomainEmails(domain, {
      type: "generic",
      limit: 5,
    })

    if (!genericData) {
      return {
        contact: null,
        companyDetails: { domain, name: domain },
        allContacts: [],
      }
    }

    // 모든 이메일 병합 및 최적 선택
    const allEmails = [...personalEmails, ...genericData.emails]
    const bestContact = selectBestContact(allEmails, criteria)

    return {
      contact: bestContact ? toContact(bestContact) : null,
      companyDetails: toCompanyDetails(genericData),
      allContacts: sortEmailsByPriority(allEmails, criteria).map(toContact),
    }
  }

  /**
   * Domain Search API 호출
   */
  private async fetchDomainEmails(
    domain: string,
    options: {
      type?: "personal" | "generic"
      seniority?: "junior" | "senior" | "executive"
      limit?: number
      offset?: number
    } = {},
  ): Promise<HunterDomainSearchResponse["data"] | null> {
    const response = await this.executor.execute(async () => {
      const url = new URL("https://api.hunter.io/v2/domain-search")
      url.searchParams.set("api_key", this.apiKey)
      url.searchParams.set("domain", domain)

      if (options.type) {
        url.searchParams.set("type", options.type)
      }
      if (options.seniority) {
        url.searchParams.set("seniority", options.seniority)
      }
      if (options.limit) {
        url.searchParams.set("limit", String(options.limit))
      }
      if (options.offset) {
        url.searchParams.set("offset", String(options.offset))
      }

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Hunter API error (${res.status}): ${errorText}`)
      }

      return res.json()
    })

    const parsed = HunterDomainSearchResponseSchema.safeParse(response)
    if (!parsed.success) {
      console.error(`[HunterContactEnricher] Invalid response for ${domain}:`, parsed.error)
      return null
    }

    return parsed.data.data
  }

  /**
   * Rate Limit 상태 확인
   */
  getRateLimitStatus() {
    const status = this.executor.getStatus()
    return {
      remainingRequests: Math.max(0, 500 - status.minuteQueue.pending - status.minuteQueue.size),
      resetTimeMs: 60000,
    }
  }

  /**
   * 재시도 가능한 에러인지 판단
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      if (message.includes("429") || message.includes("rate limit")) return true
      if (message.includes("500") || message.includes("502") || message.includes("503")) return true
      if (message.includes("network") || message.includes("timeout")) return true
    }
    return false
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * HunterContactEnricher 인스턴스 생성
 */
export function createHunterContactEnricher(apiKey?: string): HunterContactEnricher {
  return new HunterContactEnricher(apiKey)
}
