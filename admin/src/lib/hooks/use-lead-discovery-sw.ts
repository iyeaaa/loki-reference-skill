/**
 * Lead Discovery Service Worker & BroadcastChannel Hook
 * Service Worker와 BroadcastChannel을 통한 오프라인 지원 및 탭 동기화
 *
 * 주요 기능:
 * - Service Worker 등록 및 상태 관리
 * - IndexedDB 세션 영구 저장
 * - BroadcastChannel 탭 간 동기화
 * - 오프라인 복구 지원
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  addMessageHandler,
  type BroadcastMessage,
  broadcastSessionComplete,
  broadcastSessionError,
  broadcastSessionUpdate,
  closeChannel,
  isBroadcastChannelSupported,
  notifyTabOpened,
  requestActiveSessions,
  respondWithActiveSessions,
} from "@/lib/broadcast/lead-discovery-channel"
import {
  cleanupOldResults,
  cleanupOldSessions,
  getActiveSessions,
  getResults,
  getSession,
  isIndexedDBSupported,
  type StoredResult,
  type StoredSession,
  saveResults,
  saveSession,
} from "@/lib/idb/session-store"

// Service Worker 상태
export type SWStatus = "unsupported" | "installing" | "waiting" | "active" | "error"

// 탭 동기화 콜백
export type TabSyncCallbacks = {
  onSessionUpdate?: (session: Partial<StoredSession>) => void
  onSessionComplete?: (session: Partial<StoredSession>, results?: unknown[]) => void
  onSessionError?: (sessionId: string, error: string) => void
  onActiveSessionsReceived?: (sessions: Partial<StoredSession>[]) => void
}

// Service Worker 등록 상태
let swRegistration: ServiceWorkerRegistration | null = null
let isRegistering = false

/**
 * Service Worker 지원 여부 확인
 */
function isServiceWorkerSupported(): boolean {
  return "serviceWorker" in navigator
}

/**
 * Service Worker 등록
 */
async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isServiceWorkerSupported()) {
    return null
  }

  // 이미 등록 중이면 대기
  if (isRegistering) {
    return new Promise((resolve) => {
      const check = () => {
        if (isRegistering) {
          setTimeout(check, 100)
        } else {
          resolve(swRegistration)
        }
      }
      check()
    })
  }

  // 이미 등록되어 있으면 반환
  if (swRegistration) {
    return swRegistration
  }

  isRegistering = true

  try {
    const registration = await navigator.serviceWorker.register("/lead-discovery-sw.js", {
      scope: "/",
      updateViaCache: "none",
    })

    swRegistration = registration
    console.log("[SW Hook] Service Worker 등록 성공")

    // 업데이트 체크
    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing
      if (newWorker) {
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[SW Hook] 새 Service Worker 설치됨, 업데이트 대기 중")
          }
        })
      }
    })

    return registration
  } catch (error) {
    console.error("[SW Hook] Service Worker 등록 실패:", error)
    return null
  } finally {
    isRegistering = false
  }
}

/**
 * Service Worker에 메시지 전송 (응답 대기)
 * 향후 SW와의 직접 통신에 사용 예정
 */
export async function sendMessageToSW<T>(
  message: { type: string; payload?: unknown },
  timeout = 3000,
): Promise<T | null> {
  const controller = navigator.serviceWorker?.controller
  if (!controller) {
    return null
  }

  return new Promise((resolve) => {
    const messageChannel = new MessageChannel()

    const timer = setTimeout(() => {
      resolve(null)
    }, timeout)

    messageChannel.port1.onmessage = (event) => {
      clearTimeout(timer)
      if (event.data.success) {
        resolve(event.data.data)
      } else {
        console.error("[SW Hook] SW 응답 오류:", event.data.error)
        resolve(null)
      }
    }

    controller.postMessage(message, [messageChannel.port2])
  })
}

/**
 * Lead Discovery Service Worker Hook
 */
