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
import { useCallback, useEffect, useRef } from "react"
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

  // Status Flags
  isComplete: boolean
  hasError: boolean
  isFromCache: boolean

  // Leads/Emails for UI
  leads: LeadProgressItem[]
  emails: EmailProgressItem[]
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
 * 특정 워크스페이스의 진행 상태 가져오기
 */
export const getOnboardingProgressAtom = (workspaceId: string) =>
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

  const progressAtom = getOnboardingProgressAtom(workspaceId)
  const [state, setState] = useAtom(progressAtom)
  const [fakeProgressMap, setFakeProgressMap] = useAtom(fakeProgressMapAtom)

  const abortControllerRef = useRef<AbortController | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  // Callbacks refs
  const onProgressRef = useRef(onProgress)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onProgressRef.current = onProgress
    onCompleteRef.current = onComplete
    onErrorRef.current = onError
  }, [onProgress, onComplete, onError])

  // Handle SSE event
  const handleEvent = useCallback(
    (eventType: string, eventData: OnboardingProgressEvent, fromCache = false) => {
      // Update leads array
      let newLeads = state.leads
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

      // Update emails array
      let newEmails = state.emails
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

      setState({
        event: eventData,
        phase: eventData.phase,
        progressPercent: eventData.progressPercent,
        message: eventData.messageKr || eventData.message || "",
        isComplete,
        hasError,
        isFromCache: fromCache,
        leads: newLeads,
        emails: newEmails,
      })

      // Update fake progress phase
      if (eventData.phase && eventData.phase !== fakeProgressMap[workspaceId]?.currentPhase) {
        setFakeProgressMap((prev) => ({
          ...prev,
          [workspaceId]: {
            startTime: Date.now(),
            currentPhase: eventData.phase,
            animatedProgress: eventData.progressPercent,
          },
        }))
      }

      // Call callbacks
      if (eventType === "progress" || eventType === "cached") {
        onProgressRef.current?.(eventData)
      } else if (isComplete) {
        onCompleteRef.current?.(eventData)
      } else if (hasError) {
        onErrorRef.current?.(eventData)
      }
    },
    [state.leads, state.emails, workspaceId, fakeProgressMap, setState, setFakeProgressMap],
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
  useEffect(() => {
    if (!(workspaceId && enabled) || state.isComplete || state.hasError) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const fakeState = fakeProgressMap[workspaceId]
    if (!fakeState?.currentPhase) {
      return
    }

    const phaseRange = PHASE_PROGRESS_RANGES[fakeState.currentPhase]
    if (!phaseRange || phaseRange.min < 0) {
      return
    }

    const animate = () => {
      const elapsed = Date.now() - fakeState.startTime
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
  }, [workspaceId, enabled, state.isComplete, state.hasError, fakeProgressMap, setFakeProgressMap])

  // Calculate display progress (real or fake)
  const fakeState = fakeProgressMap[workspaceId]
  const displayProgress =
    state.progressPercent > 0
      ? state.progressPercent
      : fakeState?.animatedProgress || PHASE_PROGRESS_RANGES[state.phase || "init"]?.min || 0

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
  const progressAtom = getOnboardingProgressAtom(workspaceId)
  const state = useAtomValue(progressAtom)
  const fakeProgressMap = useAtomValue(fakeProgressMapAtom)

  const fakeState = fakeProgressMap[workspaceId]
  const displayProgress =
    state.progressPercent > 0
      ? state.progressPercent
      : fakeState?.animatedProgress || PHASE_PROGRESS_RANGES[state.phase || "init"]?.min || 0

  return {
    phase: state.phase,
    progressPercent: state.progressPercent,
    displayProgress: Math.round(displayProgress),
    message: state.message,
    isComplete: state.isComplete,
    hasError: state.hasError,
    isConnected: state.isConnected,
    leads: state.leads,
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
