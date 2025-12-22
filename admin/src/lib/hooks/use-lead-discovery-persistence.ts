/**
 * Lead Discovery Persistence Hook
 * SharedWorker + Service Worker + IndexedDB + BroadcastChannel 통합
 *
 * 아키텍처:
 * 1. SharedWorker: SSE 스트림 관리 (메인, 탭 간 공유)
 * 2. Service Worker: 오프라인 지원, 백그라운드 복구
 * 3. IndexedDB: 세션 상태 영구 저장
 * 4. BroadcastChannel: 실시간 탭 동기화
 *
 * 폴백 순서:
 * SharedWorker → BroadcastChannel + IndexedDB → Polling
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { type SSEEventData, useSSEWorker } from "@/lib/api/hooks/use-sse-worker"
import {
  cleanupLeadDiscoveryPersistence,
  initLeadDiscoveryPersistence,
  useLeadDiscoverySW,
} from "@/lib/hooks/use-lead-discovery-sw"
import type { SessionStatus, StoredResult, StoredSession } from "@/lib/idb/session-store"

// 통합 세션 상태
export type PersistentSession = {
  id: string
  backendSessionId?: string
  workspaceId: string
  query: string
  status: SessionStatus
  progress: number
  message: string
  // SSE 이벤트 데이터
  eventData?: SSEEventData
  // 메타데이터
  recommendations?: unknown[]
  clarificationData?: unknown
  results?: unknown[]
  totalCount?: number
  hasMore?: boolean
  totalAvailable?: number
  analysisSummary?: string
  analyzedPages?: unknown[]
  error?: string
  // 타임스탬프
  createdAt: number
  updatedAt: number
}

// 콜백
export type PersistenceCallbacks = {
  onSessionUpdate?: (session: PersistentSession) => void
  onSessionComplete?: (session: PersistentSession, results?: unknown[]) => void
  onSessionError?: (sessionId: string, error: string) => void
  onReconnected?: (session: PersistentSession) => void
}

// 영구 저장 초기화 (앱 시작 시 한 번 호출)
let persistenceInitialized = false

/**
 * 영구 저장 시스템 초기화
 */
export function initPersistence(): void {
  if (persistenceInitialized) {
    return
  }
  persistenceInitialized = true
  initLeadDiscoveryPersistence()
}

/**
 * 영구 저장 시스템 정리 (앱 종료 시)
 */
export function cleanupPersistence(): void {
  cleanupLeadDiscoveryPersistence()
  persistenceInitialized = false
}

/**
 * SSE 이벤트 데이터를 StoredSession으로 변환
 */
function eventDataToStoredSession(
  sessionId: string,
  workspaceId: string,
  query: string,
  data: SSEEventData,
  existingSession?: Partial<StoredSession>,
): StoredSession {
  const now = Date.now()

  return {
    id: sessionId,
    backendSessionId: data.sessionId || existingSession?.backendSessionId,
    workspaceId,
    query,
    status: mapEventStatusToSessionStatus(data.status),
    progress: data.progress ?? existingSession?.progress ?? 0,
    message: data.message ?? existingSession?.message ?? "",
    mode: data.mode ?? existingSession?.mode,
    recommendations: data.recommendations ?? existingSession?.recommendations,
    clarificationData: data.clarificationData ?? existingSession?.clarificationData,
    analysisSummary: data.analysisSummary ?? existingSession?.analysisSummary,
    analyzedPages: data.analyzedPages ?? existingSession?.analyzedPages,
    error: data.error ?? existingSession?.error,
    createdAt: existingSession?.createdAt ?? now,
    updatedAt: now,
  }
}

/**
 * 이벤트 상태를 세션 상태로 매핑
 */
