/**
 * Lead Discovery API Routes
 * Integrates with LangGraph for AI-powered lead discovery
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
import type { LeadDiscoveryState } from "../services/lead-discovery/state"
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

  // ⭐ interrupt() payload에서 recommendations 추출
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
      }
    }>
  }

  const tasks = interruptState.tasks as InterruptTask[] | undefined
  const interruptPayload = tasks?.[0]?.interrupts?.[0]?.value

  // payload에서 recommendations 가져오기 (state보다 우선)
  const recommendations =
    interruptPayload?.recommendations || stateValues.buyerRecommendations || []

  leadDiscoveryLogger.info(
    `[SSE] Interrupt payload: hasPayload=${!!interruptPayload} payloadRecs=${interruptPayload?.recommendations?.length || 0} stateRecs=${stateValues.buyerRecommendations?.length || 0}`,
  )

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
    `[SSE] Interrupt event sent with ${recommendations.length} recommendations`,
  )
}

// Create graph instance
const leadDiscoveryGraph = createLeadDiscoveryGraph()

export const leadDiscoveryRoutes = new Elysia({ prefix: "/api/v1/lead-discovery" })
  // Health check
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
      const { leads, websiteAnalysis, selectedTarget } = body

      leadDiscoveryLogger.info(
        `[적합도 계산] 시작 - ${leads.length}개 리드, 타겟: ${selectedTarget.country}/${selectedTarget.industry}`,
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
            company_name: t.Optional(t.String()),
            email: t.Optional(t.String()),
            phone: t.Optional(t.String()),
            web_address: t.Optional(t.String()),
            country: t.Optional(t.String()),
            industry: t.Optional(t.String()),
            sub_industry: t.Optional(t.String()),
            employee: t.Optional(t.String()),
            revenue: t.Optional(t.String()),
            title: t.Optional(t.String()),
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
      }),
      detail: {
        tags: ["lead-discovery"],
        summary: "Calculate fit scores for leads",
        description:
          "AI-powered fit score calculation for leads based on website analysis. Returns scores via SSE streaming.",
      },
    },
  )
