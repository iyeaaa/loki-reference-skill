/**
 * Phase 1: Buyer Intelligence Generation
 * LLM을 사용하여 바이어 페르소나 및 검색 전략 생성
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { buildIntelligencePrompt } from "../prompts"
import type { BuyerIntelligence, BuyerSearchInput } from "../types"

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.7,
  apiKey: config.gemini.apiKey,
})

/**
 * LLM 응답에서 JSON 파싱
 */
function parseIntelligenceResponse(response: string): BuyerIntelligence | null {
  try {
    // 마크다운 코드블록 제거
    let cleaned = response.trim()
    if (cleaned.includes("```json")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (cleaned.includes("```")) {
      cleaned = cleaned.replace(/```\n?/g, "")
    }

    // JSON 추출
    const startIdx = cleaned.indexOf("{")
    const endIdx = cleaned.lastIndexOf("}")

    if (startIdx === -1 || endIdx === -1) {
      return null
    }

    const jsonStr = cleaned.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr) as BuyerIntelligence

    // 기본 검증
    if (
      !parsed.productSummary ||
      !parsed.buyerPersonas ||
      !Array.isArray(parsed.buyerPersonas) ||
      parsed.buyerPersonas.length === 0
    ) {
      return null
    }

    return parsed
  } catch (error) {
    logger.error({ error }, "[Intelligence] JSON 파싱 실패")
    return null
  }
}

/**
 * Fallback 인텔리전스 생성 (LLM 실패 시)
 */
function createFallbackIntelligence(input: BuyerSearchInput): BuyerIntelligence {
  const isB2B = input.target === "b2b" || input.target === "both"
  const isB2C = input.target === "b2c" || input.target === "both"

  const personas: BuyerIntelligence["buyerPersonas"] = []

  // 규모 기반 타겟 설정
  type CompanySizeType = typeof input.companySize
  const getSizeTargets = (priority: number): CompanySizeType[] => {
    const allSizes: CompanySizeType[] = ["startup", "small", "medium", "large", "enterprise"]
    const sizeIndex = allSizes.indexOf(input.companySize)

    if (priority === 1) {
      // 동일 규모 + 인접 규모 1개
      const next = allSizes[Math.min(sizeIndex + 1, allSizes.length - 1)]
      return next ? [input.companySize, next] : [input.companySize]
    } else if (priority === 2) {
      // 동일 규모 + 인접 규모 2개
      const next = allSizes[Math.min(sizeIndex + 1, allSizes.length - 1)]
      const prev = allSizes[Math.max(sizeIndex - 1, 0)]
      const result: CompanySizeType[] = [input.companySize]
      if (next) result.push(next)
      if (prev && prev !== input.companySize) result.push(prev)
      return Array.from(new Set(result))
    } else if (priority === 3) {
      // 대기업 제외 (작은 기업의 경우)
      if (sizeIndex <= 1) {
        return allSizes.slice(0, 4) // startup ~ large
      }
      return allSizes
    } else {
      // 모든 규모
      return allSizes
    }
  }

  if (isB2B) {
    personas.push({
      type: "Small Scale Distributor",
      typeKo: "소규모 유통업체",
      description: `${input.companyName}와 비슷한 규모의 전문 유통업체로 협업 가능성이 높음`,
      decisionMakers: ["Purchasing Manager", "CEO", "Operations Director"],
      targetCompanySize: getSizeTargets(1),
      searchKeywords: {
        en: ["small distributor", "boutique wholesaler", input.industry.replace("_", " ")],
        local: {},
      },
    })

    personas.push({
      type: "Specialized Distributor",
      typeKo: "전문 유통업체",
      description: `중소규모의 전문 유통업체로 빠른 의사결정 가능`,
      decisionMakers: ["Import Manager", "Sourcing Manager", "CEO"],
      targetCompanySize: getSizeTargets(2),
      searchKeywords: {
        en: ["distributor", "wholesaler", input.industry.replace("_", " ")],
        local: {},
      },
    })

    personas.push({
      type: "General Importer",
      typeKo: "일반 수입업체",
      description: `다양한 규모의 수입업체`,
      decisionMakers: ["Import Manager", "Sourcing Manager", "CEO"],
      targetCompanySize: getSizeTargets(3),
      searchKeywords: {
        en: ["importer", "import company", input.industry.replace("_", " ")],
        local: {},
      },
    })

    personas.push({
      type: "Wholesaler",
      typeKo: "도매업체",
      description: `규모 상관없이 도매 유통 가능한 업체`,
      decisionMakers: ["Buyer", "Purchasing Director", "CEO"],
      targetCompanySize: getSizeTargets(4),
      searchKeywords: {
        en: ["wholesaler", "wholesale distributor", input.industry.replace("_", " ")],
        local: {},
      },
    })
  }

  if (isB2C) {
    personas.push({
      type: "Independent Retailer",
      typeKo: "독립 소매점",
      description: `비슷한 규모의 소매점으로 협업하기 좋음`,
      decisionMakers: ["Owner", "Buyer", "Category Manager"],
      targetCompanySize: getSizeTargets(1),
      searchKeywords: {
        en: ["independent retailer", "boutique shop", input.industry.replace("_", " ")],
        local: {},
      },
    })

    personas.push({
      type: "Specialty Retailer",
      typeKo: "전문 소매업체",
      description: `중소규모의 전문 소매점`,
      decisionMakers: ["Buyer", "Category Manager", "Owner"],
      targetCompanySize: getSizeTargets(2),
      searchKeywords: {
        en: ["specialty retailer", "shop", input.industry.replace("_", " ")],
        local: {},
      },
    })
  }

  // 5번째 페르소나 (B2B/B2C 모두 포괄적)
  personas.push({
    type: "General Merchandise Importer",
    typeKo: "종합 상품 수입업체",
    description: `규모와 상관없이 다양한 제품을 취급하는 종합 수입업체`,
    decisionMakers: ["Import Manager", "Buyer", "CEO"],
    targetCompanySize: getSizeTargets(5),
    searchKeywords: {
      en: ["general importer", "merchandise", "trading company"],
      local: {},
    },
  })

  // 5개로 제한
  const finalPersonas = personas.slice(0, 5)

  return {
    productSummary: input.companyDescription.slice(0, 200),
    buyerPersonas: finalPersonas,
    industryFilters: {
      keywords: [input.industry.replace("_", " ")],
      excludeKeywords: [],
    },
    searchStrategy: {
      priorityPersonas: finalPersonas.slice(0, 2).map((p) => p.type),
      notes: "Fallback strategy - 규모 기반 우선순위로 5개 페르소나 생성",
    },
  }
}

/**
 * Phase 1: 바이어 인텔리전스 생성
 */
export async function generateBuyerIntelligence(
  input: BuyerSearchInput,
): Promise<BuyerIntelligence> {
  const startTime = Date.now()

  logger.info(`[Intelligence] 바이어 인텔리전스 생성 시작: ${input.companyName}`)

  try {
    const prompt = buildIntelligencePrompt(input)
    const response = await llm.invoke(prompt)
    const responseText = (response.content as string).trim()

    const intelligence = parseIntelligenceResponse(responseText)

    if (!intelligence) {
      logger.warn("[Intelligence] LLM 응답 파싱 실패, Fallback 사용")
      return createFallbackIntelligence(input)
    }

    const duration = Date.now() - startTime
    logger.info(
      `[Intelligence] 생성 완료 (${duration}ms): ${intelligence.buyerPersonas.length}개 페르소나`,
    )

    // 페르소나 요약 로그
    intelligence.buyerPersonas.forEach((persona, idx) => {
      logger.info(`  ${idx + 1}. ${persona.typeKo} (${persona.type})`)
    })

    return intelligence
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error({ error, duration }, "[Intelligence] LLM 호출 실패")

    // Fallback 사용
    return createFallbackIntelligence(input)
  }
}
