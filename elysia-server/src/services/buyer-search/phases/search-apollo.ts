/**
 * Phase 2B: Apollo.io Search
 * 구조화된 B2B 데이터베이스 검색
 */

import { config } from "../../../config"
import logger from "../../../utils/logger"
import { COUNTRY_TO_APOLLO } from "../constants"
import type { BuyerIntelligence, Country, RawCompany, TargetCustomer } from "../types"

/**
 * Apollo.io People Search API 파라미터
 */
interface ApolloSearchParams {
  organization_locations?: string[]
  q_organization_keyword_tags?: string[]
  organization_num_employees_ranges?: string[]
  person_titles?: string[]
  page?: number
  per_page?: number
}

/**
 * Apollo API 응답 타입
 */
interface ApolloResponse {
  people?: Array<{
    id: string
    first_name?: string
    last_name?: string
    title?: string
    email?: string
    phone_numbers?: Array<{ raw_number?: string }>
    organization?: {
      name?: string
      website_url?: string
      primary_domain?: string
      industry?: string
      country?: string
      phone?: string
      num_current_employees?: number
    }
  }>
  pagination?: {
    page: number
    per_page: number
    total_entries: number
    total_pages: number
  }
}

/**
 * Apollo.io API 호출
 */
async function callApolloAPI(params: ApolloSearchParams): Promise<ApolloResponse> {
  const apiKey = config.apollo.apiKey

  if (!apiKey) {
    logger.warn("[Apollo] API 키가 설정되지 않음")
    return { people: [] }
  }

  try {
    const response = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      body: JSON.stringify({
        api_key: apiKey,
        ...params,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, error: errorText }, "[Apollo] API 호출 실패")
      return { people: [] }
    }

    const data = (await response.json()) as ApolloResponse
    return data
  } catch (error) {
    logger.error({ error }, "[Apollo] API 호출 중 오류")
    return { people: [] }
  }
}

/**
 * 타겟 고객 유형에 따른 회사 규모 범위
 */
function getEmployeeRanges(target: TargetCustomer): string[] {
  if (target === "b2c") {
    // B2C: 소규모 리테일러 포함
    return ["1,10", "11,50", "51,200"]
  }
  // B2B: 중견 이상
  return ["11,50", "51,200", "201,1000", "1001,10000"]
}

/**
 * Apollo로 바이어 검색
 */
export async function searchWithApollo(
  intelligence: BuyerIntelligence,
  countries: Country[],
  target: TargetCustomer,
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(`[Apollo] 검색 시작: ${countries.length}개 국가`)

  // API 키 체크
  if (!config.apollo.apiKey) {
    logger.warn("[Apollo] API 키 없음, 스킵")
    return []
  }

  // 국가 매핑
  const locations = countries.flatMap((c) => COUNTRY_TO_APOLLO[c])

  // 회사 규모
  const employeeRanges = getEmployeeRanges(target)

  // 의사결정자 직책 (상위 10개)
  const personTitles = intelligence.buyerPersonas.flatMap((p) => p.decisionMakers).slice(0, 10)

  // 검색 파라미터
  const searchParams: ApolloSearchParams = {
    organization_locations: locations,
    q_organization_keyword_tags: intelligence.industryFilters.keywords.slice(0, 5),
    organization_num_employees_ranges: employeeRanges,
    person_titles: personTitles.length > 0 ? personTitles : undefined,
    page: 1,
    per_page: 50, // 최대 50개
  }

  try {
    const result = await callApolloAPI(searchParams)

    if (!result.people || result.people.length === 0) {
      logger.info("[Apollo] 결과 없음")
      return []
    }

    // Apollo 결과 → RawCompany 변환
    const companies: RawCompany[] = []
    const seenDomains = new Set<string>()

    for (const person of result.people) {
      const org = person.organization
      if (!org || !org.name) continue

      const domain = org.primary_domain || org.website_url
      if (!domain) continue

      // 조직당 하나만 (중복 제거)
      if (seenDomains.has(domain)) continue
      seenDomains.add(domain)

      companies.push({
        companyName: org.name,
        website: org.website_url,
        domain: org.primary_domain,
        industry: org.industry,
        country: org.country,
        description: undefined,
        contacts: [
          {
            email: person.email,
            name: [person.first_name, person.last_name].filter(Boolean).join(" "),
            title: person.title,
            phone: person.phone_numbers?.[0]?.raw_number,
          },
        ],
        source: "apollo",
      })
    }

    const duration = Date.now() - startTime
    logger.info(`[Apollo] 검색 완료 (${duration}ms): ${companies.length}개 고유 회사 발견`)

    return companies
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error({ error, duration }, "[Apollo] 검색 중 오류")
    return []
  }
}
