/**
 * Lead Discovery LangGraph Builder
 * Orchestrates the lead discovery workflow with two modes:
 * - Basic (Website): Website Analysis → Buyer Recommendations → Selection → BigQuery
 * - Advanced (Direct): Mode Detection → BigQuery Params → BigQuery Execution
 */

import { END, MemorySaver, StateGraph } from "@langchain/langgraph"
import {
  createErrorContext,
  getRecoveryRecommendation,
  NODE_RETRY_POLICIES,
} from "./error-classifier"
import { leadDiscoveryLogger } from "./logger"
// Legacy BigQuery imports (commented out - kept for potential future use)
// import { executeBigQuery } from "./nodes/bigquery-executor"
// import { generateBigQueryParams } from "./nodes/bigquery-param-generator"
// import { recommendBuyers } from "./nodes/buyer-recommender"
// import { understandQuery } from "./nodes/understand-query"
// New buyer-search imports
import { executeBuyerSearch } from "./nodes/buyer-search-executor"
import { collectBuyerInfo } from "./nodes/collect-buyer-info"
import { routeMode } from "./nodes/mode-router"
import { analyzeWebsite } from "./nodes/website-analyzer"
import type { ErrorContext, LeadDiscoveryState } from "./state"
import { LeadDiscoveryStateAnnotation } from "./state"

// Node names as constants
const NODE_NAMES = {
  ROUTE_MODE: "routeMode",
  UNDERSTAND_QUERY: "understandQuery",
  ANALYZE_WEBSITE: "analyzeWebsite",
  RECOMMEND_BUYERS: "recommendBuyers",
  GENERATE_PARAMS: "generateParams",
  EXECUTE_BIGQUERY: "executeBigQuery",
  FORMAT_RESPONSE: "formatResponse",
  HANDLE_ERROR: "handleError",
  // New nodes for buyer-search flow
  COLLECT_BUYER_INFO: "collectBuyerInfo",
  EXECUTE_BUYER_SEARCH: "executeBuyerSearch",
} as const

type NodeName = (typeof NODE_NAMES)[keyof typeof NODE_NAMES]

// === Helper Nodes ===

/**
 * 중앙화된 에러 핸들링 노드
 * - 에러 타입별 복구 전략 적용
 * - 구조화된 에러 응답 생성
 * - 노드별 재시도 정책 관리
 */
async function handleError(state: LeadDiscoveryState): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  leadDiscoveryLogger.nodeStart("handleError", {
    error: state.error,
    errorContext: state.errorContext,
    retryCount: state.retryCount,
  })

  // 1. 에러 컨텍스트가 없으면 기본 에러 문자열로부터 생성
  let errorContext: ErrorContext =
    state.errorContext ||
    createErrorContext(state.error || "An unexpected error occurred", "unknown", {
      sessionId: state.sessionId,
      retryCount: state.retryCount,
    })

  // 2. 에러 타입별 처리 로직
  const processedError = await processErrorByType(errorContext, state)
  errorContext = processedError.errorContext

  // 3. 복구 권장 사항 확인
  const recovery = getRecoveryRecommendation(errorContext)

  // 4. 사용자 메시지 생성 (구조화된 정보 포함)
  const userMessage = buildErrorMessage(errorContext, recovery)

  // 5. 이미터가 있으면 에러 이벤트 발송
  if (emitter) {
    emitter.error(
      "handleError",
      JSON.stringify({
        message: errorContext.message,
        errorType: errorContext.type,
        errorCode: errorContext.code,
        recoveryStrategy: errorContext.recoveryStrategy,
        suggestedAction: errorContext.suggestedAction,
        retryable: errorContext.retryable,
      }),
    )
  }

  const duration = Date.now() - startTime
  leadDiscoveryLogger.nodeSuccess("handleError", duration, {
    errorType: errorContext.type,
    errorCode: errorContext.code,
    recoveryStrategy: errorContext.recoveryStrategy,
  })

  return {
    messages: [
      {
        role: "assistant",
        content: userMessage,
        timestamp: new Date(),
        metadata: {
          error: errorContext.message,
          errorContext: errorContext,
        },
      },
    ],
    errorContext: errorContext,
    retryCount: processedError.newRetryCount,
  }
}

