/**
 * Phase 4: Scoring and Ranking
 * LLM 관련성 평가 + 규칙 기반 스코어링
 */

import { ChatGoogleGenerativeAI } from "@langchain/google-genai"
import pLimit from "p-limit"
import { config } from "../../../config"
import logger from "../../../utils/logger"
import { LLM_BATCH_SIZE, SCORING_WEIGHTS, SOURCE_RELIABILITY } from "../constants"
import { buildBatchEvaluationPrompt } from "../prompts"
import type {
  BuyerIntelligence,
  BuyerSearchInput,
  CompanySize,
  EnrichedCompany,
  LLMEvaluation,
  ScoredCompany,
} from "../types"

const llm = new ChatGoogleGenerativeAI({
  model: "gemini-3-flash-preview",
  temperature: 0.7,
  apiKey: config.gemini.apiKey,
})

/**
 * LLM 응답 파싱
 */
function parseLLMEvaluations(
  response: string,
): Array<{ index: number; score: number; matchedPersona: string; reason: string }> | null {
  try {
    let cleaned = response.trim()

    // 마크다운 제거
    if (cleaned.includes("```json")) {
      cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?/g, "")
    } else if (cleaned.includes("```")) {
      cleaned = cleaned.replace(/```\n?/g, "")
    }

    // JSON 추출
    const startIdx = cleaned.indexOf("[")
    const endIdx = cleaned.lastIndexOf("]")

    if (startIdx === -1 || endIdx === -1) {
      return null
    }

    const jsonStr = cleaned.substring(startIdx, endIdx + 1)
    const parsed = JSON.parse(jsonStr)

    if (!Array.isArray(parsed)) return null

    return parsed
  } catch {
    return null
  }
}

/**
 * 배치로 LLM 평가
 */
async function evaluateBatch(
  intelligence: BuyerIntelligence,
  companies: EnrichedCompany[],
  sellerSize: CompanySize,
  locale: "ko" | "en" = "ko",
): Promise<Map<number, LLMEvaluation>> {
  const evaluations = new Map<number, LLMEvaluation>()

  try {
    const prompt = buildBatchEvaluationPrompt(intelligence, companies, sellerSize, locale)
    const response = await llm.invoke(prompt)
    const responseText = (response.content as string).trim()

    const parsed = parseLLMEvaluations(responseText)

    const isKorean = locale === "ko"

    if (!parsed) {
      // Fallback: 모든 회사에 중간 점수
      const defaultPersona = isKorean
        ? intelligence.buyerPersonas[0]?.typeKo
        : intelligence.buyerPersonas[0]?.type
      companies.forEach((_, idx) => {
        evaluations.set(idx, {
          score: 6,
          matchedPersona: defaultPersona || "Unknown",
          reason: isKorean
            ? "LLM 평가 파싱 실패 - 기본 점수 부여"
            : "LLM evaluation parsing failed - default score assigned",
        })
      })
      return evaluations
    }

    // 파싱 성공
    for (const item of parsed) {
      if (typeof item.index === "number" && item.index >= 0 && item.index < companies.length) {
        evaluations.set(item.index, {
          score: item.score || 5,
          matchedPersona: item.matchedPersona || "",
          reason: item.reason || "",
        })
      }
    }

    // 누락된 인덱스는 기본값
    companies.forEach((_, idx) => {
      if (!evaluations.has(idx)) {
        evaluations.set(idx, {
          score: 5,
          matchedPersona: "",
          reason: isKorean ? "LLM 평가 누락" : "LLM evaluation missing",
        })
      }
    })
  } catch (error) {
    logger.error({ error }, "[Scoring] LLM 평가 실패")

    // Fallback
    const isKorean = locale === "ko"
    companies.forEach((_, idx) => {
      evaluations.set(idx, {
        score: 5,
        matchedPersona: "",
        reason: isKorean ? "LLM 평가 오류" : "LLM evaluation error",
      })
    })
  }

  return evaluations
}

/**
 * 이메일 품질 점수 계산
 */
function calculateEmailQuality(company: EnrichedCompany): number {
  let score = 0.3 // 기본 점수 (이메일 있음)

  if (company.primaryEmail.verified) score += 0.3

  const email = company.primaryEmail.email.toLowerCase()
  const genericPrefixes = ["info", "contact", "sales", "hello", "support", "admin"]
  const isGeneric = genericPrefixes.some((p) => email.startsWith(`${p}@`))
  if (!isGeneric) score += 0.25

  const title = company.primaryEmail.title?.toLowerCase() || ""
  const decisionKeywords = ["director", "manager", "ceo", "vp", "head", "chief"]
  const isDecision = decisionKeywords.some((k) => title.includes(k))
  if (isDecision) score += 0.15

  return Math.min(score, 1.0)
}

/**
 * 데이터 완성도 점수
 */
function calculateCompleteness(company: EnrichedCompany): number {
  let score = 0

  if (company.companyName) score += 0.2
  if (company.website) score += 0.2
  if (company.industry) score += 0.2
  if (company.country) score += 0.2
  if (company.description && company.description.length > 20) score += 0.2

  return score
}

/**
 * 소스 신뢰도 점수
 */
function calculateSourceReliability(sources: string[]): number {
  // 가장 신뢰도 높은 소스 기준
  const maxWeight = Math.max(...sources.map((s) => SOURCE_RELIABILITY[s] || 0.5))

  // 복수 소스 보너스
  const multiSourceBonus = sources.length > 1 ? 0.1 : 0

  return Math.min(maxWeight + multiSourceBonus, 1.0)
}

/**
 * 규모 적합성 점수 계산
 * 소기업 → 소기업/중기업: 높은 점수
 * 소기업 → 대기업: 낮은 점수
 */
function calculateCompanySizeMatch(sellerSize: CompanySize, buyerSize: CompanySize | null): number {
  if (!buyerSize) return 0.5 // 규모 정보 없으면 중립 점수

  const sizeOrder: CompanySize[] = ["startup", "small", "medium", "large", "enterprise"]
  const sellerIdx = sizeOrder.indexOf(sellerSize)
  const buyerIdx = sizeOrder.indexOf(buyerSize)

  if (sellerIdx === -1 || buyerIdx === -1) return 0.5

  const diff = Math.abs(sellerIdx - buyerIdx)

  // 거리 기반 점수
  if (diff === 0) return 1.0 // 동일 규모 = 완벽
  if (diff === 1) return 0.85 // 인접 규모 = 매우 좋음
  if (diff === 2) return 0.6 // 2단계 차이 = 보통
  if (diff === 3) return 0.3 // 3단계 차이 = 어려움
  return 0.1 // 4단계 차이 = 거의 불가능 (startup ↔ enterprise)
}

/**
 * 최종 스코어 계산
 */
function calculateFinalScore(
  company: EnrichedCompany,
  llmEvaluation: LLMEvaluation,
  sellerSize: CompanySize,
): { finalScore: number; breakdown: ScoredCompany["scoreBreakdown"] } {
  const llmRelevance = llmEvaluation.score / 10 // 0-10 → 0-1
  const companySizeMatch = calculateCompanySizeMatch(sellerSize, company.size)
  const emailQuality = calculateEmailQuality(company)
  const dataCompleteness = calculateCompleteness(company)
  const sourceReliability = calculateSourceReliability(company.sources)

  const finalScore =
    llmRelevance * SCORING_WEIGHTS.llmRelevance +
    companySizeMatch * SCORING_WEIGHTS.companySizeMatch +
    emailQuality * SCORING_WEIGHTS.emailQuality +
    dataCompleteness * SCORING_WEIGHTS.dataCompleteness +
    sourceReliability * SCORING_WEIGHTS.sourceReliability

  return {
    finalScore: Math.round(finalScore * 100) / 100,
    breakdown: {
      llmRelevance,
      companySizeMatch,
      emailQuality,
      dataCompleteness,
      sourceReliability,
    },
  }
}

/**
 * 스코어링 진행 콜백 타입
 */
export type ScoringProgressCallback = (scored: ScoredCompany) => void

/**
 * Phase 4: 스코어링 및 랭킹
 */
export async function scoreAndRankCompanies(
  companies: EnrichedCompany[],
  intelligence: BuyerIntelligence,
  input: BuyerSearchInput,
  onProgress?: ScoringProgressCallback,
): Promise<ScoredCompany[]> {
  const startTime = Date.now()
  logger.info(
    `[Scoring] 스코어링 시작: ${companies.length}개 회사 (판매자 규모: ${input.companySize})`,
  )

  const scoredCompanies: ScoredCompany[] = []

  const limit = pLimit(10)
  const batches: EnrichedCompany[][] = []
  for (let i = 0; i < companies.length; i += LLM_BATCH_SIZE) {
    batches.push(companies.slice(i, i + LLM_BATCH_SIZE))
  }

  // 순차 처리로 변경하여 실시간 업데이트 가능하게 함
  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx]
    if (!batch) {
      continue
    }
    logger.info(`[Scoring] 배치 ${batchIdx + 1}/${batches.length}: ${batch.length}개 평가 중...`)

    const evaluations = await limit(async () => {
      return await evaluateBatch(intelligence, batch, input.companySize, input.locale)
    })

    // 최종 스코어 계산 및 실시간 콜백
    for (let i = 0; i < batch.length; i++) {
      const company = batch[i]
      if (!company) {
        continue
      }
      const llmEvaluation = evaluations.get(i)

      if (!llmEvaluation) {
        logger.warn(`[Scoring] 배치 인덱스 ${i}에 대한 평가 결과가 없습니다.`)
        continue
      }

      const { finalScore, breakdown } = calculateFinalScore(
        company,
        llmEvaluation,
        input.companySize,
      )

      const scoredCompany: ScoredCompany = {
        ...company,
        llmEvaluation,
        finalScore,
        scoreBreakdown: breakdown,
      }

      scoredCompanies.push(scoredCompany)

      // 실시간 진행 콜백 호출
      if (onProgress) {
        onProgress(scoredCompany)
      }
    }
  }

  // 점수 기준 정렬 (내림차순)
  scoredCompanies.sort((a, b) => b.finalScore - a.finalScore)

  const duration = Date.now() - startTime
  logger.info(`[Scoring] 스코어링 완료 (${duration}ms): 상위 10개 점수`)

  scoredCompanies.slice(0, 10).forEach((c, idx) => {
    const sizeMatch = (c.scoreBreakdown.companySizeMatch * 100).toFixed(0)
    logger.info(
      `  ${idx + 1}. ${c.companyName} - ${c.finalScore.toFixed(2)} (LLM: ${c.llmEvaluation.score}/10, 규모: ${sizeMatch}%)`,
    )
  })

  return scoredCompanies
}
