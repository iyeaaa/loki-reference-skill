/**
 * SSE Helper Utilities
 * better-sse 패턴을 Elysia에 맞게 구현
 */

export interface SSEEvent {
  event?: string
  data: unknown
  id?: string
  retry?: number
}

export interface SSESessionOptions {
  keepAlive?: boolean
  keepAliveInterval?: number
  onClose?: () => void
}

/**
 * SSE 세션 클래스
 * better-sse의 Session 패턴 구현
 */
export class SSESession {
  private controller: ReadableStreamDefaultController<Uint8Array>
  private encoder = new TextEncoder()
  private isClosed = false
  private keepAliveTimer?: Timer
  private options: Required<SSESessionOptions>

  constructor(
    controller: ReadableStreamDefaultController<Uint8Array>,
    options: SSESessionOptions = {},
  ) {
    this.controller = controller
    this.options = {
      keepAlive: options.keepAlive ?? true,
      keepAliveInterval: options.keepAliveInterval ?? 15000,
      onClose: options.onClose ?? (() => {}),
    }

    if (this.options.keepAlive) {
      this.startKeepAlive()
    }
  }

  /**
   * SSE 이벤트 전송
   */
  push(event: SSEEvent): boolean {
    if (this.isClosed) {
      console.warn("[SSE] Attempted to push to closed session:", event.event)
      return false
    }

    try {
      let message = ""

      if (event.id) {
        message += `id: ${event.id}\n`
      }

      if (event.event) {
        message += `event: ${event.event}\n`
      }

      if (event.retry) {
        message += `retry: ${event.retry}\n`
      }

      const dataStr = typeof event.data === "string" ? event.data : JSON.stringify(event.data)
      message += `data: ${dataStr}\n\n`

      this.controller.enqueue(this.encoder.encode(message))
      console.log("[SSE] Push success:", event.event)
      return true
    } catch (error) {
      console.error("[SSE] Push failed:", error, "Event:", event.event)
      this.isClosed = true
      return false
    }
  }

  /**
   * Keep-alive (heartbeat) 시작
   */
  private startKeepAlive(): void {
    this.keepAliveTimer = setInterval(() => {
      if (this.isClosed) {
        this.stopKeepAlive()
        return
      }

      try {
        // Comment 형태로 heartbeat 전송
        this.controller.enqueue(this.encoder.encode(": heartbeat\n\n"))
      } catch (_error) {
        this.close()
      }
    }, this.options.keepAliveInterval)
  }

  /**
   * Keep-alive 중지
   */
  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer)
      this.keepAliveTimer = undefined
    }
  }

  /**
   * 세션 종료
   */
  close(): void {
    if (this.isClosed) return

    this.isClosed = true
    this.stopKeepAlive()

    try {
      this.controller.close()
    } catch (_error) {
      // Already closed
    }

    this.options.onClose()
  }

  /**
   * 세션 상태 확인
   */
  get closed(): boolean {
    return this.isClosed
  }
}

/**
 * SSE Response 생성 헬퍼
 */
export function createSSEResponse(
  handler: (session: SSESession) => Promise<void>,
  options: SSESessionOptions = {},
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const session = new SSESession(controller, {
        ...options,
        onClose: () => {
          options.onClose?.()
        },
      })

      try {
        await handler(session)
      } catch (error) {
        console.error("[SSE] Handler error:", error)
        // Send error event before closing
        session.push({
          event: "error",
          data: {
            message: error instanceof Error ? error.message : "Unknown error occurred",
          },
        })
      } finally {
        session.close()
      }
    },
    cancel() {
      options.onClose?.()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
