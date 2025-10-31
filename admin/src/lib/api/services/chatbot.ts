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
    const { onMessage, onMessageUpdate, onThinking, onError } = callbacks

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

      const reader = response.body?.getReader()
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
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log("[Chatbot] Stream reading completed")
          break
        }

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n")

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data: StreamEvent = JSON.parse(line.slice(6))
              console.log(`[Chatbot] Received event:`, data.type, data.node || "")

              // Handle different event types
              if (data.type === "text_chunk") {
                console.log(`[Chatbot] Received text chunk:`, data.chunk?.substring(0, 50))
                chatbotApi.handleTextChunk(data, onMessageUpdate, accumulatedData)
              } else if (data.type === "node") {
                chatbotApi.handleNodeEvent(data, onThinking, onMessageUpdate, accumulatedData)
              } else if (data.type === "done") {
                console.log("[Chatbot] Processing done event")
                chatbotApi.handleDoneEvent(accumulatedData, onMessage)
              } else if (data.type === "error") {
                console.error("[Chatbot] Received error event:", data.error)
                chatbotApi.handleErrorEvent(data, onError, onMessage)
              }
            } catch (parseError) {
              console.error("[Chatbot] Failed to parse stream event:", parseError, line)
            }
          }
        }
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
  ): void {
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
}
