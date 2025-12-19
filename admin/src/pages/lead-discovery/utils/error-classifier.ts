/**
 * Error Classifier Utility
 * 에러 메시지를 분석하여 적절한 타입으로 분류
 * 백엔드(elysia-server/src/services/lead-discovery/error-classifier.ts)와 동기화
 */

import {
  ERROR_SUGGESTED_ACTIONS,
  ERROR_TYPE_INFO,
  type ErrorContext,
  type ErrorRecoveryStrategy,
  getRetryDelay,
  isErrorRecoverable,
  isErrorRetryable,
  type LeadDiscoveryError,
  type LeadDiscoveryErrorCode,
  type LeadDiscoveryErrorType,
  parseErrorResponse,
  type StructuredErrorResponse,
} from "../types/errors"

// Re-export types for convenience
export type {
  ErrorContext,
  ErrorRecoveryStrategy,
  LeadDiscoveryError,
  LeadDiscoveryErrorCode,
  LeadDiscoveryErrorType,
  StructuredErrorResponse,
}

// Re-export utilities
export { getRetryDelay, isErrorRecoverable, isErrorRetryable, parseErrorResponse }

/**
 * 에러를 분석하여 LeadDiscoveryError 객체로 변환
 * 백엔드에서 구조화된 에러가 오면 그대로 사용, 아니면 메시지 기반 분류
 */
export function classifyError(
  error: string | Error | StructuredErrorResponse,
  context?: {
    node?: string
    sessionId?: string
  },
): LeadDiscoveryError {
  // 백엔드에서 구조화된 에러 응답이 온 경우
  if (
    typeof error === "object" &&
    "type" in error &&
    !("message" in error && error instanceof Error)
  ) {
    return parseErrorResponse(error as StructuredErrorResponse)
  }

  // 문자열 또는 Error 객체인 경우 분류
  const errorMsg = typeof error === "string" ? error : error.message
  const lowerMsg = errorMsg.toLowerCase()

  // 에러 타입 분류
  const errorType = classifyErrorType(lowerMsg, context?.node)
  const errorInfo = ERROR_TYPE_INFO[errorType]

  return {
    type: errorType,
    code: errorInfo.code,
    message: errorInfo.message,
    originalError: errorMsg,
    retryable: errorInfo.retryable,
    recoverable: errorInfo.recoverable,
    suggestedAction: ERROR_SUGGESTED_ACTIONS[errorType],
    recoveryStrategy: errorInfo.recoveryStrategy,
    context: {
      ...context,
      timestamp: Date.now(),
    },
  }
}

/**
 * 에러 타입 세분화 분류
 */
