/**
 * Onboarding React Query Hooks
 *
 * 워크스페이스 기반 온보딩 진행 관리 훅
 * SSE를 통한 실시간 진행 상황 업데이트 지원
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { API_BASE_URL } from "@/lib/env"
import { type OnboardingSurveyData, onboardingApi } from "../services/onboarding"

// ====================================
// QUERY KEYS
// ====================================

export const onboardingKeys = {
  all: ["onboarding"] as const,
  progress: (workspaceId: string) => [...onboardingKeys.all, "progress", workspaceId] as const,
  incomplete: () => [...onboardingKeys.all, "incomplete"] as const,
  stats: () => [...onboardingKeys.all, "stats"] as const,
}

// ====================================
// QUERIES
// ====================================

/**
 * 온보딩 진행 상태 조회 훅
 * - staleTime: 0 - 항상 최신 데이터
 * - gcTime: 0 - 캐시 사용 안함
 * - retry: false - 실패 시 자동 재시도 비활성화
 */
export function useOnboardingProgress(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.progress(workspaceId),
    queryFn: () => onboardingApi.getProgress(workspaceId),
    enabled: enabled && !!workspaceId,
    staleTime: 0, // 항상 최신 데이터
    gcTime: 0, // 캐시 사용 안함
    retry: false, // 실패 시 자동 재시도 비활성화
  })
}

/**
 * 미완료 온보딩 목록 조회 훅 (관리자용)
 */
export function useIncompleteOnboardings(limit?: number, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.incomplete(),
    queryFn: () => onboardingApi.getIncomplete(limit),
    enabled,
    staleTime: 30 * 1000, // 30초
  })
}

/**
 * 온보딩 통계 조회 훅 (관리자용)
 */
export function useOnboardingStats(enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.stats(),
    queryFn: onboardingApi.getStats,
    enabled,
    staleTime: 60 * 1000, // 1분
  })
}

// ====================================
// MUTATIONS
// ====================================

/**
 * 설문 데이터 저장 mutation
 */
export function useSaveSurvey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      surveyData,
      userId,
    }: {
      workspaceId: string
      surveyData: OnboardingSurveyData
      userId?: string
    }) => onboardingApi.saveSurvey(workspaceId, surveyData, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "설문 저장에 실패했습니다")
    },
  })
}

/**
 * Step 1 완료 mutation
 */
export function useCompleteStep1() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.completeStep1(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "회사 정보 확인 처리에 실패했습니다")
    },
  })
}

/**
 * Step 2 완료 mutation
 */
export function useCompleteStep2() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      selectedLeadIds,
      customerGroupId,
      userId,
    }: {
      workspaceId: string
      selectedLeadIds: string[]
      customerGroupId?: string
      userId?: string
    }) => onboardingApi.completeStep2(workspaceId, selectedLeadIds, customerGroupId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "리드 검색 완료 처리에 실패했습니다")
    },
  })
}

/**
 * Step 3 완료 mutation
 */
export function useCompleteStep3() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      sequenceId,
      userId,
    }: {
      workspaceId: string
      sequenceId: string
      userId?: string
    }) => onboardingApi.completeStep3(workspaceId, sequenceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 시퀀스 생성 처리에 실패했습니다")
    },
  })
}

/**
 * Step 4 완료 mutation
 */
export function useCompleteStep4() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.completeStep4(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 연동 완료 처리에 실패했습니다")
    },
  })
}

/**
 * 온보딩 완료 mutation
 */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, userId }: { workspaceId: string; userId?: string }) =>
      onboardingApi.complete(workspaceId, userId),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
      queryClient.invalidateQueries({ queryKey: onboardingKeys.stats() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 완료 처리에 실패했습니다")
    },
  })
}

/**
 * 현재 스텝 업데이트 mutation
 */
export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ workspaceId, step }: { workspaceId: string; step: number }) =>
      onboardingApi.updateStep(workspaceId, step),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(onboardingKeys.progress(variables.workspaceId), data)
    },
    onError: (error: Error) => {
      toast.error(error.message || "스텝 업데이트에 실패했습니다")
    },
  })
}

/**
 * 온보딩 리셋 mutation (개발/테스트용)
 */
