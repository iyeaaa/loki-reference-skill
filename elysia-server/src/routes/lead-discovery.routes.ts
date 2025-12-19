/**
 * Lead Discovery API Routes
 * Integrates with LangGraph for AI-powered lead discovery + Simple enrichment
 *
 * interrupt() 처리 방식:
 * - stream() 모드: GraphInterrupt 예외 발생 → catch에서 처리
 * - invoke() 모드: 결과 객체에 __interrupt__ 필드 포함
 *
 * 현재는 실시간 progress를 위해 stream()을 사용하고,
 * GraphInterrupt를 catch해서 정상적인 interrupt로 처리
 */

import { Command, GraphInterrupt } from "@langchain/langgraph"
import { Elysia, t } from "elysia"
import { v4 as uuidv4 } from "uuid"
import { createNodeEmitter } from "../services/chatbot/sse-context"
import { classifyError } from "../services/lead-discovery/error-classifier"
import {
  calculateFitScores,
  type LeadForScoring,
  type WebsiteAnalysisContext,
} from "../services/lead-discovery/fit-score-calculator"
import { clearCheckpoints, createLeadDiscoveryGraph } from "../services/lead-discovery/graph"
import { leadDiscoveryLogger } from "../services/lead-discovery/logger"
import { getMoreResults } from "../services/lead-discovery/nodes/bigquery-executor"
import {
  clearAllSessions as clearAllSessionMetadata,
  createSession,
  deleteSession,
  extendSession,
  SESSION_TTL_MS,
  touchSession,
  validateSession,
} from "../services/lead-discovery/session-manager"
import type { LeadDiscoveryState } from "../services/lead-discovery/state"
import { processLeadEnrichment } from "../services/web-extraction.service"
import { DEFAULT_EXTRACTION_CONFIG } from "../types/web-extraction.types"
import logger from "../utils/logger"
import { createSSEResponse } from "../utils/sse-helper"

// SSE 세션에 interrupt 이벤트 전송
async function sendInterruptEvent(
  session: { push: (data: { event: string; data: unknown }) => void },
  graph: ReturnType<typeof createLeadDiscoveryGraph>,
  config: { configurable: { thread_id: string } },
  sessionId: string,
  startTime: number,
): Promise<void> {
  const interruptState = await graph.getState(config)
  const stateValues = interruptState.values as LeadDiscoveryState
  const duration = Date.now() - startTime

  // ⭐ interrupt() payload에서 데이터 추출
  // interrupt()가 예외를 던지기 때문에 state에는 저장되지 않고
  // tasks[].interrupts[].value에 payload가 저장됨
  type InterruptTask = {
    interrupts?: Array<{
      value?: {
        type?: string
        message?: string
        recommendations?: Array<{
          id: string
          country: string
          industry: string
          subIndustry?: string
          reasoning: string
          estimatedLeadCount?: number
          keywords?: string[]
        }>
        // Clarification-specific fields
        questions?: Array<{
          field: string
          label: string
          options: string[]
          required: boolean
        }>
        understood?: {
          country?: string
          industry?: string
          employeeRange?: string
          keywords?: string[]
        }
        confidence?: number
      }
    }>
  }

  const tasks = interruptState.tasks as InterruptTask[] | undefined
  const interruptPayload = tasks?.[0]?.interrupts?.[0]?.value
  const interruptType = interruptPayload?.type || "buyer_selection_required"

  leadDiscoveryLogger.info(
    `[SSE] Interrupt payload: type=${interruptType} hasPayload=${!!interruptPayload}`,
  )

  // Handle different interrupt types
  if (interruptType === "clarification_required") {
    // Clarification interrupt - send questions to frontend
    session.push({
      event: "interrupt",
      data: {
        type: "clarification_required",
        message: interruptPayload?.message || "검색 조건을 더 명확히 해주세요",
        sessionId,
        questions: interruptPayload?.questions || [],
        understood: interruptPayload?.understood || {},
        confidence: interruptPayload?.confidence || 0,
        duration,
      },
    })

    leadDiscoveryLogger.info(
      `[SSE] Clarification interrupt sent with ${interruptPayload?.questions?.length || 0} questions`,
    )
  } else {
    // Buyer selection interrupt - send recommendations to frontend
    const recommendations =
      interruptPayload?.recommendations || stateValues.buyerRecommendations || []

    session.push({
      event: "interrupt",
      data: {
        type: interruptPayload?.type || "buyer_selection_required",
        message: interruptPayload?.message || "원하시는 바이어 타겟을 선택해주세요",
        sessionId,
        recommendations: recommendations.map((r) => ({
          id: r.id,
          country: r.country,
          industry: r.industry,
          subIndustry: r.subIndustry,
          reasoning: r.reasoning,
          estimatedLeadCount: r.estimatedLeadCount,
          keywords: r.keywords,
        })),
        websiteAnalysis: stateValues.websiteAnalysis,
        duration,
      },
    })

    leadDiscoveryLogger.info(
      `[SSE] Buyer selection interrupt sent with ${recommendations.length} recommendations`,
    )
  }
}

// Create graph instance
const leadDiscoveryGraph = createLeadDiscoveryGraph()

