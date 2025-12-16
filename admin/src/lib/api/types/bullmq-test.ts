// BullMQ Test Types

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed"

export type QueueStatus = {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
  paused: boolean
}

export type JobDetail = {
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

export type WorkerStatus = {
  running: boolean
  concurrency: number
}

export type HealthStatus = {
  redis: "connected" | "disconnected"
  timestamp: string
}

export type JobCounts = {
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export type Pagination = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type TestQueueParams = {
  page?: number
  limit?: number
  status?: JobStatus | "all"
  search?: string
  sortBy?: "id" | "name" | "status" | "timestamp"
  sortOrder?: "asc" | "desc"
}

export type TestQueueResponse = {
  jobs: JobDetail[]
  counts: JobCounts
  pagination: Pagination
}

export type AddJobRequest = {
  message: string
  jobName?: string
  scheduleDelay?: number
  processingDelay?: number
  shouldFail?: boolean
  priority?: number
  attempts?: number
  customData?: Record<string, unknown>
}

export type AddJobResponse = {
  jobId: string
  name: string
  data: unknown
  opts: {
    delay?: number
    priority?: number
    attempts?: number
  }
}

export type BulkJobRequest = {
  message: string
  jobName?: string
  scheduleDelay?: number
  processingDelay?: number
  shouldFail?: boolean
  priority?: number
}

export type BulkJobsResponse = {
  count: number
  jobs: Array<{ jobId: string; name: string }>
}

export type CleanQueueRequest = {
  grace?: number
  limit?: number
}

export type CleanQueueResponse = {
  cleanedCompleted: number
  cleanedFailed: number
}

export type JobActionResponse = {
  jobId: string
  message: string
}

export type QueueActionResponse = {
  paused?: boolean
  message?: string
}
