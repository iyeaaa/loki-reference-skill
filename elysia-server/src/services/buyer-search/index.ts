/**
 * Buyer Search Service
 * Main entry point for the buyer search pipeline
 */

import logger from "../../utils/logger"
import { FINAL_BUYER_COUNT, PHASE_PROGRESS_RANGES } from "./constants"
import { deduplicateAndNormalize } from "./phases/dedup"
import { enrichWithEmails } from "./phases/enrichment"
import { selectFinal30 } from "./phases/finalizing"
import { generateBuyerIntelligence } from "./phases/intelligence"
import { scoreAndRankCompanies } from "./phases/scoring"
import { searchWithGemini } from "./phases/search-gemini"
import { searchWithPerplexity } from "./phases/search-perplexity"
import type { Buyer, BuyerSearchInput, BuyerSearchResult, ProgressEvent } from "./types"

/**
 * Buyer Search - 메인 함수
 *
 * @param input 바이어 검색 입력
 * @param onProgress SSE 진행률 콜백
 * @returns 바이어 검색 결과
 */
export async function searchBuyers(
  input: BuyerSearchInput,
  onProgress?: (event: ProgressEvent) => void,
): Promise<BuyerSearchResult> {
  const startTime = Date.now()

  logger.info(`[BuyerSearch] 검색 시작: ${input.companyName} → ${input.country.join(", ")}`)

  try {
    // ========================================================================
    // Phase 1: Buyer Intelligence Generation (0% → 15%)
    // ========================================================================
    onProgress?.({
      phase: "intelligence",
      progress: PHASE_PROGRESS_RANGES.intelligence.start,
      message: "Analyzing buyer personas...",
      messageKr: "바이어 유형을 분석하고 있어요...",
      reasoning: {
        step: "Analyzing buyer personas...",
        stepKr: "바이어 유형을 분석하고 있어요...",
      },
    })

    const intelligence = await generateBuyerIntelligence(input, onProgress)

    // 생성된 페르소나 이름 추출
    const personaNames = intelligence.buyerPersonas.map((p) => p.typeKo || p.type).slice(0, 3)
    const personaList = personaNames.join(", ")

    onProgress?.({
      phase: "intelligence",
      progress: PHASE_PROGRESS_RANGES.intelligence.end,
      message: `Generated ${intelligence.buyerPersonas.length} buyer personas`,
      messageKr: `${intelligence.buyerPersonas.length}개의 바이어 페르소나를 생성했어요`,
      reasoning: {
        step: `Generated ${intelligence.buyerPersonas.length} buyer personas`,
        stepKr: `${intelligence.buyerPersonas.length}개의 바이어 페르소나를 생성했어요`,
        details: personaList,
        detailsKr: personaList,
      },
    })

    // ========================================================================
    // Phase 2: Multi-Source Parallel Search (15% → 70%)
    // ========================================================================
    const countryText = input.country.join(", ")

    // 2A & 2B: Perplexity + Gemini 병렬 검색 (15% → 35%)
    onProgress?.({
      phase: "search_perplexity",
      progress: PHASE_PROGRESS_RANGES.search_perplexity.start,
      message: "Searching with AI engines (Perplexity + Gemini)...",
      messageKr: "AI 검색 엔진으로 검색 중 (Perplexity + Gemini)...",
      reasoning: {
        step: "Starting parallel AI search...",
        stepKr: "AI 병렬 검색 시작 중...",
        details: countryText,
        detailsKr: `${countryText} 시장`,
      },
    })

    // 병렬 실행
    const perplexityPromise = searchWithPerplexity(intelligence, input.country)
    const geminiPromise = searchWithGemini(intelligence, input.country)

    // 다른 검색 소스들 (임시 비활성화)
    const apolloPromise = Promise.resolve([])
    const serperPromise = Promise.resolve([])
    const placesPromise = Promise.resolve([])

    // 병렬 검색 완료 대기
    const [perplexityResults, geminiResults, apolloResults, serperResults, placesResults] =
      await Promise.all([
        perplexityPromise,
        geminiPromise,
        apolloPromise,
        serperPromise,
        placesPromise,
      ])

    onProgress?.({
      phase: "search_gemini",
      progress: PHASE_PROGRESS_RANGES.search_gemini.end,
      message: "AI search complete",
      messageKr: "AI 검색을 완료했어요",
      reasoning: {
        step: "AI search complete",
        stepKr: "AI 검색을 완료했어요",
        details: `Found ${perplexityResults.length + geminiResults.length} companies`,
        detailsKr: `${perplexityResults.length + geminiResults.length}개 회사 발견`,
      },
    })

    // 2C: Serper (45% → 55%) - 임시 비활성화

    const rawPool = [
      ...perplexityResults,
      ...geminiResults,
      ...apolloResults,
      ...serperResults,
      ...placesResults,
    ]

    logger.info(`[BuyerSearch] 원시 검색 결과: ${rawPool.length}개`)

    // 2E: Deduplication (65% → 70%)
    onProgress?.({
      phase: "dedup",
      progress: PHASE_PROGRESS_RANGES.dedup.start,
      message: "Removing duplicates...",
      messageKr: "중복 제거 중...",
      reasoning: {
        step: "Removing duplicates...",
        stepKr: "중복 제거 중...",
      },
    })

    const uniquePool = deduplicateAndNormalize(rawPool)

    onProgress?.({
      phase: "dedup",
      progress: PHASE_PROGRESS_RANGES.dedup.end,
      message: `Organized ${rawPool.length} → ${uniquePool.length} companies`,
      messageKr: `${rawPool.length}개 → ${uniquePool.length}개로 정리했어요`,
      reasoning: {
        step: `Organized ${rawPool.length} → ${uniquePool.length} companies`,
        stepKr: `${rawPool.length}개 → ${uniquePool.length}개로 정리했어요`,
      },
    })

    // ========================================================================
    // Phase 3: Email Enrichment (70% → 85%)
    // ========================================================================
    onProgress?.({
      phase: "enrichment",
      progress: PHASE_PROGRESS_RANGES.enrichment.start,
      message: `Finding contact emails for ${uniquePool.length} companies...`,
      messageKr: `${uniquePool.length}개 회사의 담당자 이메일을 찾고 있어요...`,
      reasoning: {
        step: `Finding contact emails for ${uniquePool.length} companies...`,
        stepKr: `${uniquePool.length}개 회사의 담당자 이메일을 찾고 있어요...`,
      },
    })

    const enrichedPool = await enrichWithEmails(uniquePool)

    onProgress?.({
      phase: "enrichment",
      progress: PHASE_PROGRESS_RANGES.enrichment.end,
      message: `Found emails for ${enrichedPool.length} companies`,
      messageKr: `${enrichedPool.length}개 회사의 이메일을 찾았어요`,
      reasoning: {
        step: `Found emails for ${enrichedPool.length} companies`,
        stepKr: `${enrichedPool.length}개 회사의 이메일을 찾았어요`,
      },
    })

    // ========================================================================
    // Phase 4: Scoring & Ranking (85% → 92%)
    // ========================================================================
    onProgress?.({
      phase: "scoring",
      progress: PHASE_PROGRESS_RANGES.scoring.start,
      message: "Evaluating buyer fit...",
      messageKr: "바이어 적합도를 평가하고 있어요...",
      reasoning: {
        step: "Evaluating buyer fit...",
        stepKr: "바이어 적합도를 평가하고 있어요...",
      },
    })

    let scoredCount = 0
    let scoredSseCount = 0
    const scoredPool = await scoreAndRankCompanies(enrichedPool, intelligence, input, (scored) => {
      // 각 회사가 스코어링될 때마다 실시간 업데이트
      scoredCount++
      const shouldEmitScoredCompany = scoredSseCount < FINAL_BUYER_COUNT
      if (shouldEmitScoredCompany) {
        scoredSseCount++
      }
      const progressPercent =
        PHASE_PROGRESS_RANGES.scoring.start +
        Math.floor(
          ((scoredCount / enrichedPool.length) *
            (PHASE_PROGRESS_RANGES.scoring.end - PHASE_PROGRESS_RANGES.scoring.start)) /
            2,
        )

      // 사용자 locale에 따라 설명 선택
      // - Korean (ko): llmEvaluation.reason (한글) 우선 사용
      // - English (en): 원본 description (영문) 우선 사용
      const scoredDescription =
        input.locale === "ko"
          ? scored.llmEvaluation?.reason || scored.description || undefined
          : scored.description || scored.llmEvaluation?.reason || undefined

      onProgress?.({
        phase: "scoring",
        progress: progressPercent,
        message: `Scoring ${scored.companyName}...`,
        messageKr: `${scored.companyName} 평가 중...`,
        reasoning: {
          step: `Evaluated ${scoredCount}/${enrichedPool.length} companies`,
          stepKr: `${scoredCount}/${enrichedPool.length}개 회사 평가 완료`,
          details: scored.companyName,
          detailsKr: scored.companyName,
        },
        ...(shouldEmitScoredCompany
          ? {
              scoredCompany: {
                companyName: scored.companyName,
                country: scored.country,
                email: scored.primaryEmail?.email,
                description: scoredDescription,
                score: Math.round(scored.finalScore * 100),
              },
            }
          : {}),
      })
    })

    onProgress?.({
      phase: "scoring",
      progress: PHASE_PROGRESS_RANGES.scoring.end,
      message: "Ranking complete",
      messageKr: "순위 결정 완료",
      reasoning: {
        step: "Ranking complete",
        stepKr: "순위 결정 완료",
      },
    })

    // ========================================================================
    // Phase 5: Finalizing (92% → 100%)
    // ========================================================================
    onProgress?.({
      phase: "finalizing",
      progress: PHASE_PROGRESS_RANGES.finalizing.start,
      message: "Finalizing results...",
      messageKr: "최종 결과를 정리하고 있어요...",
      reasoning: {
        step: "Finalizing results...",
        stepKr: "최종 결과를 정리하고 있어요...",
      },
    })

    const finalBuyers = await selectFinal30(scoredPool, input, intelligence)

    onProgress?.({
      phase: "finalizing",
      progress: PHASE_PROGRESS_RANGES.finalizing.end,
      message: "Done!",
      messageKr: `${finalBuyers.length}명의 적합한 바이어를 찾았어요`,
      reasoning: {
        step: `Found ${finalBuyers.length} qualified buyers`,
        stepKr: `${finalBuyers.length}명의 적합한 바이어를 찾았어요`,
      },
    })

    // ========================================================================
    // Build Result
    // ========================================================================
    const searchTimeSeconds = (Date.now() - startTime) / 1000

    const buyers: Buyer[] = finalBuyers.map((fb) => ({
      companyName: fb.companyName,
      website: fb.website,
      email: fb.email,
      industry: fb.industry,
      country: fb.country,
      description: fb.description,
      size: fb.size,
      score: fb.score ? Math.round(fb.score * 100) : undefined, // finalScore(0-1) → 0-100
    }))

    const result: BuyerSearchResult = {
      buyers,
      buyerPersonas: intelligence.buyerPersonas,
      metadata: {
        totalSearched: rawPool.length,
        totalWithEmail: enrichedPool.length,
        searchTimeSeconds: Math.round(searchTimeSeconds * 10) / 10,
        sources: ["perplexity", "gemini", "apollo", "serper", "places"],
      },
    }

    logger.info(
      `[BuyerSearch] 검색 완료 (${searchTimeSeconds.toFixed(1)}초): ${buyers.length}개 최종 바이어`,
    )

    return result
  } catch (error) {
    logger.error({ error }, "[BuyerSearch] 검색 중 오류 발생")

    // 에러 시 빈 결과 반환
    return {
      buyers: [],
      buyerPersonas: [],
      metadata: {
        totalSearched: 0,
        totalWithEmail: 0,
        searchTimeSeconds: (Date.now() - startTime) / 1000,
        sources: [],
      },
    }
  }
}

// Export types
export type {
  Buyer,
  BuyerSearchInput,
  BuyerSearchResult,
  Country,
  Industry,
  ProgressEvent,
  ScoredCompanyProgress,
  TargetCustomer,
} from "./types"
