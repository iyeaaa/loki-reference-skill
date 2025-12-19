/**
 * SSE Shared Worker Hook
 * Shared Worker를 통한 백그라운드 SSE 스트림 관리
 *
 * 주요 기능:
 * - 페이지 이동 후에도 검색 상태 유지
 * - 여러 탭 간 세션 공유
 * - 자동 재연결 및 폴링 폴백
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { API_BASE_URL } from "@/lib/env"

// 메시지 타입 정의
type WorkerMessage =
  | { type: "connect"; sessionId: string }
  | { type: "disconnect"; sessionId: string }
  | { type: "start_search"; payload: SearchPayload }
  | { type: "select_recommendation"; payload: SelectPayload }
  | { type: "clarify"; payload: ClarifyPayload }
  | { type: "abort"; sessionId: string }
  | { type: "get_status"; sessionId: string }
  | { type: "poll_session"; sessionId: string }

type SearchPayload = {
  baseUrl: string
  query: string
  workspaceId: string
  locale?: string
}

type SelectPayload = {
  baseUrl: string
  sessionId: string
  selectedRecommendationId: string
  workspaceId: string
}

type ClarifyPayload = {
  baseUrl: string
  sessionId: string
  answers: Record<string, string>
  workspaceId: string
}

type WorkerResponse =
  | { type: "status_update"; sessionId: string; data: SSEEventData }
  | { type: "search_complete"; sessionId: string; data: SSEEventData }
  | { type: "search_error"; sessionId: string; error: string }
  | { type: "session_status"; sessionId: string; status: string }
  | { type: "connection_lost"; sessionId: string }
  | { type: "poll_result"; sessionId: string; data: PollResult }

export type SSEEventData = {
  status: string
  message: string
  progress: number
  mode?: string
  sessionId?: string
  results?: unknown[]
  totalCount?: number
  recommendations?: unknown[]
  hasMore?: boolean
  totalAvailable?: number
  analyzedPages?: unknown[]
  analysisSummary?: string
  customerAnalysisSummary?: string
  clarificationData?: unknown
  error?: string
}

type PollResult = {
  exists: boolean
  status?: string
  progress?: number
  hasResults?: boolean
  resultCount?: number
  error?: string
}

type SSEWorkerCallbacks = {
  onStatusUpdate?: (sessionId: string, data: SSEEventData) => void
  onComplete?: (sessionId: string, data: SSEEventData) => void
  onError?: (sessionId: string, error: string) => void
  onConnectionLost?: (sessionId: string) => void
}

// Shared Worker 싱글톤
let sharedWorker: SharedWorker | null = null
let workerSupported: boolean | null = null

/**
 * Shared Worker 지원 여부 확인
 */
function isSharedWorkerSupported(): boolean {
  if (workerSupported !== null) {
    return workerSupported
  }
  workerSupported = typeof SharedWorker !== "undefined"
  return workerSupported
}

/**
 * Shared Worker 인스턴스 가져오기 (싱글톤)
 */
function getSharedWorker(): SharedWorker | null {
  if (!isSharedWorkerSupported()) {
    return null
  }

  if (!sharedWorker) {
    try {
      sharedWorker = new SharedWorker(
        new URL("../../workers/sse-stream.shared-worker.ts", import.meta.url),
        { type: "module", name: "lead-discovery-sse" },
      )
    } catch (error) {
      console.warn("[SSEWorker] SharedWorker 생성 실패:", error)
      workerSupported = false
      return null
    }
  }

  return sharedWorker
}

/**
 * SSE Shared Worker Hook
 */
