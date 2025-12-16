/**
 * Job Log Types
 *
 * BullMQ Job 로그 관련 타입 정의
 */

// Job 상태 타입
export type JobLogStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "stalled"

// Job Log 엔티티
export interface JobLog {
  id: string
  jobId: string
  queueName: string
  jobName: string | null
  status: JobLogStatus
  attemptsMade: number
  maxAttempts: number
  priority: number | null
  addedAt: string
  processedAt: string | null
  completedAt: string | null
  failedAt: string | null
  durationMs: number | null
  delayedUntil: string | null
  inputData: Record<string, unknown> | null
  outputData: Record<string, unknown> | null
  errorMessage: string | null
  stackTrace: string | null
  errorCode: string | null
  workerName: string | null
  processedBy: string | null
  jobOptions: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

// Job Logs 검색 파라미터
export interface JobLogsSearchParams {
  page?: number
  limit?: number
  queueName?: string
  status?: JobLogStatus[]
  startDate?: string
  endDate?: string
  search?: string
  errorCode?: string
  workerName?: string
}

// Job Logs 검색 응답
export interface JobLogsSearchResponse {
  data: JobLog[]
  total: number
  limit: number
  offset: number
}

// Job Logs 통계 응답
export interface JobLogStats {
  statusCounts: {
    queueName: string
    status: JobLogStatus
    count: number
    avgDurationMs: number | null
    maxDurationMs: number | null
    minDurationMs: number | null
  }[]
  errorStats: {
    errorCode: string | null
    count: number
  }[]
  totalCounts: {
    status: JobLogStatus
    count: number
  }[]
  queueNames: string[]
  hours: number
}

// Job Logs 페이지네이션 응답 (프론트엔드 변환용)
export interface JobLogsPageResponse {
  logs: JobLog[]
  total: number
  page: number
  limit: number
  totalPages: number
}
