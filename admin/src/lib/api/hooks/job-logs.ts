/**
 * Job Logs React Query Hooks
 *
 * BullMQ Job 로그 조회 훅
 */

import { useQuery } from "@tanstack/react-query"
import { jobLogsApi } from "../services/job-logs"
import type { JobLogsSearchParams } from "../types/job-log"

// Query Keys
export const jobLogKeys = {
  all: ["job-logs"] as const,
  lists: () => [...jobLogKeys.all, "list"] as const,
  list: (params?: JobLogsSearchParams) => [...jobLogKeys.lists(), params] as const,
  stats: (params?: { hours?: number; queueName?: string }) =>
    [...jobLogKeys.all, "stats", params] as const,
  queues: () => [...jobLogKeys.all, "queues"] as const,
  errorCodes: () => [...jobLogKeys.all, "error-codes"] as const,
  detail: (id: string) => [...jobLogKeys.all, "detail", id] as const,
}

/**
 * Job 로그 목록 조회 훅
 */
export function useJobLogs(params?: JobLogsSearchParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobLogKeys.list(params),
    queryFn: () => jobLogsApi.search(params),
    enabled: options?.enabled,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
  })
}

/**
 * Job 로그 통계 조회 훅
 */
export function useJobLogStats(
  params?: { hours?: number; queueName?: string },
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: jobLogKeys.stats(params),
    queryFn: () => jobLogsApi.stats(params),
    enabled: options?.enabled,
    staleTime: 60 * 1000, // 1분
    gcTime: 5 * 60 * 1000, // 5분
  })
}

/**
 * Queue 이름 목록 조회 훅
 */
export function useJobLogQueues(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobLogKeys.queues(),
    queryFn: () => jobLogsApi.getQueues(),
    enabled: options?.enabled,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  })
}

/**
 * 에러 코드 목록 조회 훅
 */
export function useJobLogErrorCodes(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobLogKeys.errorCodes(),
    queryFn: () => jobLogsApi.getErrorCodes(),
    enabled: options?.enabled,
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 10 * 60 * 1000, // 10분
  })
}

/**
 * Job 로그 상세 조회 훅
 */
export function useJobLog(id: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: jobLogKeys.detail(id),
    queryFn: () => jobLogsApi.get(id),
    enabled: options?.enabled !== false && !!id,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