export function useResetOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId: string) => onboardingApi.reset(workspaceId),
    onSuccess: (data, workspaceId) => {
      queryClient.setQueryData(onboardingKeys.progress(workspaceId), data)
      queryClient.invalidateQueries({ queryKey: onboardingKeys.stats() })
      toast.success("온보딩 상태가 리셋되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 리셋에 실패했습니다")
    },
  })
}

// ====================================
// HELPER HOOKS
// ====================================

/**
 * 온보딩 완료 여부 확인 훅
 */
export function useIsOnboardingComplete(workspaceId: string, enabled = true) {
  const { data, isLoading } = useOnboardingProgress(workspaceId, enabled)
  return {
    isComplete: data?.completedAt !== null,
    isLoading,
    currentStep: data?.currentStep || 0,
    status: data?.status || "not_started",
  }
}

// ====================================
// SSE TYPES
// ====================================

export type OnboardingPhase =
  | "init"
  | "discovery"
  | "group"
  | "templates"
  | "sequence"
  | "previews"
  | "complete"
  | "error"

// Individual lead status for real-time display
export type LeadProgressItem = {
  leadId: string
  companyName: string
  country?: string
  status: "discovering" | "enriching" | "generating" | "done" | "error"
  email?: string
  emailCount?: number
}

// Individual email for real-time display
export type EmailProgressItem = {
  emailId: string
  leadId: string
  companyName: string
  subject: string
  step: number
  status: "generating" | "done"
}

export type OnboardingProgressEvent = {
  workspaceId: string
  jobId: string
  phase: OnboardingPhase
  progressPercent: number
  details: {
    // Discovery phase
    leadsFound?: number
    leadsEnriched?: number
    currentBatch?: number
    totalBatches?: number
    // Templates phase
    templatesGenerated?: number
    totalTemplates?: number
    currentTemplate?: string
    // Previews phase
    previewsGenerated?: number
    totalPreviews?: number
    // Error info
    error?: string
    // NEW: Real-time lead/email tracking for 20-lead onboarding
    leads?: LeadProgressItem[]
    currentLead?: LeadProgressItem
    emails?: EmailProgressItem[]
    recentEmail?: EmailProgressItem
  }
  message: string
  messageKr: string
  timestamp: string
  final?: boolean
}

export type UseOnboardingSSEOptions = {
  enabled?: boolean
  onProgress?: (event: OnboardingProgressEvent) => void
  onComplete?: (event: OnboardingProgressEvent) => void
  onError?: (event: OnboardingProgressEvent) => void
}

export type UseOnboardingSSEReturn = {
  isConnected: boolean
  progress: OnboardingProgressEvent | null
  phase: OnboardingPhase | null
  progressPercent: number
  message: string
  isComplete: boolean
  hasError: boolean
  connect: () => void
  disconnect: () => void
}

// ====================================
// SSE HOOK
// ====================================

/**
 * 온보딩 자동 생성 진행 상황 실시간 스트리밍 훅
 *
 * @example
 * ```tsx
 * const {
 *   isConnected,
 *   progress,
 *   phase,
 *   progressPercent,
 *   message,
 *   isComplete,
 *   hasError,
 * } = useOnboardingSSE(workspaceId, {
 *   enabled: true,
 *   onProgress: (event) => console.log('Progress:', event),
 *   onComplete: (event) => console.log('Complete:', event),
 *   onError: (event) => console.error('Error:', event),
 * })
 * ```
 */
