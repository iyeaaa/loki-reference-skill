/**
 * SSE Stream Shared Worker
 * 백그라운드에서 SSE 스트림을 관리하여 페이지 이동 후에도 검색 진행 유지
 *
 * 주요 기능:
 * - 여러 탭/컴포넌트 간 SSE 연결 공유
 * - 페이지 이동 후에도 검색 세션 유지
 * - 검색 상태 폴링 모드 지원 (SSE 연결 끊김 시 폴백)
 */

// Shared Worker 컨텍스트 타입
type SharedWorkerGlobalScopeInterface = {
  onconnect: ((event: MessageEvent) => void) | null
}
declare const self: SharedWorkerGlobalScopeInterface

// 메시지 타입 정의
type IncomingMessage =
  | { type: "connect"; sessionId: string }
  | { type: "disconnect"; sessionId: string }
  | { type: "start_search"; payload: SearchPayload }
  | { type: "select_recommendation"; payload: SelectPayload }
  | { type: "clarify"; payload: ClarifyPayload }
  | { type: "abort"; sessionId: string }
  | { type: "get_status"; sessionId: string }
  | { type: "poll_session"; sessionId: string }

type OutgoingMessage =
  | { type: "status_update"; sessionId: string; data: SSEEventData }
  | { type: "search_complete"; sessionId: string; data: SSEEventData }
  | { type: "search_error"; sessionId: string; error: string }
  | { type: "session_status"; sessionId: string; status: SessionStatus }
  | { type: "connection_lost"; sessionId: string }
  | { type: "poll_result"; sessionId: string; data: PollResult }

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

