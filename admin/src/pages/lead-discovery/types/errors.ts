/**
 * Lead Discovery Error Types
 * 에러 타입 정의 및 분류 체계
 */

export type LeadDiscoveryErrorType =
  | "network" // 네트워크 연결 오류
  | "timeout" // 요청 타임아웃
  | "session_expired" // 세션 만료
  | "server" // 서버 오류 (5xx)
  | "validation" // 입력 검증 오류
  | "rate_limit" // API 호출 제한
  | "bigquery" // BigQuery 실행 오류
  | "ai" // AI 분석 오류
  | "unknown" // 알 수 없는 오류

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
