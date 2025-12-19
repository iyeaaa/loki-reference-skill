/**
 * Lead Discovery Error Classifier (Backend)
 * 에러를 분석하여 적절한 에러 타입으로 분류
 * 구조화된 에러 컨텍스트 생성 및 복구 전략 제공
 */

import type {
  ErrorContext,
  ErrorRecoveryStrategy,
  LeadDiscoveryErrorCode,
  LeadDiscoveryErrorType,
} from "./state"

// Re-export types from state for backward compatibility
export type { ErrorContext, LeadDiscoveryErrorCode, LeadDiscoveryErrorType } from "./state"

// Legacy error type for backward compatibility
export type LeadDiscoveryError = {
  type: LeadDiscoveryErrorType
  message: string
  originalError?: string
  retryable: boolean
  recoverable: boolean
  suggestedAction?: string
  context?: {
    node?: string
    sessionId?: string
    timestamp?: number
  }
}

// Node-specific retry policies
export const NODE_RETRY_POLICIES: Record<
  string,
  { maxRetries: number; delayMs: number; backoffMultiplier: number }
> = {
  routeMode: { maxRetries: 2, delayMs: 1000, backoffMultiplier: 1.5 },
  understandQuery: { maxRetries: 2, delayMs: 1000, backoffMultiplier: 1.5 },
  analyzeWebsite: { maxRetries: 3, delayMs: 2000, backoffMultiplier: 2 },
  recommendBuyers: { maxRetries: 2, delayMs: 1000, backoffMultiplier: 1.5 },
  generateParams: { maxRetries: 2, delayMs: 1000, backoffMultiplier: 1.5 },
  executeBigQuery: { maxRetries: 3, delayMs: 2000, backoffMultiplier: 2 },
  formatResponse: { maxRetries: 1, delayMs: 500, backoffMultiplier: 1 },
}

// Error type to recovery strategy mapping
const ERROR_RECOVERY_STRATEGIES: Record<LeadDiscoveryErrorType, ErrorRecoveryStrategy> = {
  network: "retry",
  timeout: "retry",
  session_expired: "restart_session",
  server: "retry",
  validation: "user_intervention",
  rate_limit: "retry",
  bigquery: "simplify_query",
  bigquery_query_invalid: "simplify_query",
  bigquery_quota: "retry",
  bigquery_no_results: "reduce_scope",
  ai: "retry",
  ai_parse_error: "retry",
  website_unreachable: "user_intervention",
  website_blocked: "skip_step",
  user_cancelled: "none",
  unknown: "retry",
}

// Error type to code mapping
const ERROR_TYPE_TO_CODE: Record<LeadDiscoveryErrorType, LeadDiscoveryErrorCode> = {
  network: "E_NETWORK_FAILED",
  timeout: "E_TIMEOUT",
  session_expired: "E_SESSION_EXPIRED",
  server: "E_SERVER_ERROR",
  validation: "E_VALIDATION_FAILED",
  rate_limit: "E_RATE_LIMITED",
  bigquery: "E_BIGQUERY_FAILED",
  bigquery_query_invalid: "E_BIGQUERY_INVALID_QUERY",
  bigquery_quota: "E_BIGQUERY_QUOTA_EXCEEDED",
  bigquery_no_results: "E_BIGQUERY_NO_RESULTS",
  ai: "E_AI_FAILED",
  ai_parse_error: "E_AI_PARSE_ERROR",
  website_unreachable: "E_WEBSITE_UNREACHABLE",
  website_blocked: "E_WEBSITE_BLOCKED",
  user_cancelled: "E_USER_CANCELLED",
  unknown: "E_UNKNOWN",
}

/**
 * 에러를 분석하여 LeadDiscoveryError 객체로 변환
 */