type SSEEventData = {
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

type SessionStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "waiting_selection"
  | "waiting_clarification"
  | "complete"
  | "error"
  | "disconnected"

type PollResult = {
  exists: boolean
  status?: string
  progress?: number
  hasResults?: boolean
  resultCount?: number
  error?: string
}

// 세션별 상태 관리
type SessionState = {
  id: string
  backendSessionId?: string
  status: SessionStatus
  lastEventData?: SSEEventData
  abortController?: AbortController
  ports: Set<MessagePort> // 연결된 모든 포트 (여러 탭)
  createdAt: number
  updatedAt: number
}

// 전역 세션 저장소
const sessions = new Map<string, SessionState>()

// 모든 연결된 포트
const allPorts = new Set<MessagePort>()

/**
 * Shared Worker 연결 처리
 */
self.onconnect = (event: MessageEvent) => {
  const port = event.ports[0]
  allPorts.add(port)

  port.onmessage = (e: MessageEvent<IncomingMessage>) => {
    handleMessage(e.data, port)
  }

  port.start()

  // 연결 시 현재 진행 중인 세션 상태 전송
  sessions.forEach((session) => {
    if (session.lastEventData && session.status !== "idle") {
      port.postMessage({
        type: "status_update",
        sessionId: session.id,
        data: session.lastEventData,
      } as OutgoingMessage)
    }
  })
}

/**
 * 메시지 핸들러
 */
function handleMessage(message: IncomingMessage, port: MessagePort) {
  switch (message.type) {
    case "connect": {
      const session = getOrCreateSession(message.sessionId)
      session.ports.add(port)
      // 현재 상태 전송
      if (session.lastEventData) {
        port.postMessage({
          type: "status_update",
          sessionId: session.id,
          data: session.lastEventData,
        } as OutgoingMessage)
      }
      break
    }

    case "disconnect": {
      const session = sessions.get(message.sessionId)
      if (session) {
        session.ports.delete(port)
      }
      break
    }

    case "start_search":
      startSearch(message.payload, port)
      break

    case "select_recommendation":
      selectRecommendation(message.payload, port)
      break

    case "clarify":
      submitClarification(message.payload, port)
      break

    case "abort": {
      const session = sessions.get(message.sessionId)
      if (session?.abortController) {
        session.abortController.abort()
        session.status = "idle"
        session.updatedAt = Date.now()
      }
      break
    }

    case "get_status": {
      const session = sessions.get(message.sessionId)
      port.postMessage({
        type: "session_status",
        sessionId: message.sessionId,
        status: session?.status || "idle",
      } as OutgoingMessage)
      break
    }

    case "poll_session":
      pollSessionStatus(message.sessionId, port)
      break
  }
}

/**
 * 세션 가져오기 또는 생성
 */
function getOrCreateSession(sessionId: string): SessionState {
  let session = sessions.get(sessionId)
  if (!session) {
    session = {
      id: sessionId,
      status: "idle",
      ports: new Set(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    sessions.set(sessionId, session)
  }
  return session
}

/**
 * 모든 연결된 포트에 메시지 브로드캐스트
 */
function broadcastToSession(session: SessionState, message: OutgoingMessage) {
  session.ports.forEach((port) => {
    try {
      port.postMessage(message)
    } catch {
      // 포트가 닫혔을 수 있음
      session.ports.delete(port)
    }
  })
}

/**
 * SSE 스트림 처리
 */
async function processSSEStream(
  response: Response,
  session: SessionState,
  _port: MessagePort,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error("스트림을 읽을 수 없습니다")
  }

  const decoder = new TextDecoder()
  let buffer = ""

  const handleEvent = (eventType: string, data: Record<string, unknown>) => {
    let eventData: SSEEventData | null = null

    switch (eventType) {
      case "connected":
        session.backendSessionId = data.sessionId as string
        eventData = {
          status: "routing",
          message: "검색 모드 분석 중...",
          progress: 5,
          sessionId: data.sessionId as string,
        }
        break

      case "node-start":
      case "progress":
        eventData = {
          status: (data.status as string) || session.lastEventData?.status || "routing",
          message: (data.message as string) || session.lastEventData?.message || "",
          progress:
            (data.percent as number) ??
            (data.progress as number) ??
            session.lastEventData?.progress ??
            0,
          sessionId: session.backendSessionId,
          analyzedPages:
            ((data.details as Record<string, unknown>)?.pages as unknown[]) ||
            session.lastEventData?.analyzedPages,
        }
        break

      case "text_chunk":
        eventData = {
          ...session.lastEventData,
          status: session.lastEventData?.status || "analyzing",
          message: session.lastEventData?.message || "",
          progress: session.lastEventData?.progress || 70,
          analysisSummary:
            (data.accumulatedText as string) || session.lastEventData?.analysisSummary,
        }
        break

      case "interrupt": {
        const interruptType = data.type as string
        if (interruptType === "clarification_required") {
          session.status = "waiting_clarification"
          eventData = {
            status: "waiting_clarification",
            message: (data.message as string) || "검색 조건을 더 명확히 해주세요",
            progress: 30,
            sessionId: session.backendSessionId,
            clarificationData: {
              questions: data.questions,
              understood: data.understood,
              confidence: data.confidence,
            },
          }
        } else {
          session.status = "waiting_selection"
          eventData = {
            status: "waiting_selection",
            message: (data.message as string) || "바이어 타겟을 선택해주세요",
            progress: 60,
            sessionId: session.backendSessionId,
            recommendations: (data.recommendations as unknown[]) || [],
          }
        }
        break
      }

      case "complete": {
        session.status = "complete"
        eventData = {
          status: "complete",
          message: `${(data.results as unknown[])?.length || 0}개 리드 탐색 완료`,
          progress: 100,
          sessionId: session.backendSessionId,
          results: data.results as unknown[],
          totalCount: data.totalCount as number,
          hasMore: data.hasMore as boolean,
          totalAvailable: data.totalAvailable as number,
        }

        broadcastToSession(session, {
          type: "search_complete",
          sessionId: session.id,
          data: eventData,
        })
        break
      }

      case "error": {
        session.status = "error"
        const errorMsg = (data.message as string) || (data.error as string) || "알 수 없는 오류"
        eventData = {
          status: "error",
          message: errorMsg,
          progress: 0,
          sessionId: session.backendSessionId,
          error: errorMsg,
        }

        broadcastToSession(session, {
          type: "search_error",
          sessionId: session.id,
          error: errorMsg,
        })
        break
      }
    }

    if (eventData) {
      session.lastEventData = eventData
      session.updatedAt = Date.now()

      broadcastToSession(session, {
        type: "status_update",
        sessionId: session.id,
        data: eventData,
      })
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }

      buffer += decoder.decode(value, { stream: true })

      const lastDoubleNewline = buffer.lastIndexOf("\n\n")
      if (lastDoubleNewline !== -1) {
        const completeChunks = buffer.substring(0, lastDoubleNewline + 2)
        buffer = buffer.substring(lastDoubleNewline + 2)

        const events = parseSSEChunk(completeChunks)
        for (const { event, data } of events) {
          handleEvent(event, data)
        }
      }
    }

    // 남은 버퍼 처리
    if (buffer.trim()) {
      const events = parseSSEChunk(buffer)
      for (const { event, data } of events) {
        handleEvent(event, data)
      }
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      // 정상적인 취소
      return
    }
    throw error
  }
}

/**
 * SSE 청크 파싱
 */
function parseSSEChunk(chunk: string): Array<{ event: string; data: Record<string, unknown> }> {
  const results: Array<{ event: string; data: Record<string, unknown> }> = []
  const blocks = chunk.split("\n\n").filter((b) => b.trim())

  for (const block of blocks) {
    const lines = block.split("\n")
    let eventType = ""
    let eventData = ""

    for (const line of lines) {
      const eventMatch = line.match(/^event:\s*(.+)$/)
      const dataMatch = line.match(/^data:\s*(.+)$/)
      if (eventMatch) {
        eventType = eventMatch[1]
      }
      if (dataMatch) {
        eventData = dataMatch[1]
      }
    }

    if (eventType && eventData) {
      try {
        results.push({ event: eventType, data: JSON.parse(eventData) })
      } catch {
        // JSON 파싱 실패 시 무시
      }
    }
  }

  return results
}

/**
 * 검색 시작
 */
async function startSearch(payload: SearchPayload, port: MessagePort) {
  const sessionId = `session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const session = getOrCreateSession(sessionId)
  session.ports.add(port)
  session.status = "connecting"
  session.abortController = new AbortController()

  try {
    const response = await fetch(`${payload.baseUrl}/api/v1/lead-discovery/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        query: payload.query,
        workspaceId: payload.workspaceId,
        locale: payload.locale || "ko",
      }),
      signal: session.abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    session.status = "streaming"
    await processSSEStream(response, session, port)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return
    }

    session.status = "error"
    const errorMsg = error instanceof Error ? error.message : "검색 실패"

    broadcastToSession(session, {
      type: "search_error",
      sessionId: session.id,
      error: errorMsg,
    })
  }
}