export function useOnboardingSSE(
  workspaceId: string,
  options: UseOnboardingSSEOptions = {},
): UseOnboardingSSEReturn {
  const { enabled = true, onProgress, onComplete, onError } = options

  const [isConnected, setIsConnected] = useState(false)
  const [progress, setProgress] = useState<OnboardingProgressEvent | null>(null)
  const [isComplete, setIsComplete] = useState(false)
  const [hasError, setHasError] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const previousPhaseRef = useRef<OnboardingPhase | null>(null)
  const queryClient = useQueryClient()

  // Store callbacks in refs to avoid recreating connect
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // Update refs when callbacks change
  useEffect(() => {
    onProgressRef.current = onProgress
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onProgress, onComplete, onError])

  const connect = useCallback(async () => {
    if (!(workspaceId && enabled)) {
      return
    }

    // Abort existing connection
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

    try {
      const url = `${API_BASE_URL}/api/v1/onboarding/workspace/${workspaceId}/stream`

      const response = await fetch(url, {
        signal,
        headers: {
          Accept: "text/event-stream",
        },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      setIsConnected(true)
      setIsComplete(false)
      setHasError(false)

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
              const eventData = JSON.parse(currentData) as OnboardingProgressEvent

              // Handle different event types
              if (currentEventType === "connected") {
                console.log("[Onboarding SSE] Connected:", eventData)
              } else if (currentEventType === "progress") {
                setProgress(eventData)
                onProgressRef.current?.(eventData)

                // Invalidate queries on progress to keep data fresh (only when phase changes)
                if (eventData.phase !== previousPhaseRef.current) {
                  previousPhaseRef.current = eventData.phase
                  queryClient.invalidateQueries({
                    queryKey: onboardingKeys.progress(workspaceId),
                  })
                }
              } else if (currentEventType === "complete") {
                setProgress(eventData)
                setIsComplete(true)
                onCompleteRef.current?.(eventData)

                // Invalidate queries on complete
                queryClient.invalidateQueries({
                  queryKey: onboardingKeys.progress(workspaceId),
                })
              } else if (currentEventType === "error") {
                setProgress(eventData)
                setHasError(true)
                onErrorRef.current?.(eventData)

                // Show error toast
                toast.error(eventData.messageKr || eventData.message || "오류가 발생했습니다")
              }
            } catch (parseError) {
              console.warn("[Onboarding SSE] Failed to parse event:", currentData, parseError)
            }

            currentEventType = ""
            currentData = ""
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[Onboarding SSE] Connection error:", error)
        setHasError(true)
      }
    } finally {
      setIsConnected(false)
    }
    // Note: callbacks are accessed via refs to avoid recreating this function
  }, [workspaceId, enabled, queryClient])

  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsConnected(false)
  }, [])

  // Auto-connect when enabled and workspaceId changes
  useEffect(() => {
    if (enabled && workspaceId) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, workspaceId, connect, disconnect])

  return {
    isConnected,
    progress,
    phase: progress?.phase ?? null,
    progressPercent: progress?.progressPercent ?? 0,
    message: progress?.messageKr || progress?.message || "",
    isComplete,
    hasError,
    connect,
    disconnect,
  }
}

// ====================================
// COMBINED HOOK
// ====================================

/**
 * 온보딩 진행 상황 + SSE 실시간 업데이트 통합 훅
 *
 * REST API 폴링과 SSE 실시간 업데이트를 함께 사용
 * SSE 연결이 끊어져도 폴링으로 상태 유지
 */
export function useOnboardingWithSSE(
  workspaceId: string,
  options: {
    enableSSE?: boolean
    enablePolling?: boolean
    pollingInterval?: number
  } = {},
) {
  const { enableSSE = true, enablePolling = false, pollingInterval = 5000 } = options

  // REST API query with optional polling
  const progressQuery = useOnboardingProgress(workspaceId, true)

  // SSE for real-time updates
  const sse = useOnboardingSSE(workspaceId, {
    enabled: enableSSE,
  })

  // Use SSE progress when connected, fallback to polling
  const currentProgress = sse.isConnected && sse.progress ? sse.progress : null

  // Enable polling as fallback when SSE is not connected
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null

    if (enablePolling && !sse.isConnected) {
      intervalId = setInterval(() => {
        progressQuery.refetch()
      }, pollingInterval)
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [enablePolling, sse.isConnected, pollingInterval, progressQuery])

  return {
    // REST API data
    data: progressQuery.data,
    isLoading: progressQuery.isLoading,
    refetch: progressQuery.refetch,

    // SSE data
    sse: {
      isConnected: sse.isConnected,
      progress: currentProgress,
      phase: sse.phase,
      progressPercent: sse.progressPercent,
      message: sse.message,
      isComplete: sse.isComplete,
      hasError: sse.hasError,
    },

    // Combined status
    isAutoGenerating: sse.isConnected && !sse.isComplete && !sse.hasError,
  }
}
