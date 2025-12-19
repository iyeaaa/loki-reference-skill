/**
 * Lead Discovery Error Types
 * 에러 타입 정의 및 분류 체계
 * 백엔드(elysia-server/src/services/lead-discovery/error-classifier.ts)와 동기화
 */

// 기본 에러 타입
export type LeadDiscoveryErrorType =
  | "network" // 네트워크 연결 오류
  | "timeout" // 요청 타임아웃
  | "session_expired" // 세션 만료
  | "server" // 서버 오류 (5xx)
  | "validation" // 입력 검증 오류
  | "rate_limit" // API 호출 제한
  // BigQuery 관련 (세분화)
  | "bigquery" // 일반 BigQuery 오류
  | "bigquery_query_invalid" // 쿼리 문법 오류
  | "bigquery_quota" // 할당량 초과
  | "bigquery_no_results" // 결과 없음
  // AI 관련 (세분화)
  | "ai" // 일반 AI 오류
  | "ai_parse_error" // AI 응답 파싱 오류
  // 웹사이트 분석 관련
  | "website_unreachable" // 웹사이트 접근 불가
  | "website_blocked" // 웹사이트 차단됨
  // 기타
  | "user_cancelled" // 사용자 취소
  | "unknown" // 알 수 없는 오류

// 에러 코드 (백엔드와 동기화)
export type LeadDiscoveryErrorCode =
  | "E_NETWORK_FAILED"
  | "E_TIMEOUT"
  | "E_SESSION_EXPIRED"
  | "E_SERVER_ERROR"
  | "E_VALIDATION_FAILED"
  | "E_RATE_LIMITED"
  | "E_BIGQUERY_FAILED"
  | "E_BIGQUERY_INVALID_QUERY"
  | "E_BIGQUERY_QUOTA_EXCEEDED"
  | "E_BIGQUERY_NO_RESULTS"
  | "E_AI_FAILED"
  | "E_AI_PARSE_ERROR"
  | "E_WEBSITE_UNREACHABLE"
  | "E_WEBSITE_BLOCKED"
  | "E_USER_CANCELLED"
  | "E_UNKNOWN"

// 복구 전략 타입
export type ErrorRecoveryStrategy =
  | "retry" // 재시도
  | "simplify_query" // 쿼리 단순화
  | "fallback_source" // 대체 소스 사용
  | "reduce_scope" // 검색 범위 축소
  | "restart_session" // 세션 재시작
  | "user_intervention" // 사용자 개입 필요
  | "skip_step" // 단계 건너뛰기
  | "none" // 복구 불가

// 기본 에러 객체
export type LeadDiscoveryError = {
  type: LeadDiscoveryErrorType
  code?: LeadDiscoveryErrorCode
  message: string
  originalError?: string
  retryable: boolean
  recoverable: boolean
  suggestedAction?: string
  recoveryStrategy?: ErrorRecoveryStrategy
  context?: ErrorContext
}

// 에러 컨텍스트 (상세 정보)
export type ErrorContext = {
  node?: string // 에러 발생 노드
  sessionId?: string // 세션 ID
  timestamp?: number // 발생 시간
  retryCount?: number // 재시도 횟수
  maxRetries?: number // 최대 재시도 횟수
  details?: Record<string, unknown> // 추가 정보
}

// 백엔드에서 받은 구조화된 에러 응답
export type StructuredErrorResponse = {
  type: LeadDiscoveryErrorType
  code?: LeadDiscoveryErrorCode
  message: string
  errorType?: LeadDiscoveryErrorType // SSE 이벤트 호환용
  errorCode?: LeadDiscoveryErrorCode // SSE 이벤트 호환용
  originalError?: string
  recoveryStrategy?: ErrorRecoveryStrategy
  suggestedAction?: string
  retryable?: boolean
  recoverable?: boolean
  context?: ErrorContext
}

// 에러 타입별 기본 정보
export const ERROR_TYPE_INFO: Record<
  LeadDiscoveryErrorType,
  {
    message: string
    retryable: boolean
    recoverable: boolean
    code: LeadDiscoveryErrorCode
    recoveryStrategy: ErrorRecoveryStrategy
  }
