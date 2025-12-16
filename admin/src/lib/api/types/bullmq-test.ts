// BullMQ Test Types

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed"

export interface QueueStatus {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

export interface JobDetail {
  id: string
  name: string
  data: Record<string, unknown>
  status: JobStatus
  progress: number
  attemptsMade: number
  failedReason?: string
  returnvalue?: unknown
  timestamp: number
  processedOn?: number
  finishedOn?: number
}

export interface WorkerStatus {
  running: boolean
  concurrency: number
}

export interface HealthStatus {
  redis: "connected" | "disconnected"
  timestamp: string
}

export interface JobCounts {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface TestQueueParams {
  page?: number
  limit?: number
  status?: JobStatus | "all"
  search?: string
  sortBy?: "id" | "name" | "status" | "timestamp"
  sortOrder?: "asc" | "desc"
}

export interface TestQueueResponse {
  jobs: JobDetail[]
  counts: JobCounts
  pagination: Pagination
}

export interface AddJobRequest {
  message: string
  jobName?: string
  scheduleDelay?: number
  processingDelay?: number
  shouldFail?: boolean
  priority?: number
  attempts?: number
  customData?: Record<string, unknown>
}

export interface AddJobResponse {
  jobId: string
  name: string
  data: unknown
  opts: {
    delay?: number
    priority?: number
    attempts?: number
  }
}

export interface BulkJobRequest {
  message: string
  jobName?: string
  scheduleDelay?: number
  processingDelay?: number
  shouldFail?: boolean
  priority?: number
}

export interface BulkJobsResponse {
  count: number
  jobs: Array<{ jobId: string; name: string }>
}

export interface CleanQueueRequest {
  grace?: number
  limit?: number
}

export interface CleanQueueResponse {
  cleanedCompleted: number
  cleanedFailed: number
}

export interface JobActionResponse {
  jobId: string
  message: string
}

export interface QueueActionResponse {
  paused?: boolean
  message?: string
}