export function useSSEWorker(callbacks: SSEWorkerCallbacks) {
  const [isWorkerReady, setIsWorkerReady] = useState(false)
  const [isWorkerSupported] = useState(() => isSharedWorkerSupported())
  const callbacksRef = useRef(callbacks)
  const portRef = useRef<MessagePort | null>(null)

  // 콜백 ref 업데이트
  useEffect(() => {
    callbacksRef.current = callbacks
  }, [callbacks])

  // Worker 초기화
  useEffect(() => {
    const worker = getSharedWorker()
    if (!worker) {
      setIsWorkerReady(false)
      return
    }

    const port = worker.port
    portRef.current = port

    port.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data
      const cbs = callbacksRef.current

      switch (message.type) {
        case "status_update":
          cbs.onStatusUpdate?.(message.sessionId, message.data)
          break
        case "search_complete":
          cbs.onComplete?.(message.sessionId, message.data)
          break
        case "search_error":
          cbs.onError?.(message.sessionId, message.error)
          break
        case "connection_lost":
          cbs.onConnectionLost?.(message.sessionId)
          break
      }
    }

    port.start()
    setIsWorkerReady(true)

    return () => {
      // 컴포넌트 언마운트 시에도 Worker는 유지 (다른 탭/컴포넌트에서 사용)
      // 필요시 disconnect 메시지 전송
    }
  }, [])

  /**
   * 세션 연결
   */
  const connectSession = useCallback((sessionId: string) => {
    if (!portRef.current) {
      return false
    }

    portRef.current.postMessage({
      type: "connect",
      sessionId,
    } as WorkerMessage)

    return true
  }, [])

  /**
   * 세션 연결 해제
   */
  const disconnectSession = useCallback((sessionId: string) => {
    if (!portRef.current) {
      return
    }

    portRef.current.postMessage({
      type: "disconnect",
      sessionId,
    } as WorkerMessage)
  }, [])

  /**
   * 검색 시작 (Worker를 통해)
   */
  const startSearch = useCallback(
    (query: string, workspaceId: string, locale?: string): boolean => {
      if (!portRef.current) {
        return false
      }

      portRef.current.postMessage({
        type: "start_search",
        payload: {
          baseUrl: API_BASE_URL,
          query,
          workspaceId,
          locale: locale || "ko",
        },
      } as WorkerMessage)

      return true
    },
    [],
  )

  /**
   * 추천 선택
   */
  const selectRecommendation = useCallback(
    (sessionId: string, recommendationId: string, workspaceId: string): boolean => {
      if (!portRef.current) {
        return false
      }

      portRef.current.postMessage({
        type: "select_recommendation",
        payload: {
          baseUrl: API_BASE_URL,
          sessionId,
          selectedRecommendationId: recommendationId,
          workspaceId,
        },
      } as WorkerMessage)

      return true
    },
    [],
  )

  /**
   * 확인 질문 답변
   */
  const submitClarification = useCallback(
    (sessionId: string, answers: Record<string, string>, workspaceId: string): boolean => {
      if (!portRef.current) {
        return false
      }

      portRef.current.postMessage({
        type: "clarify",
        payload: {
          baseUrl: API_BASE_URL,
          sessionId,
          answers,
          workspaceId,
        },
      } as WorkerMessage)

      return true
    },
    [],
  )

  /**
   * 검색 중단
   */
  const abortSearch = useCallback((sessionId: string) => {
    if (!portRef.current) {
      return
    }

    portRef.current.postMessage({
      type: "abort",
      sessionId,
    } as WorkerMessage)
  }, [])

  /**
   * 세션 상태 폴링
   */
  const pollSession = useCallback(async (sessionId: string): Promise<PollResult | null> => {
    if (!portRef.current) {
      return null
    }

    return new Promise((resolve) => {
      const handleMessage = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.type === "poll_result" && event.data.sessionId === sessionId) {
          portRef.current?.removeEventListener("message", handleMessage)
          resolve(event.data.data)
        }
      }

      portRef.current?.addEventListener("message", handleMessage)

      portRef.current?.postMessage({
        type: "poll_session",
        sessionId,
      } as WorkerMessage)

      // 타임아웃 (5초)
      setTimeout(() => {
        portRef.current?.removeEventListener("message", handleMessage)
        resolve(null)
      }, 5000)
    })
  }, [])

  return {
    isWorkerReady,
    isWorkerSupported,
    connectSession,
    disconnectSession,
    startSearch,
    selectRecommendation,
    submitClarification,
    abortSearch,
    pollSession,
  }
}

/**
 * 세션 상태 폴링 유틸리티 (Worker 없이도 사용 가능)
 * SSE 연결이 끊어졌을 때 서버에서 세션 상태를 폴링
 */
export async function pollSessionFromServer(sessionId: string): Promise<PollResult | null> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/lead-discovery/session/${sessionId}/status`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    )

    if (!response.ok) {
      if (response.status === 404) {
        return { exists: false }
      }
      throw new Error(`HTTP ${response.status}`)
    }

    const data = await response.json()
    return {
      exists: true,
      status: data.status,
      progress: data.progress,
      hasResults: data.hasResults,
      resultCount: data.resultCount,
    }
  } catch (error) {
    console.error("[pollSessionFromServer] 폴링 실패:", error)
    return null
  }
}
