/**
 * Lead Discovery Error Classifier (Backend)
 * 에러를 분석하여 적절한 에러 타입으로 분류
 */

export type LeadDiscoveryErrorType =
  | "network"
  | "timeout"
  | "session_expired"
  | "server"
  | "validation"
  | "rate_limit"
  | "bigquery"
  | "ai"
  | "unknown"

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