export function useLeadDiscoverySW(callbacks?: TabSyncCallbacks) {
  const [swStatus, setSWStatus] = useState<SWStatus>("unsupported")
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  )
  const callbacksRef = useRef(callbacks)

  // 콜백 ref 업데이트
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // Service Worker 초기화
  useEffect(() => {
    if (!isServiceWorkerSupported()) {
      setSWStatus("unsupported")
      return
    }

    setSWStatus("installing")

    registerServiceWorker().then((registration) => {
      if (!registration) {
        setSWStatus("error")
        return
      }

      // 상태 결정
      if (registration.active) {
        setSWStatus("active")
      } else if (registration.waiting) {
        setSWStatus("waiting")
      } else if (registration.installing) {
        setSWStatus("installing")

        registration.installing.addEventListener("statechange", function listener() {
          if (this.state === "activated") {
            setSWStatus("active")
            this.removeEventListener("statechange", listener)
          }
        })
      }
    })
  }, [])

  // BroadcastChannel 메시지 핸들러
  useEffect(() => {
    if (!isBroadcastChannelSupported()) {
      return
    }

    const handleMessage = (message: BroadcastMessage) => {
      const cbs = callbacksRef.current

      switch (message.type) {
        case "session_update":
          if (message.payload?.session) {
            cbs?.onSessionUpdate?.(message.payload.session)
          }
          break

        case "session_complete":
          if (message.payload?.session) {
            cbs?.onSessionComplete?.(message.payload.session, message.payload.results)
          }
          break

        case "session_error":
          if (message.payload?.session?.id && message.payload?.error) {
            cbs?.onSessionError?.(message.payload.session.id, message.payload.error)
          }
          break

        case "request_active_sessions":
          // 다른 탭이 활성 세션 요청 → IndexedDB에서 조회 후 응답
          getActiveSessions()
            .then((sessions) => {
              respondWithActiveSessions(sessions)
            })
            .catch((error) => {
              console.error("[SW Hook] 활성 세션 조회 실패:", error)
            })
          break

        case "active_sessions_response":
          if (message.payload?.sessions) {
            cbs?.onActiveSessionsReceived?.(message.payload.sessions)
          }
          break
      }
    }

    // 탭 열림 알림 및 활성 세션 요청
    notifyTabOpened()
    requestActiveSessions()

    // 핸들러 등록
    const cleanup = addMessageHandler(handleMessage)

    return () => {
      cleanup()
    }
  }, [])

  // 온라인/오프라인 상태 감지
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // 세션 저장 및 브로드캐스트
  const saveAndBroadcastSession = useCallback(async (session: StoredSession): Promise<void> => {
    // IndexedDB에 저장
    await saveSession(session)

    // 다른 탭에 알림
    broadcastSessionUpdate(session)
  }, [])

  // 세션 완료 저장 및 브로드캐스트
  const saveAndBroadcastComplete = useCallback(
    async (session: StoredSession, results: StoredResult): Promise<void> => {
      // IndexedDB에 저장
      await saveSession(session)
      await saveResults(results)

      // 다른 탭에 알림
      broadcastSessionComplete(session, results.results)
    },
    [],
  )

  // 세션 에러 저장 및 브로드캐스트
  const saveAndBroadcastError = useCallback(
    async (sessionId: string, error: string): Promise<void> => {
      const session = await getSession(sessionId)
      if (session) {
        const errorSession: StoredSession = {
          ...session,
          status: "error",
          error,
          updatedAt: Date.now(),
        }
        await saveSession(errorSession)
      }

      // 다른 탭에 알림
      broadcastSessionError(sessionId, error)
    },
    [],
  )

  // 세션 복구 (IndexedDB에서)
  const recoverSession = useCallback(
    async (sessionId: string): Promise<StoredSession | null> => getSession(sessionId),
    [],
  )

  // 활성 세션 목록 조회
  const getActiveSessionList = useCallback(
    async (): Promise<StoredSession[]> => getActiveSessions(),
    [],
  )

  // 검색 결과 복구
  const recoverResults = useCallback(
    async (sessionId: string): Promise<StoredResult | null> => getResults(sessionId),
    [],
  )

  // 오래된 데이터 정리
  const cleanup = useCallback(async (): Promise<{ sessions: number; results: number }> => {
    const [sessions, results] = await Promise.all([cleanupOldSessions(), cleanupOldResults()])
    return { sessions, results }
  }, [])

  // Service Worker 업데이트 적용
  const applyUpdate = useCallback(async (): Promise<void> => {
    if (swRegistration?.waiting) {
      swRegistration.waiting.postMessage({ type: "SKIP_WAITING" })
      window.location.reload()
    }
  }, [])

  return {
    // 상태
    swStatus,
    isOnline,
    isSupported: isServiceWorkerSupported() && isIndexedDBSupported(),
    isBroadcastSupported: isBroadcastChannelSupported(),

    // 세션 관리
    saveAndBroadcastSession,
    saveAndBroadcastComplete,
    saveAndBroadcastError,
    recoverSession,
    getActiveSessionList,
    recoverResults,

    // 유틸리티
    cleanup,
    applyUpdate,
  }
}

/**
 * Cleanup 유틸리티 (앱 시작 시 호출)
 */
export async function initLeadDiscoveryPersistence(): Promise<void> {
  // Service Worker 등록
  if (isServiceWorkerSupported()) {
    registerServiceWorker().catch((error) => {
      console.error("[Persistence] SW 등록 실패:", error)
    })
  }

  // 오래된 데이터 정리 (백그라운드)
  if (isIndexedDBSupported()) {
    Promise.all([cleanupOldSessions(), cleanupOldResults()])
      .then(([sessions, results]) => {
        if (sessions > 0 || results > 0) {
          console.log(`[Persistence] 정리 완료: 세션 ${sessions}개, 결과 ${results}개 삭제`)
        }
      })
      .catch((error) => {
        console.error("[Persistence] 정리 실패:", error)
      })
  }
}

/**
 * BroadcastChannel cleanup (앱 종료 시)
 */
export function cleanupLeadDiscoveryPersistence(): void {
  closeChannel()
}
