import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { API_BASE_URL } from "@/lib/env"
import { bullmqTestApi } from "../services/bullmq-test"
import type {
  AddJobRequest,
  BulkJobRequest,
  CleanQueueRequest,
  JobCounts,
  TestQueueParams,
} from "../types/bullmq-test"
import { jobLogKeys } from "./job-logs"

// Query Keys
export const bullmqTestKeys = {
  all: ["bullmq-test"] as const,
  health: () => [...bullmqTestKeys.all, "health"] as const,
  queues: () => [...bullmqTestKeys.all, "queues"] as const,
  testQueue: (params?: TestQueueParams) => [...bullmqTestKeys.all, "testQueue", params] as const,
  job: (jobId: string) => [...bullmqTestKeys.all, "job", jobId] as const,
  workerStatus: () => [...bullmqTestKeys.all, "workerStatus"] as const,
}

// ================================
// Queries
// ================================

export function useBullMQHealth(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: bullmqTestKeys.health(),
    queryFn: () => bullmqTestApi.getHealth(),
    staleTime: 5 * 1000,
    gcTime: 30 * 1000,
    refetchInterval: options?.refetchInterval,
  })
}

export function useBullMQQueues(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: bullmqTestKeys.queues(),
    queryFn: () => bullmqTestApi.getQueues(),
    staleTime: 5 * 1000,
    gcTime: 30 * 1000,
    refetchInterval: options?.refetchInterval,
  })
}

export function useBullMQTestQueue(
  params?: TestQueueParams,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: bullmqTestKeys.testQueue(params),
    queryFn: () => bullmqTestApi.getTestQueue(params),
    staleTime: 5 * 1000,
    gcTime: 30 * 1000,
    refetchInterval: options?.refetchInterval,
  })
}

export function useBullMQJob(jobId: string, enabled = true) {
  return useQuery({
    queryKey: bullmqTestKeys.job(jobId),
    queryFn: () => bullmqTestApi.getJob(jobId),
    enabled: enabled && !!jobId,
    staleTime: 10 * 1000,
  })
}

export function useBullMQWorkerStatus(options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: bullmqTestKeys.workerStatus(),
    queryFn: () => bullmqTestApi.getWorkerStatus(),
    staleTime: 5 * 1000,
    gcTime: 30 * 1000,
    refetchInterval: options?.refetchInterval,
  })
}

// ================================
// Mutations
// ================================

export function useAddJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AddJobRequest) => bullmqTestApi.addJob(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success(`Job added: ${result.jobId}`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add job")
    },
  })
}

export function useAddBulkJobs() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobs: BulkJobRequest[]) => bullmqTestApi.addBulkJobs(jobs),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success(`${result.count} jobs added`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to add bulk jobs")
    },
  })
}

export function useRetryJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => bullmqTestApi.retryJob(jobId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success(`Job ${result.jobId} queued for retry`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to retry job")
    },
  })
}

export function useRemoveJob() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (jobId: string) => bullmqTestApi.removeJob(jobId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success(`Job ${result.jobId} removed`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to remove job")
    },
  })
}

export function useCleanQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data?: CleanQueueRequest) => bullmqTestApi.cleanQueue(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success(
        `Cleaned ${result.cleanedCompleted} completed, ${result.cleanedFailed} failed jobs`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to clean queue")
    },
  })
}

export function usePauseQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => bullmqTestApi.pauseQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success("Queue paused")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to pause queue")
    },
  })
}

export function useResumeQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => bullmqTestApi.resumeQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success("Queue resumed")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to resume queue")
    },
  })
}

export function useDrainQueue() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => bullmqTestApi.drainQueue(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.testQueue() })
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.queues() })
      toast.success("Queue drained - all waiting jobs removed")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to drain queue")
    },
  })
}

export function useStartWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => bullmqTestApi.startWorker(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.workerStatus() })
      toast.success("Worker started")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to start worker")
    },
  })
}

