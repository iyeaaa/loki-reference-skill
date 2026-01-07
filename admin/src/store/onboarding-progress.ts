/**
 * Onboarding Progress Store (Jotai)
 *
 * 통합 온보딩 진행 상태 관리
 * - StepBuyerLoading과 NotificationBell 간 상태 공유
 * - SSE 연결 상태 관리
 * - Phase별 Fake Progress 지원
 * - 페이지 이탈 후 재접속 시 상태 복원
 */

import { atom, useAtom, useAtomValue, useSetAtom } from "jotai"
import { useCallback, useEffect, useMemo, useRef } from "react"
import { API_BASE_URL } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

export type OnboardingPhase =
  | "init"
  | "discovery"
  | "group"
  | "templates"
  | "sequence"
  | "previews"
  | "complete"
  | "error"

export type LeadProgressItem = {
  leadId: string
  companyName: string
  country?: string
  status: "discovering" | "enriching" | "generating" | "done" | "error"
  email?: string
  emailCount?: number
  leadSource?: string
}

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
    leadsFound?: number
    leadsEnriched?: number
    templatesGenerated?: number
    totalTemplates?: number
    previewsGenerated?: number
    totalPreviews?: number
    error?: string
    leads?: LeadProgressItem[]
    currentLead?: LeadProgressItem
    emails?: EmailProgressItem[]
    recentEmail?: EmailProgressItem
  }
  message: string
  messageKr: string
  timestamp: string
  // NEW: Parallel execution progress (for discovery + templates running simultaneously)
  parallelProgress?: {
    discovery: { percent: number; done: boolean }
    templates: { percent: number; done: boolean }
  }
}

