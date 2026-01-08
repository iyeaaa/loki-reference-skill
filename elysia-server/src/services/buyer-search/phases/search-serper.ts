/**
 * Phase 2C: Serper (Google Search) API
 * Google 검색 결과 파싱, 특정 쿼리 정밀 검색
 */

import { config } from "../../../config"
import logger from "../../../utils/logger"
import { COUNTRY_NAMES } from "../constants"
import type { BuyerIntelligence, Country, RawCompany } from "../types"

/**
 * Serper API 응답 타입
 */
interface SerperResponse {
  organic?: Array<{
    title?: string
    link?: string
    snippet?: string
    position?: number
  }>
  searchParameters?: {
    q?: string
    gl?: string
    hl?: string
  }
}

/**
 * Serper API 호출
 */
async function callSerperAPI(query: string, gl = "us"): Promise<SerperResponse> {
  const apiKey = config.serper.apiKey

  if (!apiKey) {
    logger.warn("[Serper] API 키가 설정되지 않음")
    return { organic: [] }
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl, // 국가 코드
        num: 10, // 결과 수
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, error: errorText }, "[Serper] API 호출 실패")
      return { organic: [] }
    }

    const data = (await response.json()) as SerperResponse
    return data
  } catch (error) {
    logger.error({ error }, "[Serper] API 호출 중 오류")
    return { organic: [] }
  }
}

/**
 * 국가 코드 → Google 국가 코드 (gl 파라미터)
 */
const COUNTRY_TO_GL: Record<Country, string> = {
  japan: "jp",
  usa: "us",
  china: "cn",
  southeast_asia: "sg", // 싱가포르 대표
  europe: "de", // 독일 대표
  middle_east: "ae", // UAE 대표
}

/**
 * URL에서 도메인 추출 (간단 버전)
 */
function extractDomainFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    let domain = urlObj.hostname

    // www. 제거
    if (domain.startsWith("www.")) {
      domain = domain.slice(4)
    }

    return domain
  } catch {
    return null
  }
}

/**
 * Serper 검색 쿼리 생성
 */
function buildSerperQueries(
  intelligence: BuyerIntelligence,
  countries: Country[],
): Array<{ query: string; country: Country }> {
  const queries: Array<{ query: string; country: Country }> = []

  for (const country of countries) {
    const countryName = COUNTRY_NAMES[country]
    const mainKeyword = intelligence.industryFilters.keywords[0] || ""

    // 일반 검색
    queries.push({
      query: `${mainKeyword} importer distributor ${countryName}`,
      country,
    })

    // LinkedIn 회사 검색
    queries.push({
      query: `site:linkedin.com/company ${mainKeyword} ${countryName}`,
      country,
    })

    // "we import" 패턴
    queries.push({
      query: `"we import" OR "looking for suppliers" ${intelligence.productSummary.slice(0, 50)} ${countryName}`,
      country,
    })
  }

  return queries
}

/**
 * Serper로 바이어 검색
 */
export async function searchWithSerper(
  intelligence: BuyerIntelligence,
  countries: Country[],
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(`[Serper] 검색 시작: ${countries.length}개 국가`)

  // API 키 체크
  if (!config.serper.apiKey) {
    logger.warn("[Serper] API 키 없음, 스킵")
    return []
  }

  const queries = buildSerperQueries(intelligence, countries)
  const allResults: RawCompany[] = []
  const seenDomains = new Set<string>()

  // 쿼리별로 순차 실행 (rate limit 고려)
  for (const { query, country } of queries) {
    try {
      logger.info(`[Serper] 쿼리: "${query.slice(0, 60)}..."`)

      const result = await callSerperAPI(query, COUNTRY_TO_GL[country])

      if (!result.organic || result.organic.length === 0) {
        continue
      }

      // 검색 결과 → RawCompany 변환
      for (const item of result.organic) {
        if (!item.link) continue

        const domain = extractDomainFromUrl(item.link)
        if (!domain) continue

        // 중복 제거
        if (seenDomains.has(domain)) continue

        // 제외할 도메인 (소셜미디어, 마켓플레이스 등)
        const excludeDomains = [
          "facebook.com",
          "linkedin.com",
          "twitter.com",
          "instagram.com",
          "youtube.com",
          "amazon.",
          "alibaba.com",
          "wikipedia.org",
        ]

        if (excludeDomains.some((excluded) => domain.includes(excluded))) {
          continue
        }

        seenDomains.add(domain)

        allResults.push({
          companyName: item.title || domain,
          website: item.link,
          domain,
          industry: undefined,
          country: COUNTRY_NAMES[country],
          description: item.snippet,
          contacts: [],
          source: "serper",
        })
      }

      // Rate limit 방지: 요청 간 약간의 딜레이
      await new Promise((resolve) => setTimeout(resolve, 200))
    } catch (error) {
      logger.error({ error, query }, "[Serper] 쿼리 실행 중 오류")
      // 실패해도 계속 진행
    }
  }

  const duration = Date.now() - startTime
  logger.info(`[Serper] 검색 완료 (${duration}ms): ${allResults.length}개 발견`)

  return allResults
}
