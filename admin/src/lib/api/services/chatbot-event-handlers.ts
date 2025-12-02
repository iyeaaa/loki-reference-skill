/**
 * Chatbot SSE Event Handlers
 * Centralized event handling with Handler Map pattern
 */

import type {
  ChatbotProgress,
  ChatMessage,
  Insight,
  StreamCallbacks,
  StreamEvent,
} from "../types/chatbot"

export interface EventHandlerContext {
  accumulatedData: {
    analysis: string
    insights: unknown[]
    sql: string
    result: unknown[]
    followUpQuestions: string[]
    visualizationSuggestions: unknown[]
  }
  callbacks: StreamCallbacks
}

export type EventHandler = (data: StreamEvent, context: EventHandlerContext) => void

/**
 * Handle node-start event - node execution beginning
 *
 * Claude/GPT Style:
 * - node-start is for high-level "thinking" indicator only
 * - Does NOT add to NodeProgressTracker (progress events handle that)
 */
export const handleNodeStart: EventHandler = (data, context) => {
  console.log(`[Chatbot] Node starting:`, data.node, "-", data.message)

  // Show in thinking indicator only
  if (data.message && context.callbacks.onThinking) {
    context.callbacks.onThinking(data.message)
  }

  // DO NOT track in node progress - let progress events handle that
  // This prevents duplicate messages in the UI
}

/**
 * Handle node-complete event - node execution completed
 */
export const handleNodeComplete: EventHandler = (data, context) => {
  console.log(`[Chatbot] Node completed:`, data.node, "-", data.message)
  console.log("[Chatbot] Full node-complete data:", data)

  // Track node progress
  if (data.node && context.callbacks.onNodeProgress) {
    context.callbacks.onNodeProgress({
      nodeName: data.node,
      status: "completed",
      message: data.message,
      timestamp: Date.now(),
    })
  }

  // ⭐ CRITICAL: Update accumulated data from node-complete payload
  // This allows real-time streaming of insights and follow-up questions
  const resultData = data.result as Record<string, unknown> | undefined
  console.log("[Chatbot] Result data from node-complete:", resultData)

  if (resultData && typeof resultData === "object") {
    if ("insights" in resultData && resultData.insights) {
      context.accumulatedData.insights = resultData.insights as unknown[]
      console.log("[Chatbot] ✅ Insights received:", resultData.insights)
    }
    if ("followUpQuestions" in resultData && resultData.followUpQuestions) {
      context.accumulatedData.followUpQuestions = resultData.followUpQuestions as string[]
      console.log("[Chatbot] ✅ Follow-up questions received:", resultData.followUpQuestions)
    }
  } else {
    console.log("[Chatbot] ⚠️ No result data in node-complete event")
  }

  // IMPORTANT: Stream updated content with new metadata
  // This triggers real-time artifact updates in the UI
  if (context.callbacks.onMessageUpdate && context.accumulatedData.analysis) {
    const completedMsg: ChatMessage = {
      role: "assistant",
      content: context.accumulatedData.analysis, // Keep existing content
      timestamp: new Date(),
      metadata: {
        sql: context.accumulatedData.sql || undefined,
        result: context.accumulatedData.result?.length ? context.accumulatedData.result : undefined,
        insights: context.accumulatedData.insights?.length
          ? (context.accumulatedData.insights as Insight[])
          : undefined,
        followUpQuestions: context.accumulatedData.followUpQuestions?.length
          ? context.accumulatedData.followUpQuestions
          : undefined,
      },
    }
    console.log("[Chatbot] Updating message with metadata:", completedMsg.metadata)
    context.callbacks.onMessageUpdate(completedMsg)
  }
}

/**
 * Handle thinking event - legacy support
 */
export const handleThinking: EventHandler = (data, context) => {
  console.log(`[Chatbot] Thinking:`, data.message)

  if (data.message && context.callbacks.onThinking) {
    context.callbacks.onThinking(data.message)
  }
}

/**
 * Handle progress event - node execution progress
 */
export const handleProgress: EventHandler = (data, context) => {
  console.log(`[Chatbot] Progress:`, data)

  // Convert StreamEvent to ChatbotProgress
  const progress: ChatbotProgress = {
    type: "progress",
    node: data.node,
    message: data.message,
    phase: data.phase,
    percent: data.percent,
  }

  // Send progress update to callback
  if (context.callbacks.onProgress) {
    context.callbacks.onProgress(progress)
  }

  // Track node progress with percent
  if (data.node && context.callbacks.onNodeProgress) {
    context.callbacks.onNodeProgress({
      nodeName: data.node,
      status: "in_progress",
      message: data.message,
      percent: data.percent,
      timestamp: Date.now(),
    })
  }

  // IMPORTANT: Keep existing accumulated content when showing progress
  // Don't replace the message content with progress info
  if (context.callbacks.onMessageUpdate && context.accumulatedData.analysis) {
    const progressMsg: ChatMessage = {
      role: "assistant",
      content: context.accumulatedData.analysis, // Keep existing content
      timestamp: new Date(),
      metadata: {
        chatbotProgress: progress,
      },
    }
    context.callbacks.onMessageUpdate(progressMsg)
  }
}

/**
 * Handle text_chunk event - LLM streaming chunks
 */
export const handleTextChunk: EventHandler = (data, context) => {
  console.log(`[Chatbot] Text chunk:`, data.chunk?.substring(0, 50))

  const { accumulatedData, callbacks } = context

  // Accumulate text (from LLM streaming)
  if (data.accumulatedText) {
    accumulatedData.analysis = data.accumulatedText
  }

  // Stream real-time updates to UI
  if (callbacks.onMessageUpdate) {
    const streamingMsg: ChatMessage = {
      role: "assistant",
      content: accumulatedData.analysis,
      timestamp: new Date(),
      metadata: {
        sql: accumulatedData.sql || undefined,
      },
    }
    callbacks.onMessageUpdate(streamingMsg)
  }
}