export type OnboardingProgressState = {
  // SSE Connection
  isConnected: boolean
  connectionError: boolean

  // Progress Data
  event: OnboardingProgressEvent | null
  phase: OnboardingPhase | null
  progressPercent: number
  message: string

  // Parallel Progress (Discovery + Templates)
  parallelProgress?: {
    discovery: { percent: number; done: boolean }
    templates: { percent: number; done: boolean }
  }

  // Status Flags
  isComplete: boolean
  hasError: boolean
  isFromCache: boolean

  // Leads/Emails for UI
  leads: LeadProgressItem[]
  emails: EmailProgressItem[]
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Merge parallel progress while preserving completed tasks
 * - If current progress is done (100%), don't overwrite it
 * - Otherwise, use incoming progress
 */
function mergeParallelProgress(
  current: OnboardingProgressState["parallelProgress"],
  incoming: OnboardingProgressEvent["parallelProgress"],
): OnboardingProgressState["parallelProgress"] {
  if (!incoming) {
    return current
  }
  if (!current) {
    return incoming
  }

  return {
    discovery: current.discovery?.done
      ? current.discovery // Keep completed state
      : incoming.discovery || current.discovery,
    templates: current.templates?.done
      ? current.templates // Keep completed state
      : incoming.templates || current.templates,
  }
}

// ============================================================================
// Phase-based Fake Progress Ranges
// ============================================================================

export const PHASE_PROGRESS_RANGES: Record<OnboardingPhase, { min: number; max: number }> = {
  init: { min: 0, max: 5 },
  discovery: { min: 5, max: 30 },
  group: { min: 30, max: 45 },
  templates: { min: 45, max: 65 },
  sequence: { min: 65, max: 75 },
  previews: { min: 75, max: 95 },
  complete: { min: 100, max: 100 },
  error: { min: -1, max: -1 },
}

// ============================================================================
// Atoms
// ============================================================================

const DEFAULT_STATE: OnboardingProgressState = {
  isConnected: false,
  connectionError: false,
  event: null,
  phase: null,
  progressPercent: 0,
  message: "",
  isComplete: false,
  hasError: false,
  isFromCache: false,
  leads: [],
  emails: [],
}

/**
 * 워크스페이스별 진행 상태 저장
 */
const onboardingProgressMapAtom = atom<Record<string, OnboardingProgressState>>({})

/**
 * 파생 atom 타입 정의
 */
type OnboardingProgressAtom = ReturnType<typeof createProgressAtom>

/**
 * 워크스페이스별 진행 상태 atom 생성 함수
 */
const createProgressAtom = (workspaceId: string) =>
  atom(
    (get) => get(onboardingProgressMapAtom)[workspaceId] || DEFAULT_STATE,
    (get, set, update: Partial<OnboardingProgressState>) => {
      const current = get(onboardingProgressMapAtom)
      set(onboardingProgressMapAtom, {
        ...current,
        [workspaceId]: {
          ...(current[workspaceId] || DEFAULT_STATE),
          ...update,
        },
      })
    },
  )

/**
 * Atom 캐시 (동일 workspaceId에 대해 같은 atom 반환)
 * Jotai 원칙: atom은 안정적인 참조를 유지해야 함
 */
const atomCache = new Map<string, OnboardingProgressAtom>()

/**
 * 특정 워크스페이스의 진행 상태 가져오기
 * 메모이제이션으로 동일 workspaceId에 대해 같은 atom 반환
 */
export const getOnboardingProgressAtom = (workspaceId: string): OnboardingProgressAtom => {
  const cached = atomCache.get(workspaceId)
  if (cached) {
    return cached
  }

  const newAtom = createProgressAtom(workspaceId)
  atomCache.set(workspaceId, newAtom)
  return newAtom
}

/**
 * Phase별 Fake Progress 상태
 */
type FakeProgressState = {
  startTime: number
  currentPhase: OnboardingPhase | null
  animatedProgress: number
}

const fakeProgressMapAtom = atom<Record<string, FakeProgressState>>({})

// ============================================================================
// Hooks
// ============================================================================

/**
 * 통합 Onboarding Progress Hook
 *
 * 단일 SSE 연결로 진행 상태 관리
 * - 연결 시 캐시된 상태 즉시 수신
 * - 실시간 업데이트
 * - Phase별 Fake Progress
 */
export function useOnboardingProgress(
  workspaceId: string,
  options: {
    enabled?: boolean
    onProgress?: (event: OnboardingProgressEvent) => void
    onComplete?: (event: OnboardingProgressEvent) => void
    onError?: (event: OnboardingProgressEvent) => void
  } = {},
) {
  const { enabled = true, onProgress, onComplete, onError } = options

  // 빈 workspaceId 처리: 유효한 workspaceId가 있을 때만 atom 구독
  const safeWorkspaceId = workspaceId || "__empty__"
  const progressAtom = getOnboardingProgressAtom(safeWorkspaceId)
  const [state, setState] = useAtom(progressAtom)
  const fakeProgressMap = useAtomValue(fakeProgressMapAtom)
  const setFakeProgressMap = useSetAtom(fakeProgressMapAtom)

  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Callbacks refs
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  // State refs to avoid infinite loop in handleEvent
  const leadsRef = useRef<LeadProgressItem[]>([])
  const emailsRef = useRef<EmailProgressItem[]>([])
  const parallelProgressRef = useRef<OnboardingProgressState["parallelProgress"]>(undefined)

  // fakeProgressMap을 ref로 추적 (의존성에서 제거하기 위함)
  const fakeProgressMapRef = useRef(fakeProgressMap)
  useEffect(() => {
    fakeProgressMapRef.current = fakeProgressMap
  }, [fakeProgressMap])

  useEffect(() => {
    onProgressRef.current = onProgress
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onProgress, onComplete, onError])

  // Keep refs in sync with state
  useEffect(() => {
    leadsRef.current = state.leads
    emailsRef.current = state.emails
    parallelProgressRef.current = state.parallelProgress
  }, [state.leads, state.emails, state.parallelProgress])

  // Handle SSE event
  const handleEvent = useCallback(
    (eventType: string, eventData: OnboardingProgressEvent, fromCache = false) => {
      // Update leads array using ref to avoid infinite loop
      let newLeads = leadsRef.current
      if (eventData.details?.leads) {
        newLeads = eventData.details.leads
      } else if (eventData.details?.currentLead) {
        const currentLead = eventData.details.currentLead
        const existingIndex = newLeads.findIndex((l) => l.leadId === currentLead.leadId)
        if (existingIndex >= 0) {
          newLeads = newLeads.map((l, i) => (i === existingIndex ? currentLead : l))
        } else {
          newLeads = [...newLeads, currentLead]
        }
      }

      // Update emails array using ref to avoid infinite loop
      let newEmails = emailsRef.current
      if (eventData.details?.emails) {
        newEmails = eventData.details.emails
      } else if (eventData.details?.recentEmail) {
        const recentEmail = eventData.details.recentEmail
        const existingIndex = newEmails.findIndex((e) => e.emailId === recentEmail.emailId)
        if (existingIndex >= 0) {
          newEmails = newEmails.map((e, i) => (i === existingIndex ? recentEmail : e))
        } else {
          newEmails = [...newEmails, recentEmail]
        }
      }

      const isComplete = eventType === "complete" || eventData.phase === "complete"
      const hasError = eventType === "error" || eventData.phase === "error"

      // Merge parallel progress while preserving completed tasks
      const mergedParallelProgress = mergeParallelProgress(
        parallelProgressRef.current,
        eventData.parallelProgress,
      )

      setState({
        event: eventData,
        phase: eventData.phase,
        progressPercent: eventData.progressPercent,
        message: eventData.messageKr || eventData.message || "",
        parallelProgress: mergedParallelProgress,
        isComplete,
        hasError,
        isFromCache: fromCache,
        leads: newLeads,
        emails: newEmails,
      })

      // Update fake progress phase
      setFakeProgressMap((prev) => {
        if (eventData.phase && eventData.phase !== prev[workspaceId]?.currentPhase) {
          return {
            ...prev,
            [workspaceId]: {
              startTime: Date.now(),
              currentPhase: eventData.phase,
              animatedProgress: eventData.progressPercent,
            },
          }
        }
        return prev
      })

      // Call callbacks
      if (eventType === "progress" || eventType === "cached") {
        onProgressRef.current?.(eventData)
      } else if (isComplete) {
        onCompleteRef.current?.(eventData)
      } else if (hasError) {
        onErrorRef.current?.(eventData)
      }
    },
    [workspaceId, setState, setFakeProgressMap],
  )

  // Connect to SSE
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
        headers: { Accept: "text/event-stream" },
        credentials: "include",
      })

      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status}`)
      }

      setState({ isConnected: true, connectionError: false })

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
            try {
              const eventData = JSON.parse(currentData) as OnboardingProgressEvent

              if (currentEventType === "connected") {
                console.log("[OnboardingProgress] Connected:", eventData)
              } else if (currentEventType === "cached") {
                // Cached state from reconnection
                handleEvent("cached", eventData, true)
              } else if (currentEventType === "progress") {
                handleEvent("progress", eventData)
              } else if (currentEventType === "complete") {
                handleEvent("complete", eventData)
              } else if (currentEventType === "error") {
                handleEvent("error", eventData)
              }
            } catch {
              console.warn("[OnboardingProgress] Failed to parse:", currentData)
            }

            currentEventType = ""
            currentData = ""
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("[OnboardingProgress] Connection error:", error)
        setState({ connectionError: true })
      }
    } finally {
      setState({ isConnected: false })
    }
  }, [workspaceId, enabled, setState, handleEvent])

  // Disconnect
  const disconnect = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setState({ isConnected: false })
  }, [setState])

  // Auto-connect
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

  // Phase-based fake progress animation
  // NOTE: fakeProgressMap을 의존성에서 제거하고 ref로 읽기 (무한 루프 방지)
  useEffect(() => {
    if (!(workspaceId && enabled) || state.isComplete || state.hasError) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const fakeState = fakeProgressMapRef.current[workspaceId]
    if (!fakeState?.currentPhase) {
      return
    }

    const phaseRange = PHASE_PROGRESS_RANGES[fakeState.currentPhase]
    if (!phaseRange || phaseRange.min < 0) {
      return
    }

    const animate = () => {
      // 최신 fakeState를 ref에서 읽기
      const currentFakeState = fakeProgressMapRef.current[workspaceId]
      if (!currentFakeState) {
        return
      }

      const elapsed = Date.now() - currentFakeState.startTime
      const duration = 30_000 // 30 seconds per phase
      const t = Math.min(elapsed / duration, 1)

      // Ease-out cubic
      const easeOutCubic = 1 - (1 - t) ** 3
      const fakeProgress = phaseRange.min + easeOutCubic * (phaseRange.max - phaseRange.min) * 0.8

      setFakeProgressMap((prev) => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          animatedProgress: fakeProgress,
        },
      }))

      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [workspaceId, enabled, state.isComplete, state.hasError, setFakeProgressMap])

  // Calculate display progress (real or fake)
  // useMemo로 안정화 (불필요한 재계산 방지)
  const displayProgress = useMemo(() => {
    const fakeState = fakeProgressMap[safeWorkspaceId]
    if (state.progressPercent > 0) {
      return state.progressPercent
    }
    return fakeState?.animatedProgress || PHASE_PROGRESS_RANGES[state.phase || "init"]?.min || 0
  }, [state.progressPercent, state.phase, fakeProgressMap, safeWorkspaceId])

  return {
    // Connection state
    isConnected: state.isConnected,
    connectionError: state.connectionError,

    // Progress data
    event: state.event,
    phase: state.phase,
    progressPercent: state.progressPercent,
    displayProgress: Math.round(displayProgress),
    message: state.message,
    parallelProgress: state.parallelProgress,

    // Status
    isComplete: state.isComplete,
    hasError: state.hasError,
    isFromCache: state.isFromCache,

    // Data
    leads: state.leads,
    emails: state.emails,

    // Actions
    connect,
    disconnect,
  }
}

/**
 * Read-only hook for NotificationBell
 * Subscribes to the same state without managing SSE connection
 */
export function useOnboardingProgressReadOnly(workspaceId: string) {
  // 빈 workspaceId 처리
  const safeWorkspaceId = workspaceId || "__empty__"
  const progressAtom = getOnboardingProgressAtom(safeWorkspaceId)
  const state = useAtomValue(progressAtom)
  const fakeProgressMap = useAtomValue(fakeProgressMapAtom)

  // useMemo로 displayProgress 안정화
  const displayProgress = useMemo(() => {
    const fakeState = fakeProgressMap[safeWorkspaceId]
    if (state.progressPercent > 0) {
      return state.progressPercent
    }
    return fakeState?.animatedProgress || PHASE_PROGRESS_RANGES[state.phase || "init"]?.min || 0
  }, [state.progressPercent, state.phase, fakeProgressMap, safeWorkspaceId])

  return {
    phase: state.phase,
    progressPercent: state.progressPercent,
    displayProgress: Math.round(displayProgress),
    message: state.message,
    isComplete: state.isComplete,
    hasError: state.hasError,
    isConnected: state.isConnected,
    leads: state.leads,
    parallelProgress: state.parallelProgress,
  }
}

/**
 * Reset progress state for a workspace
 */
export function useResetOnboardingProgress() {
  const setProgressMap = useSetAtom(onboardingProgressMapAtom)
  const setFakeProgressMap = useSetAtom(fakeProgressMapAtom)

  return useCallback(
    (workspaceId: string) => {
      setProgressMap((prev) => {
        const { [workspaceId]: _, ...rest } = prev
        return rest
      })
      setFakeProgressMap((prev) => {
        const { [workspaceId]: _, ...rest } = prev
        return rest
      })
    },
    [setProgressMap, setFakeProgressMap],
  )
}