function classifyErrorType(lowerMsg: string, node?: string): LeadDiscoveryErrorType {
  // 네트워크 오류
  if (
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("연결") ||
    lowerMsg.includes("connect") ||
    lowerMsg.includes("econnrefused") ||
    lowerMsg.includes("enotfound") ||
    lowerMsg.includes("dns")
  ) {
    return "network"
  }

  // 타임아웃
  if (
    lowerMsg.includes("timeout") ||
    lowerMsg.includes("시간 초과") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("etimedout") ||
    lowerMsg.includes("deadline exceeded")
  ) {
    return "timeout"
  }

  // 세션 만료
  if (
    lowerMsg.includes("session") ||
    lowerMsg.includes("세션") ||
    lowerMsg.includes("만료") ||
    lowerMsg.includes("expired") ||
    lowerMsg.includes("checkpoint not found") ||
    lowerMsg.includes("thread not found")
  ) {
    return "session_expired"
  }

  // Rate Limit (API 호출 제한)
  if (
    (lowerMsg.includes("rate") && lowerMsg.includes("limit")) ||
    lowerMsg.includes("429") ||
    lowerMsg.includes("too many requests") ||
    lowerMsg.includes("quota exceeded")
  ) {
    return "rate_limit"
  }

  // BigQuery 오류 (세분화)
  if (
    lowerMsg.includes("bigquery") ||
    node === "executeBigQuery" ||
    node === "generateParams" ||
    (lowerMsg.includes("검색") && lowerMsg.includes("실패"))
  ) {
    if (lowerMsg.includes("invalid") || lowerMsg.includes("syntax")) {
      return "bigquery_query_invalid"
    }
    if (
      lowerMsg.includes("quota") ||
      lowerMsg.includes("exceeded") ||
      lowerMsg.includes("할당량")
    ) {
      return "bigquery_quota"
    }
    if (
      lowerMsg.includes("no results") ||
      lowerMsg.includes("empty") ||
      lowerMsg.includes("결과 없")
    ) {
      return "bigquery_no_results"
    }
    return "bigquery"
  }

  // 웹사이트 분석 오류
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
    lowerMsg.includes("ai") ||
    lowerMsg.includes("gpt") ||
    lowerMsg.includes("openai") ||
    lowerMsg.includes("llm") ||
    lowerMsg.includes("gemini") ||
    (lowerMsg.includes("분석") && lowerMsg.includes("실패")) ||
    node === "recommendBuyers" ||
    node === "understandQuery"
  ) {
    if (
      lowerMsg.includes("parse") ||
      lowerMsg.includes("json") ||
      lowerMsg.includes("invalid response")
    ) {
      return "ai_parse_error"
    }
    return "ai"
  }

  // 사용자 취소
  if (
    lowerMsg.includes("cancelled") ||
    lowerMsg.includes("canceled") ||
    lowerMsg.includes("취소") ||
    lowerMsg.includes("aborted")
  ) {
    return "user_cancelled"
  }

  // 서버 오류 (5xx)
  if (
    lowerMsg.includes("500") ||
    lowerMsg.includes("502") ||
    lowerMsg.includes("503") ||
    lowerMsg.includes("504") ||
    (lowerMsg.includes("서버") && lowerMsg.includes("오류"))
  ) {
    return "server"
  }

  // 입력 검증 오류
  if (
    lowerMsg.includes("validation") ||
    lowerMsg.includes("invalid") ||
    lowerMsg.includes("검증") ||
    lowerMsg.includes("유효하지")
  ) {
    return "validation"
  }

  // 기본값 (알 수 없는 오류)
  return "unknown"
}

/**
 * 에러 타입별 재시도 가능 여부 확인 (레거시 호환)
 * @deprecated isErrorRetryable 사용 권장
 */
export function isRetryable(errorType: LeadDiscoveryErrorType): boolean {
  const info = ERROR_TYPE_INFO[errorType]
  return info?.retryable ?? false
}

/**
 * 에러 타입별 복구 가능 여부 확인 (레거시 호환)
 * @deprecated isErrorRecoverable 사용 권장
 */
export function isRecoverable(errorType: LeadDiscoveryErrorType): boolean {
  const info = ERROR_TYPE_INFO[errorType]
  return info?.recoverable ?? false
}

/**
 * 에러 코드로 에러 타입 조회
 */
export function getErrorTypeByCode(code: LeadDiscoveryErrorCode): LeadDiscoveryErrorType | null {
  for (const [type, info] of Object.entries(ERROR_TYPE_INFO)) {
    if (info.code === code) {
      return type as LeadDiscoveryErrorType
    }
  }
  return null
}

/**
 * 에러에서 복구 권장 사항 추출
 */
export function getErrorRecoveryInfo(error: LeadDiscoveryError): {
  shouldRetry: boolean
  retryDelay: number
  alternativeAction?: string
} {
  const retryCount = error.context?.retryCount || 0
  const maxRetries = error.context?.maxRetries || 3

  if (!error.retryable || retryCount >= maxRetries) {
    return {
      shouldRetry: false,
      retryDelay: 0,
      alternativeAction: error.suggestedAction,
    }
  }

  switch (error.recoveryStrategy) {
    case "retry":
      return {
        shouldRetry: true,
        retryDelay: getRetryDelay(error, retryCount),
      }

    case "simplify_query":
      return {
        shouldRetry: retryCount < 1,
        retryDelay: 0,
        alternativeAction: "검색 조건을 단순화하여 재시도",
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
        alternativeAction: error.suggestedAction || "사용자 입력이 필요합니다",
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
        alternativeAction: error.suggestedAction,
      }
  }
}
