/**
 * Job Logs API Service
 *
 * BullMQ Job 로그 조회 API
 */

import { apiFetch } from "@/lib/api/client"
import type {
  JobLog,
  JobLogStats,
  JobLogsPageResponse,
  JobLogsSearchParams,
  JobLogsSearchResponse,
} from "../types/job-log"

export const jobLogsApi = {
  /**
   * Job 로그 목록 조회 (페이지네이션, 필터, 검색)
   */
  search: (params?: JobLogsSearchParams): Promise<JobLogsPageResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 20
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.queueName) {
      searchParams.append("queueName", params.queueName)
    }
    if (params?.status && params.status.length > 0) {
      searchParams.append("status", params.status.join(","))
    }
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.errorCode) {
      searchParams.append("errorCode", params.errorCode)
    }
    if (params?.workerName) {
      searchParams.append("workerName", params.workerName)
    }

    const query = searchParams.toString()
    return apiFetch<JobLogsSearchResponse>(
      `/api/v1/admin/job-logs/search${query ? `?${query}` : ""}`,
    ).then((response) => ({
      logs: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  /**
   * Job 로그 통계 조회
   */
  stats: (params?: { hours?: number; queueName?: string }): Promise<JobLogStats> => {
    const searchParams = new URLSearchParams()
    if (params?.hours) {
      searchParams.append("hours", params.hours.toString())
    }
    if (params?.queueName) {
      searchParams.append("queueName", params.queueName)
    }
    const query = searchParams.toString()
    return apiFetch<JobLogStats>(`/api/v1/admin/job-logs/stats${query ? `?${query}` : ""}`)
  },

  /**
   * 사용 가능한 Queue 이름 목록 조회
   */
  getQueues: (): Promise<string[]> => {
    return apiFetch<{ data: string[] }>("/api/v1/admin/job-logs/queues").then(
      (response) => response.data,
    )
  },

  /**
   * 사용 가능한 에러 코드 목록 조회
   */
  getErrorCodes: (): Promise<string[]> => {
    return apiFetch<{ data: string[] }>("/api/v1/admin/job-logs/error-codes").then(
      (response) => response.data,
    )
  },

  /**
   * Job 로그 상세 조회
   */
  get: (id: string): Promise<JobLog> => {
    return apiFetch<JobLog>(`/api/v1/admin/job-logs/${id}`)
  },
}