function mapEventStatusToSessionStatus(status: string): SessionStatus {
  switch (status) {
    case "routing":
    case "analyzing":
    case "searching":
    case "processing":
      return "streaming"
    case "waiting_selection":
      return "waiting_selection"
    case "waiting_clarification":
      return "waiting_clarification"
    case "complete":
      return "complete"
    case "error":
      return "error"
    default:
      return "streaming"
  }
}

/**
 * StoredSession을 PersistentSession으로 변환
 */
function storedSessionToPersistent(
  stored: StoredSession,
  eventData?: SSEEventData,
): PersistentSession {
  return {
    ...stored,
    eventData,
  }
}

/**
 * Lead Discovery Persistence Hook
 * SharedWorker + Service Worker + IndexedDB + BroadcastChannel 통합
 */
export function useLeadDiscoveryPersistence(workspaceId: string, callbacks?: PersistenceCallbacks) {
  const [activeSession, setActiveSession] = useState<PersistentSession | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const callbacksRef = useRef(callbacks)
  const currentSessionRef = useRef<{ id: string; query: string } | null>(null)

  // 콜백 ref 업데이트
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // SharedWorker 훅
  const sseWorker = useSSEWorker({
    onStatusUpdate: (sessionId, data) => {
      const current = currentSessionRef.current
      if (!current) {
        return
      }

      const storedSession = eventDataToStoredSession(sessionId, workspaceId, current.query, data)

      const persistentSession = storedSessionToPersistent(storedSession, data)
      setActiveSession(persistentSession)

      // IndexedDB에 저장 및 브로드캐스트
      swHook.saveAndBroadcastSession(storedSession).catch((error) => {
        console.error("[Persistence] 세션 저장 실패:", error)
      })

      callbacksRef.current?.onSessionUpdate?.(persistentSession)
    },

    onComplete: (sessionId, data) => {
      const current = currentSessionRef.current
      if (!current) {
        return
      }

      const storedSession = eventDataToStoredSession(sessionId, workspaceId, current.query, data)

      const persistentSession = storedSessionToPersistent(storedSession, data)
      setActiveSession(persistentSession)

      // 결과 저장
      const storedResult: StoredResult = {
        sessionId,
        results: data.results || [],
        totalCount: data.totalCount || 0,
        hasMore: data.hasMore ?? false,
        totalAvailable: data.totalAvailable || 0,
        savedAt: Date.now(),
      }

      swHook.saveAndBroadcastComplete(storedSession, storedResult).catch((error) => {
        console.error("[Persistence] 완료 저장 실패:", error)
      })

      callbacksRef.current?.onSessionComplete?.(persistentSession, data.results)
    },

    onError: (sessionId, error) => {
      swHook.saveAndBroadcastError(sessionId, error).catch((err) => {
        console.error("[Persistence] 에러 저장 실패:", err)
      })

      callbacksRef.current?.onSessionError?.(sessionId, error)
    },

    onConnectionLost: (_sessionId) => {
      // 연결 끊김 시 IndexedDB에서 복구 시도
      tryRecoverSession()
    },
  })

  // Service Worker + BroadcastChannel 훅
  const swHook = useLeadDiscoverySW({
    onSessionUpdate: (session) => {
      // 다른 탭에서 업데이트된 세션 정보 수신
      if (session.id && session.workspaceId === workspaceId) {
        const persistentSession = storedSessionToPersistent(session as StoredSession)
        setActiveSession(persistentSession)
        callbacksRef.current?.onSessionUpdate?.(persistentSession)
      }
    },

    onSessionComplete: (session, results) => {
      if (session.id && session.workspaceId === workspaceId) {
        const persistentSession = storedSessionToPersistent(session as StoredSession)
        setActiveSession(persistentSession)
        callbacksRef.current?.onSessionComplete?.(persistentSession, results)
      }
    },

    onSessionError: (sessionId, error) => {
      callbacksRef.current?.onSessionError?.(sessionId, error)
    },

    onActiveSessionsReceived: (sessions) => {
      // 다른 탭에서 활성 세션 목록 수신
      const mySession = sessions.find((s) => s.workspaceId === workspaceId)
      if (mySession && !activeSession) {
        const persistentSession = storedSessionToPersistent(mySession as StoredSession)
        setActiveSession(persistentSession)
        callbacksRef.current?.onReconnected?.(persistentSession)
      }
    },
  })

  /**
   * 세션 복구 시도
   */
  const tryRecoverSession = useCallback(async () => {
    if (isRecovering) {
      return
    }
    setIsRecovering(true)

    try {
      // IndexedDB에서 활성 세션 조회
      const activeSessions = await swHook.getActiveSessionList()
      const mySession = activeSessions.find((s) => s.workspaceId === workspaceId)

      if (mySession) {
        // 결과도 함께 복구
        const results = await swHook.recoverResults(mySession.id)

        const persistentSession: PersistentSession = {
          ...mySession,
          results: results?.results,
          totalCount: results?.totalCount,
          hasMore: results?.hasMore,
          totalAvailable: results?.totalAvailable,
        }

        setActiveSession(persistentSession)
        callbacksRef.current?.onReconnected?.(persistentSession)
      }
    } catch (error) {
      console.error("[Persistence] 세션 복구 실패:", error)
    } finally {
      setIsRecovering(false)
    }
  }, [workspaceId, isRecovering, swHook])

  // 초기 세션 복구
  useEffect(() => {
    tryRecoverSession()
  }, [tryRecoverSession]) // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * 검색 시작
   */
  const startSearch = useCallback(
    (query: string, locale?: string): boolean => {
      currentSessionRef.current = { id: "", query }

      // SharedWorker를 통해 검색 시작
      const success = sseWorker.startSearch(query, workspaceId, locale)

      if (!success) {
        // SharedWorker 사용 불가 시 직접 API 호출 폴백
        console.warn("[Persistence] SharedWorker 사용 불가, 폴백 필요")
        return false
      }

      return true
    },
    [sseWorker, workspaceId],
  )

  /**
   * 추천 선택
   */
  const selectRecommendation = useCallback(
    (sessionId: string, recommendationId: string): boolean =>
      sseWorker.selectRecommendation(sessionId, recommendationId, workspaceId),
    [sseWorker, workspaceId],
  )

  /**
   * 확인 질문 답변
   */
  const submitClarification = useCallback(
    (sessionId: string, answers: Record<string, string>): boolean =>
      sseWorker.submitClarification(sessionId, answers, workspaceId),
    [sseWorker, workspaceId],
  )

  /**
   * 검색 중단
   */
  const abortSearch = useCallback(
    (sessionId: string): void => {
      sseWorker.abortSearch(sessionId)
      setActiveSession(null)
      currentSessionRef.current = null
    },
    [sseWorker],
  )

  /**
   * 세션 새로고침 (수동 복구)
   */
  const refreshSession = useCallback(() => {
    tryRecoverSession()
  }, [tryRecoverSession])

  /**
   * 세션 초기화
   */
  const clearSession = useCallback(() => {
    setActiveSession(null)
    currentSessionRef.current = null
  }, [])

  return {
    // 상태
    activeSession,
    isRecovering,

    // 지원 여부
    isWorkerReady: sseWorker.isWorkerReady,
    isWorkerSupported: sseWorker.isWorkerSupported,
    isOfflineSupported: swHook.isSupported,
    isOnline: swHook.isOnline,

    // 검색 액션
    startSearch,
    selectRecommendation,
    submitClarification,
    abortSearch,

    // 세션 관리
    refreshSession,
    clearSession,
    tryRecoverSession,

    // 유틸리티
    cleanup: swHook.cleanup,
  }
}

/**
 * 전역 초기화 (App.tsx에서 호출)
 */
export function useInitPersistence(): void {
  useEffect(() => {
    initPersistence()

    return () => {
      cleanupPersistence()
    }
  }, [])
}
