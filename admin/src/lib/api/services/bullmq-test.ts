import { apiFetch } from "../client"
import type {
  AddJobRequest,
  AddJobResponse,
  BulkJobRequest,
  BulkJobsResponse,
  CleanQueueRequest,
  CleanQueueResponse,
  HealthStatus,
  JobActionResponse,
  JobDetail,
  QueueActionResponse,
  QueueStatus,
  TestQueueParams,
  TestQueueResponse,
  WorkerStatus,
} from "../types/bullmq-test"

const BASE_PATH = "/api/v1/bullmq-test"

// Helper to unwrap nested data response
// API returns { success, data: { ... } } and apiFetch extracts first data
// But our routes return { success, data: { ... } } too, causing double wrap
function unwrapData<T>(response: unknown): T {
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: T }).data
  }
  return response as T
}

export const bullmqTestApi = {
  // Health check
  async getHealth(): Promise<HealthStatus> {
    const result = await apiFetch<{ data: HealthStatus } | HealthStatus>(`${BASE_PATH}/health`)
    return unwrapData(result)
  },

  // Get all queue statuses
  async getQueues(): Promise<Record<string, QueueStatus>> {
    const result = await apiFetch<
      { data: Record<string, QueueStatus> } | Record<string, QueueStatus>
    >(`${BASE_PATH}/queues`)
    return unwrapData(result)
  },

  // Get test queue details with pagination and filters
  async getTestQueue(params?: TestQueueParams): Promise<TestQueueResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) searchParams.set("page", params.page.toString())
    if (params?.limit) searchParams.set("limit", params.limit.toString())
    if (params?.status && params.status !== "all") searchParams.set("status", params.status)
    if (params?.search) searchParams.set("search", params.search)
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy)
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder)

    const queryString = searchParams.toString()
    const url = `${BASE_PATH}/queues/test${queryString ? `?${queryString}` : ""}`

    const result = await apiFetch<{ data: TestQueueResponse } | TestQueueResponse>(url)
    return unwrapData(result)
  },

  // Add a single job
  async addJob(data: AddJobRequest): Promise<AddJobResponse> {
    const result = await apiFetch<{ data: AddJobResponse } | AddJobResponse>(`${BASE_PATH}/jobs`, {
      method: "POST",
      body: JSON.stringify(data),
    })
    return unwrapData(result)
  },

  // Add multiple jobs
  async addBulkJobs(jobs: BulkJobRequest[]): Promise<BulkJobsResponse> {
    const result = await apiFetch<{ data: BulkJobsResponse } | BulkJobsResponse>(
      `${BASE_PATH}/jobs/bulk`,
      {
        method: "POST",
        body: JSON.stringify({ jobs }),
      },
    )
    return unwrapData(result)
  },

  // Get a specific job
  async getJob(jobId: string): Promise<JobDetail> {
    const result = await apiFetch<{ data: JobDetail } | JobDetail>(`${BASE_PATH}/jobs/${jobId}`)
    return unwrapData(result)
  },

  // Retry a failed job
  async retryJob(jobId: string): Promise<JobActionResponse> {
    const result = await apiFetch<{ data: JobActionResponse } | JobActionResponse>(
      `${BASE_PATH}/jobs/${jobId}/retry`,
      { method: "POST" },
    )
    return unwrapData(result)
  },

  // Remove a job
  async removeJob(jobId: string): Promise<JobActionResponse> {
    const result = await apiFetch<{ data: JobActionResponse } | JobActionResponse>(
      `${BASE_PATH}/jobs/${jobId}`,
      { method: "DELETE" },
    )
    return unwrapData(result)
  },

  // Clean old jobs
  async cleanQueue(data?: CleanQueueRequest): Promise<CleanQueueResponse> {
    const result = await apiFetch<{ data: CleanQueueResponse } | CleanQueueResponse>(
      `${BASE_PATH}/queues/test/clean`,
      {
        method: "POST",
        body: JSON.stringify(data ?? { grace: 0, limit: 100 }),
      },
    )
    return unwrapData(result)
  },

  // Pause queue
  async pauseQueue(): Promise<QueueActionResponse> {
    const result = await apiFetch<{ data: QueueActionResponse } | QueueActionResponse>(
      `${BASE_PATH}/queues/test/pause`,
      { method: "POST" },
    )
    return unwrapData(result)
  },

  // Resume queue
  async resumeQueue(): Promise<QueueActionResponse> {
    const result = await apiFetch<{ data: QueueActionResponse } | QueueActionResponse>(
      `${BASE_PATH}/queues/test/resume`,
      { method: "POST" },
    )
    return unwrapData(result)
  },

  // Drain queue
  async drainQueue(): Promise<QueueActionResponse> {
    const result = await apiFetch<{ data: QueueActionResponse } | QueueActionResponse>(
      `${BASE_PATH}/queues/test/drain`,
      { method: "POST" },
    )
    return unwrapData(result)
  },

  // Start worker
  async startWorker(): Promise<WorkerStatus & { message: string }> {
    const result = await apiFetch<
      { data: WorkerStatus & { message: string } } | (WorkerStatus & { message: string })
    >(`${BASE_PATH}/worker/start`, { method: "POST" })
    return unwrapData(result)
  },

  // Stop worker
  async stopWorker(): Promise<WorkerStatus & { message: string }> {
    const result = await apiFetch<
      { data: WorkerStatus & { message: string } } | (WorkerStatus & { message: string })
    >(`${BASE_PATH}/worker/stop`, { method: "POST" })
    return unwrapData(result)
  },

  // Get worker status
  async getWorkerStatus(): Promise<WorkerStatus> {
    const result = await apiFetch<{ data: WorkerStatus } | WorkerStatus>(
      `${BASE_PATH}/worker/status`,
    )
    return unwrapData(result)
  },
}
