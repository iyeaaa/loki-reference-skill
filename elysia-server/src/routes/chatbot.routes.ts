import { cors } from "@elysiajs/cors"
import { Command } from "@langchain/langgraph"
import { Elysia, t } from "elysia"
import { createChatbotGraph } from "../services/chatbot"
import { streamAnalysisResults } from "../services/chatbot/nodes/result-analyzer"
import type { ChatbotState } from "../services/chatbot/state"
import { errorResponse, successResponse } from "../types/response.types"
import { chatbotLogger } from "../utils/logger"

type LangGraphEvent = {
  [key: string]: Partial<ChatbotState>
}

export const chatbotRoutes = new Elysia({ prefix: "/api/chatbot" })
  // Add explicit CORS handling for chatbot routes
  .use(
    cors({
      origin: true, // Allow all origins in development
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID", "Accept"],
      exposeHeaders: ["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    }),
  )
  // Handle OPTIONS preflight explicitly
  .options("/ask", ({ set, request }) => {
    const origin = request.headers.get("origin") || "*"
    set.headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, Accept",
      "Access-Control-Max-Age": "86400",
    }
    set.status = 204
    return ""
  })
  .post(
    "/ask",
    async ({ body }) => {
      const routeStartTime = Date.now()
      chatbotLogger.routeStart("POST", "/api/chatbot/ask")

      try {
        // Validate workspace_id
        if (!body.workspaceId || body.workspaceId === "all" || body.workspaceId.trim() === "") {
          const routeDuration = Date.now() - routeStartTime
          chatbotLogger.routeError(
            "POST",
            "/api/chatbot/ask",
            400,
            routeDuration,
            "Invalid workspace_id: must be a valid UUID, not 'all' or empty",
          )
          return errorResponse(
            "워크스페이스를 선택해주세요. '전체' 워크스페이스에서는 챗봇을 사용할 수 없습니다.",
          )
        }

        const graph = createChatbotGraph()

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()

            try {
              const config = {
                configurable: {
                  thread_id: body.conversationId || `chat-${Date.now()}`,
                },
              }

              // 스트리밍 실행
              const initialState: Partial<ChatbotState> = {
                currentQuestion: body.question,
                workspaceId: body.workspaceId,
                userId: body.userId || "anonymous",
                // @ts-expect-error - Elysia body.messages type doesn't match ChatbotState messages type exactly
                messages: body.messages || [],
                conversationId: body.conversationId || `chat-${Date.now()}`,
                generatedSQL: "",
                sqlExplanation: "",
                isQuerySafe: false,
                queryResult: [],
                executionTime: 0,
                error: null,
                analysis: "",
                insights: [],
                visualizationSuggestions: [],
                schemaContext: "",
                previousQueries: [],
                followUpQuestions: [],
                needsClarification: false,
                clarificationQuestion: "",
              }

              let currentState: ChatbotState | null = null
              let isWaitingForConfirmation = false

              // Graph execution start logging
              const graphStartTime = Date.now()
              chatbotLogger.graphStart(body.conversationId || `chat-${Date.now()}`, body.question)

              let _graphSuccess = false

              try {
                // @ts-expect-error - LangGraph's stream() return type is complex and hard to type precisely
                for await (const event of await graph.stream(initialState as unknown, config)) {
                  const entries = Object.entries(event as LangGraphEvent)
                  const [[nodeName, nodeState]] = entries as [[string, Partial<ChatbotState>]]

                  chatbotLogger.graphEvent("streaming", nodeName)

                  // Store current state for streaming
                  if (nodeState) {
                    currentState = { ...currentState, ...nodeState } as ChatbotState
                  }

                  // CRITICAL: Handle __interrupt__ event from interrupt() function
                  if (nodeName === "__interrupt__") {
                    isWaitingForConfirmation = true
                    chatbotLogger.info(
                      "[LangGraph] Hit interrupt() - waiting for user confirmation",
                    )

                    // The nodeState contains the payload passed to interrupt()
                    // Send it to the client for display
                    const interruptPayload = nodeState as {
                      type?: string
                      confirmationMessage?: string
                      metadata?: unknown
                    }

                    chatbotLogger.nodeDetail("interrupt-payload", {
                      type: interruptPayload.type,
                      hasConfirmationMessage: !!interruptPayload.confirmationMessage,
                      hasMetadata: !!interruptPayload.metadata,
                    })

                    // Send interrupt event to client
                    const interruptEvent = {
                      type: "interrupt",
                      payload: interruptPayload,
                      timestamp: Date.now(),
                    }

                    const eventData = `data: ${JSON.stringify(interruptEvent)}\n\n`
                    controller.enqueue(encoder.encode(eventData))

                    continue // Skip further processing for interrupt node
                  }

                  // Check if we're at askConfirmation node (for logging)
                  if (nodeName === "askConfirmation") {
                    chatbotLogger.info(
                      "[LangGraph] At askConfirmation node - interrupt() will be called",
                    )
                  }

                  // Special handling for analyzeResults node - stream LLM text chunks
                  if (nodeName === "analyzeResults" && currentState) {
                    console.log("[SSE] Starting LLM text streaming for analyzeResults node")

                    try {
                      let accumulatedText = ""
                      let lastSendTime = Date.now()
                      const THROTTLE_MS = 50 // Send updates every 50ms maximum

                      for await (const chunk of streamAnalysisResults(currentState)) {
                        accumulatedText += chunk

                        const now = Date.now()
                        const timeSinceLastSend = now - lastSendTime

                        // Throttle: only send if enough time has passed
                        if (timeSinceLastSend >= THROTTLE_MS) {
                          // Send text chunk event
                          const chunkEvent = {
                            type: "text_chunk",
                            node: nodeName,
                            chunk: chunk,
                            accumulatedText: accumulatedText,
                            timestamp: now,
                          }

                          const chunkData = `data: ${JSON.stringify(chunkEvent)}\n\n`
                          controller.enqueue(encoder.encode(chunkData))
                          lastSendTime = now
                        }
                      }

                      // Send final accumulated text
                      const finalEvent = {
                        type: "text_chunk",
                        node: nodeName,
                        chunk: "",
                        accumulatedText: accumulatedText,
                        timestamp: Date.now(),
                      }
                      const finalData = `data: ${JSON.stringify(finalEvent)}\n\n`
                      controller.enqueue(encoder.encode(finalData))

                      console.log(
                        `[SSE] LLM streaming completed. Total length: ${accumulatedText.length}`,
                      )

                      // Update nodeState with final accumulated text
                      nodeState.analysis = accumulatedText
                    } catch (streamError) {
                      console.error("[SSE] Error during LLM streaming:", streamError)
                    }
                  }

                  // 각 노드의 진행 상황을 스트리밍
                  const streamEvent = {
                    type: "node",
                    node: nodeName,
                    state: {
                      // 중요한 상태만 전송
                      ...(nodeState.metadata && { metadata: nodeState.metadata }),
                      ...(nodeState.generatedSQL && { generatedSQL: nodeState.generatedSQL }),
                      ...(nodeState.sqlExplanation && {
                        sqlExplanation: nodeState.sqlExplanation,
                      }),
                      ...(nodeState.queryResult && { queryResult: nodeState.queryResult }),
                      ...(nodeState.executionTime && { executionTime: nodeState.executionTime }),
                      ...(nodeState.analysis && { analysis: nodeState.analysis }),
                      ...(nodeState.insights && { insights: nodeState.insights }),
                      ...(nodeState.visualizationSuggestions && {
                        visualizationSuggestions: nodeState.visualizationSuggestions,
                      }),
                      ...(nodeState.followUpQuestions && {
                        followUpQuestions: nodeState.followUpQuestions,
                      }),
                      ...(nodeState.error && { error: nodeState.error }),
                      ...(nodeState.messages && { messages: nodeState.messages }),
                      // Confirmation fields for human-in-the-loop
                      ...(nodeState.needsConfirmation !== undefined && {
                        needsConfirmation: nodeState.needsConfirmation,
                      }),
                      ...(nodeState.confirmationMessage && {
                        confirmationMessage: nodeState.confirmationMessage,
                      }),
                    },
                    timestamp: Date.now(),
                  }

                  // Encode as Uint8Array for proper streaming
                  const eventData = `data: ${JSON.stringify(streamEvent)}\n\n`
                  console.log(`[SSE] Sending event to client:`, streamEvent.type, streamEvent.node)
                  controller.enqueue(encoder.encode(eventData))
                }

                // Mark graph execution as successful
                _graphSuccess = true

                // Graph execution end logging
                const graphDuration = Date.now() - graphStartTime
                chatbotLogger.graphEnd(
                  body.conversationId || `chat-${Date.now()}`,
                  graphDuration,
                  true,
                )
              } catch (graphError) {
                // Graph execution failed
                const graphDuration = Date.now() - graphStartTime
                chatbotLogger.graphEnd(
                  body.conversationId || `chat-${Date.now()}`,
                  graphDuration,
                  false,
                )
                throw graphError
              }

              const routeDuration = Date.now() - routeStartTime
              chatbotLogger.routeSuccess("POST", "/api/chatbot/ask", 200, routeDuration)

              // Only send done event if we're not waiting for confirmation
              if (!isWaitingForConfirmation) {
                const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`
                controller.enqueue(encoder.encode(doneEvent))
              } else {
                chatbotLogger.info(
                  "[LangGraph] Stream ending with confirmation pending (no done event)",
                )
                // Send a special waiting event instead
                const waitingEvent = `data: ${JSON.stringify({ type: "waiting_confirmation" })}\n\n`
                controller.enqueue(encoder.encode(waitingEvent))
              }
              controller.close()
            } catch (error) {
              const routeDuration = Date.now() - routeStartTime
              const errorMessage =
                error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"

              chatbotLogger.routeError("POST", "/api/chatbot/ask", 500, routeDuration, errorMessage)

              const errorEvent = `data: ${JSON.stringify({
                type: "error",
                error: errorMessage,
              })}\n\n`
              controller.enqueue(encoder.encode(errorEvent))
              controller.close()
            }
          },
        })

        // Return SSE stream
        // Note: CORS headers are handled by the CORS plugin, no need to add them here
        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        })
      } catch (error) {
        const routeDuration = Date.now() - routeStartTime
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"
        chatbotLogger.routeError("POST", "/api/chatbot/ask", 500, routeDuration, errorMessage)
        return errorResponse(errorMessage)
      }
    },
    {
      body: t.Object({
        question: t.String({ minLength: 1 }),
        workspaceId: t.String(),
        userId: t.Optional(t.String()),
        conversationId: t.Optional(t.String()),
        messages: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              content: t.String(),
              timestamp: t.Optional(t.Any()),
              metadata: t.Optional(t.Any()),
            }),
          ),
        ),
      }),
    },
  )
  .options("/history/:conversationId", ({ set, request }) => {
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
  .get("/history/:conversationId", async ({ params }) => {
    const startTime = Date.now()
    chatbotLogger.routeStart("GET", `/api/chatbot/history/${params.conversationId}`)

    try {
      const graph = createChatbotGraph()
      const config = {
        configurable: { thread_id: params.conversationId },
      }

      const state = await graph.getState(config)

      const duration = Date.now() - startTime
      chatbotLogger.routeSuccess(
        "GET",
        `/api/chatbot/history/${params.conversationId}`,
        200,
        duration,
      )

      return successResponse({
        messages: state.values.messages || [],
        conversationId: params.conversationId,
      })
    } catch (_error) {
      const duration = Date.now() - startTime
      chatbotLogger.routeError(
        "GET",
        `/api/chatbot/history/${params.conversationId}`,
        500,
        duration,
      )
      return errorResponse("대화 히스토리를 가져오는데 실패했습니다")
    }
  })
  .options("/confirm", ({ set, request }) => {
    const origin = request.headers.get("origin") || "*"
    set.headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, Accept",
      "Access-Control-Max-Age": "86400",
    }
    set.status = 204
    return ""
  })
  .post(
    "/confirm",
    async ({ body }) => {
      const routeStartTime = Date.now()
      chatbotLogger.routeStart("POST", "/api/chatbot/confirm")

      try {
        const graph = createChatbotGraph()
        const config = {
          configurable: {
            thread_id: body.conversationId,
          },
        }

        chatbotLogger.info(
          `[LangGraph] User ${body.confirmed ? "confirmed" : "rejected"} mutation for conversation ${body.conversationId}`,
        )

        // For rejected operations, resume with false and return immediately
        if (!body.confirmed) {
          chatbotLogger.info("[LangGraph] User rejected - resuming with false")

          // Resume execution with rejection
          // The interrupt() in askConfirmation will receive false
          await graph.invoke(new Command({ resume: false }), config)

          const routeDuration = Date.now() - routeStartTime
          chatbotLogger.routeSuccess("POST", "/api/chatbot/confirm", 200, routeDuration)

          return successResponse({
            message: "작업이 취소되었습니다.",
            conversationId: body.conversationId,
          })
        }

        // User approved - resume and stream results
        chatbotLogger.info("[LangGraph] User confirmed - resuming with true and streaming results")

        // CRITICAL: Check checkpoint state before resuming
        try {
          const checkpointState = await graph.getState(config)
          chatbotLogger.nodeDetail("confirm-checkpoint-state", {
            exists: !!checkpointState,
            hasValues: !!checkpointState?.values,
            hasGeneratedSQL: !!checkpointState?.values?.generatedSQL,
            sqlLength: checkpointState?.values?.generatedSQL?.length || 0,
            hasSqlQueries: !!checkpointState?.values?.sqlQueries,
            sqlQueriesCount: checkpointState?.values?.sqlQueries?.length || 0,
            hasConfirmationMessage: !!checkpointState?.values?.confirmationMessage,
            nextNodes: checkpointState?.next || [],
            configKeys: checkpointState?.config ? Object.keys(checkpointState.config) : [],
          })

          if (!checkpointState?.values) {
            throw new Error(
              "No checkpoint found for conversation. The session may have expired or the server was restarted.",
            )
          }
        } catch (checkpointError) {
          chatbotLogger.error(
            `[LangGraph] Failed to retrieve checkpoint: ${checkpointError instanceof Error ? checkpointError.message : String(checkpointError)}`,
          )
          throw checkpointError
        }

        // Stream the resumed execution
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder()

            try {
              const graphStartTime = Date.now()
              chatbotLogger.info(`[LangGraph] Resuming execution after user approval`)

              let _graphSuccess = false

              try {
                // CRITICAL: Resume with Command({ resume: true, update: { isConfirmed: true } })
                // - resume: true will be the return value of interrupt() in askConfirmation
                // - update: sets isConfirmed flag so executeQuery knows user approved
                for await (const event of await graph.stream(
                  new Command({
                    resume: true,
                    update: {
                      isConfirmed: true,
                    },
                  }),
                  config,
                )) {
                  const entries = Object.entries(event as Record<string, Partial<ChatbotState>>)
                  const [[nodeName, nodeState]] = entries as [[string, Partial<ChatbotState>]]

                  chatbotLogger.graphEvent("streaming", nodeName)

                  const streamEvent = {
                    type: "node",
                    node: nodeName,
                    state: {
                      ...(nodeState.metadata && { metadata: nodeState.metadata }),
                      ...(nodeState.generatedSQL && { generatedSQL: nodeState.generatedSQL }),
                      ...(nodeState.queryResult && { queryResult: nodeState.queryResult }),
                      ...(nodeState.executionTime && { executionTime: nodeState.executionTime }),
                      ...(nodeState.analysis && { analysis: nodeState.analysis }),
                      ...(nodeState.insights && { insights: nodeState.insights }),
                      ...(nodeState.visualizationSuggestions && {
                        visualizationSuggestions: nodeState.visualizationSuggestions,
                      }),
                      ...(nodeState.followUpQuestions && {
                        followUpQuestions: nodeState.followUpQuestions,
                      }),
                      ...(nodeState.error && { error: nodeState.error }),
                      ...(nodeState.messages && { messages: nodeState.messages }),
                    },
                    timestamp: Date.now(),
                  }

                  const eventData = `data: ${JSON.stringify(streamEvent)}\n\n`
                  controller.enqueue(encoder.encode(eventData))
                }

                _graphSuccess = true

                const graphDuration = Date.now() - graphStartTime
                chatbotLogger.graphEnd(body.conversationId, graphDuration, true)
              } catch (graphError) {
                const graphDuration = Date.now() - graphStartTime
                chatbotLogger.graphEnd(body.conversationId, graphDuration, false)
                throw graphError
              }

              const routeDuration = Date.now() - routeStartTime
              chatbotLogger.routeSuccess("POST", "/api/chatbot/confirm", 200, routeDuration)

              const doneEvent = `data: ${JSON.stringify({ type: "done" })}\n\n`
              controller.enqueue(encoder.encode(doneEvent))
              controller.close()
            } catch (error) {
              const routeDuration = Date.now() - routeStartTime
              const errorMessage =
                error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"

              chatbotLogger.routeError(
                "POST",
                "/api/chatbot/confirm",
                500,
                routeDuration,
                errorMessage,
              )

              const errorEvent = `data: ${JSON.stringify({
                type: "error",
                error: errorMessage,
              })}\n\n`
              controller.enqueue(encoder.encode(errorEvent))
              controller.close()
            }
          },
        })

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
          },
        })
      } catch (error) {
        const routeDuration = Date.now() - routeStartTime
        const errorMessage =
          error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"
        chatbotLogger.routeError("POST", "/api/chatbot/confirm", 500, routeDuration, errorMessage)
        return errorResponse(errorMessage)
      }
    },
    {
      body: t.Object({
        conversationId: t.String(),
        confirmed: t.Boolean(),
      }),
    },
  )