export function classifyError(
  error: unknown,
  context?: {
    node?: string
    sessionId?: string
  },
): LeadDiscoveryError {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const lowerMsg = errorMsg.toLowerCase()

  // 네트워크 오류
  if (
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("enotfound")
  ) {
    return {
      type: "network",
      message: "네트워크 연결에 문제가 발생했습니다",
      originalError: errorMsg,
      retryable: true,
      recoverable: true,
      suggestedAction: "인터넷 연결을 확인하고 다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // 타임아웃
  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("etimedout")
  ) {
    return {
      type: "timeout",
      message: "요청 시간이 초과되었습니다",
      originalError: errorMsg,
      retryable: true,
      recoverable: true,
      suggestedAction: "잠시 후 다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // 세션 만료
  if (
    lowerMsg.includes("checkpoint not found") ||
    lowerMsg.includes("session not found") ||
    lowerMsg.includes("thread not found")
  ) {
    return {
      type: "session_expired",
      message: "세션이 만료되었습니다",
      originalError: errorMsg,
      retryable: false,
      recoverable: true,
      suggestedAction: "새 검색을 시작해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // Rate Limit
  if ((lowerMsg.includes("rate") && lowerMsg.includes("limit")) || lowerMsg.includes("429")) {
    return {
      type: "rate_limit",
      message: "요청이 너무 많습니다",
      originalError: errorMsg,
      retryable: true,
      recoverable: true,
      suggestedAction: "1분 후 다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // BigQuery 오류
  if (lowerMsg.includes("bigquery") || context?.node === "bigquery_executor") {
    return {
      type: "bigquery",
      message: "리드 검색 중 오류가 발생했습니다",
      originalError: errorMsg,
      retryable: true,
      recoverable: true,
      suggestedAction: "검색 조건을 변경하거나 다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // AI 분석 오류
  if (
    lowerMsg.includes("openai") ||
    lowerMsg.includes("gpt") ||
    lowerMsg.includes("llm") ||
    lowerMsg.includes("ai") ||
    context?.node === "website_analyzer" ||
    context?.node === "buyer_recommender"
  ) {
    return {
      type: "ai",
      message: "AI 분석 중 오류가 발생했습니다",
      originalError: errorMsg,
      retryable: true,
      recoverable: true,
      suggestedAction: "다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // 입력 검증 오류
  if (lowerMsg.includes("validation") || lowerMsg.includes("invalid")) {
    return {
      type: "validation",
      message: "입력값을 확인해주세요",
      originalError: errorMsg,
      retryable: false,
      recoverable: false,
      suggestedAction: "입력 내용을 수정하고 다시 시도해주세요",
      context: {
        ...context,
        timestamp: Date.now(),
      },
    }
  }

  // 기본값 (서버 오류)
  return {
    type: "server",
    message: "서버에 일시적인 문제가 발생했습니다",
    originalError: errorMsg,
    retryable: true,
    recoverable: true,
    suggestedAction: "잠시 후 다시 시도해주세요",
    context: {
      ...context,
      timestamp: Date.now(),
    },
  }
}

/**
 * 구조화된 에러 컨텍스트 생성
 * handleError 노드에서 사용하기 위한 상세한 에러 정보 제공
 */
export function createErrorContext(
  error: unknown,
  node: string,
  options?: {
    sessionId?: string
    retryCount?: number
    details?: Record<string, unknown>
  },
): ErrorContext {
  const errorMsg = error instanceof Error ? error.message : String(error)
  const lowerMsg = errorMsg.toLowerCase()
  const retryPolicy = NODE_RETRY_POLICIES[node] || {
    maxRetries: 2,
    delayMs: 1000,
    backoffMultiplier: 1.5,
  }

  // 에러 타입 분류 (세분화된 분류)
  const errorType = classifyErrorType(errorMsg, lowerMsg, node)
  const errorCode = ERROR_TYPE_TO_CODE[errorType]
  const recoveryStrategy = ERROR_RECOVERY_STRATEGIES[errorType]

  // 노드별 맞춤 메시지 및 제안
  const { message, suggestedAction } = getNodeSpecificErrorInfo(errorType, node, errorMsg)

  return {
    type: errorType,
    code: errorCode,
    message,
    originalError: errorMsg,
    node,
    timestamp: Date.now(),
    retryable: isRetryable(errorType),
    recoverable: isRecoverable(errorType),
    maxRetries: retryPolicy.maxRetries,
    suggestedAction,
    recoveryStrategy,
    details: {
      ...options?.details,
      sessionId: options?.sessionId,
      retryCount: options?.retryCount || 0,
      retryDelayMs: retryPolicy.delayMs,
    },
  }
}

/**
 * 에러 타입 세분화 분류
 */
function classifyErrorType(
  _errorMsg: string,
  lowerMsg: string,
  node: string,
): LeadDiscoveryErrorType {
  // 네트워크 오류
  if (
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("enotfound") ||
    lowerMsg.includes("dns")
  ) {
    return "network"
  }

  // 타임아웃
  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("etimedout") ||
    lowerMsg.includes("deadline exceeded")
  ) {
    return "timeout"
  }

  // 세션 만료
  if (
    lowerMsg.includes("checkpoint not found") ||
    lowerMsg.includes("session not found") ||
    lowerMsg.includes("thread not found") ||
    lowerMsg.includes("session expired")
  ) {
    return "session_expired"
  }

  // Rate Limit
  if (
    (lowerMsg.includes("rate") && lowerMsg.includes("limit")) ||
    lowerMsg.includes("429") ||
    lowerMsg.includes("too many requests") ||
    lowerMsg.includes("quota exceeded")
  ) {
    return "rate_limit"
  }

  // BigQuery 관련 (세분화)
  if (lowerMsg.includes("bigquery") || node === "executeBigQuery" || node === "generateParams") {
    if (lowerMsg.includes("invalid") || lowerMsg.includes("syntax")) {
      return "bigquery_query_invalid"
    }
    if (lowerMsg.includes("quota") || lowerMsg.includes("exceeded")) {
      return "bigquery_quota"
    }
    if (lowerMsg.includes("no results") || lowerMsg.includes("empty")) {
      return "bigquery_no_results"
    }
    return "bigquery"
  }

  // 웹사이트 분석 관련
  if (node === "analyzeWebsite") {
    if (
      lowerMsg.includes("http 4") ||
      lowerMsg.includes("http 5") ||
      lowerMsg.includes("unreachable") ||
      lowerMsg.includes("접근할 수 없")
    ) {
      return "website_unreachable"
    }
    if (
      lowerMsg.includes("blocked") ||
      lowerMsg.includes("forbidden") ||
      lowerMsg.includes("403")
    ) {
      return "website_blocked"
    }
  }

  // AI 분석 오류 (세분화)
  if (
    lowerMsg.includes("openai") ||
    lowerMsg.includes("gpt") ||
    lowerMsg.includes("llm") ||
    lowerMsg.includes("gemini") ||
    lowerMsg.includes("anthropic") ||
    node === "recommendBuyers" ||
    node === "understandQuery"
  ) {
    if (lowerMsg.includes("parse") || lowerMsg.includes("json") || lowerMsg.includes("invalid")) {
      return "ai_parse_error"
    }
    return "ai"
  }

  // 사용자 취소
  if (
    lowerMsg.includes("cancelled") ||
    lowerMsg.includes("canceled") ||
    lowerMsg.includes("취소")
  ) {
    return "user_cancelled"
  }

  // 입력 검증 오류
  if (lowerMsg.includes("validation") || lowerMsg.includes("invalid input")) {
    return "validation"
  }

  return "unknown"
}

/**
 * 노드별 맞춤 에러 메시지 및 제안 행동 반환
 */
function getNodeSpecificErrorInfo(
  errorType: LeadDiscoveryErrorType,
  node: string,
  _originalError: string,
): { message: string; suggestedAction: string } {
  // BigQuery 노드 에러
  if (node === "executeBigQuery") {
    switch (errorType) {
      case "bigquery_query_invalid":
        return {
          message: "검색 쿼리가 잘못되었습니다",
          suggestedAction: "검색 조건을 단순화하거나 다른 키워드로 시도해주세요",
        }
      case "bigquery_quota":
        return {
          message: "검색 할당량이 초과되었습니다",
          suggestedAction: "잠시 후 다시 시도해주세요 (약 1분)",
        }
      case "bigquery_no_results":
        return {
          message: "검색 결과가 없습니다",
          suggestedAction: "검색 조건을 넓히거나 다른 키워드로 검색해주세요",
        }
      case "timeout":
        return {
          message: "검색 시간이 초과되었습니다",
          suggestedAction: "검색 범위를 좁히거나 조건을 단순화해주세요",
        }
      default:
        return {
          message: "리드 검색 중 오류가 발생했습니다",
          suggestedAction: "검색 조건을 변경하거나 다시 시도해주세요",
        }
    }
  }

  // 웹사이트 분석 노드 에러
  if (node === "analyzeWebsite") {
    switch (errorType) {
      case "website_unreachable":
        return {
          message: "웹사이트에 접근할 수 없습니다",
          suggestedAction: "URL을 확인하거나 다른 웹사이트를 입력해주세요",
        }
      case "website_blocked":
        return {
          message: "웹사이트 접근이 차단되었습니다",
          suggestedAction: "직접 검색 모드를 사용하거나 다른 웹사이트를 시도해주세요",
        }
      case "timeout":
        return {
          message: "웹사이트 분석 시간이 초과되었습니다",
          suggestedAction: "웹사이트가 느릴 수 있습니다. 다시 시도하거나 직접 검색을 사용해주세요",
        }
      default:
        return {
          message: "웹사이트 분석에 실패했습니다",
          suggestedAction: "다시 시도하거나 직접 검색 모드를 사용해주세요",
        }
    }
  }

  // AI 추천 노드 에러
  if (node === "recommendBuyers" || node === "understandQuery") {
    switch (errorType) {
      case "ai_parse_error":
        return {
          message: "AI 분석 결과를 처리할 수 없습니다",
          suggestedAction: "다시 시도해주세요. 문제가 지속되면 검색어를 단순화해주세요",
        }
      case "rate_limit":
        return {
          message: "AI 서비스 요청이 너무 많습니다",
          suggestedAction: "1분 후 다시 시도해주세요",
        }
      default:
        return {
          message: "AI 분석 중 오류가 발생했습니다",
          suggestedAction: "다시 시도해주세요",
        }
    }
  }

  // 일반 에러 타입별 메시지
  switch (errorType) {
    case "network":
      return {
        message: "네트워크 연결에 문제가 발생했습니다",
        suggestedAction: "인터넷 연결을 확인하고 다시 시도해주세요",
      }
    case "timeout":
      return {
        message: "요청 시간이 초과되었습니다",
        suggestedAction: "잠시 후 다시 시도해주세요",
      }
    case "session_expired":
      return {
        message: "세션이 만료되었습니다",
        suggestedAction: "새 검색을 시작해주세요",
      }
    case "rate_limit":
      return {
        message: "요청이 너무 많습니다",
        suggestedAction: "1분 후 다시 시도해주세요",
      }
    case "validation":
      return {
        message: "입력값을 확인해주세요",
        suggestedAction: "입력 내용을 수정하고 다시 시도해주세요",
      }
    case "user_cancelled":
      return {
        message: "사용자에 의해 취소되었습니다",
        suggestedAction: "새 검색을 시작해주세요",
      }
    default:
      return {
        message: "서버에 일시적인 문제가 발생했습니다",
        suggestedAction: "잠시 후 다시 시도해주세요",
      }
  }
}

/**
 * 재시도 가능 여부 확인
 */
function isRetryable(errorType: LeadDiscoveryErrorType): boolean {
  const nonRetryableTypes: LeadDiscoveryErrorType[] = [
    "session_expired",
    "validation",
    "user_cancelled",
    "website_blocked",
  ]
  return !nonRetryableTypes.includes(errorType)
}

/**
 * 복구 가능 여부 확인
 */
function isRecoverable(errorType: LeadDiscoveryErrorType): boolean {
  const nonRecoverableTypes: LeadDiscoveryErrorType[] = ["user_cancelled"]
  return !nonRecoverableTypes.includes(errorType)
}

/**
 * 에러 컨텍스트를 기반으로 복구 행동 실행 권장 사항 반환
 */
export function getRecoveryRecommendation(errorContext: ErrorContext): {
  shouldRetry: boolean
  retryDelay: number
  alternativeAction?: string
} {
  const { recoveryStrategy, retryable, maxRetries, details } = errorContext
  const currentRetry = (details?.retryCount as number) || 0
  const retryDelayMs = (details?.retryDelayMs as number) || 1000

  switch (recoveryStrategy) {
    case "retry":
      return {
        shouldRetry: retryable && currentRetry < maxRetries,
        retryDelay: retryDelayMs * 1.5 ** currentRetry,
      }

    case "simplify_query":
      return {
        shouldRetry: currentRetry < 1, // 쿼리 단순화는 한 번만 시도
        retryDelay: 0,
        alternativeAction: "검색 조건을 단순화하여 재시도",
      }

    case "fallback_source":
      return {
        shouldRetry: true,
        retryDelay: 0,
        alternativeAction: "대체 데이터 소스로 검색 시도",
      }

    case "reduce_scope":
      return {
        shouldRetry: true,
        retryDelay: 0,
        alternativeAction: "검색 범위를 축소하여 재시도",
      }

    case "restart_session":
      return {
        shouldRetry: false,
        retryDelay: 0,
        alternativeAction: "새 세션을 시작해주세요",
      }

    case "user_intervention":
      return {
        shouldRetry: false,
        retryDelay: 0,
        alternativeAction: "사용자 입력이 필요합니다",
      }

    case "skip_step":
      return {
        shouldRetry: false,
        retryDelay: 0,
        alternativeAction: "이 단계를 건너뛰고 계속 진행",
      }

    default:
      return {
        shouldRetry: false,
        retryDelay: 0,
      }
  }
}