/**
 * 에러 타입별 처리 로직
 * BigQuery 오류 → 쿼리 단순화 시도
 * AI 오류 → 폴백 전략 적용
 * 네트워크 오류 → 재시도 로직
 */
async function processErrorByType(
  errorContext: ErrorContext,
  state: LeadDiscoveryState,
): Promise<{ errorContext: ErrorContext; newRetryCount: number }> {
  const currentRetry = state.retryCount
  const maxRetries = NODE_RETRY_POLICIES[errorContext.node]?.maxRetries || 2

  // BigQuery 관련 에러 처리
  if (
    errorContext.type === "bigquery" ||
    errorContext.type === "bigquery_query_invalid" ||
    errorContext.type === "bigquery_no_results"
  ) {
    return handleBigQueryError(errorContext, state, currentRetry, maxRetries)
  }

  // AI 관련 에러 처리
  if (errorContext.type === "ai" || errorContext.type === "ai_parse_error") {
    return handleAIError(errorContext, state, currentRetry, maxRetries)
  }

  // 웹사이트 분석 에러 처리
  if (errorContext.type === "website_unreachable" || errorContext.type === "website_blocked") {
    return handleWebsiteError(errorContext, state)
  }

  // 네트워크/타임아웃 에러 처리
  if (errorContext.type === "network" || errorContext.type === "timeout") {
    return handleNetworkError(errorContext, currentRetry, maxRetries)
  }

  // Rate limit 에러 처리
  if (errorContext.type === "rate_limit") {
    return handleRateLimitError(errorContext, currentRetry, maxRetries)
  }

  // 세션 만료 에러
  if (errorContext.type === "session_expired") {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "restart_session",
        suggestedAction: "세션이 만료되었습니다. 새 검색을 시작해주세요.",
      },
      newRetryCount: 0,
    }
  }

  // 기타 에러
  return {
    errorContext,
    newRetryCount: currentRetry,
  }
}

/**
 * BigQuery 에러 처리
 * - 쿼리 단순화 전략 권장
 * - 검색 범위 축소 제안
 */
function handleBigQueryError(
  errorContext: ErrorContext,
  state: LeadDiscoveryState,
  currentRetry: number,
  maxRetries: number,
): { errorContext: ErrorContext; newRetryCount: number } {
  const params = state.bigQueryParams

  // 쿼리가 너무 복잡한 경우 단순화 제안
  if (errorContext.type === "bigquery_query_invalid" && params) {
    const simplificationSuggestions: string[] = []

    if (params.subIndustry) {
      simplificationSuggestions.push("하위 산업 조건 제거")
    }
    if (params.employeeRange) {
      simplificationSuggestions.push("직원 수 조건 완화")
    }
    if (params.revenueRange) {
      simplificationSuggestions.push("매출 조건 제거")
    }

    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "simplify_query",
        suggestedAction:
          simplificationSuggestions.length > 0
            ? `다음을 시도해보세요: ${simplificationSuggestions.join(", ")}`
            : "검색 조건을 단순화해주세요",
        details: {
          ...errorContext.details,
          originalParams: params,
          simplificationSuggestions,
        },
      },
      newRetryCount: currentRetry + 1,
    }
  }

  // 결과 없음 - 검색 범위 축소/확대 제안
  if (errorContext.type === "bigquery_no_results") {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "reduce_scope",
        suggestedAction: "검색 조건을 넓히거나 다른 키워드로 검색해주세요",
        details: {
          ...errorContext.details,
          hint: "industry나 country 조건을 변경해보세요",
        },
      },
      newRetryCount: currentRetry,
    }
  }

  // 일반 BigQuery 에러 - 재시도 가능
  if (currentRetry < maxRetries) {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "retry",
        suggestedAction: `재시도 중입니다 (${currentRetry + 1}/${maxRetries})`,
      },
      newRetryCount: currentRetry + 1,
    }
  }

  return {
    errorContext: {
      ...errorContext,
      recoveryStrategy: "user_intervention",
      suggestedAction: "검색 조건을 변경하고 다시 시도해주세요",
    },
    newRetryCount: currentRetry,
  }
}

