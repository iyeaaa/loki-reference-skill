/**
 * Execute Buyer Search Node
 * Calls the searchBuyers service and converts results to lead-discovery format
 */

import { searchBuyers } from "../../buyer-search"
import type { BuyerSearchInput, BuyerSearchResult } from "../../buyer-search/types"
import { createErrorContext } from "../error-classifier"
import { leadDiscoveryLogger } from "../logger"
import type { BigQueryResult, LeadDiscoveryState } from "../state"

/**
 * Convert BuyerSearchResult to BigQueryResult[] for compatibility with existing UI
 */
function buyersToSearchResults(result: BuyerSearchResult): BigQueryResult[] {
  return result.buyers.map((buyer) => ({
    companyName: buyer.companyName,
    webAddress: buyer.website,
    description: buyer.description,
    fitScore: buyer.score,
    country: buyer.country,
    category: buyer.industry,
    mainIndustry: buyer.industry,
    subIndustry: undefined,
    email: buyer.email,
    phone: undefined,
    employee: buyer.size,
    revenue: undefined,
    source: "perplexity" as const, // buyer-search primarily uses AI sources
  }))
}

/**
 * Execute Buyer Search Node
 * Main entry point for calling searchBuyers service
 */
export async function executeBuyerSearch(
  state: LeadDiscoveryState,
): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter
  const locale = state.locale || "ko"

  leadDiscoveryLogger.info(`[executeBuyerSearch] 시작`)
  leadDiscoveryLogger.nodeStart("executeBuyerSearch", {
    buyerSearchInput: state.buyerSearchInput,
    sessionId: state.sessionId,
  })

  if (emitter) {
    emitter.nodeStart(
      "executeBuyerSearch",
      locale === "ko" ? "바이어 검색을 시작합니다" : "Starting buyer search",
    )
    emitter.thinking("executeBuyerSearch", {
      summary: locale === "ko" ? "AI 바이어 검색을 시작합니다" : "Starting AI buyer search",
      detail:
        locale === "ko"
          ? `**검색 조건**\n- 국가: ${state.buyerSearchInput?.country?.join(", ") || "전체"}\n- 설명: ${state.buyerSearchInput?.companyDescription || "-"}\n- 산업: ${state.buyerSearchInput?.industry || "-"}\n\nPerplexity + Gemini AI 엔진으로 바이어를 검색합니다.`
          : `**Search Criteria**\n- Country: ${state.buyerSearchInput?.country?.join(", ") || "All"}\n- Description: ${state.buyerSearchInput?.companyDescription || "-"}\n- Industry: ${state.buyerSearchInput?.industry || "-"}\n\nSearching buyers using Perplexity + Gemini AI engines.`,
      isStreaming: true,
    })
  }

  try {
    // Validate input
    if (!state.buyerSearchInput) {
      throw new Error("buyerSearchInput is not defined")
    }

    const input = state.buyerSearchInput as BuyerSearchInput

    // Validate required fields
    if (!input.country || input.country.length === 0) {
      throw new Error("country is required but not provided")
    }
    if (!input.companyDescription) {
      throw new Error("companyDescription is required but not provided")
    }

    leadDiscoveryLogger.info(
      `[executeBuyerSearch] 검색 조건: 국가=${input.country.join(", ")}, 설명=${input.companyDescription}`,
    )

    // Call searchBuyers with progress callback
    const result = await searchBuyers(input, (progress) => {
      // Log progress
      leadDiscoveryLogger.info(
        `[executeBuyerSearch] 진행률: ${progress.progress}% - ${progress.messageKr || progress.message}`,
      )

      // Update state progress
      const progressPercent = progress.progress

      // Send SSE progress event
      if (emitter) {
        emitter.progress(
          "executeBuyerSearch",
          progress.messageKr || progress.message,
          progressPercent,
        )

        // Send thinking event for major progress milestones
        if (progress.progress === 10 || progress.progress === 30 || progress.progress === 60) {
          emitter.thinking("executeBuyerSearch", {
            summary: progress.messageKr || progress.message,
            detail: progress.reasoning
              ? locale === "ko"
                ? `**진행 상황**\n${progress.reasoning.stepKr}\n\n${progress.reasoning.detailsKr || ""}`
                : `**Progress**\n${progress.reasoning.step}\n\n${progress.reasoning.details || ""}`
              : locale === "ko"
                ? `**검색 진행 중** (${progressPercent}%)\n\n${progress.messageKr || progress.message}`
                : `**Searching** (${progressPercent}%)\n\n${progress.message}`,
            isStreaming: true,
          })
        }

        // Send reasoning details if available
        if (progress.reasoning) {
          emitter.progress(
            "executeBuyerSearch",
            locale === "ko" ? progress.reasoning.stepKr : progress.reasoning.step,
            progressPercent,
          )
        }

        // 실시간 scored company 전송 비활성화 - 로딩 스피너만 표시
        // if (progress.scoredCompany) {
        //   emitter.results(
        //     [
        //       {
        //         companyName: progress.scoredCompany.companyName,
        //         country: progress.scoredCompany.country,
        //         email: progress.scoredCompany.email,
        //         description: progress.scoredCompany.description,
        //         fitScore: progress.scoredCompany.score,
        //       } as BigQueryResult,
        //     ],
        //     1,
        //     { type: "scored_company" },
        //   )
        // }
      }
    })

    const duration = Date.now() - startTime

    leadDiscoveryLogger.info(
      `[executeBuyerSearch] 완료: ${result.buyers.length}개 바이어 발견 (${duration}ms)`,
    )
    leadDiscoveryLogger.nodeSuccess("executeBuyerSearch", duration, {
      buyerCount: result.buyers.length,
      totalSearched: result.metadata.totalSearched,
      totalWithEmail: result.metadata.totalWithEmail,
    })

    // Convert to BigQueryResult format for compatibility
    const searchResults = buyersToSearchResults(result)

    if (emitter) {
      // Send thinking event with final summary
      emitter.thinking("executeBuyerSearch", {
        summary:
          locale === "ko"
            ? `${result.metadata.totalSearched}개 잠재 바이어 중 ${result.buyers.length}개를 엄선합니다`
            : `Selecting ${result.buyers.length} from ${result.metadata.totalSearched} potential buyers`,
        detail:
          locale === "ko"
            ? `**검색 결과 요약**\n- 검색된 바이어: ${result.metadata.totalSearched}개\n- 이메일 있는 바이어: ${result.metadata.totalWithEmail}개\n- 최종 선별: ${result.buyers.length}개\n\n> 💡 AI가 적합도를 분석하여 최적의 바이어를 선별했습니다.`
            : `**Search Results Summary**\n- Total searched: ${result.metadata.totalSearched}\n- With email: ${result.metadata.totalWithEmail}\n- Final selection: ${result.buyers.length}\n\n> 💡 AI analyzed fit scores to select the best buyers.`,
        isStreaming: false,
      })

      emitter.nodeComplete(
        "executeBuyerSearch",
        locale === "ko"
          ? `${result.buyers.length}개의 적합한 바이어를 찾았어요`
          : `Found ${result.buyers.length} qualified buyers`,
        {
          resultCount: result.buyers.length,
          totalSearched: result.metadata.totalSearched,
        },
      )

      // Send all results
      if (searchResults.length > 0) {
        emitter.results(searchResults, searchResults.length, { type: "final_results" })
      }
    }

    return {
      buyerSearchResult: result,
      buyerSearchProgress: 100,
      searchResults,
      totalResultCount: result.buyers.length,
      executionTime: duration,
      hasMore: false, // buyer-search returns all results at once
      totalAvailable: result.buyers.length,
    }
  } catch (error) {
    const duration = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    // Create structured error context
    const errorContext = createErrorContext(error, "executeBuyerSearch", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
      details: {
        buyerSearchInput: state.buyerSearchInput,
        executionTimeMs: duration,
      },
    })

    leadDiscoveryLogger.error(`[executeBuyerSearch] 오류 발생: ${errorMessage}`)
    leadDiscoveryLogger.nodeError("executeBuyerSearch", errorMessage, duration)

    if (emitter) {
      emitter.error(
        "executeBuyerSearch",
        locale === "ko"
          ? `바이어 검색 중 문제가 발생했어요: ${errorMessage}`
          : `Error during buyer search: ${errorMessage}`,
      )
    }

    return {
      error: errorContext.message,
      errorContext,
      searchResults: [],
      totalResultCount: 0,
      executionTime: duration,
    }
  }
}
