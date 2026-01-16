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
  score?: number // LLM 평가 점수 (0-100)
  description?: string // 회사 설명
}

export type EmailProgressItem = {
  emailId: string
  leadId: string
  companyName: string
  subject: string
  step: number
  status: "generating" | "done"
}

// AI reasoning 정보 (ChatGPT 스타일 상세 진행 표시)
export type ReasoningInfo = {
  step: string // 현재 단계 설명 (영문)
  stepKr: string // 현재 단계 설명 (한글)
  details?: string // 추가 상세 (페르소나, 키워드 등)
  detailsKr?: string // 추가 상세 (한글)
}

// Chat message types for persistence
export type OnboardingChatMessageType =
  | "user_input"
  | "phase_summary"
  | "completion"
  | "progress"
  | "error"

export type OnboardingChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  messageType: OnboardingChatMessageType
  phase?: OnboardingPhase
}

// Phase summary for AI-generated messages
export type OnboardingPhaseSummary = {
  phase: "intelligence" | "search" | "scoring" | "complete"
  summary: { ko: string; en: string }
  metadata?: {
    personaCount?: number
    buyerCount?: number
    averageScore?: number
    countryDistribution?: Record<string, number>
  }
}

export type TodoChecklist = {
  findBuyers: boolean
  writeEmails: boolean
  pickBestBuyers: boolean
  refineEmails: boolean
}

// Email step (templates phase에서 생성되는 이메일 초안)
export type EmailStepItem = {
  id: string
  stepOrder: number
  delayDays: number
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
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
    steps?: EmailStepItem[] // 🆕 이메일 템플릿 스텝
    completionSummary?: { ko: string; en: string } // 🆕 LLM 생성 완료 요약
  }
  message: string
  messageKr: string
  timestamp: string
  // NEW: Parallel execution progress (for discovery + templates running simultaneously)
  parallelProgress?: {
    discovery: { percent: number; done: boolean }
    templates: { percent: number; done: boolean }
  }
  // NEW: AI reasoning 스타일 상세 진행 정보
  reasoning?: ReasoningInfo
  // NEW: 현재 활성 phase (병렬 실행 시 reasoning 표시용)
  activePhase?: "discovery" | "templates"
  // NEW: TODO checklist status
  todoChecklist?: TodoChecklist
  // NEW: Phase별 AI 요약 (intelligence, search, scoring 완료 시)
  phaseSummary?: OnboardingPhaseSummary
  // NEW: 채팅 메시지로 직접 추가할 내용
  chatMessage?: OnboardingChatMessage
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

  // AI Reasoning (Claude Desktop 스타일 누적 진행)
  reasonings: ReasoningInfo[] // 🆕 배열로 변경 (누적)

  // 현재 활성 phase (병렬 실행 시 reasoning 표시용)
  activePhase?: "discovery" | "templates"

  // LLM 생성 완료 요약
  completionSummary?: { ko: string; en: string }
  // TODO checklist
  todoChecklist?: TodoChecklist
  // 🆕 Phase별 AI 요약 (영속화)
  phaseSummaries: OnboardingPhaseSummary[]
  // 🆕 채팅 메시지 (영속화)
  chatMessages: OnboardingChatMessage[]

  // Status Flags
  isComplete: boolean
  hasError: boolean
  isFromCache: boolean
  isStuck: boolean // 🆕 일정 시간 동안 업데이트 없음

  // Last update tracking
  lastUpdateTime: number | null // 🆕 마지막 SSE 업데이트 시간

  // Leads/Emails for UI
  leads: LeadProgressItem[]
  emails: EmailProgressItem[]
  steps: EmailStepItem[] // 🆕 이메일 템플릿 스텝
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

