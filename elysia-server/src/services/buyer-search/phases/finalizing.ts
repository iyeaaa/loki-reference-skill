/**
 * Phase 5: Finalizing - Description Generation and Top 30 Selection
 * 설명 생성 및 국가별/페르소나별 균형 조정
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import pLimit from "p-limit"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import {
  COUNTRY_NAMES,
  FINAL_BUYER_COUNT,
  MAX_PER_PERSONA,
  MIN_PRIORITY_PERSONA_COUNT,
  MIN_PRIORITY_PERSONA_SCORE,
} from "../constants"
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
 * 최종 30개 선정 (우선순위 페르소나 우선 + 국가별 균형)
 */
export async function selectFinal30(
  rankedCompanies: ScoredCompany[],
  input: BuyerSearchInput,
  intelligence: BuyerIntelligence,
): Promise<FinalBuyer[]> {
  const startTime = Date.now()
  logger.info(`[Finalizing] 최종 선정 시작: ${rankedCompanies.length}개 후보`)

  // 상위 60개 정도에 대해서만 설명 생성 (API 비용 절감)
  const topCandidates = rankedCompanies.slice(0, 60)
  logger.info(`[Finalizing] 상위 ${topCandidates.length}개에 대해 설명 생성 중...`)

  const descriptions = await generateDescriptionsBatch(input, intelligence, topCandidates)

  // 우선순위 페르소나 파악 (1-2번)
  const priorityPersonaTypes = intelligence.searchStrategy.priorityPersonas.slice(0, 2)
  logger.info(`[Finalizing] 우선순위 페르소나: ${priorityPersonaTypes.join(", ")}`)

  // 페르소나별로 후보 분류
  const priorityCandidates = topCandidates.filter((c) => {
    const personaType = c.llmEvaluation.matchedPersona
    // typeKo 또는 type으로 매칭
    return (
      priorityPersonaTypes.some((p) => personaType.includes(p)) &&
      c.finalScore >= MIN_PRIORITY_PERSONA_SCORE
    )
  })

  const otherCandidates = topCandidates.filter((c) => !priorityCandidates.includes(c))

  logger.info(
    `[Finalizing] 우선순위 페르소나 후보: ${priorityCandidates.length}개, 기타: ${otherCandidates.length}개`,
  )

  const result: FinalBuyer[] = []
  const usedIds = new Set<string>()
  const usedPersonas = new Map<string, number>()

  // Phase 1: 우선순위 페르소나에서 최소 15개 선정
  let prioritySelected = 0
  for (const company of priorityCandidates) {
    if (prioritySelected >= MIN_PRIORITY_PERSONA_COUNT) break
    if (usedIds.has(company.website || "")) continue

    const persona = company.llmEvaluation.matchedPersona
    const personaCount = usedPersonas.get(persona) || 0

    if (personaCount >= MAX_PER_PERSONA) continue

    const description = descriptions.get(company.id) || company.llmEvaluation.reason

    result.push({
      companyName: company.companyName,
      website: company.website || "",
      email: company.primaryEmail.email,
      industry: company.industry || "N/A",
      country: company.country,
      description,
      size: company.size || undefined,
      matchedPersona: persona,
      score: company.finalScore,
    })

    usedIds.add(company.website || "")
    usedPersonas.set(persona, personaCount + 1)
    prioritySelected++
  }

  logger.info(`[Finalizing] Phase 1 완료: 우선순위 페르소나 ${prioritySelected}개 선정`)

  // Phase 2: 나머지를 점수순으로 채우기 (우선순위 + 기타 모두 포함)
  const remainingCandidates = [...priorityCandidates, ...otherCandidates].filter(
    (c) => !usedIds.has(c.website || ""),
  )

  for (const company of remainingCandidates) {
    if (result.length >= FINAL_BUYER_COUNT) break
    if (usedIds.has(company.website || "")) continue

    const persona = company.llmEvaluation.matchedPersona
    const personaCount = usedPersonas.get(persona) || 0

    if (personaCount >= MAX_PER_PERSONA) continue

    const description = descriptions.get(company.id) || company.llmEvaluation.reason

    result.push({
      companyName: company.companyName,
      website: company.website || "",
      email: company.primaryEmail.email,
      industry: company.industry || "N/A",
      country: company.country,
      description,
      size: company.size || undefined,
      matchedPersona: persona,
      score: company.finalScore,
    })

    usedIds.add(company.website || "")
    usedPersonas.set(persona, personaCount + 1)
  }

  logger.info(`[Finalizing] Phase 2 완료: 총 ${result.length}개 선정`)

  // 최대 30개로 제한
  const final = result.slice(0, FINAL_BUYER_COUNT)

  const duration = Date.now() - startTime
  logger.info(`[Finalizing] 최종 선정 완료 (${duration}ms): ${final.length}개`)

  // 페르소나별 분포 로그
  const personaDistribution = new Map<string, number>()
  for (const buyer of final) {
    const persona = buyer.matchedPersona || "Unknown"
    personaDistribution.set(persona, (personaDistribution.get(persona) || 0) + 1)
  }

  logger.info("  페르소나별 분포:")
  for (const [persona, count] of personaDistribution.entries()) {
    const isPriority = priorityPersonaTypes.some((p) => persona.includes(p))
    logger.info(`    - ${persona}: ${count}개 ${isPriority ? "(우선순위)" : ""}`)
  }

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
