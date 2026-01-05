import { cors } from "@elysiajs/cors"
import { Command } from "@langchain/langgraph"
import { ChatOpenAI } from "@langchain/openai"
import { and, asc, desc, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { chatConversations, chatMessages } from "../db/schema"
import { createChatbotGraph } from "../services/chatbot"
import { createNodeEmitter } from "../services/chatbot/sse-context"
import type { ChatbotState } from "../services/chatbot/state"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import { chatbotLogger } from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

/**
 * Parse CSV string to structured data
 * Optimized for performance with large CSV files
 */
function parseCSV(csvContent: string): {
  headers: string[]
  rows: Record<string, string>[]
  rowCount: number
} {
  const lines = csvContent.trim().split("\n")

  if (lines.length === 0) {
    return { headers: [], rows: [], rowCount: 0 }
  }

  // Simple CSV parser (handles basic quoted fields)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ""
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]

      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === "," && !inQuotes) {
        result.push(current.trim())
        current = ""
      } else {
        current += char
      }
    }

    result.push(current.trim())
    return result
  }

  // Parse header
  const headers = parseCSVLine(lines[0] || "").filter((h) => h.length > 0)

  // Parse data rows
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim() || ""
    if (line.length === 0) continue

    const values = parseCSVLine(line)
    const row: Record<string, string> = {}

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j]
      if (header) {
        row[header] = values[j] || ""
      }
    }

    rows.push(row)
  }

  return {
    headers,
    rows,
    rowCount: rows.length,
  }
}

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

        // Use better-sse pattern with createSSEResponse
        return createSSEResponse(
          async (session) => {
            try {
              const config = {
                configurable: {
                  thread_id: body.conversationId || `chat-${Date.now()}`,
                },
              }

              // Parse CSV from message attachment if present
              let csvData:
                | { headers: string[]; rows: Record<string, string>[]; rowCount: number }
                | undefined

              const lastMessage = body.messages?.[body.messages.length - 1]
              if (
                lastMessage?.attachment?.content &&
                lastMessage.attachment.fileName?.endsWith(".csv")
              ) {
                chatbotLogger.info(
                  `[CSV] Parsing CSV attachment: ${lastMessage.attachment.fileName}`,
                )
                csvData = parseCSV(lastMessage.attachment.content)
                chatbotLogger.nodeDetail("csv-parsing", {
                  fileName: lastMessage.attachment.fileName,
                  headers: csvData.headers,
                  rowCount: csvData.rowCount,
                })
              }

              // ⭐ Create SSE emitter for nodes to use
              const emitter = createNodeEmitter(session)

              // Extract sequence generation request from last message metadata
              const lastMessageMetadata = body.messages?.[body.messages.length - 1]?.metadata
              let sequenceGenerationRequest:
                | {
                    customerGroupId: string
                    customerGroupName: string
                    membersCount: number
                  }
                | undefined

              if (lastMessageMetadata && typeof lastMessageMetadata === "object") {
                const metadata = lastMessageMetadata as Record<string, unknown>
                if (
                  metadata.sequenceGenerationRequest &&
                  typeof metadata.sequenceGenerationRequest === "object"
                ) {
                  const req = metadata.sequenceGenerationRequest as Record<string, unknown>
                  if (
                    typeof req.customerGroupId === "string" &&
                    typeof req.customerGroupName === "string" &&
                    typeof req.membersCount === "number"
                  ) {
                    sequenceGenerationRequest = {
                      customerGroupId: req.customerGroupId,
                      customerGroupName: req.customerGroupName,
                      membersCount: req.membersCount,
                    }
                    chatbotLogger.info(
                      `[Sequence Generation] Request detected: ${req.customerGroupName} (${req.membersCount} members)`,
                    )
                  }
                }
              }

              // 스트리밍 실행
              const initialState: Partial<ChatbotState> = {
                currentQuestion: body.question,
                workspaceId: body.workspaceId,
                userId: body.userId || "anonymous",
                locale: body.locale || "ko", // Default to Korean
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
                csvData, // Add parsed CSV data to state
                _emitter: emitter, // ⭐ Inject emitter into state for nodes to use
                sequenceGenerationRequest, // ⭐ Add sequence generation request if present
                pendingSequenceGeneration: !!sequenceGenerationRequest,
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

                  // Update current state
                  if (nodeState) {
                    currentState = { ...currentState, ...nodeState } as ChatbotState
                  }

                  // ⭐ CRITICAL: Handle __interrupt__ event from interrupt() function
                  if (nodeName === "__interrupt__") {
                    isWaitingForConfirmation = true
                    chatbotLogger.info(
                      "[LangGraph] Hit interrupt() - waiting for user confirmation",
                    )

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

                    if (!session.push({ event: "interrupt", data: interruptEvent })) {
                      chatbotLogger.warn("[SSE] Client disconnected, cannot send interrupt event")
                      break
                    }

                    continue // Skip further processing for interrupt node
                  }

                  // Check if we're at askConfirmation node (for logging)
                  if (nodeName === "askConfirmation") {
                    chatbotLogger.info(
                      "[LangGraph] At askConfirmation node - interrupt() will be called",
                    )
                  }

                  // Check for client disconnect
                  if (session.closed) {
                    chatbotLogger.warn(
                      "[SSE] Client disconnected during streaming, stopping graph execution",
                    )
                    break
                  }
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

              // Send final done event with complete state
              if (!isWaitingForConfirmation) {
                // Save messages to database if conversationId looks like a valid UUID
                const convId = body.conversationId || ""
                const isValidUUID =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(convId)

                if (isValidUUID && currentState?.analysis) {
                  try {
                    // Save user message
                    await db.insert(chatMessages).values({
                      conversationId: convId,
                      role: "user",
                      content: body.question,
                      metadata: lastMessage?.attachment
                        ? { attachment: lastMessage.attachment }
                        : null,
                    })

                    // Save assistant message with metadata
                    // ⭐ CRITICAL: Include pendingSequenceActivation so follow-up questions know sequence exists
                    const pendingSeqActivation =
                      (currentState.metadata as { pendingSequenceActivation?: unknown })
                        ?.pendingSequenceActivation || undefined

                    await db.insert(chatMessages).values({
                      conversationId: convId,
                      role: "assistant",
                      content: currentState.analysis,
                      metadata: {
                        ...(currentState.generatedSQL && { sql: currentState.generatedSQL }),
                        ...(currentState.sqlExplanation && {
                          sqlExplanation: currentState.sqlExplanation,
                        }),
                        ...(currentState.queryResult?.length && {
                          result: currentState.queryResult,
                        }),
                        ...(currentState.insights?.length && { insights: currentState.insights }),
                        ...(currentState.visualizationSuggestions?.length && {
                          visualization: currentState.visualizationSuggestions,
                        }),
                        ...(currentState.followUpQuestions?.length && {
                          followUpQuestions: currentState.followUpQuestions,
                        }),
                        ...(pendingSeqActivation && {
                          pendingSequenceActivation: pendingSeqActivation,
                        }),
                      },
                    })

                    // Update conversation's updatedAt
                    await db
                      .update(chatConversations)
                      .set({ updatedAt: new Date() })
                      .where(eq(chatConversations.id, convId))

                    chatbotLogger.info(`[DB] Saved messages to conversation ${convId}`)
                  } catch (dbError) {
                    chatbotLogger.error(
                      `[DB] Failed to save messages: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
                    )
                  }
                }

                const doneEvent = {
                  type: "done",
                  state: {
                    ...(currentState?.metadata && { metadata: currentState.metadata }),
                    ...(currentState?.generatedSQL && { generatedSQL: currentState.generatedSQL }),
                    ...(currentState?.sqlExplanation && {
                      sqlExplanation: currentState.sqlExplanation,
                    }),
                    ...(currentState?.queryResult && { queryResult: currentState.queryResult }),
                    ...(currentState?.executionTime && {
                      executionTime: currentState.executionTime,
                    }),
                    ...(currentState?.analysis && { analysis: currentState.analysis }),
                    ...(currentState?.insights && { insights: currentState.insights }),
                    ...(currentState?.visualizationSuggestions && {
                      visualizationSuggestions: currentState.visualizationSuggestions,
                    }),
                    ...(currentState?.followUpQuestions && {
                      followUpQuestions: currentState.followUpQuestions,
                    }),
                    ...(currentState?.error && { error: currentState.error }),
                    ...(currentState?.messages && { messages: currentState.messages }),
                  },
                  timestamp: Date.now(),
                }

                session.push({ event: "done", data: doneEvent })
                chatbotLogger.info("[SSE] Sent done event")
                // Give client time to process the done event and any remaining node events
                await new Promise((resolve) => setTimeout(resolve, 500))
              } else {
                chatbotLogger.info(
                  "[LangGraph] Stream ending with confirmation pending (no done event)",
                )
                // Send a special waiting event instead
                session.push({
                  event: "waiting_confirmation",
                  data: { type: "waiting_confirmation" },
                })
                // Give client time to process the waiting event
                await new Promise((resolve) => setTimeout(resolve, 500))
              }
            } catch (error) {
              const routeDuration = Date.now() - routeStartTime
              const errorMessage =
                error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"

              chatbotLogger.routeError("POST", "/api/chatbot/ask", 500, routeDuration, errorMessage)

              session.push({
                event: "error",
                data: {
                  type: "error",
                  error: errorMessage,
                },
              })
            }
          },
          {
            keepAlive: true,
            keepAliveInterval: 30000, // 30 seconds heartbeat
            onClose: () => {
              chatbotLogger.info("[SSE] Client disconnected from /ask")
            },
          },
        )
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
        locale: t.Optional(t.String()), // Language code for AI responses (e.g., "ko", "en")
        messages: t.Optional(
          t.Array(
            t.Object({
              role: t.Union([t.Literal("user"), t.Literal("assistant")]),
              content: t.String(),
              timestamp: t.Optional(t.Any()),
              metadata: t.Optional(t.Any()),
              attachment: t.Optional(
                t.Object({
                  fileName: t.String(),
                  fileSize: t.Number(),
                  fileType: t.String(),
                  content: t.Optional(t.String()),
                }),
              ),
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
      // Fetch messages from database instead of LangGraph checkpoint
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, params.conversationId))
        .orderBy(asc(chatMessages.createdAt))

      // Transform to match expected format
      const formattedMessages = messages.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
        timestamp: msg.createdAt,
        metadata: msg.metadata as Record<string, unknown> | undefined,
      }))

      const duration = Date.now() - startTime
      chatbotLogger.routeSuccess(
        "GET",
        `/api/chatbot/history/${params.conversationId}`,
        200,
        duration,
      )

      return successResponse({
        messages: formattedMessages,
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

        // Stream the resumed execution using better-sse
        return createSSEResponse(
          async (session) => {
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

                  if (!session.push({ event: "node", data: streamEvent })) {
                    chatbotLogger.warn("[SSE] Client disconnected during confirm streaming")
                    break
                  }
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

              session.push({ event: "done", data: { type: "done" } })
              // Give client time to process the done event and any remaining node events
              await new Promise((resolve) => setTimeout(resolve, 500))
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

              session.push({
                event: "error",
                data: {
                  type: "error",
                  error: errorMessage,
                },
              })
            }
          },
          {
            keepAlive: true,
            keepAliveInterval: 30000, // 30 seconds heartbeat
            onClose: () => {
              chatbotLogger.info("[SSE] Client disconnected from /confirm")
            },
          },
        )
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
  // ============================================
  // Conversation Management Endpoints
  // ============================================
  .options("/conversations", ({ set, request }) => {
    const origin = request.headers.get("origin") || "*"
    set.headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, Accept",
      "Access-Control-Max-Age": "86400",
    }
    set.status = 204
    return ""
  })
  // GET /api/chatbot/conversations - List user's conversations
  .get(
    "/conversations",
    async ({ query, headers, set }) => {
      const startTime = Date.now()
      chatbotLogger.routeStart("GET", "/api/chatbot/conversations")

      try {
        const userId = await getUserIdFromToken(headers.authorization)
        if (!userId) {
          set.status = 401
          return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
        }

        const { workspaceId } = query
        if (!workspaceId) {
          return errorResponse("workspaceId is required")
        }

        const conversations = await db
          .select()
          .from(chatConversations)
          .where(
            and(
              eq(chatConversations.workspaceId, workspaceId),
              eq(chatConversations.userId, userId),
              eq(chatConversations.isDeleted, false),
            ),
          )
          .orderBy(desc(chatConversations.updatedAt))

        const duration = Date.now() - startTime
        chatbotLogger.routeSuccess("GET", "/api/chatbot/conversations", 200, duration)

        return successResponse(conversations)
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch conversations"
        chatbotLogger.routeError("GET", "/api/chatbot/conversations", 500, duration, errorMessage)
        return errorResponse(errorMessage)
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(),
      }),
    },
  )
  // POST /api/chatbot/conversations - Create new conversation
  .post(
    "/conversations",
    async ({ body, headers, set }) => {
      const startTime = Date.now()
      chatbotLogger.routeStart("POST", "/api/chatbot/conversations")

      try {
        const userId = await getUserIdFromToken(headers.authorization)
        if (!userId) {
          set.status = 401
          return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
        }

        const { workspaceId, title } = body

        const [conversation] = await db
          .insert(chatConversations)
          .values({
            workspaceId,
            userId,
            title: title || "새 채팅",
          })
          .returning()

        const duration = Date.now() - startTime
        chatbotLogger.routeSuccess("POST", "/api/chatbot/conversations", 201, duration)

        return successResponse(conversation)
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create conversation"
        chatbotLogger.routeError("POST", "/api/chatbot/conversations", 500, duration, errorMessage)
        return errorResponse(errorMessage)
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        title: t.Optional(t.String()),
      }),
    },
  )
  .options("/conversations/:id", ({ set, request }) => {
    const origin = request.headers.get("origin") || "*"
    set.headers = {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID, Accept",
      "Access-Control-Max-Age": "86400",
    }
    set.status = 204
    return ""
  })
  // PATCH /api/chatbot/conversations/:id - Update conversation title
  .patch(
    "/conversations/:id",
    async ({ params, body }) => {
      const startTime = Date.now()
      chatbotLogger.routeStart("PATCH", `/api/chatbot/conversations/${params.id}`)

      try {
        const { title } = body

        const [updated] = await db
          .update(chatConversations)
          .set({
            title,
            updatedAt: new Date(),
          })
          .where(eq(chatConversations.id, params.id))
          .returning()

        if (!updated) {
          return errorResponse("Conversation not found", ResponseCode.NOT_FOUND)
        }

        const duration = Date.now() - startTime
        chatbotLogger.routeSuccess(
          "PATCH",
          `/api/chatbot/conversations/${params.id}`,
          200,
          duration,
        )

        return successResponse(updated)
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update conversation"
        chatbotLogger.routeError(
          "PATCH",
          `/api/chatbot/conversations/${params.id}`,
          500,
          duration,
          errorMessage,
        )
        return errorResponse(errorMessage)
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        title: t.String(),
      }),
    },
  )
  // DELETE /api/chatbot/conversations/:id - Soft delete conversation
  .delete(
    "/conversations/:id",
    async ({ params }) => {
      const startTime = Date.now()
      chatbotLogger.routeStart("DELETE", `/api/chatbot/conversations/${params.id}`)

      try {
        const [deleted] = await db
          .update(chatConversations)
          .set({
            isDeleted: true,
            updatedAt: new Date(),
          })
          .where(eq(chatConversations.id, params.id))
          .returning()

        if (!deleted) {
          return errorResponse("Conversation not found", ResponseCode.NOT_FOUND)
        }

        const duration = Date.now() - startTime
        chatbotLogger.routeSuccess(
          "DELETE",
          `/api/chatbot/conversations/${params.id}`,
          200,
          duration,
        )

        return successResponse({ success: true })
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete conversation"
        chatbotLogger.routeError(
          "DELETE",
          `/api/chatbot/conversations/${params.id}`,
          500,
          duration,
          errorMessage,
        )
        return errorResponse(errorMessage)
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
    },
  )
  .options("/conversations/:id/generate-title", ({ set, request }) => {
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
  // POST /api/chatbot/conversations/:id/generate-title - AI generate title from first message
  .post(
    "/conversations/:id/generate-title",
    async ({ params, body }) => {
      const startTime = Date.now()
      chatbotLogger.routeStart("POST", `/api/chatbot/conversations/${params.id}/generate-title`)

      try {
        const { firstMessage, locale } = body

        // Use OpenAI to generate a concise title
        const llm = new ChatOpenAI({
          modelName: "gpt-5-mini",
          reasoning: {
            effort: "none",
          },
        })

        const titlePrompt =
          locale === "ko"
            ? `다음 메시지의 핵심 주제를 5-10단어 이내의 짧은 제목으로 요약해주세요. 제목만 출력하세요:
            
"${firstMessage}"`
            : `Summarize the core topic of the following message in a short title (5-10 words max). Output only the title:
            
"${firstMessage}"`

        const response = await llm.invoke(titlePrompt)
        const generatedTitle =
          typeof response.content === "string"
            ? response.content.trim().replace(/^["']|["']$/g, "")
            : "새 채팅"

        // Update the conversation with the generated title
        const [updated] = await db
          .update(chatConversations)
          .set({
            title: generatedTitle.substring(0, 255), // Ensure it fits in the column
            updatedAt: new Date(),
          })
          .where(eq(chatConversations.id, params.id))
          .returning()

        if (!updated) {
          return errorResponse("Conversation not found", ResponseCode.NOT_FOUND)
        }

        const duration = Date.now() - startTime
        chatbotLogger.routeSuccess(
          "POST",
          `/api/chatbot/conversations/${params.id}/generate-title`,
          200,
          duration,
        )

        return successResponse({ title: updated.title })
      } catch (error) {
        const duration = Date.now() - startTime
        const errorMessage = error instanceof Error ? error.message : "Failed to generate title"
        chatbotLogger.routeError(
          "POST",
          `/api/chatbot/conversations/${params.id}/generate-title`,
          500,
          duration,
          errorMessage,
        )
        return errorResponse(errorMessage)
      }
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        firstMessage: t.String(),
        locale: t.Optional(t.String()),
      }),
    },
  )