/**
 * AI 에러 처리
 * - 파싱 에러 시 재시도
 * - API 에러 시 폴백
 */
function handleAIError(
  errorContext: ErrorContext,
  _state: LeadDiscoveryState,
  currentRetry: number,
  maxRetries: number,
): { errorContext: ErrorContext; newRetryCount: number } {
  // AI 파싱 에러 - 재시도로 해결 가능할 수 있음
  if (errorContext.type === "ai_parse_error" && currentRetry < maxRetries) {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "retry",
        suggestedAction: "AI 분석을 재시도합니다",
      },
      newRetryCount: currentRetry + 1,
    }
  }

  // AI API 에러 - 재시도
  if (currentRetry < maxRetries) {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "retry",
        suggestedAction: `AI 서비스 재연결 중 (${currentRetry + 1}/${maxRetries})`,
      },
      newRetryCount: currentRetry + 1,
    }
  }

  return {
    errorContext: {
      ...errorContext,
      recoveryStrategy: "user_intervention",
      suggestedAction: "검색어를 단순화하거나 다시 시도해주세요",
    },
    newRetryCount: currentRetry,
  }
}

/**
 * 웹사이트 분석 에러 처리
 * - 접근 불가 시 직접 검색 모드 제안
 * - 차단된 경우 대안 제시
 */
function handleWebsiteError(
  errorContext: ErrorContext,
  _state: LeadDiscoveryState,
): { errorContext: ErrorContext; newRetryCount: number } {
  if (errorContext.type === "website_blocked") {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "skip_step",
        suggestedAction: "이 웹사이트는 분석이 제한됩니다. 직접 검색 모드를 사용해주세요.",
        details: {
          ...errorContext.details,
          alternativeMode: "advanced",
        },
      },
      newRetryCount: 0,
    }
  }

  return {
    errorContext: {
      ...errorContext,
      recoveryStrategy: "user_intervention",
      suggestedAction: "URL을 확인하거나 직접 검색 모드를 사용해주세요",
    },
    newRetryCount: 0,
  }
}

/**
 * 네트워크/타임아웃 에러 처리
 * - 지수 백오프 재시도
 */
function handleNetworkError(
  errorContext: ErrorContext,
  currentRetry: number,
  maxRetries: number,
): { errorContext: ErrorContext; newRetryCount: number } {
  if (currentRetry < maxRetries) {
    const delayMs = 1000 * 2 ** currentRetry // 지수 백오프
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "retry",
        suggestedAction: `네트워크 재연결 중... (${Math.round(delayMs / 1000)}초 후 재시도)`,
        details: {
          ...errorContext.details,
          retryDelayMs: delayMs,
        },
      },
      newRetryCount: currentRetry + 1,
    }
  }

  return {
    errorContext: {
      ...errorContext,
      recoveryStrategy: "user_intervention",
      suggestedAction: "인터넷 연결을 확인하고 다시 시도해주세요",
    },
    newRetryCount: currentRetry,
  }
}

/**
 * Rate Limit 에러 처리
 * - 대기 시간 안내
 */
function handleRateLimitError(
  errorContext: ErrorContext,
  currentRetry: number,
  maxRetries: number,
): { errorContext: ErrorContext; newRetryCount: number } {
  // Rate limit은 일정 시간 대기 후 재시도
  const waitTimeMs = 60000 // 1분 대기

  if (currentRetry < maxRetries) {
    return {
      errorContext: {
        ...errorContext,
        recoveryStrategy: "retry",
        suggestedAction: "요청 제한에 도달했습니다. 1분 후 자동으로 재시도됩니다.",
        details: {
          ...errorContext.details,
          retryDelayMs: waitTimeMs,
        },
      },
      newRetryCount: currentRetry + 1,
    }
  }

  return {
    errorContext: {
      ...errorContext,
      recoveryStrategy: "user_intervention",
      suggestedAction: "잠시 후 다시 시도해주세요",
    },
    newRetryCount: currentRetry,
  }
}

