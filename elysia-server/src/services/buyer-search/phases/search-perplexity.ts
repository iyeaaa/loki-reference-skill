/**
 * Phase 2A: Perplexity Search
 * 기존 perplexity-search.service의 searchCustomersWithPerplexity 활용
 */

import logger from "../../../utils/logger"
import { searchCustomersWithPerplexity } from "../../perplexity-search.service"
import { COUNTRY_NAMES } from "../constants"
import type { BuyerIntelligence, CompanySize, Country, RawCompany } from "../types"

/**
 * Perplexity estimatedSize → CompanySize 매핑
 */
function mapPerplexitySizeToCompanySize(
  estimatedSize: "Startup" | "SMB" | "Enterprise" | undefined,
): CompanySize | undefined {
  if (!estimatedSize) return undefined

  const lower = estimatedSize.toLowerCase()
  if (lower === "startup") return "startup"
  if (lower === "smb") return "small" // SMB → small로 매핑
  if (lower === "enterprise") return "enterprise"

  return undefined
}

/**
 * Perplexity로 바이어 검색
 * 페르소나별 × 국가별로 쿼리 생성하여 검색
 */
export async function searchWithPerplexity(
  intelligence: BuyerIntelligence,
  countries: Country[],
): Promise<RawCompany[]> {
  const startTime = Date.now()
  logger.info(
    `[Perplexity] 검색 시작: ${countries.length}개 국가, ${intelligence.buyerPersonas.length}개 페르소나`,
  )

  const allResults: RawCompany[] = []
  const promises: Promise<void>[] = []

  // 각 국가별로 검색 (병렬)
  for (const country of countries) {
    const countryName = COUNTRY_NAMES[country]

    // 모든 페르소나 검색 (다양성 확보)
    const targetPersonas = intelligence.buyerPersonas

    for (const persona of targetPersonas) {
      const promise = (async () => {
        try {
          // 검색 쿼리 구성
          const idealCustomerTypes = [persona.type, ...persona.searchKeywords.en.slice(0, 2)]

          const excludeTypes = intelligence.industryFilters.excludeKeywords

          logger.info(`[Perplexity] ${countryName} - ${persona.typeKo} 검색 중...`)

          const result = await searchCustomersWithPerplexity({
            sellerDescription: intelligence.productSummary,
            idealCustomerTypes,
            country: countryName,
            excludeTypes,
            count: 9, // 페르소나당 9개 목표 (15 x 0.6, Gemini와 병렬)
            targetCompanySize: persona.targetCompanySize, // 페르소나별 타겟 규모 전달
          })

          // Perplexity 결과 → RawCompany 변환
          const companies: RawCompany[] = result.leads.map((lead) => ({
            companyName: lead.companyName,
            website: lead.website,
            domain: undefined, // extractDomain은 dedup 단계에서
            industry: lead.industry,
            country: lead.country,
            description: lead.description,
            size: mapPerplexitySizeToCompanySize(lead.estimatedSize), // 규모 정보 매핑
            contacts: [],
            source: "perplexity",
          }))

          allResults.push(...companies)

          logger.info(`[Perplexity] ${countryName} - ${persona.typeKo}: ${companies.length}개 발견`)
        } catch (error) {
          logger.error(
            { error, country: countryName, persona: persona.typeKo },
            `[Perplexity] 검색 실패`,
          )
          // 실패해도 계속 진행
        }
      })()

      promises.push(promise)
    }
  }

  // 모든 검색 완료 대기
  await Promise.all(promises)

  // ========================================================================
  // Fallback Logic: 결과가 부족할 경우 포괄적인 검색 수행
  // ========================================================================
  const uniqueCount = new Set(allResults.map((c) => c.website)).size
  if (uniqueCount < 30) {
    logger.info(`[Perplexity] 결과 부족 (${uniqueCount}개), 포괄적 검색(Fallback) 실행...`)

    const fallbackPromises: Promise<void>[] = []

    for (const country of countries) {
      const countryName = COUNTRY_NAMES[country]
      const promise = (async () => {
        try {
          // 아주 포괄적인 키워드 사용 (페르소나 무관)
          const broadKeywords = intelligence.industryFilters.keywords
            .slice(0, 3)
            .map((k) => `${k} Distributors/Importers`)

          const idealCustomerTypes = ["Distributors", "Wholesalers", "Importers", ...broadKeywords]

          logger.info(`[Perplexity] ${countryName} - Fallback Broad Search 진행 중...`)

          const result = await searchCustomersWithPerplexity({
            sellerDescription: intelligence.productSummary,
            idealCustomerTypes,
            country: countryName,
            excludeTypes: [], // 제외 키워드 최소화
            count: 30 - uniqueCount > 0 ? 30 - uniqueCount + 10 : 20, // 부족한 만큼 + 여유분
          })

          const companies: RawCompany[] = result.leads.map((lead) => ({
            companyName: lead.companyName,
            website: lead.website,
            domain: undefined,
            industry: lead.industry,
            country: lead.country,
            description: lead.description,
            size: mapPerplexitySizeToCompanySize(lead.estimatedSize), // 규모 정보 매핑
            contacts: [],
            source: "perplexity",
          }))

          allResults.push(...companies)
          logger.info(`[Perplexity] ${countryName} - Fallback: ${companies.length}개 추가 발견`)
        } catch (error) {
          logger.error({ error, country: countryName }, `[Perplexity] Fallback 검색 실패`)
        }
      })()
      fallbackPromises.push(promise)
    }

    await Promise.all(fallbackPromises)
  }

  const duration = Date.now() - startTime
  logger.info(`[Perplexity] 검색 완료 (${duration}ms): 총 ${allResults.length}개 발견 (중복 포함)`)

  return allResults
}
