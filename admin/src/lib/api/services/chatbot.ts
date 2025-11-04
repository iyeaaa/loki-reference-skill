import { API_BASE_URL, getToken } from "@/lib/api/client"
import type {
  ChatbotAskRequest,
  ChatbotHistoryResponse,
  ChatMessage,
  StreamCallbacks,
  StreamEvent,
} from "../types/chatbot"

export const chatbotApi = {
  /**
   * Stream chatbot response using Server-Sent Events
   */
  async streamAsk(request: ChatbotAskRequest, callbacks: StreamCallbacks): Promise<void> {
    const { onMessage, onMessageUpdate, onThinking, onError, onConfirmationRequired } = callbacks
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
                console.log(`[Chatbot] Received event:`, data.type, data.node || "")

                // Ignore ping/heartbeat events - they're only for keeping connection alive
                if (data.type === "ping") {
                  console.log("[Chatbot] Heartbeat ping received, connection alive")
                  continue
                }

                // Handle different event types
                if (data.type === "text_chunk") {
                  console.log(`[Chatbot] Received text chunk:`, data.chunk?.substring(0, 50))
                  chatbotApi.handleTextChunk(data, onMessageUpdate, accumulatedData)
                } else if (data.type === "interrupt") {
                  // NEW: Handle interrupt() event from LangGraph
                  console.log("[Chatbot] Received interrupt event:", data.payload)
                  chatbotApi.handleInterruptEvent(data, onConfirmationRequired, onMessageUpdate)
                } else if (data.type === "node") {
                  chatbotApi.handleNodeEvent(
                    data,
                    onThinking,
                    onMessageUpdate,
                    accumulatedData,
                    onConfirmationRequired,
                  )
                } else if (data.type === "waiting_confirmation") {
                  console.log("[Chatbot] Waiting for user confirmation - keeping UI active")
                  // Don't call onMessage - keep the confirmation UI visible
                  // The confirmation state is already set by onConfirmationRequired in handleNodeEvent
                } else if (data.type === "done") {
                  console.log("[Chatbot] Processing done event")
                  chatbotApi.handleDoneEvent(accumulatedData, onMessage)
                  streamCompleted = true
                } else if (data.type === "error") {
                  console.error("[Chatbot] Received error event:", data.error)
                  chatbotApi.handleErrorEvent(data, onError, onMessage)
                  streamCompleted = true
                }
              } catch (parseError) {
                console.error("[Chatbot] Failed to parse stream event:", parseError, line)
              }
            }
          }
        }
      } catch (streamReadError) {
        console.error("[Chatbot] Stream read error:", streamReadError)

        // Check if this is an incomplete chunked encoding error
        if (
          streamReadError instanceof Error &&
          (streamReadError.message.includes("INCOMPLETE_CHUNKED_ENCODING") ||
            streamReadError.message.includes("premature close"))
        ) {
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
   * Handle interrupt event from LangGraph's interrupt() function
   */
  handleInterruptEvent(
    data: StreamEvent,
    onConfirmationRequired: ((message: string) => void) | undefined,
    onMessageUpdate: ((message: ChatMessage) => void) | undefined,
  ): void {
    const payload = data.payload as {
      type?: string
      confirmationMessage?: string
      metadata?: {
        sql?: string
        sqlQueries?: string[]
        sqlExplanation?: string
        queryCount?: number
      }
    }

    console.log("[Chatbot] Interrupt payload:", payload)

    if (payload.confirmationMessage) {
      // Trigger confirmation UI
      if (onConfirmationRequired) {
        onConfirmationRequired(payload.confirmationMessage)
      }

      // Update message display with confirmation request
      if (onMessageUpdate) {
        const confirmationMsg: ChatMessage = {
          role: "assistant",
          content: payload.confirmationMessage,
          timestamp: new Date(),
          metadata: payload.metadata,
        }
        onMessageUpdate(confirmationMsg)
      }
    }
  },

  /**
   * Handle text chunk events from LLM streaming
   */
  handleTextChunk(
    data: StreamEvent,
    onMessageUpdate: ((message: ChatMessage) => void) | undefined,
    accumulatedData: {
      analysis: string
      insights: unknown[]
      sql: string
      result: unknown[]
      followUpQuestions: string[]
      visualizationSuggestions: unknown[]
    },
  ): void {
    if (!data.accumulatedText) return

    // Update accumulated analysis text
    accumulatedData.analysis = data.accumulatedText

    // Stream message update in real-time
    // Don't send metadata during streaming to prevent flickering
    if (onMessageUpdate) {
      const streamingMessage: ChatMessage = {
        role: "assistant",
        content: data.accumulatedText,
        timestamp: new Date(),
        metadata: undefined,
      }
      onMessageUpdate(streamingMessage)
    }
  },

  /**
   * Handle node events during streaming
   */
  handleNodeEvent(
    data: StreamEvent,
    onThinking: (thinking: string) => void,
    onMessageUpdate: ((message: ChatMessage) => void) | undefined,
    accumulatedData: {
      analysis: string
      insights: unknown[]
      sql: string
      result: unknown[]
      followUpQuestions: string[]
      visualizationSuggestions: unknown[]
    },
    onConfirmationRequired?: (message: string) => void,
  ): void {
    // Check for confirmation requirement first
    if (data.state?.needsConfirmation && data.state?.confirmationMessage) {
      console.log("[Chatbot] Confirmation required:", data.state.confirmationMessage)
      if (onConfirmationRequired) {
        onConfirmationRequired(data.state.confirmationMessage)
      }
      // Update analysis with confirmation message
      accumulatedData.analysis = data.state.confirmationMessage
      if (onMessageUpdate) {
        const confirmationMsg: ChatMessage = {
          role: "assistant",
          content: data.state.confirmationMessage,
          timestamp: new Date(),
          metadata: undefined,
        }
        onMessageUpdate(confirmationMsg)
      }
      return
    }

    let thinkingMessage = ""
    let shouldUpdateMessage = false

    // Node name mapping: handle both old and new node names
    const nodeName = data.node?.toLowerCase() || ""

    if (nodeName.includes("analyze") && !nodeName.includes("result")) {
      thinkingMessage = "Analyzing your question and understanding the context..."
    } else if (nodeName.includes("generatesql") || nodeName.includes("sql")) {
      thinkingMessage = "Generating SQL query based on your question..."
      if (data.state?.generatedSQL) {
        accumulatedData.sql = data.state.generatedSQL
        shouldUpdateMessage = true
        thinkingMessage = `Generating SQL query: ${data.state.generatedSQL.split("\n")[0].substring(0, 80)}...`
      }
    } else if (nodeName.includes("validatesql") || nodeName.includes("validate")) {
      thinkingMessage = "Validating query safety and checking for potential issues..."
    } else if (nodeName.includes("executequery") || nodeName.includes("execute")) {
      thinkingMessage = "Executing query against your database..."
      if (data.state?.generatedSQL) {
        accumulatedData.sql = data.state.generatedSQL
        shouldUpdateMessage = true
      }
      if (data.state?.queryResult) {
        accumulatedData.result = data.state.queryResult
        shouldUpdateMessage = true
        const rowCount = Array.isArray(data.state.queryResult) ? data.state.queryResult.length : 0
        thinkingMessage = `Query executed successfully. Retrieved ${rowCount} row${rowCount !== 1 ? "s" : ""}...`
      }
    } else if (nodeName.includes("analyzeresult") || nodeName.includes("result")) {
      thinkingMessage = "Analyzing query results and extracting key information..."
      if (data.state?.analysis) {
        accumulatedData.analysis = data.state.analysis
        shouldUpdateMessage = true
      }
    } else if (nodeName.includes("insight")) {
      thinkingMessage = "Generating insights and identifying important patterns..."
      if (data.state?.insights) {
        accumulatedData.insights = data.state.insights
        shouldUpdateMessage = true
        const insightCount = Array.isArray(data.state.insights) ? data.state.insights.length : 0
        if (insightCount > 0) {
          thinkingMessage = `Generated ${insightCount} insight${insightCount !== 1 ? "s" : ""} from the data...`
        }
      }
    } else if (nodeName.includes("visual")) {
      thinkingMessage = "Recommending visualization options for your data..."
      if (data.state?.visualizationSuggestions) {
        accumulatedData.visualizationSuggestions = data.state.visualizationSuggestions
        shouldUpdateMessage = true
      }
    } else if (nodeName.includes("followup") || nodeName.includes("follow")) {
      thinkingMessage = "Preparing related questions you might want to explore..."
      if (data.state?.followUpQuestions) {
        accumulatedData.followUpQuestions = data.state.followUpQuestions
        shouldUpdateMessage = true
        const questionCount = Array.isArray(data.state.followUpQuestions)
          ? data.state.followUpQuestions.length
          : 0
        if (questionCount > 0) {
          thinkingMessage = `Generated ${questionCount} follow-up question${questionCount !== 1 ? "s" : ""}...`
        }
      }
    } else if (nodeName.includes("format")) {
      thinkingMessage = "Formatting response and preparing final output..."
    } else if (nodeName.includes("confirmation") || nodeName.includes("askconfirmation")) {
      thinkingMessage = "Waiting for user confirmation..."
      // Update analysis with confirmation message if available
      if (data.state?.analysis) {
        accumulatedData.analysis = data.state.analysis
        shouldUpdateMessage = true

        // Trigger confirmation UI
        console.log("[Chatbot] askConfirmation node detected, triggering confirmation")
        if (onConfirmationRequired) {
          onConfirmationRequired(data.state.analysis)
        }
      }
    } else if (nodeName.includes("error")) {
      if (data.state?.error) {
        thinkingMessage = `Error: ${data.state.error}`
      }
    } else {
      // Default case for unknown nodes
      thinkingMessage = `Processing: ${data.node}...`
    }

    if (thinkingMessage) {
      console.log(`[Chatbot] Thinking update for '${data.node}': ${thinkingMessage}`)
      onThinking(thinkingMessage)
    }

    // Stream message updates in real-time
    // Only update if there's actual analysis content to show
    if (shouldUpdateMessage && onMessageUpdate && accumulatedData.analysis) {
      const streamingMessage: ChatMessage = {
        role: "assistant",
        content: accumulatedData.analysis,
        timestamp: new Date(),
        // Don't send metadata during streaming to prevent flickering
        metadata: undefined,
      }
      console.log(`[Chatbot] Streaming message update:`, streamingMessage)
      onMessageUpdate(streamingMessage)
    }
  },

  /**
   * Handle done event - send final message
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
    onMessage({
      role: "assistant",
      content: accumulatedData.analysis || "Processing completed.",
      timestamp: new Date(),
      metadata: {
        sql: accumulatedData.sql,
        result: accumulatedData.result,
        insights: accumulatedData.insights,
        followUpQuestions: accumulatedData.followUpQuestions,
        visualization: accumulatedData.visualizationSuggestions,
      },
    })
  },

  /**
   * Handle error event
   */
  handleErrorEvent(
    data: StreamEvent,
    onError: ((error: string) => void) | undefined,
    onMessage: (message: ChatMessage) => void,
  ): void {
    const errorMsg = data.error || "An unexpected error occurred"
    onError?.(errorMsg)
    onMessage({
      role: "assistant",
      content: `Error: ${errorMsg}`,
      timestamp: new Date(),
    })
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

    const { onMessage, onMessageUpdate, onThinking, onError } = callbacks
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

                if (data.type === "node") {
                  chatbotApi.handleNodeEvent(
                    data,
                    onThinking,
                    onMessageUpdate,
                    accumulatedData,
                    undefined,
                  )
                } else if (data.type === "done") {
                  chatbotApi.handleDoneEvent(accumulatedData, onMessage)
                  streamCompleted = true
                } else if (data.type === "error") {
                  chatbotApi.handleErrorEvent(data, onError, onMessage)
                  streamCompleted = true
                }
              } catch (parseError) {
                console.error("[Chatbot] Failed to parse stream event:", parseError)
              }
            }
          }
        }
      } catch (streamReadError) {
        console.error("[Chatbot] Confirmation stream read error:", streamReadError)

        // Check if this is an incomplete chunked encoding error
        if (
          streamReadError instanceof Error &&
          (streamReadError.message.includes("INCOMPLETE_CHUNKED_ENCODING") ||
            streamReadError.message.includes("premature close"))
        ) {
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
}
