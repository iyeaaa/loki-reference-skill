/**
 * Error Classifier Utility
 * 에러 메시지를 분석하여 적절한 타입으로 분류
 */

import type { LeadDiscoveryError, LeadDiscoveryErrorType } from "../types/errors"

/**
 * 에러를 분석하여 LeadDiscoveryError 객체로 변환
 */
export function classifyError(
  error: string | Error,
  context?: {
    node?: string
    sessionId?: string
  },
): LeadDiscoveryError {
  const errorMsg = typeof error === "string" ? error : error.message
  const lowerMsg = errorMsg.toLowerCase()

  // 네트워크 오류
  if (
    lowerMsg.includes("fetch") ||
    lowerMsg.includes("network") ||
    lowerMsg.includes("연결") ||
    lowerMsg.includes("connect") ||
    lowerMsg.includes("econnrefused")
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
    lowerMsg.includes("시간 초과") ||
    lowerMsg.includes("timed out")
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
    lowerMsg.includes("session") ||
    lowerMsg.includes("세션") ||
    lowerMsg.includes("만료") ||
    lowerMsg.includes("expired") ||
    (lowerMsg.includes("not found") && lowerMsg.includes("checkpoint"))
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

  // Rate Limit (API 호출 제한)
  if (lowerMsg.includes("rate") || lowerMsg.includes("limit") || lowerMsg.includes("429")) {
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

  // 서버 오류 (5xx)
  if (
    lowerMsg.includes("500") ||
    lowerMsg.includes("502") ||
    lowerMsg.includes("503") ||
    lowerMsg.includes("504") ||
    (lowerMsg.includes("서버") && lowerMsg.includes("오류"))
  ) {
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

  // BigQuery 오류
  if (
    lowerMsg.includes("bigquery") ||
    (lowerMsg.includes("검색") && lowerMsg.includes("실패")) ||
    (lowerMsg.includes("query") && lowerMsg.includes("failed"))
  ) {
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
    lowerMsg.includes("ai") ||
    lowerMsg.includes("gpt") ||
    lowerMsg.includes("openai") ||
    (lowerMsg.includes("분석") && lowerMsg.includes("실패")) ||
    lowerMsg.includes("llm")
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
  if (
    lowerMsg.includes("validation") ||
    lowerMsg.includes("invalid") ||
    lowerMsg.includes("검증") ||
    lowerMsg.includes("유효하지")
  ) {
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

  // 기본값 (알 수 없는 오류)
  return {
    type: "unknown",
    message: "알 수 없는 오류가 발생했습니다",
    originalError: errorMsg,
    retryable: true,
    recoverable: false,
    suggestedAction: "문제가 계속되면 새 검색을 시작해주세요",
    context: {
      ...context,
      timestamp: Date.now(),
    },
  }
}

/**
 * 에러 타입별 재시도 가능 여부 확인
 */
export function isRetryable(errorType: LeadDiscoveryErrorType): boolean {
  const nonRetryableTypes: LeadDiscoveryErrorType[] = ["session_expired", "validation"]
  return !nonRetryableTypes.includes(errorType)
}

/**
 * 에러 타입별 복구 가능 여부 확인
 */
export function isRecoverable(errorType: LeadDiscoveryErrorType): boolean {
  const nonRecoverableTypes: LeadDiscoveryErrorType[] = ["validation", "unknown"]
  return !nonRecoverableTypes.includes(errorType)
}