> = {
  network: {
    message: "네트워크 연결에 문제가 발생했습니다",
    retryable: true,
    recoverable: true,
    code: "E_NETWORK_FAILED",
    recoveryStrategy: "retry",
  },
  timeout: {
    message: "요청 시간이 초과되었습니다",
    retryable: true,
    recoverable: true,
    code: "E_TIMEOUT",
    recoveryStrategy: "retry",
  },
  session_expired: {
    message: "세션이 만료되었습니다",
    retryable: false,
    recoverable: true,
    code: "E_SESSION_EXPIRED",
    recoveryStrategy: "restart_session",
  },
  server: {
    message: "서버에 일시적인 문제가 발생했습니다",
    retryable: true,
    recoverable: true,
    code: "E_SERVER_ERROR",
    recoveryStrategy: "retry",
  },
  validation: {
    message: "입력값을 확인해주세요",
    retryable: false,
    recoverable: false,
    code: "E_VALIDATION_FAILED",
    recoveryStrategy: "user_intervention",
  },
  rate_limit: {
    message: "요청이 너무 많습니다",
    retryable: true,
    recoverable: true,
    code: "E_RATE_LIMITED",
    recoveryStrategy: "retry",
  },
  bigquery: {
    message: "리드 검색 중 오류가 발생했습니다",
    retryable: true,
    recoverable: true,
    code: "E_BIGQUERY_FAILED",
    recoveryStrategy: "simplify_query",
  },
  bigquery_query_invalid: {
    message: "검색 쿼리가 잘못되었습니다",
    retryable: false,
    recoverable: true,
    code: "E_BIGQUERY_INVALID_QUERY",
    recoveryStrategy: "simplify_query",
  },
  bigquery_quota: {
    message: "검색 할당량이 초과되었습니다",
    retryable: true,
    recoverable: true,
    code: "E_BIGQUERY_QUOTA_EXCEEDED",
    recoveryStrategy: "retry",
  },
  bigquery_no_results: {
    message: "검색 결과가 없습니다",
    retryable: false,
    recoverable: true,
    code: "E_BIGQUERY_NO_RESULTS",
    recoveryStrategy: "reduce_scope",
  },
  ai: {
    message: "AI 분석 중 오류가 발생했습니다",
    retryable: true,
    recoverable: true,
    code: "E_AI_FAILED",
    recoveryStrategy: "retry",
  },
  ai_parse_error: {
    message: "AI 분석 결과를 처리할 수 없습니다",
    retryable: true,
    recoverable: true,
    code: "E_AI_PARSE_ERROR",
    recoveryStrategy: "retry",
  },
  website_unreachable: {
    message: "웹사이트에 접근할 수 없습니다",
    retryable: true,
    recoverable: true,
    code: "E_WEBSITE_UNREACHABLE",
    recoveryStrategy: "user_intervention",
  },
  website_blocked: {
    message: "웹사이트 접근이 차단되었습니다",
    retryable: false,
    recoverable: true,
    code: "E_WEBSITE_BLOCKED",
    recoveryStrategy: "skip_step",
  },
  user_cancelled: {
    message: "사용자에 의해 취소되었습니다",
    retryable: false,
    recoverable: false,
    code: "E_USER_CANCELLED",
    recoveryStrategy: "none",
  },
  unknown: {
    message: "알 수 없는 오류가 발생했습니다",
    retryable: true,
    recoverable: false,
    code: "E_UNKNOWN",
    recoveryStrategy: "retry",
  },
}

// 에러 타입별 제안 행동
export const ERROR_SUGGESTED_ACTIONS: Record<LeadDiscoveryErrorType, string> = {
  network: "인터넷 연결을 확인하고 다시 시도해주세요",
  timeout: "잠시 후 다시 시도해주세요",
  session_expired: "새 검색을 시작해주세요",
  server: "잠시 후 다시 시도해주세요",
  validation: "입력 내용을 수정하고 다시 시도해주세요",
  rate_limit: "1분 후 다시 시도해주세요",
  bigquery: "검색 조건을 변경하거나 다시 시도해주세요",
  bigquery_query_invalid: "검색 조건을 단순화하거나 다른 키워드로 시도해주세요",
  bigquery_quota: "잠시 후 다시 시도해주세요 (약 1분)",
  bigquery_no_results: "검색 조건을 넓히거나 다른 키워드로 검색해주세요",
  ai: "다시 시도해주세요",
  ai_parse_error: "다시 시도해주세요. 문제가 지속되면 검색어를 단순화해주세요",
  website_unreachable: "URL을 확인하거나 다른 웹사이트를 입력해주세요",
  website_blocked: "직접 검색 모드를 사용하거나 다른 웹사이트를 시도해주세요",
  user_cancelled: "새 검색을 시작해주세요",
  unknown: "문제가 계속되면 새 검색을 시작해주세요",
}

/**
 * 백엔드 에러 응답을 LeadDiscoveryError로 변환
 */
export function parseErrorResponse(response: StructuredErrorResponse): LeadDiscoveryError {
  const errorType = response.type || response.errorType || "unknown"
  const errorInfo = ERROR_TYPE_INFO[errorType]

  return {
    type: errorType,
    code: response.code || response.errorCode || errorInfo.code,
    message: response.message || errorInfo.message,
    originalError: response.originalError,
    retryable: response.retryable ?? errorInfo.retryable,
    recoverable: response.recoverable ?? errorInfo.recoverable,
    suggestedAction: response.suggestedAction || ERROR_SUGGESTED_ACTIONS[errorType],
    recoveryStrategy: response.recoveryStrategy || errorInfo.recoveryStrategy,
    context: response.context,
  }
}

/**
 * 에러 재시도 가능 여부 확인
 */
export function isErrorRetryable(error: LeadDiscoveryError): boolean {
  return error.retryable && error.recoveryStrategy !== "none"
}

/**
 * 에러 복구 가능 여부 확인
 */
export function isErrorRecoverable(error: LeadDiscoveryError): boolean {
  return error.recoverable && error.recoveryStrategy !== "none"
}

/**
 * 에러 복구 전략에 따른 재시도 지연 시간 계산
 */
export function getRetryDelay(error: LeadDiscoveryError, currentRetry = 0): number {
  if (!error.retryable) {
    return 0
  }

  const baseDelay = error.type === "rate_limit" ? 60_000 : 1000 // rate_limit은 1분, 나머지는 1초
  const maxDelay = 30_000 // 최대 30초
  const backoffMultiplier = 1.5

  return Math.min(baseDelay * backoffMultiplier ** currentRetry, maxDelay)
}
