/**
 * BroadcastChannel for Lead Discovery Tab Sync
 * 여러 탭 간 실시간 세션 상태 동기화
 *
 * 주요 기능:
 * - 탭 간 세션 상태 브로드캐스트
 * - 새 탭이 열렸을 때 활성 세션 알림
 * - 검색 결과 공유
 */

import type { StoredSession } from "@/lib/idb/session-store"

// 채널 이름
const CHANNEL_NAME = "lead-discovery-sync"

// 메시지 타입
export type BroadcastMessageType =
  | "session_update" // 세션 상태 업데이트
  | "session_complete" // 검색 완료
  | "session_error" // 에러 발생
  | "request_active_sessions" // 활성 세션 요청 (새 탭이 열렸을 때)
  | "active_sessions_response" // 활성 세션 응답
  | "tab_opened" // 새 탭 열림 알림
  | "tab_closed" // 탭 닫힘 알림

// 브로드캐스트 메시지
export type BroadcastMessage = {
  type: BroadcastMessageType
  tabId: string
  timestamp: number
  payload?: {
    session?: Partial<StoredSession>
    sessions?: Partial<StoredSession>[]
    error?: string
    results?: unknown[]
  }
}

// 이벤트 핸들러 타입
export type MessageHandler = (message: BroadcastMessage) => void

// 현재 탭 ID
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// BroadcastChannel 인스턴스
let channelInstance: BroadcastChannel | null = null
const messageHandlers: Set<MessageHandler> = new Set()
let isSupported: boolean | null = null

/**
 * BroadcastChannel 지원 여부 확인
 */
export function isBroadcastChannelSupported(): boolean {
  if (isSupported !== null) {
    return isSupported
  }
  isSupported = typeof BroadcastChannel !== "undefined"
  return isSupported
}

/**
 * 채널 인스턴스 가져오기 (싱글톤)
 */
function getChannel(): BroadcastChannel | null {
  if (!isBroadcastChannelSupported()) {
    return null
  }

  if (!channelInstance) {
    try {
      channelInstance = new BroadcastChannel(CHANNEL_NAME)

      channelInstance.onmessage = (event: MessageEvent<BroadcastMessage>) => {
        // 자신이 보낸 메시지는 무시
        if (event.data.tabId === TAB_ID) {
          return
        }

        // 등록된 모든 핸들러에게 메시지 전달
        messageHandlers.forEach((handler) => {
          try {
            handler(event.data)
          } catch (error) {
            console.error("[BroadcastChannel] 핸들러 오류:", error)
          }
        })
      }

      channelInstance.onmessageerror = () => {
        console.error("[BroadcastChannel] 메시지 직렬화 오류")
      }
    } catch (error) {
      console.warn("[BroadcastChannel] 채널 생성 실패:", error)
      isSupported = false
      return null
    }
  }

  return channelInstance
}

/**
 * 현재 탭 ID 가져오기
 */
export function getTabId(): string {
  return TAB_ID
}

/**
 * 메시지 핸들러 등록
 */
export function addMessageHandler(handler: MessageHandler): () => void {
  // 채널 초기화 (첫 핸들러 등록 시)
  getChannel()

  messageHandlers.add(handler)

  // cleanup 함수 반환
  return () => {
    messageHandlers.delete(handler)
  }
}

/**
 * 모든 핸들러 제거
 */
export function removeAllHandlers(): void {
  messageHandlers.clear()
}

/**
 * 메시지 브로드캐스트
 */
export function broadcast(
  type: BroadcastMessageType,
  payload?: BroadcastMessage["payload"],
): boolean {
  const channel = getChannel()
  if (!channel) {
    return false
  }

  try {
    const message: BroadcastMessage = {
      type,
      tabId: TAB_ID,
      timestamp: Date.now(),
      payload,
    }

    channel.postMessage(message)
    return true
  } catch (error) {
    console.error("[BroadcastChannel] 브로드캐스트 실패:", error)
    return false
  }
}

/**
 * 세션 업데이트 브로드캐스트
 */
export function broadcastSessionUpdate(session: Partial<StoredSession>): boolean {
  return broadcast("session_update", { session })
}

/**
 * 검색 완료 브로드캐스트
 */
export function broadcastSessionComplete(
  session: Partial<StoredSession>,
  results?: unknown[],
): boolean {
  return broadcast("session_complete", { session, results })
}

/**
 * 에러 브로드캐스트
 */
export function broadcastSessionError(sessionId: string, error: string): boolean {
  return broadcast("session_error", {
    session: { id: sessionId, status: "error", error },
    error,
  })
}

/**
 * 활성 세션 요청 (새 탭이 열렸을 때)
 */
export function requestActiveSessions(): boolean {
  return broadcast("request_active_sessions")
}

/**
 * 활성 세션 응답
 */
export function respondWithActiveSessions(sessions: Partial<StoredSession>[]): boolean {
  return broadcast("active_sessions_response", { sessions })
}

/**
 * 탭 열림 알림
 */
export function notifyTabOpened(): boolean {
  return broadcast("tab_opened")
}

/**
 * 탭 닫힘 알림
 */
export function notifyTabClosed(): boolean {
  return broadcast("tab_closed")
}

/**
 * 채널 닫기 (cleanup)
 */
export function closeChannel(): void {
  if (channelInstance) {
    notifyTabClosed()
    channelInstance.close()
    channelInstance = null
  }
  messageHandlers.clear()
}

// 페이지 언로드 시 자동 cleanup
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    closeChannel()
  })
}