/**
 * 추천 선택
 */
async function selectRecommendation(payload: SelectPayload, port: MessagePort) {
  const session = sessions.get(payload.sessionId)
  if (!session) {
    port.postMessage({
      type: "search_error",
      sessionId: payload.sessionId,
      error: "세션을 찾을 수 없습니다",
    } as OutgoingMessage)
    return
  }

  session.status = "streaming"
  session.abortController = new AbortController()

  try {
    const response = await fetch(`${payload.baseUrl}/api/v1/lead-discovery/select`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        selectedRecommendationId: payload.selectedRecommendationId,
        workspaceId: payload.workspaceId,
      }),
      signal: session.abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    await processSSEStream(response, session, port)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return
    }

    session.status = "error"
    const errorMsg = error instanceof Error ? error.message : "선택 실패"

    broadcastToSession(session, {
      type: "search_error",
      sessionId: session.id,
      error: errorMsg,
    })
  }
}

/**
 * 확인 질문 답변 제출
 */
async function submitClarification(payload: ClarifyPayload, port: MessagePort) {
  const session = sessions.get(payload.sessionId)
  if (!session) {
    port.postMessage({
      type: "search_error",
      sessionId: payload.sessionId,
      error: "세션을 찾을 수 없습니다",
    } as OutgoingMessage)
    return
  }

  session.status = "streaming"
  session.abortController = new AbortController()

  try {
    const response = await fetch(`${payload.baseUrl}/api/v1/lead-discovery/clarify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({
        sessionId: payload.sessionId,
        answers: payload.answers,
        workspaceId: payload.workspaceId,
      }),
      signal: session.abortController.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    await processSSEStream(response, session, port)
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return
    }

    session.status = "error"
    const errorMsg = error instanceof Error ? error.message : "답변 제출 실패"

    broadcastToSession(session, {
      type: "search_error",
      sessionId: session.id,
      error: errorMsg,
    })
  }
}

/**
 * 세션 상태 폴링 (SSE 연결 끊김 시 폴백)
 */
async function pollSessionStatus(sessionId: string, port: MessagePort) {
  // 로컬 세션 상태 확인
  const localSession = sessions.get(sessionId)

  if (localSession) {
    port.postMessage({
      type: "poll_result",
      sessionId,
      data: {
        exists: true,
        status: localSession.status,
        progress: localSession.lastEventData?.progress || 0,
        hasResults: (localSession.lastEventData?.results?.length || 0) > 0,
        resultCount: localSession.lastEventData?.results?.length || 0,
      },
    } as OutgoingMessage)
    return
  }

  // 로컬에 없으면 서버에 세션 상태 확인 요청 가능
  // (백엔드 /api/v1/lead-discovery/session/:id 엔드포인트 필요)
  port.postMessage({
    type: "poll_result",
    sessionId,
    data: {
      exists: false,
    },
  } as OutgoingMessage)
}

/**
 * 오래된 세션 정리 (30분 이상)
 */
function cleanupExpiredSessions() {
  const TTL_MS = 30 * 60 * 1000 // 30분
  const now = Date.now()

  sessions.forEach((session, id) => {
    if (now - session.updatedAt > TTL_MS && session.status !== "streaming") {
      session.abortController?.abort()
      sessions.delete(id)
    }
  })
}

// 주기적으로 만료된 세션 정리 (5분마다)
setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