export function useStopWorker() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => bullmqTestApi.stopWorker(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: bullmqTestKeys.workerStatus() })
      toast.success("Worker stopped")
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to stop worker")
    },
  })
}

// ================================
// Custom Hook for All Data
// ================================

export function useBullMQTestData(params?: TestQueueParams, autoRefresh = false) {
  const refetchInterval = autoRefresh ? 2000 : false

  const healthQuery = useBullMQHealth({ refetchInterval })
  const queuesQuery = useBullMQQueues({ refetchInterval })
  const testQueueQuery = useBullMQTestQueue(params, { refetchInterval })
  const workerStatusQuery = useBullMQWorkerStatus({ refetchInterval })

  const queryClient = useQueryClient()

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: bullmqTestKeys.all })
  }

  return {
    // Data
    health: healthQuery.data,
    queues: queuesQuery.data ?? {},
    testQueueJobs: testQueueQuery.data?.jobs ?? [],
    testQueueCounts: testQueueQuery.data?.counts ?? {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
    },
    pagination: testQueueQuery.data?.pagination ?? {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    },
    workerStatus: workerStatusQuery.data ?? { running: false, concurrency: 0 },

    // Loading states
    isLoading:
      healthQuery.isLoading ||
      queuesQuery.isLoading ||
      testQueueQuery.isLoading ||
      workerStatusQuery.isLoading,
    isFetching: testQueueQuery.isFetching,

    // Refresh function
    refreshAll,
  }
}

// ================================
// SSE Hook for Real-time Updates
// ================================

export type BullMQSSEEvent = {
  type: string
  jobId?: string
  name?: string
  data?: unknown
  result?: unknown
  failedReason?: string
  attemptsMade?: number
  progress?: number | object
  counts?: JobCounts
  timestamp: string
}

export type UseBullMQSSEOptions = {
  enabled?: boolean
  onEvent?: (event: BullMQSSEEvent) => void
  onError?: (error: Error) => void
}

export function useBullMQSSE(options: UseBullMQSSEOptions = {}) {
  const { enabled = true, onEvent, onError } = options
  const [isConnected, setIsConnected] = useState(false)
  const [lastEvent, setLastEvent] = useState<BullMQSSEEvent | null>(null)
  const [counts, setCounts] = useState<JobCounts>({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  })
  const abortControllerRef = useRef<AbortController | null>(null)
  const queryClient = useQueryClient()

  const connect = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/bullmq-test/stream`, {
        signal,
        headers: {
          Accept: "text/event-stream",
        },
      })

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      setIsConnected(true)

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("No readable stream")
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        let currentEventType = ""
        let currentData = ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEventType = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6)
          } else if (line === "" && currentData) {
            // End of event
            try {
              const eventData = JSON.parse(currentData)
              const event: BullMQSSEEvent = {
                type: currentEventType || "message",
                ...eventData,
              }

              setLastEvent(event)
              onEvent?.(event)

              // Update counts from queue-state event
              if (event.type === "queue-state" && event.counts) {
                setCounts(event.counts)
              }

              // Invalidate queries on job events
              if (
                event.type === "job-completed" ||
                event.type === "job-failed" ||
                event.type === "job-active" ||
                event.type === "job-waiting" ||
                event.type === "job-removed" ||
                event.type === "job-progress" ||
                event.type === "job-stalled"
              ) {
                // Invalidate BullMQ test queries
                queryClient.invalidateQueries({ queryKey: bullmqTestKeys.all })
                // Also invalidate Job Logs queries for real-time sync
                queryClient.invalidateQueries({ queryKey: jobLogKeys.all })
              }
            } catch {
              console.warn("[BullMQ-SSE] Failed to parse event:", currentData)
            }
            currentEventType = ""
            currentData = ""
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[BullMQ-SSE] Connection error:", error)
        onError?.(error)
      }
    } finally {
      setIsConnected(false)
    }
  }, [onEvent, onError, queryClient])

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsConnected(false)
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return {
    isConnected,
    lastEvent,
    counts,
    connect,
    disconnect,
  }
}
