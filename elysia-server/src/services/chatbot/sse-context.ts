/**
 * SSE Context for LangGraph Nodes
 * Allows nodes to emit real-time events during execution
 */

import { chatbotLogger } from "../../utils/logger"

export interface SSESession {
  push: (event: { event: string; data: unknown }) => boolean
  closed: boolean
}

export interface NodeEventEmitter {
  /**
   * Emit node start event
   * Call this at the beginning of node execution
   */
  nodeStart(nodeName: string, message: string): void

  /**
   * Emit progress event
   * Call this during long-running operations
   */
  progress(
    nodeName: string,
    message: string,
    percent?: number,
    details?: Record<string, unknown>,
  ): void

  /**
   * Emit text chunk for LLM streaming
   * Call this for each chunk received from LLM
   */
  textChunk(nodeName: string, chunk: string, accumulated: string): void

  /**
   * Emit node complete event
   * Call this at the end of node execution
   */
  nodeComplete(nodeName: string, message: string, result?: unknown): void

  /**
   * Emit error event
   */
  error(nodeName: string, error: string): void

  /**
   * Emit open_sequence_modal event
   * Triggers the sequence generator modal in the frontend
   */
  openSequenceModal(payload: {
    customerGroupId?: string
    customerGroupName?: string
    leadsCount?: number
  }): void

  /**
   * Check if client is still connected
   */
  isConnected(): boolean
}

/**
 * Create a node event emitter from SSE session
 */
export function createNodeEmitter(session: SSESession): NodeEventEmitter {
  return {
    nodeStart(nodeName: string, message: string) {
      if (session.closed) return

      const success = session.push({
        event: "node-start",
        data: {
          type: "node-start",
          node: nodeName,
          message,
          timestamp: Date.now(),
        },
      })

      if (success) {
        chatbotLogger.debug(`[Node] ${nodeName} started: ${message}`)
      }
    },

    progress(
      nodeName: string,
      message: string,
      percent?: number,
      details?: Record<string, unknown>,
    ) {
      if (session.closed) return

      const success = session.push({
        event: "progress",
        data: {
          type: "progress",
          node: nodeName,
          message,
          percent,
          details,
          timestamp: Date.now(),
        },
      })

      if (success) {
        chatbotLogger.debug(
          `[Node] ${nodeName} progress: ${message} ${percent ? `(${percent}%)` : ""}`,
        )
      }
    },

    textChunk(nodeName: string, chunk: string, accumulated: string) {
      if (session.closed) return

      session.push({
        event: "text_chunk",
        data: {
          type: "text_chunk",
          node: nodeName,
          chunk,
          accumulatedText: accumulated,
          timestamp: Date.now(),
        },
      })
    },

    nodeComplete(nodeName: string, message: string, result?: unknown) {
      if (session.closed) return

      const success = session.push({
        event: "node-complete",
        data: {
          type: "node-complete",
          node: nodeName,
          message,
          result,
          timestamp: Date.now(),
        },
      })

      if (success) {
        chatbotLogger.debug(`[Node] ${nodeName} completed: ${message}`)
      }
    },

    error(nodeName: string, error: string) {
      if (session.closed) return

      session.push({
        event: "error",
        data: {
          type: "error",
          node: nodeName,
          error,
          timestamp: Date.now(),
        },
      })

      chatbotLogger.error(`[Node] ${nodeName} error: ${error}`)
    },

    openSequenceModal(payload: {
      customerGroupId?: string
      customerGroupName?: string
      leadsCount?: number
    }) {
      if (session.closed) return

      const success = session.push({
        event: "open_sequence_modal",
        data: {
          type: "open_sequence_modal",
          payload,
          timestamp: Date.now(),
        },
      })

      if (success) {
        chatbotLogger.info(
          `[Node] Emitting open_sequence_modal event for group: ${payload.customerGroupName || "none"}`,
        )
      }
    },

    isConnected() {
      return !session.closed
    },
  }
}

/**
 * Helper to stream LLM responses with automatic chunking
 */
export async function streamLLMResponse(
  emitter: NodeEventEmitter,
  nodeName: string,
  asyncIterator: AsyncIterable<unknown>,
  options?: {
    throttleMs?: number
    onComplete?: (fullText: string) => void
  },
): Promise<string> {
  const throttleMs = options?.throttleMs || 50
  let accumulated = ""
  let lastSendTime = Date.now()

  try {
    for await (const chunk of asyncIterator) {
      if (!emitter.isConnected()) {
        chatbotLogger.warn(`[Stream] Client disconnected during ${nodeName} streaming`)
        break
      }

      // Extract text content from AIMessageChunk or string
      const textContent =
        typeof chunk === "string" ? chunk : ((chunk as { content?: string })?.content ?? "")

      accumulated += textContent
      const now = Date.now()

      // Throttle to avoid overwhelming the client
      if (now - lastSendTime >= throttleMs) {
        emitter.textChunk(nodeName, textContent, accumulated)
        lastSendTime = now
      }
    }

    // Send final chunk
    if (emitter.isConnected()) {
      emitter.textChunk(nodeName, "", accumulated)
    }

    if (options?.onComplete) {
      options.onComplete(accumulated)
    }

    return accumulated
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    emitter.error(nodeName, `Streaming failed: ${errorMessage}`)
    throw error
  }
}
