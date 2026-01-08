/**
 * Phase 5: Finalizing - Description Generation and Top 30 Selection
 * 설명 생성 및 국가별/페르소나별 균형 조정
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import pLimit from "p-limit"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { COUNTRY_NAMES, FINAL_BUYER_COUNT, MAX_PER_PERSONA } from "../constants"
import { buildDescriptionPrompt } from "../prompts"
import type { BuyerIntelligence, BuyerSearchInput, FinalBuyer, ScoredCompany } from "../types"

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.7,
  apiKey: config.gemini.apiKey,
})

/**
 * 설명 생성 (배치)
 */
async function generateDescriptionsBatch(
  input: BuyerSearchInput,
  intelligence: BuyerIntelligence,
  buyers: ScoredCompany[],
): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>()
  const limit = pLimit(10) // 동시 처리 제한 (Rate limit 고려)

  const tasks = buyers.map((buyer) =>
    limit(async () => {
      try {
        const prompt = buildDescriptionPrompt(input, intelligence, buyer)
        const response = await llm.invoke(prompt)
        const description = (response.content as string).trim()

        descriptions.set(buyer.id, description)
      } catch (error) {
        logger.error({ error, buyer: buyer.companyName }, "[Finalizing] 설명 생성 실패")

        // Fallback: LLM 평가 reason 사용
        descriptions.set(buyer.id, buyer.llmEvaluation.reason)
      }
    }),
  )

  await Promise.all(tasks)

  return descriptions
}

/**
 * 국가별 할당량 계산
 */
function calculateCountryQuotas(countries: string[]): Map<string, number> {
  const baseQuota = Math.floor(FINAL_BUYER_COUNT / countries.length)
  const remainder = FINAL_BUYER_COUNT % countries.length

  const quotas = new Map<string, number>()

  countries.forEach((country, idx) => {
    quotas.set(country, baseQuota + (idx < remainder ? 1 : 0))
  })

  return quotas
}

/**
 * 국가 매핑 (normalized → Country enum)
 */
function mapToCountryEnum(countryStr: string): string {
  const lower = countryStr.toLowerCase()

  // 직접 매핑
  for (const [_key, value] of Object.entries(COUNTRY_NAMES)) {
    if (value.toLowerCase() === lower) {
      return value
    }
  }

  // 부분 매칭
  if (lower.includes("japan") || lower.includes("日本")) return COUNTRY_NAMES.japan
  if (lower.includes("united states") || lower.includes("usa") || lower.includes("us"))
    return COUNTRY_NAMES.usa
  if (lower.includes("china") || lower.includes("中国")) return COUNTRY_NAMES.china

  // Southeast Asia 국가들
  const seaCountries = ["vietnam", "thailand", "indonesia", "malaysia", "singapore", "philippines"]
  if (seaCountries.some((c) => lower.includes(c))) return COUNTRY_NAMES.southeast_asia

  // Europe 국가들
  const euCountries = [
    "germany",
    "france",
    "united kingdom",
    "italy",
    "spain",
    "netherlands",
    "belgium",
    "poland",
  ]
  if (euCountries.some((c) => lower.includes(c))) return COUNTRY_NAMES.europe

  // Middle East 국가들
  const meCountries = ["uae", "saudi", "israel", "turkey", "qatar", "dubai"]
  if (meCountries.some((c) => lower.includes(c))) return COUNTRY_NAMES.middle_east

  return countryStr // 그대로 반환
}

/**
 * 최종 30개 선정 (국가별/페르소나별 균형)
 */
export async function selectFinal30(
  rankedCompanies: ScoredCompany[],
  input: BuyerSearchInput,
  intelligence: BuyerIntelligence,
): Promise<FinalBuyer[]> {
  const startTime = Date.now()
  logger.info(`[Finalizing] 최종 선정 시작: ${rankedCompanies.length}개 후보`)

  const targetCountries = input.country.map((c) => COUNTRY_NAMES[c])
  const countryQuotas = calculateCountryQuotas(targetCountries)

  const result: FinalBuyer[] = []
  const usedPersonas = new Map<string, number>()

  // 상위 60개 정도에 대해서만 설명 생성 (API 비용 절감)
  const topCandidates = rankedCompanies.slice(0, 60)
  logger.info(`[Finalizing] 상위 ${topCandidates.length}개에 대해 설명 생성 중...`)

  const descriptions = await generateDescriptionsBatch(input, intelligence, topCandidates)

  // 국가별로 선정
  for (const targetCountry of targetCountries) {
    const quota = countryQuotas.get(targetCountry) || 0
    let selected = 0

    // 해당 국가의 후보들 필터링
    const countryPool = topCandidates.filter((c) => {
      const mapped = mapToCountryEnum(c.country)
      return mapped === targetCountry
    })

    logger.info(`[Finalizing] ${targetCountry}: ${countryPool.length}개 후보 중 ${quota}개 선정`)

    for (const company of countryPool) {
      if (selected >= quota) break

      // 페르소나 다양성 체크
      const persona = company.llmEvaluation.matchedPersona
      const personaCount = usedPersonas.get(persona) || 0

      if (personaCount >= MAX_PER_PERSONA) {
        continue // 이미 이 페르소나로 충분히 선정됨
      }

      const description = descriptions.get(company.id) || company.llmEvaluation.reason

      result.push({
        companyName: company.companyName,
        website: company.website || "",
        email: company.primaryEmail.email,
        industry: company.industry || "N/A",
        country: company.country,
        description,
        matchedPersona: persona,
        score: company.finalScore,
      })

      usedPersonas.set(persona, personaCount + 1)
      selected++
    }
  }

  // 30개 미만이면 나머지 채우기 (국가 무관하게 점수순)
  if (result.length < FINAL_BUYER_COUNT) {
    const resultIds = new Set(result.map((r) => r.website))

    const remaining = topCandidates
      .filter((c) => !resultIds.has(c.website || ""))
      .slice(0, FINAL_BUYER_COUNT - result.length)

    for (const company of remaining) {
      const description = descriptions.get(company.id) || company.llmEvaluation.reason

      result.push({
        companyName: company.companyName,
        website: company.website || "",
        email: company.primaryEmail.email,
        industry: company.industry || "N/A",
        country: company.country,
        description,
        size: company.size || undefined,
        matchedPersona: company.llmEvaluation.matchedPersona,
        score: company.finalScore,
      })
    }
  }

  // 최대 30개로 제한
  const final = result.slice(0, FINAL_BUYER_COUNT)

  const duration = Date.now() - startTime
  logger.info(`[Finalizing] 최종 선정 완료 (${duration}ms): ${final.length}개`)

  // 국가별 분포 로그
  const countryDistribution = new Map<string, number>()
  for (const buyer of final) {
    const country = mapToCountryEnum(buyer.country)
    countryDistribution.set(country, (countryDistribution.get(country) || 0) + 1)
  }

  logger.info("  국가별 분포:")
  for (const [country, count] of countryDistribution.entries()) {
    logger.info(`    - ${country}: ${count}개`)
  }

  return final
}
