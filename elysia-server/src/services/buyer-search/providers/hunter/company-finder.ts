/**
 * Hunter.io Company Finder - Discover API Wrapper
 *
 * Hunter.io Discover API를 사용하여 회사 검색
 * - 자연어 쿼리 지원
 * - 지역, 산업, 규모 필터링
 * - 캐싱 및 Rate Limiting 적용
 */

import { z } from "zod"
import { config } from "../../../../config"
import logger from "../../../../utils/logger"
import { generateCompanySearchCacheKey, getOrSet } from "../../cache"
import { getDiscoverExecutor } from "../../rate-limiter"
import type { Company, CompanySearchParams } from "../../types"
import type { CompanyFinderProvider, CompanySearchResult, ProviderResult } from "../types"

// ==================== HUNTER API TYPES ====================

/**
 * Hunter.io Discover API 응답 스키마
 */
const HunterDiscoverResponseSchema = z.object({
  data: z.array(
    z.object({
      domain: z.string(),
      organization: z.string(),
      emails_count: z.object({
        personal: z.number(),
        generic: z.number(),
        total: z.number(),
      }),
    }),
  ),
  meta: z.object({
    results: z.number(),
    limit: z.number(),
    offset: z.number(),
  }),
})

type HunterDiscoverResponse = z.infer<typeof HunterDiscoverResponseSchema>

// ==================== HELPER FUNCTIONS ====================

/**
 * CompanySearchParams를 Hunter API 형식으로 변환
 */
function toHunterParams(params: CompanySearchParams): Record<string, unknown> {
  const hunterParams: Record<string, unknown> = {}

  // 자연어 쿼리
  if (params.query) {
    hunterParams.query = params.query
  }

  // 지역 필터
  if (params.location) {
    const loc: Array<{ country?: string; continent?: string; business_region?: string }> = []
    if (params.location.country) {
      loc.push({ country: params.location.country })
    }
    if (params.location.continent) {
      loc.push({ continent: params.location.continent })
    }
    if (params.location.businessRegion) {
      loc.push({ business_region: params.location.businessRegion })
    }
    if (loc.length > 0) {
      hunterParams.headquarters_location = { include: loc }
    }
  }

  // 산업 필터
  if (params.industry) {
    hunterParams.industry = {}
    if (params.industry.include?.length) {
      ;(hunterParams.industry as Record<string, unknown>).include = params.industry.include
    }
    if (params.industry.exclude?.length) {
      ;(hunterParams.industry as Record<string, unknown>).exclude = params.industry.exclude
    }
  }

  // 회사 규모
  if (params.headcount?.length) {
    hunterParams.headcount = params.headcount
  }

  // 키워드
  if (params.keywords) {
    hunterParams.keywords = {}
    if (params.keywords.include?.length) {
      ;(hunterParams.keywords as Record<string, unknown>).include = params.keywords.include
    }
    if (params.keywords.exclude?.length) {
      ;(hunterParams.keywords as Record<string, unknown>).exclude = params.keywords.exclude
    }
    if (params.keywords.match) {
      ;(hunterParams.keywords as Record<string, unknown>).match = params.keywords.match
    }
  }

  return hunterParams
}

/**
 * Hunter API 응답을 Company 배열로 변환
 */
function toCompanies(response: HunterDiscoverResponse): Company[] {
  return response.data.map((item) => ({
    domain: item.domain,
    name: item.organization,
    emailsCount: {
      personal: item.emails_count.personal,
      generic: item.emails_count.generic,
      total: item.emails_count.total,
    },
  }))
}

// ==================== HUNTER COMPANY FINDER ====================

/**
 * Hunter.io Company Finder Provider
 *
 * Hunter.io Discover API를 사용하여 회사 검색
 */
export class HunterCompanyFinder implements CompanyFinderProvider {
  readonly name = "hunter"
  private readonly apiKey: string
  private readonly executor = getDiscoverExecutor()

  constructor(apiKey?: string) {
    this.apiKey = apiKey || config.hunter.apiKey
  }

  /**
   * 회사 검색 실행
   */
  async searchCompanies(params: CompanySearchParams): Promise<ProviderResult<CompanySearchResult>> {
    const startTime = Date.now()
    const hunterParams = toHunterParams(params)

    // 캐시 키 생성
    const cacheKey = generateCompanySearchCacheKey(this.name, {
      ...hunterParams,
      limit: params.limit,
      offset: params.offset || 0,
    })

    try {
      const { data: result, fromCache } = await getOrSet<CompanySearchResult>(cacheKey, () =>
        this.executeSearch(hunterParams, params.limit, params.offset || 0),
      )

      const timeMs = Date.now() - startTime
      console.log(
        `[HunterCompanyFinder] ${fromCache ? "✅ Cache hit" : "🔍 API call"} - ` +
          `Found ${result.companies.length} companies (${timeMs}ms)`,
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

      console.error(`[HunterCompanyFinder] ❌ Error: ${errorMessage} (${timeMs}ms)`)
      logger.error({ error, params }, "HunterCompanyFinder.searchCompanies failed")

      // 재시도 가능 여부 판단
      const retryable = this.isRetryableError(error)

      return {
        success: false,
        data: null,
        fromCache: false,
        timeMs,
        error: errorMessage,
        retryable,
      }
    }
  }

  /**
   * API 호출 실행
   */
  private async executeSearch(
    hunterParams: Record<string, unknown>,
    limit: number,
    offset: number,
  ): Promise<CompanySearchResult> {
    const response = await this.executor.execute(async () => {
      const url = new URL("https://api.hunter.io/v2/discover")
      url.searchParams.set("api_key", this.apiKey)

      if (limit !== 100) {
        url.searchParams.set("limit", String(limit))
      }
      if (offset > 0) {
        url.searchParams.set("offset", String(offset))
      }

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(hunterParams),
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`Hunter API error (${res.status}): ${errorText}`)
      }

      return res.json()
    })

    // 응답 검증
    const parsed = HunterDiscoverResponseSchema.safeParse(response)
    if (!parsed.success) {
      throw new Error(`Invalid API response: ${parsed.error.message}`)
    }

    return {
      companies: toCompanies(parsed.data),
      totalAvailable: parsed.data.meta.results,
    }
  }

  /**
   * Rate Limit 상태 확인
   */
  getRateLimitStatus() {
    const status = this.executor.getStatus()
    return {
      remainingRequests: Math.max(0, 50 - status.minuteQueue.pending - status.minuteQueue.size),
      resetTimeMs: 60000,
    }
  }

  /**
   * 재시도 가능한 에러인지 판단
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      // 429 (Rate Limit), 5xx (Server Error)는 재시도 가능
      if (message.includes("429") || message.includes("rate limit")) {
        return true
      }
      if (message.includes("500") || message.includes("502") || message.includes("503")) {
        return true
      }
      // 네트워크 에러도 재시도 가능
      if (message.includes("network") || message.includes("timeout")) {
        return true
      }
    }
    return false
  }
}

// ==================== FACTORY FUNCTION ====================

/**
 * HunterCompanyFinder 인스턴스 생성
 */
export function createHunterCompanyFinder(apiKey?: string): HunterCompanyFinder {
  return new HunterCompanyFinder(apiKey)
}
