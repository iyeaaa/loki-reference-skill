import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { successResponse } from "../types/response.types"
import logger from "../utils/logger"

/**
 * SSE Test Routes - Optimized implementation
 * Production-grade Server-Sent Events without external dependencies
 */
export const sseTestRoutes = new Elysia({ prefix: "/api/sse-test" })
  .use(
    cors({
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Accept"],
      exposeHeaders: ["X-Request-ID"],
    }),
  )
  .options("/stream", ({ set, request }) => {
    const origin = request.headers.get("origin") || "*"
    set.headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, Accept",
      "Access-Control-Max-Age": "86400",
    }
    set.status = 204
    return ""
  })
  /**
   * GET /api/sse-test/stream
   * Test endpoint that streams various types of events
   * Optimized with proper connection handling
   */
  .get("/stream", async () => {
    logger.info("[SSE Test] Starting optimized SSE stream")

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let isDisconnected = false

        // Safe enqueue function with disconnect detection
        const safeEnqueue = (data: string): boolean => {
          if (isDisconnected) {
            return false
          }
          try {
            controller.enqueue(encoder.encode(data))
            return true
          } catch (_error) {
            isDisconnected = true
            logger.debug("[SSE Test] Client disconnected, stopping stream")
            return false
          }
        }

        try {
          // Event 1: Connection established
          if (
            !safeEnqueue(
              `data: ${JSON.stringify({
                type: "connected",
                message: "SSE connection established successfully",
                timestamp: new Date().toISOString(),
              })}\n\n`,
            )
          )
            return
          logger.info("[SSE Test] Sent connection event")

          await new Promise((resolve) => setTimeout(resolve, 1000))
          if (isDisconnected) return

          // Event 2: Progress events (simulate processing)
          for (let i = 1; i <= 10; i++) {
            if (isDisconnected) {
              logger.info(`[SSE Test] Stream cancelled at progress ${i}/10`)
              return
            }

            if (
              !safeEnqueue(
                `data: ${JSON.stringify({
                  type: "progress",
                  message: `Processing step ${i} of 10`,
                  progress: i * 10,
                  timestamp: new Date().toISOString(),
                })}\n\n`,
              )
            )
              return
            logger.info(`[SSE Test] Sent progress event: ${i}/10`)
            await new Promise((resolve) => setTimeout(resolve, 500))
          }

          if (isDisconnected) return

          // Event 3: Data event (simulate data streaming)
          if (
            !safeEnqueue(
              `data: ${JSON.stringify({
                type: "data",
                message: "Streaming data chunks",
                data: {
                  users: [
                    { id: 1, name: "John Doe", email: "john@example.com" },
                    { id: 2, name: "Jane Smith", email: "jane@example.com" },
                    { id: 3, name: "Bob Johnson", email: "bob@example.com" },
                  ],
                },
                timestamp: new Date().toISOString(),
              })}\n\n`,
            )
          )
            return
          logger.info("[SSE Test] Sent data event")

          await new Promise((resolve) => setTimeout(resolve, 1000))
          if (isDisconnected) return

          // Event 4: Text streaming (simulate LLM-style streaming)
          const textChunks = [
            "Hello, ",
            "this is ",
            "a test ",
            "of real-time ",
            "text streaming. ",
            "It simulates ",
            "how AI responses ",
            "are streamed ",
            "to the client. ",
            "Pretty cool, right?",
          ]

          let accumulatedText = ""
          for (const chunk of textChunks) {
            if (isDisconnected) {
              logger.info("[SSE Test] Stream cancelled during text streaming")
              return
            }

            accumulatedText += chunk
            if (
              !safeEnqueue(
                `data: ${JSON.stringify({
                  type: "text_chunk",
                  chunk: chunk,
                  accumulatedText: accumulatedText,
                  timestamp: new Date().toISOString(),
                })}\n\n`,
              )
            )
              return
            logger.info(`[SSE Test] Sent text chunk: ${chunk.trim()}`)
            await new Promise((resolve) => setTimeout(resolve, 200))
          }

          await new Promise((resolve) => setTimeout(resolve, 1000))
          if (isDisconnected) return

          // Event 5: Heartbeat/ping test
          for (let i = 1; i <= 3; i++) {
            if (isDisconnected) {
              logger.info(`[SSE Test] Stream cancelled at ping ${i}/3`)
              return
            }

            if (
              !safeEnqueue(
                `data: ${JSON.stringify({
                  type: "ping",
                  message: `Heartbeat ${i}`,
                  timestamp: new Date().toISOString(),
                })}\n\n`,
              )
            )
              return
            logger.info(`[SSE Test] Sent ping event: ${i}`)
            await new Promise((resolve) => setTimeout(resolve, 1000))
          }

          if (isDisconnected) return

          // Event 6: Completion event
          if (
            !safeEnqueue(
              `data: ${JSON.stringify({
                type: "done",
                message: "Stream completed successfully",
                totalDuration: "~20 seconds",
                timestamp: new Date().toISOString(),
              })}\n\n`,
            )
          )
            return
          logger.info("[SSE Test] Sent completion event")

          // Give client time to process final event
          await new Promise((resolve) => setTimeout(resolve, 100))

          logger.info("[SSE Test] Stream completed successfully")
        } catch (error: unknown) {
          // Only log error if it's not a cancellation
          if (!isDisconnected) {
            logger.error({ error }, "[SSE Test] Stream error")
            safeEnqueue(
              `data: ${JSON.stringify({
                type: "error",
                message: error instanceof Error ? error.message : "Unknown error occurred",
                timestamp: new Date().toISOString(),
              })}\n\n`,
            )
          }
        } finally {
          try {
            controller.close()
            if (!isDisconnected) {
              logger.info("[SSE Test] Stream closed gracefully")
            } else {
              logger.debug("[SSE Test] Stream closed after client disconnection")
            }
          } catch (_closeError) {
            logger.debug("[SSE Test] Stream already closed")
          }
        }
      },
      cancel() {
        logger.info("[SSE Test] Client cancelled stream")
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  })
  /**
   * GET /api/sse-test/info
   * Get information about the SSE test endpoint
   */
  .get("/info", () => {
    return successResponse({
      name: "SSE Test Endpoint (Optimized)",
      description: "Production-grade Server-Sent Events with proper disconnect handling",
      implementation: {
        approach: "Native ReadableStream with optimized error handling",
        features: [
          "Graceful disconnect detection",
          "Safe enqueue with automatic cleanup",
          "No external dependencies",
          "Memory efficient streaming",
          "Production-ready error handling",
        ],
      },
      endpoints: {
        stream: {
          method: "GET",
          path: "/api/sse-test/stream",
          description: "Stream test events including progress, data, and text chunks",
          events: [
            "connected - Connection established",
            "progress - Processing progress (10 steps)",
            "data - Sample data object",
            "text_chunk - Real-time text streaming (10 chunks)",
            "ping - Heartbeat events (3 pings)",
            "done - Completion event",
          ],
          duration: "~20 seconds",
        },
        info: {
          method: "GET",
          path: "/api/sse-test/info",
          description: "Get information about the SSE test endpoints",
        },
      },
      improvements: [
        "✅ Automatic disconnect detection prevents errors",
        "✅ Safe enqueue pattern with try-catch",
        "✅ Proper cleanup in finally block",
        "✅ Early return on disconnect saves resources",
        "✅ Clear logging for debugging",
      ],
    })
  })