/**
 * 사용자 친화적 에러 메시지 생성
 */
function buildErrorMessage(
  errorContext: ErrorContext,
  recovery: ReturnType<typeof getRecoveryRecommendation>,
): string {
  const parts: string[] = []

  // 1. 기본 에러 메시지
  parts.push(`❌ ${errorContext.message}`)

  // 2. 제안 행동
  if (errorContext.suggestedAction) {
    parts.push(`\n💡 ${errorContext.suggestedAction}`)
  }

  // 3. 대안 행동 (있는 경우)
  if (recovery.alternativeAction && recovery.alternativeAction !== errorContext.suggestedAction) {
    parts.push(`\n🔄 ${recovery.alternativeAction}`)
  }

  // 4. 에러 코드 (디버깅용, 작은 글씨)
  parts.push(`\n\n_오류 코드: ${errorContext.code}_`)

  return parts.join("")
}

async function formatResponse(state: LeadDiscoveryState): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  leadDiscoveryLogger.nodeStart("formatResponse", {
    resultCount: state.searchResults.length,
    totalCount: state.totalResultCount,
  })

  if (emitter) {
    emitter.nodeStart("formatResponse", "Preparing results...")
  }

  // Build response message
  let content = ""

  if (state.error) {
    content = state.error
  } else if (state.searchResults.length > 0) {
    content = `검색이 완료되었습니다.\n\n`
    content += `**검색 결과**: ${state.searchResults.length}개 / 총 ${state.totalResultCount}개\n`

    if (state.bigQueryExplanation) {
      content += `\n${state.bigQueryExplanation}\n`
    }

    if (state.selectedRecommendation) {
      content += `\n**선택된 타겟**: ${state.selectedRecommendation.country} - ${state.selectedRecommendation.industry}`
    }
  } else {
    content = "검색 결과가 없습니다. 다른 조건으로 검색해 보세요."
  }

  const assistantMessage = {
    role: "assistant" as const,
    content,
    timestamp: new Date(),
    metadata: {
      mode: state.searchMode,
      websiteUrl: state.websiteUrl,
      recommendations: state.buyerRecommendations,
      selectedRecommendation: state.selectedRecommendation,
      searchParams: state.bigQueryParams,
      resultCount: state.searchResults.length,
    },
  }

  const duration = Date.now() - startTime

  if (emitter) {
    emitter.nodeComplete("formatResponse", "Results ready", {
      resultCount: state.searchResults.length,
      totalCount: state.totalResultCount,
    })
  }

  leadDiscoveryLogger.nodeSuccess("formatResponse", duration, {
    resultCount: state.searchResults.length,
  })

  return {
    messages: [assistantMessage],
  }
}

// === Routing Functions ===

function routeAfterModeDetection(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ROUTE_MODE,
      NODE_NAMES.HANDLE_ERROR,
      "error occurred",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  if (state.isWebsiteMode && state.websiteUrl) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ROUTE_MODE,
      NODE_NAMES.ANALYZE_WEBSITE,
      `website mode - URL: ${state.websiteUrl}`,
    )
    return NODE_NAMES.ANALYZE_WEBSITE
  }

  // Advanced mode - go through collectBuyerInfo for buyer search
  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.ROUTE_MODE,
    NODE_NAMES.COLLECT_BUYER_INFO,
    "advanced mode - collecting buyer info",
  )
  return NODE_NAMES.COLLECT_BUYER_INFO
}

