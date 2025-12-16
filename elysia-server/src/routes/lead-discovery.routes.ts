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
import {
  calculateFitScores,
  type LeadForScoring,
  type WebsiteAnalysisContext,
} from "../services/lead-discovery/fit-score-calculator"
import { clearCheckpoints, createLeadDiscoveryGraph } from "../services/lead-discovery/graph"
import { leadDiscoveryLogger } from "../services/lead-discovery/logger"
import { getMoreResults } from "../services/lead-discovery/nodes/bigquery-executor"
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

      const { query, workspaceId, sessionId: providedSessionId, locale } = body

      console.log("[lead-discovery] Request body:", { query, workspaceId, locale })
      logger.info(`[lead-discovery] Request: query="${query}" workspace=${workspaceId}`)

      const sessionId = providedSessionId || uuidv4()
      const startTime = Date.now()

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

            // Initial state
            const initialState: Partial<LeadDiscoveryState> = {
              sessionId,
              workspaceId,
              locale: locale || "ko",
              userInput: query,
              _emitter: emitter,
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
            const errorMessage = error instanceof Error ? error.message : String(error)
            leadDiscoveryLogger.error("Graph execution failed", { error: errorMessage })

            session.push({
              event: "error",
              data: {
                sessionId,
                error: errorMessage,
                timestamp: Date.now(),
              },
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

            // Get current state to find the selected recommendation
            const currentState = await leadDiscoveryGraph.getState(config)
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
            const errorMessage = error instanceof Error ? error.message : String(error)
            leadDiscoveryLogger.error("Resume failed", { error: errorMessage })

            session.push({
              event: "error",
              data: {
                sessionId,
                error: errorMessage,
                timestamp: Date.now(),
              },
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

            // Get current state
            const currentState = await leadDiscoveryGraph.getState(config)
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

            const errorMessage = error instanceof Error ? error.message : String(error)
            leadDiscoveryLogger.error("Clarify resume failed", { error: errorMessage })

            session.push({
              event: "error",
              data: {
                sessionId,
                error: errorMessage,
                timestamp: Date.now(),
              },
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

  // Get more results (pagination)
  .post(
    "/more",
    async ({ body, set }) => {
      const { sessionId, offset = 100, limit = 100 } = body

      leadDiscoveryLogger.info(
        `[더 가져오기] 세션: ${sessionId}, offset: ${offset}, limit: ${limit}`,
      )

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
      leadDiscoveryLogger.info("All sessions cleared")
      return {
        success: true,
        message: "All sessions cleared",
      }
    },
    {
      detail: {
        tags: ["lead-discovery"],
        summary: "Clear all sessions",
        description: "Admin endpoint to clear all lead discovery sessions.",
      },
    },
  )

  // Calculate fit scores for leads (SSE streaming)
  .post(
    "/score",
    async ({ body }) => {
      const { leads, websiteAnalysis, selectedTarget, userQuery } = body

      leadDiscoveryLogger.info(
        `[적합도 계산] 시작 - ${leads.length}개 리드, 타겟: ${selectedTarget.country}/${selectedTarget.industry}, 쿼리: ${userQuery || "없음"}`,
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
          leadDiscoveryLogger.error(`[적합도 계산] 오류: ${error}`)
          session.push({
            event: "error",
            data: { error: "적합도 계산 중 오류가 발생했습니다." },
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