export const leadDiscoveryRoutes = new Elysia({ prefix: "/api/v1/lead-discovery" })
  .get(
    "/health",
    () => ({
      status: "ok",
      service: "lead-discovery",
      message: "Lead Discovery LangGraph service is running",
    }),
    {
      detail: {
        tags: ["lead-discovery"],
        summary: "Health check for Lead Discovery service",
      },
    },
  )

  // Main search endpoint with SSE streaming
  .post(
    "/search",
    async ({ body }) => {
      // 즉시 로그 출력 (라우트 진입 확인)
      console.log("[lead-discovery] POST /search - Route entered")
      logger.info("[lead-discovery] POST /search - Route entered")

      const {
        query,
        workspaceId,
        sessionId: providedSessionId,
        locale,
        crawlTimeoutSeconds,
        useAutoTimeout,
      } = body

      console.log("[lead-discovery] Request body:", {
        query,
        workspaceId,
        locale,
        crawlTimeoutSeconds,
        useAutoTimeout,
      })
      logger.info(`[lead-discovery] Request: query="${query}" workspace=${workspaceId}`)

      const sessionId = providedSessionId || uuidv4()
      const startTime = Date.now()

      // ⭐ 세션 메타데이터 생성 (TTL 추적)
      createSession(sessionId, workspaceId)

      leadDiscoveryLogger.sessionStart(sessionId, workspaceId, "auto-detect")

      // LangGraph config (catch 블록에서도 접근 필요)
      const config = {
        configurable: {
          thread_id: sessionId,
        },
      }

      // Use createSSEResponse for real-time event streaming (same pattern as chatbot)
      return createSSEResponse(
        async (session) => {
          try {
            // ⭐ Create emitter that pushes directly to SSE session (immediate transmission)
            const emitter = createNodeEmitter(session)

            // Send initial connected event
            session.push({
              event: "connected",
              data: { sessionId, timestamp: Date.now() },
            })

            // Initial state (타임아웃 설정 포함)
            const initialState: Partial<LeadDiscoveryState> = {
              sessionId,
              workspaceId,
              locale: locale || "ko",
              userInput: query,
              _emitter: emitter,
              crawlTimeoutSeconds: crawlTimeoutSeconds ?? 30, // 기본 30초
              useAutoTimeout: useAutoTimeout ?? true, // 기본 자동 타임아웃 활성화
              messages: [
                {
                  role: "user",
                  content: query,
                  timestamp: new Date(),
                },
              ],
            }

            leadDiscoveryLogger.info(`Starting graph execution for session: ${sessionId}`)

            // Stream graph execution
            for await (const event of await leadDiscoveryGraph.stream(initialState, {
              ...config,
              streamMode: "values",
            })) {
              // Check for client disconnect
              if (session.closed) {
                leadDiscoveryLogger.warn("[SSE] Client disconnected during streaming")
                break
              }

              // Check for interrupt (user selection required)
              const eventWithInterrupt = event as Record<string, unknown>
              if (eventWithInterrupt.__interrupt__) {
                const interruptData = eventWithInterrupt.__interrupt__ as Array<{
                  value?: Record<string, unknown>
                }>
                session.push({
                  event: "interrupt",
                  data: {
                    type: interruptData[0]?.value?.type || "selection_required",
                    payload: interruptData[0]?.value,
                    sessionId,
                  },
                })
              }
            }

            // Get final state
            const finalState = await leadDiscoveryGraph.getState(config)
            const state = finalState.values as LeadDiscoveryState
            const duration = Date.now() - startTime

            // ⭐ stream() 모드에서 interrupt 감지
            // finalState.next가 비어있지 않으면 그래프가 중단된 상태
            // finalState.tasks에 interrupt 정보가 있을 수 있음
            const isInterrupted = finalState.next && finalState.next.length > 0
            const hasInterruptTasks = finalState.tasks?.some(
              (task: { interrupts?: unknown[] }) => task.interrupts && task.interrupts.length > 0,
            )

            leadDiscoveryLogger.info(
              `[SSE] Final state check: next=${finalState.next?.join(",") || "none"} isInterrupted=${isInterrupted} hasInterruptTasks=${hasInterruptTasks} needsUserSelection=${state.needsUserSelection} recommendations=${state.buyerRecommendations?.length || 0}`,
            )

            // Interrupt 상태인 경우 - 사용자 선택 대기
            if (isInterrupted || hasInterruptTasks || state.needsUserSelection) {
              leadDiscoveryLogger.info(`[SSE] Interrupt detected - sending interrupt event`)
              await sendInterruptEvent(session, leadDiscoveryGraph, config, sessionId, startTime)
              await new Promise((resolve) => setTimeout(resolve, 300))
              return
            }

            // 정상 완료
            const success = !state.error && state.searchResults.length > 0
            leadDiscoveryLogger.sessionEnd(sessionId, duration, success, state.totalResultCount)

            // Send complete event
            session.push({
              event: "complete",
              data: {
                sessionId,
                success,
                resultCount: state.searchResults.length,
                totalCount: state.totalResultCount,
                results: state.searchResults,
                sql: state.bigQuerySQL,
                explanation: state.bigQueryExplanation,
                mode: state.searchMode,
                recommendations: state.buyerRecommendations,
                selectedRecommendation: state.selectedRecommendation,
                websiteAnalysis: state.websiteAnalysis,
                error: state.error,
                duration,
                // 더 가져오기 정보
                hasMore: state.hasMore,
                totalAvailable: state.totalAvailable,
              },
            })

            // Give client time to process final events
            await new Promise((resolve) => setTimeout(resolve, 300))
          } catch (error) {
            // GraphInterrupt는 정상적인 interrupt 동작 - 사용자 선택 대기 상태
            // stream() 모드에서 interrupt()가 호출되면 GraphInterrupt 예외 발생
            if (error instanceof GraphInterrupt) {
              leadDiscoveryLogger.info(`[SSE] GraphInterrupt caught - 사용자 선택 대기 상태`)
              await sendInterruptEvent(session, leadDiscoveryGraph, config, sessionId, startTime)
              await new Promise((resolve) => setTimeout(resolve, 300))
              return
            }

            // 실제 에러 처리
            const classifiedError = classifyError(error, {
              node: "search",
              sessionId,
            })
            leadDiscoveryLogger.error("Graph execution failed", { error: classifiedError })

            session.push({
              event: "error",
              data: classifiedError,
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 30000,
          onClose: () => {
            leadDiscoveryLogger.info(
              `[SSE] Client disconnected from /search (session: ${sessionId})`,
            )
          },
        },
      )
    },
    {
      body: t.Object({
        query: t.String({ description: "Search query or website URL" }),
        workspaceId: t.String({ format: "uuid" }),
        sessionId: t.Optional(t.String()),
        locale: t.Optional(t.String()),
        crawlTimeoutSeconds: t.Optional(
          t.Number({
            default: 30,
            minimum: 5,
            maximum: 120,
            description: "Website crawling timeout in seconds (5-120, default: 30)",
          }),
        ),
        useAutoTimeout: t.Optional(
          t.Boolean({
            default: true,
            description: "Auto-adjust timeout based on site response time",
          }),
        ),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Search for leads using natural language or website URL",
        description:
          "Streams search progress via SSE. Automatically detects basic (website) or advanced (direct search) mode.",
      },
    },
  )

  // Resume with user selection (for interrupt/resume flow)
  .post(
    "/select",
    async ({ body }) => {
      const { sessionId, selectedRecommendationId } = body
      const startTime = Date.now()

      leadDiscoveryLogger.userSelectionReceived(selectedRecommendationId)

      // Use createSSEResponse for real-time event streaming (same pattern as chatbot)
      return createSSEResponse(
        async (session) => {
          try {
            // ⭐ Create emitter that pushes directly to SSE session
            const emitter = createNodeEmitter(session)

            session.push({
              event: "connected",
              data: { sessionId, resuming: true, timestamp: Date.now() },
            })

            const config = {
              configurable: {
                thread_id: sessionId,
              },
            }

            // ⭐ 세션 TTL 검증 (서버 측 메타데이터 기반)
            const sessionValidation = validateSession(sessionId)
            if (sessionValidation.expired) {
              leadDiscoveryLogger.error(`[Select] Session expired (TTL): ${sessionId}`)
              session.push({
                event: "error",
                data: {
                  type: "session_expired",
                  message: "세션이 만료되었습니다 (30분 초과)",
                  originalError: "Session TTL expired",
                  retryable: false,
                  recoverable: true,
                  suggestedAction: "새 검색을 시작해주세요",
                  context: {
                    node: "select",
                    sessionId,
                    timestamp: Date.now(),
                  },
                },
              })
              return
            }

            // 세션 마지막 접근 시간 업데이트
            touchSession(sessionId)

            // Get current state to find the selected recommendation
            const currentState = await leadDiscoveryGraph.getState(config)

            // ⭐ 세션이 없거나 만료된 경우 명확한 에러 반환
            if (!currentState.values) {
              leadDiscoveryLogger.error(`[Select] Session not found or expired: ${sessionId}`)
              session.push({
                event: "error",
                data: {
                  type: "session_expired",
                  message: "세션이 만료되었습니다",
                  originalError: "Session not found or expired",
                  retryable: false,
                  recoverable: true,
                  suggestedAction: "새 검색을 시작해주세요",
                  context: {
                    node: "select",
                    sessionId,
                    timestamp: Date.now(),
                  },
                },
              })
              return
            }
            const state = currentState.values as LeadDiscoveryState

            // ⭐ interrupt payload에서도 recommendations 찾기
            // interrupt()가 예외를 던지기 때문에 state에 저장되지 않고
            // tasks[].interrupts[].value에 payload가 저장됨
            type InterruptTask = {
              interrupts?: Array<{
                value?: {
                  recommendations?: Array<{
                    id: string
                    country: string
                    industry: string
                    subIndustry?: string
                    reasoning: string
                    estimatedLeadCount?: number
                    keywords?: string[]
                  }>
                }
              }>
            }

            const tasks = currentState.tasks as InterruptTask[] | undefined
            const interruptPayload = tasks?.[0]?.interrupts?.[0]?.value
            const allRecommendations = [
              ...(interruptPayload?.recommendations || []),
              ...(state.buyerRecommendations || []),
            ]

            leadDiscoveryLogger.info(
              `[Select] Looking for recommendation ${selectedRecommendationId} in ${allRecommendations.length} recommendations (payload: ${interruptPayload?.recommendations?.length || 0}, state: ${state.buyerRecommendations?.length || 0})`,
            )

            // Find the selected recommendation from both sources
            const selectedRec = allRecommendations.find((r) => r.id === selectedRecommendationId)

            if (!selectedRec) {
              leadDiscoveryLogger.error(
                `[Select] Recommendation not found. Available IDs: ${allRecommendations.map((r) => r.id).join(", ")}`,
              )
              session.push({
                event: "error",
                data: {
                  sessionId,
                  error: "Selected recommendation not found",
                  timestamp: Date.now(),
                },
              })
              return
            }

            leadDiscoveryLogger.recommendationSelected({
              country: selectedRec.country,
              industry: selectedRec.industry,
              reasoning: selectedRec.reasoning,
            })

            leadDiscoveryLogger.info(`Resuming graph with selection: ${selectedRecommendationId}`)

            // Update state with emitter for resumed execution
            const resumeCommand = new Command({
              resume: { selectedId: selectedRecommendationId, confirmed: true },
              update: {
                selectedRecommendation: selectedRec,
                needsUserSelection: false,
                isConfirmed: true,
                _emitter: emitter,
              },
            })

            // Stream resumed execution
            for await (const _event of await leadDiscoveryGraph.stream(
              resumeCommand as unknown as null,
              {
                ...config,
                streamMode: "values",
              },
            )) {
              // Check for client disconnect
              if (session.closed) {
                leadDiscoveryLogger.warn("[SSE] Client disconnected during select streaming")
                break
              }
            }

            // Get final state
            const finalState = await leadDiscoveryGraph.getState(config)
            const finalStateValues = finalState.values as LeadDiscoveryState

            const duration = Date.now() - startTime
            const success = !finalStateValues.error && finalStateValues.searchResults.length > 0

            leadDiscoveryLogger.sessionEnd(
              sessionId,
              duration,
              success,
              finalStateValues.totalResultCount,
            )

            session.push({
              event: "complete",
              data: {
                sessionId,
                success,
                resultCount: finalStateValues.searchResults.length,
                totalCount: finalStateValues.totalResultCount,
                results: finalStateValues.searchResults,
                sql: finalStateValues.bigQuerySQL,
                explanation: finalStateValues.bigQueryExplanation,
                selectedRecommendation: finalStateValues.selectedRecommendation,
                error: finalStateValues.error,
                duration,
                // 더 가져오기 정보
                hasMore: finalStateValues.hasMore,
                totalAvailable: finalStateValues.totalAvailable,
              },
            })

            // Give client time to process final events
            await new Promise((resolve) => setTimeout(resolve, 300))
          } catch (error) {
            const classifiedError = classifyError(error, {
              node: "select",
              sessionId,
            })
            leadDiscoveryLogger.error("Resume failed", { error: classifiedError })

            session.push({
              event: "error",
              data: classifiedError,
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 30000,
          onClose: () => {
            leadDiscoveryLogger.info(
              `[SSE] Client disconnected from /select (session: ${sessionId})`,
            )
          },
        },
      )
    },
    {
      body: t.Object({
        sessionId: t.String({ description: "Session ID from the search request" }),
        selectedRecommendationId: t.String({ description: "ID of the selected recommendation" }),
        workspaceId: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Resume search with user's buyer selection",
        description: "Called after user selects a buyer recommendation from the interrupt.",
      },
    },
  )

  // Resume with clarification answers (for clarification interrupt flow)
  .post(
    "/clarify",
    async ({ body }) => {
      const { sessionId, answers } = body
      const startTime = Date.now()

      leadDiscoveryLogger.info(
        `[Clarify] Received answers for session ${sessionId}: ${JSON.stringify(answers)}`,
      )

      // Use createSSEResponse for real-time event streaming
      return createSSEResponse(
        async (session) => {
          try {
            // Create emitter that pushes directly to SSE session
            const emitter = createNodeEmitter(session)

            session.push({
              event: "connected",
              data: { sessionId, resuming: true, clarifying: true, timestamp: Date.now() },
            })

            const config = {
              configurable: {
                thread_id: sessionId,
              },
            }

            // ⭐ 세션 TTL 검증 (서버 측 메타데이터 기반)
            const sessionValidation = validateSession(sessionId)
            if (sessionValidation.expired) {
              leadDiscoveryLogger.error(`[Clarify] Session expired (TTL): ${sessionId}`)
              session.push({
                event: "error",
                data: {
                  type: "session_expired",
                  message: "세션이 만료되었습니다 (30분 초과)",
                  originalError: "Session TTL expired",
                  retryable: false,
                  recoverable: true,
                  suggestedAction: "새 검색을 시작해주세요",
                  context: {
                    node: "clarify",
                    sessionId,
                    timestamp: Date.now(),
                  },
                },
              })
              return
            }

            // 세션 마지막 접근 시간 업데이트
            touchSession(sessionId)

            // Get current state
            const currentState = await leadDiscoveryGraph.getState(config)

            // ⭐ 세션이 없거나 만료된 경우 명확한 에러 반환
            if (!currentState.values) {
              leadDiscoveryLogger.error(`[Clarify] Session not found or expired: ${sessionId}`)
              session.push({
                event: "error",
                data: {
                  type: "session_expired",
                  message: "세션이 만료되었습니다",
                  originalError: "Session not found or expired",
                  retryable: false,
                  recoverable: true,
                  suggestedAction: "새 검색을 시작해주세요",
                  context: {
                    node: "clarify",
                    sessionId,
                    timestamp: Date.now(),
                  },
                },
              })
              return
            }

            const state = currentState.values as LeadDiscoveryState

            leadDiscoveryLogger.info(
              `[Clarify] Current state - clarification: ${JSON.stringify(state.clarification)}`,
            )

            // Build updated clarification state with answers
            const updatedClarification = {
              ...(state.clarification || {
                needed: false,
                questions: [],
                confidence: 0,
                understood: {},
              }),
              answers,
              needed: false,
            }

            // Resume graph with clarification answers
            const resumeCommand = new Command({
              resume: { clarificationAnswers: answers, confirmed: true },
              update: {
                clarification: updatedClarification,
                needsClarification: false,
                _emitter: emitter,
              },
            })

            leadDiscoveryLogger.info(`[Clarify] Resuming graph with answers`)

            // Stream resumed execution
            for await (const _event of await leadDiscoveryGraph.stream(
              resumeCommand as unknown as null,
              {
                ...config,
                streamMode: "values",
              },
            )) {
              // Check for client disconnect
              if (session.closed) {
                leadDiscoveryLogger.warn("[SSE] Client disconnected during clarify streaming")
                break
              }
            }

            // Get final state
            const finalState = await leadDiscoveryGraph.getState(config)
            const finalStateValues = finalState.values as LeadDiscoveryState

            // Check if another interrupt occurred (e.g., still needs more clarification)
            const isInterrupted = finalState.next && finalState.next.length > 0
            const hasInterruptTasks = finalState.tasks?.some(
              (task: { interrupts?: unknown[] }) => task.interrupts && task.interrupts.length > 0,
            )

            if (isInterrupted || hasInterruptTasks) {
              leadDiscoveryLogger.info(`[Clarify] Another interrupt detected after clarification`)
              await sendInterruptEvent(session, leadDiscoveryGraph, config, sessionId, startTime)
              await new Promise((resolve) => setTimeout(resolve, 300))
              return
            }

            const duration = Date.now() - startTime
            const success = !finalStateValues.error && finalStateValues.searchResults.length > 0

            leadDiscoveryLogger.sessionEnd(
              sessionId,
              duration,
              success,
              finalStateValues.totalResultCount,
            )

            session.push({
              event: "complete",
              data: {
                sessionId,
                success,
                resultCount: finalStateValues.searchResults.length,
                totalCount: finalStateValues.totalResultCount,
                results: finalStateValues.searchResults,
                sql: finalStateValues.bigQuerySQL,
                explanation: finalStateValues.bigQueryExplanation,
                error: finalStateValues.error,
                duration,
                hasMore: finalStateValues.hasMore,
                totalAvailable: finalStateValues.totalAvailable,
              },
            })

            // Give client time to process final events
            await new Promise((resolve) => setTimeout(resolve, 300))
          } catch (error) {
            // GraphInterrupt is normal interrupt behavior
            if (error instanceof GraphInterrupt) {
              leadDiscoveryLogger.info(`[Clarify] GraphInterrupt caught - another interrupt needed`)
              const config = { configurable: { thread_id: sessionId } }
              await sendInterruptEvent(session, leadDiscoveryGraph, config, sessionId, startTime)
              await new Promise((resolve) => setTimeout(resolve, 300))
              return
            }

            const classifiedError = classifyError(error, {
              node: "clarify",
              sessionId,
            })
            leadDiscoveryLogger.error("Clarify resume failed", { error: classifiedError })

            session.push({
              event: "error",
              data: classifiedError,
            })
          }
        },
        {
          keepAlive: true,
          keepAliveInterval: 30000,
          onClose: () => {
            leadDiscoveryLogger.info(
              `[SSE] Client disconnected from /clarify (session: ${sessionId})`,
            )
          },
        },
      )
    },
    {
      body: t.Object({
        sessionId: t.String({ description: "Session ID from the search request" }),
        answers: t.Record(t.String(), t.String(), {
          description: "Map of field names to selected values",
        }),
        workspaceId: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Resume search with clarification answers",
        description: "Called after user answers clarification questions from the interrupt.",
      },
    },
  )

  // Get session state (for debugging/recovery)
  .get(
    "/session/:sessionId",
    async ({ params }) => {
      const { sessionId } = params

      try {
        const config = {
          configurable: {
            thread_id: sessionId,
          },
        }

        const state = await leadDiscoveryGraph.getState(config)

        if (!state.values) {
          return {
            success: false,
            error: "Session not found",
          }
        }

        const stateValues = state.values as LeadDiscoveryState

        return {
          success: true,
          sessionId,
          state: {
            searchMode: stateValues.searchMode,
            websiteUrl: stateValues.websiteUrl,
            websiteAnalysis: stateValues.websiteAnalysis,
            buyerRecommendations: stateValues.buyerRecommendations,
            selectedRecommendation: stateValues.selectedRecommendation,
            bigQueryParams: stateValues.bigQueryParams,
            searchResults: stateValues.searchResults?.length || 0,
            totalResultCount: stateValues.totalResultCount,
            error: stateValues.error,
          },
          isInterrupted: state.next?.length > 0,
        }
      } catch (error) {
        logger.error({ error, sessionId }, "Failed to get session state")
        return {
          success: false,
          error: "Failed to retrieve session",
        }
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Get session state",
        description: "Retrieve the current state of a lead discovery session.",
      },
    },
  )

  // ============================================
  // Session Validation & Management APIs
  // ============================================

  // Validate session (check if session exists and is valid)
  .get(
    "/session/:sessionId/validate",
    async ({ params, set }) => {
      const { sessionId } = params

      leadDiscoveryLogger.info(`[Session Validate] Checking session: ${sessionId}`)

      try {
        // ⭐ 세션 TTL 검증 (서버 측 메타데이터 기반)
        const sessionValidation = validateSession(sessionId)

        if (sessionValidation.expired) {
          leadDiscoveryLogger.info(`[Session Validate] Session expired (TTL): ${sessionId}`)
          set.status = 410 // Gone
          return {
            valid: false,
            exists: true,
            expired: true,
            error: "세션이 만료되었습니다 (30분 초과)",
            suggestedAction: "새 검색을 시작해주세요",
          }
        }

        const config = {
          configurable: {
            thread_id: sessionId,
          },
        }

        const state = await leadDiscoveryGraph.getState(config)

        if (!state.values) {
          leadDiscoveryLogger.info(`[Session Validate] Session not found: ${sessionId}`)
          set.status = 404
          return {
            valid: false,
            exists: false,
            error: "세션을 찾을 수 없습니다",
          }
        }

        // 세션 마지막 접근 시간 업데이트
        touchSession(sessionId)

        const stateValues = state.values as LeadDiscoveryState
        const isInterrupted = state.next && state.next.length > 0
        const hasResults = stateValues.searchResults?.length > 0

        // 세션 상태 결정
        let status = "unknown"
        if (stateValues.error) {
          status = "error"
        } else if (isInterrupted) {
          if (stateValues.needsClarification) {
            status = "waiting_clarification"
          } else if (stateValues.needsUserSelection) {
            status = "waiting_selection"
          } else {
            status = "interrupted"
          }
        } else if (hasResults) {
          status = "complete"
        } else {
          status = "in_progress"
        }

        // 진행률 계산
        let progress = 0
        if (status === "complete") {
          progress = 100
        } else if (status === "waiting_selection") {
          progress = 60
        } else if (status === "waiting_clarification") {
          progress = 30
        } else if (stateValues.websiteAnalysis) {
          progress = 40
        } else if (stateValues.searchMode) {
          progress = 20
        }

        leadDiscoveryLogger.info(
          `[Session Validate] Session ${sessionId}: status=${status}, progress=${progress}, hasResults=${hasResults}, remainingMs=${sessionValidation.remainingMs}`,
        )

        return {
          valid: true,
          exists: true,
          expired: false,
          expiringSoon: sessionValidation.expiringSoon,
          status,
          progress,
          hasResults,
          resultCount: stateValues.searchResults?.length || 0,
          totalCount: stateValues.totalResultCount || 0,
          isInterrupted,
          // ⭐ 세션 만료 정보 추가 (서버 측 TTL 기반)
          remainingMs: sessionValidation.remainingMs,
          expiresAt: sessionValidation.metadata?.expiresAt,
        }
      } catch (error) {
        logger.error({ error, sessionId }, "Failed to validate session")
        set.status = 500
        return {
          valid: false,
          exists: false,
          error: "세션 검증 중 오류가 발생했습니다",
        }
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Validate session",
        description:
          "Check if a session exists and is valid. Returns session status, progress, and TTL info.",
      },
    },
  )

  // Extend session (reset TTL)
  .post(
    "/session/:sessionId/extend",
    async ({ params, set }) => {
      const { sessionId } = params

      leadDiscoveryLogger.info(`[Session Extend] Extending session: ${sessionId}`)

      try {
        // ⭐ 서버 측 세션 메타데이터 연장
        const extendedMetadata = extendSession(sessionId)

        if (!extendedMetadata) {
          // 메타데이터가 없는 경우 LangGraph 상태 확인
          const config = {
            configurable: {
              thread_id: sessionId,
            },
          }

          const state = await leadDiscoveryGraph.getState(config)

          if (!state.values) {
            leadDiscoveryLogger.info(`[Session Extend] Session not found: ${sessionId}`)
            set.status = 404
            return {
              success: false,
              error: "세션을 찾을 수 없습니다",
            }
          }

          // LangGraph 상태는 있지만 메타데이터가 없는 경우 (이전 버전 호환성)
          // 새 메타데이터 생성
          const newMetadata = createSession(sessionId)

          leadDiscoveryLogger.info(
            `[Session Extend] Created new metadata for legacy session ${sessionId}, expires at ${new Date(newMetadata.expiresAt).toISOString()}`,
          )

          return {
            success: true,
            sessionId,
            expiresAt: newMetadata.expiresAt,
            remainingMs: SESSION_TTL_MS,
            message: "세션이 30분 연장되었습니다",
          }
        }

        leadDiscoveryLogger.info(
          `[Session Extend] Session ${sessionId} extended until ${new Date(extendedMetadata.expiresAt).toISOString()}`,
        )

        return {
          success: true,
          sessionId,
          expiresAt: extendedMetadata.expiresAt,
          remainingMs: extendedMetadata.expiresAt - Date.now(),
          message: "세션이 30분 연장되었습니다",
        }
      } catch (error) {
        logger.error({ error, sessionId }, "Failed to extend session")
        set.status = 500
        return {
          success: false,
          error: "세션 연장 중 오류가 발생했습니다",
        }
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Extend session TTL",
        description:
          "Extend the session expiration time by 30 minutes. Updates both server-side metadata and returns new expiry time for client.",
      },
    },
  )

  // Delete specific session
  .delete(
    "/session/:sessionId",
    async ({ params }) => {
      const { sessionId } = params

      leadDiscoveryLogger.info(`[Session Delete] Deleting session: ${sessionId}`)

      try {
        // ⭐ 세션 메타데이터 삭제
        const deleted = deleteSession(sessionId)

        // Note: LangGraph MemorySaver에서 개별 세션 삭제는
        // 현재 구현에서 직접 지원하지 않음
        // clearCheckpoints()는 전체 삭제만 지원
        // 향후 개선: 개별 세션 삭제 기능 추가

        leadDiscoveryLogger.info(
          `[Session Delete] Session ${sessionId} metadata deleted: ${deleted}`,
        )

        return {
          success: true,
          sessionId,
          message: "세션이 삭제되었습니다",
        }
      } catch (error) {
        logger.error({ error, sessionId }, "Failed to delete session")
        return {
          success: false,
          error: "세션 삭제 중 오류가 발생했습니다",
        }
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Delete session",
        description: "Delete a specific lead discovery session and its metadata.",
      },
    },
  )

  // Get session status for polling (lightweight version)
  .get(
    "/session/:sessionId/status",
    async ({ params, set }) => {
      const { sessionId } = params

      try {
        const config = {
          configurable: {
            thread_id: sessionId,
          },
        }

        const state = await leadDiscoveryGraph.getState(config)

        if (!state.values) {
          set.status = 404
          return {
            exists: false,
          }
        }

        const stateValues = state.values as LeadDiscoveryState
        const isInterrupted = state.next && state.next.length > 0
        const hasResults = stateValues.searchResults?.length > 0

        // 간단한 상태만 반환 (폴링용)
        let status = "unknown"
        if (stateValues.error) {
          status = "error"
        } else if (hasResults) {
          status = "complete"
        } else if (isInterrupted) {
          status = "waiting"
        } else {
          status = "in_progress"
        }

        return {
          exists: true,
          status,
          hasResults,
          resultCount: stateValues.searchResults?.length || 0,
        }
      } catch (error) {
        logger.error({ error, sessionId }, "Failed to get session status")
        set.status = 500
        return {
          exists: false,
          error: "상태 조회 실패",
        }
      }
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Get session status (lightweight)",
        description: "Get minimal session status for polling purposes.",
      },
    },
  )

  // Get more results (pagination)
  .post(
    "/more",
    async ({ body, set }) => {
      const { sessionId, offset = 100, limit = 100 } = body

      leadDiscoveryLogger.info(
        `[더 가져오기] 세션: ${sessionId}, offset: ${offset}, limit: ${limit}`,
      )

      // ⭐ 세션 TTL 검증 (서버 측 메타데이터 기반)
      const sessionValidation = validateSession(sessionId)
      if (sessionValidation.expired) {
        leadDiscoveryLogger.warn(`[더 가져오기] Session expired (TTL): ${sessionId}`)
        set.status = 410 // Gone
        return {
          success: false,
          expired: true,
          error: "세션이 만료되었습니다 (30분 초과). 새 검색을 시작해주세요.",
        }
      }

      // 세션 마지막 접근 시간 업데이트
      touchSession(sessionId)

      const moreResults = getMoreResults(sessionId, offset, limit)

      if (!moreResults) {
        set.status = 404
        return {
          success: false,
          error: "세션을 찾을 수 없거나 결과가 만료되었습니다. 다시 검색해주세요.",
        }
      }

      leadDiscoveryLogger.info(
        `[더 가져오기] 반환: ${moreResults.results.length}개, 남음: ${moreResults.totalAvailable - offset - moreResults.results.length}개`,
      )

      return {
        success: true,
        results: moreResults.results,
        hasMore: moreResults.hasMore,
        totalAvailable: moreResults.totalAvailable,
        offset: offset + moreResults.results.length,
      }
    },
    {
      body: t.Object({
        sessionId: t.String({ description: "Session ID from the search request" }),
        offset: t.Optional(
          t.Number({ default: 100, description: "Starting offset (default: 100)" }),
        ),
        limit: t.Optional(
          t.Number({ default: 100, description: "Number of results to fetch (default: 100)" }),
        ),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Get more search results",
        description:
          "Fetch additional results from a previous search. Results are cached for 10 minutes after the initial search.",
      },
    },
  )

  // Clear all sessions (admin endpoint)
  .delete(
    "/sessions",
    async () => {
      clearCheckpoints()
      // ⭐ 세션 메타데이터도 모두 삭제
      clearAllSessionMetadata()
      leadDiscoveryLogger.info("All sessions and metadata cleared")
      return {
        success: true,
        message: "All sessions cleared",
      }
    },
    {
      detail: {
        tags: ["lead-discovery"],
        summary: "Clear all sessions",
        description: "Admin endpoint to clear all lead discovery sessions and their metadata.",
      },
    },
  )

  // Calculate fit scores for leads (SSE streaming)
  .post(
    "/score",
    async ({ body }) => {
      const { leads, websiteAnalysis, selectedTarget, userQuery, workspaceId } = body

      leadDiscoveryLogger.info(
        `[적합도 계산] 시작 - ${leads.length}개 리드, 타겟: ${selectedTarget.country}/${selectedTarget.industry}, 쿼리: ${userQuery || "없음"}, workspaceId=${workspaceId || "없음"}`,
      )

      return createSSEResponse(async (session) => {
        const startTime = Date.now()

        try {
          // 시작 이벤트
          session.push({
            event: "start",
            data: { totalLeads: leads.length },
          })

          let processedCount = 0

          // 적합도 계산 (스트리밍)
          await calculateFitScores(
            leads as LeadForScoring[],
            websiteAnalysis as WebsiteAnalysisContext,
            selectedTarget,
            (result) => {
              processedCount++
              session.push({
                event: "score",
                data: {
                  leadId: result.leadId,
                  score: result.score,
                  reason: result.reason,
                  progress: Math.round((processedCount / leads.length) * 100),
                },
              })
            },
            userQuery, // 사용자 검색 쿼리 전달
            workspaceId, // 워크스페이스 단위 캐시 분리
          )

          const duration = Date.now() - startTime
          leadDiscoveryLogger.info(`[적합도 계산] 완료 - ${leads.length}개, ${duration}ms`)

          // 완료 이벤트
          session.push({
            event: "complete",
            data: {
              totalProcessed: processedCount,
              duration,
            },
          })
        } catch (error) {
          const classifiedError = classifyError(error, {
            node: "fit_score",
          })
          leadDiscoveryLogger.error(`[적합도 계산] 오류:`, {
            error: classifiedError.message,
            type: classifiedError.type,
            originalError: classifiedError.originalError,
          })
          session.push({
            event: "error",
            data: classifiedError,
          })
        }
      })
    },
    {
      body: t.Object({
        leads: t.Array(
          t.Object({
            id: t.String(),
            company_name: t.Optional(t.Nullable(t.String())),
            email: t.Optional(t.Nullable(t.String())),
            phone: t.Optional(t.Nullable(t.String())),
            web_address: t.Optional(t.Nullable(t.String())),
            description: t.Optional(t.Nullable(t.String())),
            company_type: t.Optional(t.Nullable(t.String())),
            http_status: t.Optional(t.Nullable(t.Number())),
            verified: t.Optional(t.Boolean()),
            country: t.Optional(t.Nullable(t.String())),
            industry: t.Optional(t.Nullable(t.String())),
            sub_industry: t.Optional(t.Nullable(t.String())),
            employee: t.Optional(t.Nullable(t.String())),
            revenue: t.Optional(t.Nullable(t.String())),
            title: t.Optional(t.Nullable(t.String())),
          }),
        ),
        websiteAnalysis: t.Object({
          companyName: t.Optional(t.String()),
          description: t.Optional(t.String()),
          industry: t.Optional(t.String()),
          products: t.Optional(t.Array(t.String())),
          targetMarkets: t.Optional(t.Array(t.String())),
          businessModel: t.Optional(t.String()),
        }),
        selectedTarget: t.Object({
          country: t.String(),
          industry: t.String(),
        }),
        userQuery: t.Optional(t.String()), // 사용자 검색 쿼리 (FitScore 계산용)
        workspaceId: t.Optional(t.String()), // 워크스페이스 단위 캐시 분리(옵션)
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Calculate fit scores for leads",
        description:
          "AI-powered fit score calculation for leads based on website analysis. Returns scores via SSE streaming.",
      },
    },
  )

  /**
   * POST /api/v1/lead-discovery/enrich
   * 단일 리드 강화 (항상 환경변수 API 키 사용)
   * 위의 LangGraph 기반 lead discovery와 별개로 동작하는 단순 enrichment 엔드포인트
   */
  .post(
    "/enrich",
    async ({ body, set }) => {
      const { websiteUrl, workspaceId } = body

      logger.info(
        {
          workspaceId,
          websiteUrl,
        },
        "[Lead Discovery] Starting lead enrichment with env API key",
      )

      // URL 유효성 검사
      if (!websiteUrl || websiteUrl.trim().length < 3) {
        set.status = 400
        return {
          success: false,
          error: "유효한 웹사이트 URL을 입력해주세요",
        }
      }

      // 환경변수 API 키 확인
      if (!process.env.OPENAI_API_KEY) {
        set.status = 500
        return {
          success: false,
          error: "서버에 OpenAI API 키가 설정되어 있지 않습니다",
        }
      }

      try {
        // processLeadEnrichment 호출 (Lead Discovery 전용 함수)
        const result = await processLeadEnrichment(websiteUrl.trim(), DEFAULT_EXTRACTION_CONFIG)

        // 에러가 있는 경우
        if (result.errorMessage) {
          return {
            success: false,
            error: result.errorMessage,
            data: {
              website_url: result.websiteUrl,
              http_status: result.httpStatus || null,
              crawl_time_seconds: result.crawlTimeSeconds || null,
            },
          }
        }

        // 성공 응답
        return {
          success: true,
          data: {
            website_url: result.websiteUrl,
            found_company_name: result.foundCompanyName || null,
            description: result.description || null,
            company_type: result.companyType || null,
            email: result.email || null,
            phone_number: result.phoneNumber || null,
            address: result.address || null,
            country: result.country || null,
            city: result.city || null,
            state: result.state || null,
            founded_year: result.foundedYear || null,
            employee_count: result.employeeCount || null,
            linkedin_url: result.linkedinUrl || null,
            facebook_url: result.facebookUrl || null,
            instagram_url: result.instagramUrl || null,
            twitter_url: result.twitterUrl || null,
            products: result.products || null,
            business_sectors: result.businessSectors || null,
            product_categories: result.productCategories || null,
            industry_types: result.industryTypes || null,
            http_status: result.httpStatus || null,
            crawl_time_seconds: result.crawlTimeSeconds || null,
            gpt_time_seconds: result.gptTimeSeconds || null,
            collected_at: result.collectedAt || null,
          },
        }
      } catch (error) {
        logger.error({ error, websiteUrl }, "[Lead Discovery] Enrichment failed")

        set.status = 500
        return {
          success: false,
          error: error instanceof Error ? error.message : "리드 강화 중 오류가 발생했습니다",
        }
      }
    },
    {
      body: t.Object({
        websiteUrl: t.String(),
        workspaceId: t.String(),
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Simple lead enrichment (env API key only)",
        description:
          "Enrich a single lead using environment variable API key. Separate from LangGraph-based discovery.",
      },
    },
  )
