import { API_BASE_URL, getToken } from "@/lib/api/client"
import type {
  ChatbotAskRequest,
  ChatbotHistoryResponse,
  ChatMessage,
  Insight,
  StreamCallbacks,
  StreamEvent,
} from "../types/chatbot"
import { type EventHandlerContext, eventHandlers } from "./chatbot-event-handlers"

export const chatbotApi = {
  /**
   * Stream chatbot response using Server-Sent Events
   */
  async streamAsk(request: ChatbotAskRequest, callbacks: StreamCallbacks): Promise<void> {
    const {
      onMessage,
      onMessageUpdate,
      onThinking,
      onProgress,
      onError,
      onConfirmationRequired,
      onOpenSequenceModal,
    } = callbacks
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

    try {
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}/api/chatbot/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to read response stream")
      }

      const decoder = new TextDecoder()
      const accumulatedData: {
        analysis: string
        insights: unknown[]
        sql: string
        result: unknown[]
        followUpQuestions: string[]
        visualizationSuggestions: unknown[]
      } = {
        analysis: "",
        insights: [],
        sql: "",
        result: [],
        followUpQuestions: [],
        visualizationSuggestions: [],
      }

      // Create event handler context (once, outside the loop)
      const eventContext: EventHandlerContext = {
        accumulatedData,
        callbacks: {
          onMessage,
          onMessageUpdate,
          onThinking,
          onProgress,
          onError,
          onConfirmationRequired,
          onOpenSequenceModal,
        },
      }

      // Read the stream
      console.log("[Chatbot] Starting to read SSE stream...")
      let streamCompleted = false
      let lastEventType = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log("[Chatbot] Stream reading completed")
            streamCompleted = true
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: StreamEvent = JSON.parse(line.slice(6))
                lastEventType = data.type
                console.log("[Chatbot] Received event:", data.type, data.node || "")

                // Ignore ping/heartbeat events - they're only for keeping connection alive
                if (data.type === "ping") {
                  console.log("[Chatbot] Heartbeat ping received, connection alive")
                  continue
                }

                // Dispatch to appropriate handler using Handler Map pattern
                const handler = eventHandlers[data.type]
                if (handler) {
                  handler(data, eventContext)

                  // Track stream completion state for done/error events
                  if (data.type === "done" || data.type === "error") {
                    streamCompleted = true
                    // ⭐ Don't break - let server close the connection naturally
                    // This ensures all node events are processed before stream ends
                  }
                } else {
                  console.warn(`[Chatbot] Unknown event type: ${data.type}`)
                }
              } catch (parseError) {
                console.error("[Chatbot] Failed to parse stream event:", parseError, line)
              }
            }
          }
        }
      } catch (streamReadError) {
        console.error("[Chatbot] Stream read error:", streamReadError)

        // Check if this is an incomplete chunked encoding error or network error
        const isNetworkError =
          streamReadError instanceof Error &&
          (streamReadError.message.includes("INCOMPLETE_CHUNKED_ENCODING") ||
            streamReadError.message.includes("premature close") ||
            streamReadError.message.includes("network error") ||
            streamReadError.name === "AbortError")

        if (isNetworkError) {
          console.warn(
            "[Chatbot] Stream closed prematurely. Last event:",
            lastEventType,
            "Completed:",
            streamCompleted,
          )

          // If we have accumulated data and haven't sent a final message, send it now
          if (!streamCompleted && accumulatedData.analysis) {
            console.log("[Chatbot] Recovering from incomplete stream with accumulated data")
            chatbotApi.handleDoneEvent(accumulatedData, onMessage)
            return // Exit gracefully
          }

          // If we have no data at all, inform the user
          if (!accumulatedData.analysis) {
            console.log("[Chatbot] Stream closed with no data - connection interrupted")
            onError?.("Connection interrupted. The response may be incomplete. Please try again.")
            onMessage({
              role: "assistant",
              content:
                "Sorry, the connection was interrupted. Please try asking your question again.",
              timestamp: new Date(),
            })
            return // Exit gracefully
          }
        }

        // Re-throw other errors
        throw streamReadError
      }

      // Final check: if stream ended without 'done' or 'error' event but we have data
      if (!streamCompleted && accumulatedData.analysis) {
        console.log("[Chatbot] Stream ended without completion event, sending accumulated data")
        chatbotApi.handleDoneEvent(accumulatedData, onMessage)
      }
    } catch (error) {
      console.error("Chat stream error:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      onError?.(errorMessage)
      onMessage({
        role: "assistant",
        content: `Connection error: ${errorMessage}`,
        timestamp: new Date(),
      })
      throw error // Re-throw for mutation error handling
    } finally {
      // Always release the reader lock
      if (reader) {
        try {
          reader.releaseLock()
        } catch (_releaseError) {
          console.debug("[Chatbot] Reader already released")
        }
      }
    }
  },

  /**
   * Get conversation history
   */
  async getHistory(conversationId: string): Promise<ChatbotHistoryResponse> {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/api/chatbot/history/${conversationId}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch conversation history")
    }

    const result = await response.json()
    return result.data || result
  },

  /**
   * Confirm or reject mutation query
   */
  async confirmMutation(
    conversationId: string,
    confirmed: boolean,
    callbacks?: StreamCallbacks,
  ): Promise<void> {
    if (!confirmed) {
      // User rejected - no streaming needed
      return
    }

    // User confirmed - stream the execution results
    if (!callbacks) {
      throw new Error("Callbacks required for confirmed mutations")
    }

    const { onMessage, onMessageUpdate, onThinking, onProgress, onError } = callbacks
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

    try {
      const token = getToken()
      const response = await fetch(`${API_BASE_URL}/api/chatbot/confirm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ conversationId, confirmed }),
      })

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`)
      }

      reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to read response stream")
      }

      const decoder = new TextDecoder()
      const accumulatedData: {
        analysis: string
        insights: unknown[]
        sql: string
        result: unknown[]
        followUpQuestions: string[]
        visualizationSuggestions: unknown[]
      } = {
        analysis: "",
        insights: [],
        sql: "",
        result: [],
        followUpQuestions: [],
        visualizationSuggestions: [],
      }

      // Create event handler context (once, outside the loop)
      const eventContext: EventHandlerContext = {
        accumulatedData,
        callbacks: {
          onMessage,
          onMessageUpdate,
          onThinking,
          onProgress,
          onError,
          onConfirmationRequired: undefined, // No confirmation needed in confirm flow
        },
      }

      // Read the stream
      console.log("[Chatbot] Starting confirmation stream...")
      let streamCompleted = false
      let lastEventType = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            console.log("[Chatbot] Confirmation stream reading completed")
            streamCompleted = true
            break
          }

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data: StreamEvent = JSON.parse(line.slice(6))
                lastEventType = data.type

                // Ignore ping/heartbeat events
                if (data.type === "ping") {
                  continue
                }

                // Dispatch to appropriate handler using Handler Map pattern
                const handler = eventHandlers[data.type]
                if (handler) {
                  handler(data, eventContext)

                  // Track stream completion state for done/error events
                  if (data.type === "done" || data.type === "error") {
                    streamCompleted = true
                  }
                } else {
                  console.warn(`[Chatbot] Unknown confirmation event type: ${data.type}`)
                }
              } catch (parseError) {
                console.error("[Chatbot] Failed to parse stream event:", parseError)
              }
            }
          }
        }
      } catch (streamReadError) {
        console.error("[Chatbot] Confirmation stream read error:", streamReadError)

        // Check if this is an incomplete chunked encoding error or network error
        const isNetworkError =
          streamReadError instanceof Error &&
          (streamReadError.message.includes("INCOMPLETE_CHUNKED_ENCODING") ||
            streamReadError.message.includes("premature close") ||
            streamReadError.message.includes("network error") ||
            streamReadError.name === "AbortError")

        if (isNetworkError) {
          console.warn(
            "[Chatbot] Confirmation stream closed prematurely. Last event:",
            lastEventType,
            "Completed:",
            streamCompleted,
          )

          // If we have accumulated data and haven't sent a final message, send it now
          if (!streamCompleted && accumulatedData.analysis) {
            console.log(
              "[Chatbot] Recovering from incomplete confirmation stream with accumulated data",
            )
            chatbotApi.handleDoneEvent(accumulatedData, onMessage)
            return // Exit gracefully
          }

          // If we have no data at all, inform the user
          if (!accumulatedData.analysis) {
            console.log(
              "[Chatbot] Confirmation stream closed with no data - connection interrupted",
            )
            onError?.("Connection interrupted. The response may be incomplete. Please try again.")
            onMessage({
              role: "assistant",
              content: "Sorry, the connection was interrupted during execution. Please try again.",
              timestamp: new Date(),
            })
            return // Exit gracefully
          }
        }

        // Re-throw other errors
        throw streamReadError
      }

      // Final check: if stream ended without 'done' or 'error' event but we have data
      if (!streamCompleted && accumulatedData.analysis) {
        console.log(
          "[Chatbot] Confirmation stream ended without completion event, sending accumulated data",
        )
        chatbotApi.handleDoneEvent(accumulatedData, onMessage)
      }
    } catch (error) {
      console.error("Confirmation stream error:", error)
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
      onError?.(errorMessage)
      onMessage({
        role: "assistant",
        content: `Connection error: ${errorMessage}`,
        timestamp: new Date(),
      })
      throw error
    } finally {
      // Always release the reader lock
      if (reader) {
        try {
          reader.releaseLock()
        } catch (_releaseError) {
          console.debug("[Chatbot] Confirmation reader already released")
        }
      }
    }
  },

  /**
   * Handle done event - create final message from accumulated data
   * Used for recovery when stream ends prematurely
   */
  handleDoneEvent(
    accumulatedData: {
      analysis: string
      insights: unknown[]
      sql: string
      result: unknown[]
      followUpQuestions: string[]
      visualizationSuggestions: unknown[]
    },
    onMessage: (message: ChatMessage) => void,
  ): void {
    const finalMessage: ChatMessage = {
      role: "assistant",
      content: accumulatedData.analysis || "분석이 완료되었습니다.",
      timestamp: new Date(),
      metadata: {
        sql: accumulatedData.sql || undefined,
        result: accumulatedData.result?.length ? accumulatedData.result : undefined,
        insights: accumulatedData.insights?.length
          ? (accumulatedData.insights as Insight[])
          : undefined,
        followUpQuestions: accumulatedData.followUpQuestions?.length
          ? accumulatedData.followUpQuestions
          : undefined,
      },
    }

    console.log("[Chatbot] Sending final message from accumulated data:", finalMessage)
    onMessage(finalMessage)
  },

  // ============================================
  // Conversation Management APIs
  // ============================================

  /**
   * Get all conversations for a user in a workspace
   * userId is extracted from JWT token on the server
   */
  async getConversations(workspaceId: string): Promise<ChatConversation[]> {
    const token = getToken()
    const params = new URLSearchParams({ workspaceId })
    const response = await fetch(`${API_BASE_URL}/api/chatbot/conversations?${params}`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      throw new Error("Failed to fetch conversations")
    }

    const result = await response.json()
    return result.data || result
  },

  /**
   * Create a new conversation
   * userId is extracted from JWT token on the server
   */
  async createConversation(workspaceId: string, title?: string): Promise<ChatConversation> {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/api/chatbot/conversations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ workspaceId, title }),
    })

    if (!response.ok) {
      throw new Error("Failed to create conversation")
    }

    const result = await response.json()
    return result.data || result
  },

  /**
   * Update conversation title
   */
  async updateConversationTitle(id: string, title: string): Promise<ChatConversation> {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/api/chatbot/conversations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ title }),
    })

    if (!response.ok) {
      throw new Error("Failed to update conversation title")
    }

    const result = await response.json()
    return result.data || result
  },

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(id: string): Promise<void> {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/api/chatbot/conversations/${id}`, {
      method: "DELETE",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })

    if (!response.ok) {
      throw new Error("Failed to delete conversation")
    }
  },

  /**
   * Generate AI title for a conversation based on first message
   */
  async generateConversationTitle(
    id: string,
    firstMessage: string,
    locale?: string,
  ): Promise<{ title: string }> {
    const token = getToken()
    const response = await fetch(`${API_BASE_URL}/api/chatbot/conversations/${id}/generate-title`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ firstMessage, locale }),
    })

    if (!response.ok) {
      throw new Error("Failed to generate conversation title")
    }

    const result = await response.json()
    return result.data || result
  },
}

// Export ChatConversation type
export type ChatConversation = {
  id: string
  userId: string
  workspaceId: string
  title: string
  createdAt: string
  updatedAt: string
  isDeleted: boolean
}