function buildTodoChecklist(
  phase: OnboardingPhase,
  progressPercent: number,
  parallelProgress?: OnboardingProgressEvent["parallelProgress"],
): TodoChecklist {
  const discoveryDone = parallelProgress?.discovery?.done || progressPercent >= 30
  const templatesDone = parallelProgress?.templates?.done || progressPercent >= 65
  const sequenceDone = phase === "sequence" || phase === "previews" || phase === "complete"
  const previewsDone = phase === "complete" || progressPercent >= 95

  return {
    findBuyers: discoveryDone,
    writeEmails: templatesDone,
    pickBestBuyers: sequenceDone,
    refineEmails: previewsDone,
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
  isStuck: false, // 🆕 stuck 상태
  lastUpdateTime: null, // 🆕 마지막 업데이트 시간
  leads: [],
  emails: [],
  steps: [], // 🆕 이메일 템플릿 스텝
  reasonings: [], // 🆕 누적된 reasoning 배열
  todoChecklist: undefined,
  phaseSummaries: [], // 🆕 Phase별 AI 요약
  chatMessages: [], // 🆕 채팅 메시지 (영속화)
}

// 🆕 Stuck 감지 상수 (2분 동안 업데이트 없으면 stuck으로 간주)
const STUCK_THRESHOLD_MS = 2 * 60 * 1000

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
  const stepsRef = useRef<EmailStepItem[]>([]) // 🆕 이메일 템플릿 스텝
  const reasoningsRef = useRef<ReasoningInfo[]>([]) // 🆕 누적된 reasoning 배열
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

  // 🆕 Phase summaries ref for handleEvent
  const phaseSummariesRef = useRef<OnboardingPhaseSummary[]>([])
  // 🆕 Chat messages ref for handleEvent
  const chatMessagesRef = useRef<OnboardingChatMessage[]>([])

  // Keep refs in sync with state
  useEffect(() => {
    leadsRef.current = state.leads
    emailsRef.current = state.emails
    stepsRef.current = state.steps
    reasoningsRef.current = state.reasonings
    parallelProgressRef.current = state.parallelProgress
    phaseSummariesRef.current = state.phaseSummaries
    chatMessagesRef.current = state.chatMessages
  }, [
    state.leads,
    state.emails,
    state.steps,
    state.reasonings,
    state.parallelProgress,
    state.phaseSummaries,
    state.chatMessages,
  ])

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
          // 🆕 Limit array size to prevent memory issues
          newLeads = [...newLeads, currentLead].slice(-50)
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
          // 🆕 Limit array size to prevent memory issues
          newEmails = [...newEmails, recentEmail].slice(-100)
        }
      }

      // 🆕 Update steps array (templates phase에서 생성된 이메일 초안)
      let newSteps = stepsRef.current
      if (eventData.details?.steps && eventData.details.steps.length > 0) {
        newSteps = eventData.details.steps
      }

      // 🆕 Update reasonings array (Claude Desktop 스타일 누적)
      let newReasonings = reasoningsRef.current
      if (eventData.reasoning) {
        // 새로운 reasoning 추가 (중복 방지: step이 다른 경우만 추가)
        const lastReasoning = newReasonings.at(-1)
        if (!lastReasoning || lastReasoning.step !== eventData.reasoning.step) {
          newReasonings = [...newReasonings, eventData.reasoning].slice(-20) // 최대 20개 유지
        }
      }

      // 🆕 Update phaseSummaries array
      let newPhaseSummaries = phaseSummariesRef.current
      if (eventData.phaseSummary) {
        // 새로운 phase summary 추가 (중복 방지: phase가 다른 경우만 추가)
        const isDuplicate = newPhaseSummaries.some((s) => s.phase === eventData.phaseSummary?.phase)
        if (!isDuplicate) {
          newPhaseSummaries = [...newPhaseSummaries, eventData.phaseSummary].slice(-10)
        }
      }

      // 🆕 Update chatMessages array
      let newChatMessages = chatMessagesRef.current
      if (eventData.chatMessage) {
        // 새로운 chat message 추가 (중복 방지: id가 다른 경우만 추가)
        const isDuplicate = newChatMessages.some((m) => m.id === eventData.chatMessage?.id)
        if (!isDuplicate) {
          newChatMessages = [...newChatMessages, eventData.chatMessage].slice(-50)
        }
      }

      const isComplete = eventType === "complete" || eventData.phase === "complete"
      const hasError = eventType === "error" || eventData.phase === "error"

      // Merge parallel progress while preserving completed tasks
      const mergedParallelProgress = mergeParallelProgress(
        parallelProgressRef.current,
        eventData.parallelProgress,
      )

      const resolvedTodoChecklist =
        eventData.todoChecklist ||
        buildTodoChecklist(eventData.phase, eventData.progressPercent, mergedParallelProgress)

      setState({
        event: eventData,
        phase: eventData.phase,
        progressPercent: eventData.progressPercent,
        message: eventData.messageKr || eventData.message || "",
        parallelProgress: mergedParallelProgress,
        reasonings: newReasonings, // 🆕 누적된 reasoning 배열
        activePhase: eventData.activePhase, // 🆕 현재 활성 phase
        completionSummary: eventData.details?.completionSummary, // 🆕 LLM 완료 요약
        todoChecklist: resolvedTodoChecklist,
        isComplete,
        hasError,
        isFromCache: fromCache,
        isStuck: false, // 🆕 업데이트 받으면 stuck 해제
        lastUpdateTime: Date.now(), // 🆕 마지막 업데이트 시간 기록
        leads: newLeads,
        emails: newEmails,
        steps: newSteps, // 🆕 이메일 템플릿 스텝
        phaseSummaries: newPhaseSummaries, // 🆕 Phase별 AI 요약
        chatMessages: newChatMessages, // 🆕 채팅 메시지
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

  const { isComplete, hasError, lastUpdateTime, phase, isStuck } = state

  // 🆕 Stuck 상태 감지 (주기적으로 체크)
  useEffect(() => {
    if (!(enabled && workspaceId) || isComplete || hasError) {
      return
    }

    const checkStuck = () => {
      // 진행 중인 상태에서만 stuck 체크 (init, complete, error 제외)
      const isInProgress = phase && !["init", "complete", "error"].includes(phase)

      if (isInProgress && lastUpdateTime) {
        const timeSinceUpdate = Date.now() - lastUpdateTime
        if (timeSinceUpdate > STUCK_THRESHOLD_MS && !isStuck) {
          console.warn(
            `[OnboardingProgress] Stuck detected: no update for ${Math.round(timeSinceUpdate / 1000)}s`,
          )
          setState({ isStuck: true })
        }
      }
    }

    // 30초마다 stuck 체크
    const intervalId = setInterval(checkStuck, 30_000)

    return () => clearInterval(intervalId)
  }, [enabled, workspaceId, isComplete, hasError, lastUpdateTime, phase, isStuck, setState])

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
    reasonings: state.reasonings, // 🆕 누적된 reasoning 배열
    activePhase: state.activePhase, // 🆕 현재 활성 phase
    completionSummary: state.completionSummary, // 🆕 LLM 완료 요약
    todoChecklist: state.todoChecklist,

    // Status
    isComplete: state.isComplete,
    hasError: state.hasError,
    isFromCache: state.isFromCache,
    isStuck: state.isStuck, // 🆕 stuck 상태

    // Data
    leads: state.leads,
    emails: state.emails,
    steps: state.steps, // 🆕 이메일 템플릿 스텝
    phaseSummaries: state.phaseSummaries, // 🆕 Phase별 AI 요약
    chatMessages: state.chatMessages, // 🆕 채팅 메시지

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

// ============================================================================
// Chat Messages Persistence (localStorage)
// ============================================================================

const CHAT_MESSAGES_STORAGE_PREFIX = "onboarding_chat_messages_"

/**
 * Save chat messages to localStorage
 */
function saveMessagesToLocalStorage(workspaceId: string, messages: OnboardingChatMessage[]): void {
  try {
    const key = `${CHAT_MESSAGES_STORAGE_PREFIX}${workspaceId}`
    localStorage.setItem(key, JSON.stringify(messages))
  } catch {
    // localStorage 저장 실패는 무시
  }
}

/**
 * Load chat messages from localStorage
 */
function loadMessagesFromLocalStorage(workspaceId: string): OnboardingChatMessage[] {
  try {
    const key = `${CHAT_MESSAGES_STORAGE_PREFIX}${workspaceId}`
    const stored = localStorage.getItem(key)
    if (stored) {
      return JSON.parse(stored) as OnboardingChatMessage[]
    }
  } catch {
    // localStorage 로딩 실패는 무시
  }
  return []
}

/**
 * Clear chat messages from localStorage
 */
function clearMessagesFromLocalStorage(workspaceId: string): void {
  try {
    const key = `${CHAT_MESSAGES_STORAGE_PREFIX}${workspaceId}`
    localStorage.removeItem(key)
  } catch {
    // localStorage 삭제 실패는 무시
  }
}

/**
 * Hook for managing onboarding chat messages with persistence
 *
 * Features:
 * - Automatically syncs with Jotai store (SSE updates)
 * - Persists to localStorage for page refresh recovery
 * - Provides add/clear functions
 */
export function useOnboardingChatMessages(workspaceId: string) {
  const safeWorkspaceId = workspaceId || "__empty__"
  const progressAtom = getOnboardingProgressAtom(safeWorkspaceId)
  const [state, setState] = useAtom(progressAtom)

  // Load from localStorage on mount (only if store is empty)
  useEffect(() => {
    if (workspaceId && state.chatMessages.length === 0) {
      const storedMessages = loadMessagesFromLocalStorage(workspaceId)
      if (storedMessages.length > 0) {
        setState({ chatMessages: storedMessages })
      }
    }
  }, [workspaceId, state.chatMessages.length, setState])

  // Save to localStorage whenever chatMessages changes
  useEffect(() => {
    if (workspaceId && state.chatMessages.length > 0) {
      saveMessagesToLocalStorage(workspaceId, state.chatMessages)
    }
  }, [workspaceId, state.chatMessages])

  // Add a new message
  const addMessage = useCallback(
    (message: OnboardingChatMessage) => {
      // 중복 방지
      const isDuplicate = state.chatMessages.some((m: OnboardingChatMessage) => m.id === message.id)
      if (isDuplicate) {
        return
      }
      const updatedMessages = [...state.chatMessages, message].slice(-50)
      setState({ chatMessages: updatedMessages })
    },
    [state.chatMessages, setState],
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    setState({ chatMessages: [] })
    if (workspaceId) {
      clearMessagesFromLocalStorage(workspaceId)
    }
  }, [workspaceId, setState])

  return {
    chatMessages: state.chatMessages,
    phaseSummaries: state.phaseSummaries,
    addMessage,
    clearMessages,
  }
}