// Legacy BigQuery routing functions (commented out - kept for potential future use)
// function routeAfterUnderstandQuery(state: LeadDiscoveryState): NodeName {
//   if (state.error) {
//     leadDiscoveryLogger.routeDecision(
//       NODE_NAMES.UNDERSTAND_QUERY,
//       NODE_NAMES.HANDLE_ERROR,
//       "query understanding failed",
//     )
//     return NODE_NAMES.HANDLE_ERROR
//   }
//
//   // If clarification is needed, the node will interrupt
//   // After resume, we proceed to generate params
//   leadDiscoveryLogger.routeDecision(
//     NODE_NAMES.UNDERSTAND_QUERY,
//     NODE_NAMES.GENERATE_PARAMS,
//     `query understood - proceeding to param generation`,
//   )
//   return NODE_NAMES.GENERATE_PARAMS
// }

function routeAfterWebsiteAnalysis(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ANALYZE_WEBSITE,
      NODE_NAMES.HANDLE_ERROR,
      "website analysis failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  // Route to collectBuyerInfo to build BuyerSearchInput from website analysis
  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.ANALYZE_WEBSITE,
    NODE_NAMES.COLLECT_BUYER_INFO,
    `analysis complete - ${state.websiteAnalysis?.companyName || "company analyzed"}`,
  )
  return NODE_NAMES.COLLECT_BUYER_INFO
}

// function routeAfterRecommendation(state: LeadDiscoveryState): NodeName {
//   if (state.error) {
//     leadDiscoveryLogger.routeDecision(
//       NODE_NAMES.RECOMMEND_BUYERS,
//       NODE_NAMES.HANDLE_ERROR,
//       "recommendation failed or cancelled",
//     )
//     return NODE_NAMES.HANDLE_ERROR
//   }
//
//   if (state.selectedRecommendation) {
//     leadDiscoveryLogger.routeDecision(
//       NODE_NAMES.RECOMMEND_BUYERS,
//       NODE_NAMES.GENERATE_PARAMS,
//       `selected: ${state.selectedRecommendation.country} - ${state.selectedRecommendation.industry}`,
//     )
//     return NODE_NAMES.GENERATE_PARAMS
//   }
//
//   // Still waiting for selection (shouldn't reach here due to interrupt)
//   leadDiscoveryLogger.routeDecision(
//     NODE_NAMES.RECOMMEND_BUYERS,
//     NODE_NAMES.HANDLE_ERROR,
//     "no selection made",
//   )
//   return NODE_NAMES.HANDLE_ERROR
// }

// function routeAfterParamGeneration(state: LeadDiscoveryState): NodeName {
//   if (state.error) {
//     leadDiscoveryLogger.routeDecision(
//       NODE_NAMES.GENERATE_PARAMS,
//       NODE_NAMES.HANDLE_ERROR,
//       "param generation failed",
//     )
//     return NODE_NAMES.HANDLE_ERROR
//   }
//
//   leadDiscoveryLogger.routeDecision(
//     NODE_NAMES.GENERATE_PARAMS,
//     NODE_NAMES.EXECUTE_BIGQUERY,
//     `params ready - query: ${state.bigQueryParams?.query?.substring(0, 30)}...`,
//   )
//   return NODE_NAMES.EXECUTE_BIGQUERY
// }

// function routeAfterBigQuery(state: LeadDiscoveryState): NodeName {
//   if (state.error && state.searchResults.length === 0) {
//     leadDiscoveryLogger.routeDecision(
//       NODE_NAMES.EXECUTE_BIGQUERY,
//       NODE_NAMES.HANDLE_ERROR,
//       "BigQuery execution failed",
//     )
//     return NODE_NAMES.HANDLE_ERROR
//   }
//
//   leadDiscoveryLogger.routeDecision(
//     NODE_NAMES.EXECUTE_BIGQUERY,
//     NODE_NAMES.FORMAT_RESPONSE,
//     `found ${state.searchResults.length} results`,
//   )
//   return NODE_NAMES.FORMAT_RESPONSE
// }

// === New Routing Functions for Buyer Search Flow ===

function routeAfterCollectBuyerInfo(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.COLLECT_BUYER_INFO,
      NODE_NAMES.HANDLE_ERROR,
      "buyer info collection failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  // If clarification is needed, the node will interrupt
  // After resume, we proceed to execute buyer search
  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.COLLECT_BUYER_INFO,
    NODE_NAMES.EXECUTE_BUYER_SEARCH,
    `buyer info collected - proceeding to search`,
  )
  return NODE_NAMES.EXECUTE_BUYER_SEARCH
}

