/**
 * Buyer Search Service
 * Main entry point for the buyer search pipeline
 */

import logger from "../../utils/logger"
import { PHASE_PROGRESS_RANGES } from "./constants"
import { deduplicateAndNormalize } from "./phases/dedup"
import { enrichWithEmails } from "./phases/enrichment"
import { selectFinal30 } from "./phases/finalizing"
import { generateBuyerIntelligence } from "./phases/intelligence"
import { scoreAndRankCompanies } from "./phases/scoring"
import { searchWithPerplexity } from "./phases/search-perplexity"
import type { Buyer, BuyerSearchInput, BuyerSearchResult, ProgressEvent } from "./types"

/**
 * 진행률 업데이트 헬퍼
 */
function emitProgress(
  phase: string,
  progress: number,
  message: string,
  onProgress?: (event: ProgressEvent) => void,
) {
  if (onProgress) {
    onProgress({ phase, progress, message })
  }
}

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
    emitProgress(
      "intelligence",
      PHASE_PROGRESS_RANGES.intelligence.start,
      "바이어 인텔리전스 생성 중...",
      onProgress,
    )

    const intelligence = await generateBuyerIntelligence(input)

    emitProgress(
      "intelligence",
      PHASE_PROGRESS_RANGES.intelligence.end,
      `${intelligence.buyerPersonas.length}개 바이어 페르소나 생성 완료`,
      onProgress,
    )

    // ========================================================================
    // Phase 2: Multi-Source Parallel Search (15% → 70%)
    // ========================================================================

    // 2A: Perplexity (15% → 30%)
    emitProgress(
      "search_perplexity",
      PHASE_PROGRESS_RANGES.search_perplexity.start,
      "웹 검색 중 (Perplexity)...",
      onProgress,
    )

    const perplexityPromise = searchWithPerplexity(intelligence, input.country)

    emitProgress(
      "search_perplexity",
      PHASE_PROGRESS_RANGES.search_perplexity.end,
      "웹 검색 완료",
      onProgress,
    )

    // 2B: Apollo (30% → 45%) - 임시 비활성화
    emitProgress(
      "search_apollo",
      PHASE_PROGRESS_RANGES.search_apollo.start,
      "B2B 데이터베이스 검색 스킵 (API 키 미설정)...",
      onProgress,
    )

    // TODO: API 키 설정 후 활성화
    // const apolloPromise = searchWithApollo(intelligence, input.country, input.target)
    const apolloPromise = Promise.resolve([])

    emitProgress(
      "search_apollo",
      PHASE_PROGRESS_RANGES.search_apollo.end,
      "B2B 데이터베이스 검색 스킵",
      onProgress,
    )

    // 2C: Serper (45% → 55%) - 임시 비활성화
    emitProgress(
      "search_serper",
      PHASE_PROGRESS_RANGES.search_serper.start,
      "추가 검색 스킵 (API 키 미설정)...",
      onProgress,
    )

    // TODO: API 키 설정 후 활성화
    // const serperPromise = searchWithSerper(intelligence, input.country)
    const serperPromise = Promise.resolve([])

    emitProgress(
      "search_serper",
      PHASE_PROGRESS_RANGES.search_serper.end,
      "추가 검색 스킵",
      onProgress,
    )

    // 2D: Google Places (55% → 65%) - 임시 비활성화
    emitProgress(
      "search_places",
      PHASE_PROGRESS_RANGES.search_places.start,
      "로컬 비즈니스 검색 스킵 (API 키 미설정)...",
      onProgress,
    )

    // TODO: API 키 설정 후 활성화
    // let placesPromise = Promise.resolve([])
    // if (shouldUseGooglePlaces(input.target, input.industry)) {
    //   placesPromise = searchWithGooglePlaces(intelligence, input.country, input.industry)
    // }
    const placesPromise = Promise.resolve([])

    emitProgress(
      "search_places",
      PHASE_PROGRESS_RANGES.search_places.end,
      "로컬 비즈니스 검색 스킵",
      onProgress,
    )

    // 모든 검색 완료 대기
    const [perplexityResults, apolloResults, serperResults, placesResults] = await Promise.all([
      perplexityPromise,
      apolloPromise,
      serperPromise,
      placesPromise,
    ])

    const rawPool = [...perplexityResults, ...apolloResults, ...serperResults, ...placesResults]

    logger.info(`[BuyerSearch] 원시 검색 결과: ${rawPool.length}개`)

    // 2E: Deduplication (65% → 70%)
    emitProgress("dedup", PHASE_PROGRESS_RANGES.dedup.start, "중복 제거 중...", onProgress)

    const uniquePool = deduplicateAndNormalize(rawPool)

    emitProgress(
      "dedup",
      PHASE_PROGRESS_RANGES.dedup.end,
      `${rawPool.length}개 → ${uniquePool.length}개 정리 완료`,
      onProgress,
    )

    // ========================================================================
    // Phase 3: Email Enrichment (70% → 85%)
    // ========================================================================
    emitProgress(
      "enrichment",
      PHASE_PROGRESS_RANGES.enrichment.start,
      "이메일 수집 및 검증 중...",
      onProgress,
    )

    const enrichedPool = await enrichWithEmails(uniquePool)

    emitProgress(
      "enrichment",
      PHASE_PROGRESS_RANGES.enrichment.end,
      `이메일 확보: ${enrichedPool.length}개`,
      onProgress,
    )

    // ========================================================================
    // Phase 4: Scoring & Ranking (85% → 92%)
    // ========================================================================
    emitProgress("scoring", PHASE_PROGRESS_RANGES.scoring.start, "적합도 평가 중...", onProgress)

    const scoredPool = await scoreAndRankCompanies(enrichedPool, intelligence, input)

    emitProgress("scoring", PHASE_PROGRESS_RANGES.scoring.end, "순위 결정 완료", onProgress)

    // ========================================================================
    // Phase 5: Finalizing (92% → 100%)
    // ========================================================================
    emitProgress(
      "finalizing",
      PHASE_PROGRESS_RANGES.finalizing.start,
      "최종 결과 정리 중...",
      onProgress,
    )

    const finalBuyers = await selectFinal30(scoredPool, input, intelligence)

    emitProgress("finalizing", PHASE_PROGRESS_RANGES.finalizing.end, "완료!", onProgress)

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
    }))

    const result: BuyerSearchResult = {
      buyers,
      metadata: {
        totalSearched: rawPool.length,
        totalWithEmail: enrichedPool.length,
        searchTimeSeconds: Math.round(searchTimeSeconds * 10) / 10,
        sources: ["perplexity", "apollo", "serper", "places"],
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
  TargetCustomer,
} from "./types"