/**
 * Handle interrupt event - human-in-the-loop confirmation
 */
export const handleInterrupt: EventHandler = (data, context) => {
  console.log("[Chatbot] Interrupt event:", data.payload)

  const { callbacks } = context

  if (data.payload?.confirmationMessage && callbacks.onConfirmationRequired) {
    callbacks.onConfirmationRequired(data.payload.confirmationMessage)

    // Show confirmation message in UI
    if (callbacks.onMessageUpdate) {
      const confirmMsg: ChatMessage = {
        role: "assistant",
        content: data.payload.confirmationMessage,
        timestamp: new Date(),
        metadata: {
          sql: data.payload.metadata?.sql,
          sqlExplanation: data.payload.metadata?.sqlExplanation,
        },
      }
      callbacks.onMessageUpdate(confirmMsg)
    }
  }
}

/**
 * Handle node event - legacy node completion
 */
export const handleNode: EventHandler = (data, context) => {
  console.log(`[Chatbot] Node event:`, data.node)

  const { accumulatedData, callbacks } = context
  const state = data.state || {}

  // Update accumulated data
  if (state.analysis) accumulatedData.analysis = state.analysis as string
  if (state.insights) accumulatedData.insights = state.insights as unknown[]
  if (state.generatedSQL) accumulatedData.sql = state.generatedSQL as string
  if (state.queryResult) accumulatedData.result = state.queryResult as unknown[]
  if (state.followUpQuestions) {
    accumulatedData.followUpQuestions = state.followUpQuestions as string[]
  }
  if (state.visualizationSuggestions) {
    accumulatedData.visualizationSuggestions = state.visualizationSuggestions as unknown[]
  }

  // Handle confirmation required
  if (state.needsConfirmation && state.confirmationMessage && callbacks.onConfirmationRequired) {
    callbacks.onConfirmationRequired(state.confirmationMessage as string)

    if (callbacks.onMessageUpdate) {
      const confirmMsg: ChatMessage = {
        role: "assistant",
        content: state.confirmationMessage as string,
        timestamp: new Date(),
        metadata: {
          sql: state.generatedSQL as string | undefined,
          sqlExplanation: state.sqlExplanation as string | undefined,
        },
      }
      callbacks.onMessageUpdate(confirmMsg)
    }
  }
}

/**
 * Handle waiting_confirmation event
 */
export const handleWaitingConfirmation: EventHandler = () => {
  console.log("[Chatbot] Waiting for confirmation")
  // Don't call onMessage - keep confirmation UI visible
}

/**
 * Handle done event - stream completion
 */
export const handleDone: EventHandler = (data, context) => {
  console.log("[Chatbot] Done event")

  const { accumulatedData, callbacks } = context

  // Create final message with all accumulated data
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

  // If done event has state, merge it
  if (data.state) {
    if (data.state.analysis) finalMessage.content = data.state.analysis as string
    if (data.state.generatedSQL && finalMessage.metadata) {
      finalMessage.metadata.sql = data.state.generatedSQL as string
    }
    if (data.state.queryResult && finalMessage.metadata) {
      finalMessage.metadata.result = data.state.queryResult as unknown[]
    }
    if (data.state.insights && finalMessage.metadata) {
      finalMessage.metadata.insights = data.state.insights
      console.log("[Chatbot] Final insights:", data.state.insights)
    }
    if (data.state.followUpQuestions && finalMessage.metadata) {
      finalMessage.metadata.followUpQuestions = data.state.followUpQuestions as string[]
      console.log("[Chatbot] Final follow-up questions:", data.state.followUpQuestions)
    }
  }

  console.log("[Chatbot] Final message:", finalMessage)
  callbacks.onMessage(finalMessage)
}

/**
 * Handle error event
 */
export const handleError: EventHandler = (data, context) => {
  console.error("[Chatbot] Error event:", data.error)

  const { callbacks } = context

  if (callbacks.onError && data.error) {
    callbacks.onError(data.error)
  }

  // Show error message
  const errorMsg: ChatMessage = {
    role: "assistant",
    content: `오류가 발생했습니다: ${data.error || "알 수 없는 오류"}`,
    timestamp: new Date(),
  }
  callbacks.onMessage(errorMsg)
}

/**
 * Handle ping event - heartbeat
 */
export const handlePing: EventHandler = () => {
  console.log("[Chatbot] Heartbeat ping")
  // Just log, no action needed
}

/**
 * Handle open_sequence_modal event - triggers sequence generator modal
 */
export const handleOpenSequenceModal: EventHandler = (data, context) => {
  console.log("[Chatbot] Open sequence modal event:", data.payload)

  const { callbacks } = context

  if (callbacks.onOpenSequenceModal && data.payload) {
    callbacks.onOpenSequenceModal({
      customerGroupId: data.payload.customerGroupId,
      customerGroupName: data.payload.customerGroupName,
      leadsCount: data.payload.leadsCount,
    })
  }
}

/**
 * Event Handler Map - dispatch events to appropriate handlers
 */
export const eventHandlers: Record<string, EventHandler> = {
  "node-start": handleNodeStart,
  "node-complete": handleNodeComplete,
  thinking: handleThinking,
  progress: handleProgress,
  text_chunk: handleTextChunk,
  interrupt: handleInterrupt,
  node: handleNode,
  waiting_confirmation: handleWaitingConfirmation,
  done: handleDone,
  error: handleError,
  ping: handlePing,
  open_sequence_modal: handleOpenSequenceModal,
}