function routeAfterBuyerSearch(state: LeadDiscoveryState): NodeName {
  if (state.error && state.searchResults.length === 0) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.EXECUTE_BUYER_SEARCH,
      NODE_NAMES.HANDLE_ERROR,
      "buyer search failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.EXECUTE_BUYER_SEARCH,
    NODE_NAMES.FORMAT_RESPONSE,
    `found ${state.searchResults.length} buyers`,
  )
  return NODE_NAMES.FORMAT_RESPONSE
}

// === Graph Builder ===

export function createLeadDiscoveryGraph() {
  const workflow = new StateGraph(LeadDiscoveryStateAnnotation)

  // Add nodes (only nodes used in the new buyer-search flow)
  workflow.addNode(NODE_NAMES.ROUTE_MODE, routeMode)
  workflow.addNode(NODE_NAMES.ANALYZE_WEBSITE, analyzeWebsite)
  workflow.addNode(NODE_NAMES.FORMAT_RESPONSE, formatResponse)
  workflow.addNode(NODE_NAMES.HANDLE_ERROR, handleError)
  // New nodes for buyer-search flow
  workflow.addNode(NODE_NAMES.COLLECT_BUYER_INFO, collectBuyerInfo)
  workflow.addNode(NODE_NAMES.EXECUTE_BUYER_SEARCH, executeBuyerSearch)

  // Note: Legacy BigQuery nodes (understandQuery, recommendBuyers, generateParams, executeBigQuery)
  // are NOT added to the graph but their code files are preserved for potential future use.

  // Set entry point
  // @ts-expect-error - LangGraph type inference issue
  workflow.setEntryPoint(NODE_NAMES.ROUTE_MODE)

  // Add conditional edges
  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.ROUTE_MODE, routeAfterModeDetection, {
    [NODE_NAMES.ANALYZE_WEBSITE]: NODE_NAMES.ANALYZE_WEBSITE,
    [NODE_NAMES.COLLECT_BUYER_INFO]: NODE_NAMES.COLLECT_BUYER_INFO,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // Website analysis → collect buyer info
  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.ANALYZE_WEBSITE, routeAfterWebsiteAnalysis, {
    [NODE_NAMES.COLLECT_BUYER_INFO]: NODE_NAMES.COLLECT_BUYER_INFO,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // Collect buyer info → execute buyer search
  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.COLLECT_BUYER_INFO, routeAfterCollectBuyerInfo, {
    [NODE_NAMES.EXECUTE_BUYER_SEARCH]: NODE_NAMES.EXECUTE_BUYER_SEARCH,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // Execute buyer search → format response
  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.EXECUTE_BUYER_SEARCH, routeAfterBuyerSearch, {
    [NODE_NAMES.FORMAT_RESPONSE]: NODE_NAMES.FORMAT_RESPONSE,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // Terminal edges
  // @ts-expect-error - LangGraph type inference issue
  workflow.addEdge(NODE_NAMES.FORMAT_RESPONSE, END)
  // @ts-expect-error - LangGraph type inference issue
  workflow.addEdge(NODE_NAMES.HANDLE_ERROR, END)

  // Compile with checkpointer for interrupt/resume support
  return workflow.compile({
    checkpointer: getSharedCheckpointer(),
  })
}

// Singleton MemorySaver for interrupt/resume
let sharedCheckpointer: MemorySaver | null = null

export function getSharedCheckpointer(): MemorySaver {
  if (!sharedCheckpointer) {
    leadDiscoveryLogger.info("Creating new shared MemorySaver instance")
    sharedCheckpointer = new MemorySaver()
  }
  return sharedCheckpointer
}

export function clearCheckpoints(): void {
  leadDiscoveryLogger.info("Clearing all checkpoints")
  sharedCheckpointer = null
}

// Export node names for external use
export { NODE_NAMES }
