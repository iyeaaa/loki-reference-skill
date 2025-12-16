import { API_BASE_URL } from "@/lib/api/client"

export type SSETestEvent = {
  type: "connected" | "progress" | "data" | "text_chunk" | "ping" | "done" | "error"
  message?: string
  progress?: number
  data?: unknown
  chunk?: string
  accumulatedText?: string
  timestamp: string
  totalDuration?: string
}

export type SSETestCallbacks = {
  onEvent: (event: SSETestEvent) => void
  onComplete?: () => void
  onError?: (error: string) => void
}

/**
 * SSE Test API Service
 * Client-side service for testing Server-Sent Events functionality
 */
export const sseTestApi = {
  /**
   * Stream test events from the SSE test endpoint
   */
  async streamTest(callbacks: SSETestCallbacks): Promise<void> {
    const { onEvent, onComplete, onError } = callbacks
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

    try {
      console.log("[SSE Test] Connecting to stream endpoint...")
      const response = await fetch(`${API_BASE_URL}/api/sse-test/stream`, {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
        },
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to read response stream")
      }

      const decoder = new TextDecoder()
      console.log("[SSE Test] Starting to read SSE stream...")

      let streamCompleted = false
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          console.log("[SSE Test] Stream reading completed")
          streamCompleted = true
          break
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true })

        // Process complete events (events end with \n\n)
        const events = buffer.split("\n\n")

        // Keep the last incomplete event in the buffer
        buffer = events.pop() || ""

        // Process complete events
        for (const eventStr of events) {
          if (!eventStr.trim()) {
            continue
          }

          const lines = eventStr.split("\n")
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event: SSETestEvent = JSON.parse(line.slice(6))
                console.log("[SSE Test] Received event:", event.type, event)
                onEvent(event)

                // If it's a done or error event, mark as complete
                if (event.type === "done" || event.type === "error") {
                  streamCompleted = true
                }
              } catch (parseError) {
                console.error("[SSE Test] Failed to parse event:", parseError, line)
              }
            }
          }
        }
      }

      if (streamCompleted) {
        console.log("[SSE Test] Stream completed successfully")
        onComplete?.()
      }
    } catch (error) {
      console.error("[SSE Test] Stream error:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      onError?.(errorMessage)
      throw error
    } finally {
      // Always release the reader lock
      if (reader) {
        try {
          reader.releaseLock()
          console.log("[SSE Test] Reader released")
        } catch (_releaseError) {
          console.debug("[SSE Test] Reader already released")
        }
      }
    }
  },

  /**
   * Get information about the SSE test endpoint
   */
  async getInfo(): Promise<{
    success: boolean
    data: {
      name: string
      description: string
      endpoints: Record<string, unknown>
    }
  }> {
    const response = await fetch(`${API_BASE_URL}/api/sse-test/info`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch SSE test info: ${response.status}`)
    }

    return response.json()
  },
}
