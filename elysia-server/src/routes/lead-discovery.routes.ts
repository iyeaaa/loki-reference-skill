/**
 * Lead Discovery API Routes
 * Integrates with LangGraph for AI-powered lead discovery
 */

import { Command } from "@langchain/langgraph"
import { Elysia, t } from "elysia"
import { v4 as uuidv4 } from "uuid"
import { createNodeEmitter, type SSESession } from "../services/chatbot/sse-context"
import { clearCheckpoints, createLeadDiscoveryGraph } from "../services/lead-discovery/graph"
import { leadDiscoveryLogger } from "../services/lead-discovery/logger"
import type { LeadDiscoveryState } from "../services/lead-discovery/state"
import logger from "../utils/logger"

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
    async function* ({ body }) {
      const { query, workspaceId, sessionId: providedSessionId, locale } = body

      const sessionId = providedSessionId || uuidv4()
      const startTime = Date.now()

      leadDiscoveryLogger.sessionStart(sessionId, workspaceId, "auto-detect")

      // Create SSE session for real-time events
      const events: Array<{ event: string; data: unknown }> = []
      let sessionClosed = false

      const sseSession: SSESession = {
        push: (event) => {
          if (!sessionClosed) {
            events.push(event)
            return true
          }
          return false
        },
        closed: false,
      }

      const emitter = createNodeEmitter(sseSession)

      // Send initial connected event
      yield {
        event: "connected",
        data: { sessionId, timestamp: Date.now() },
      }

      try {
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

        // Run the graph with streaming
        const config = {
          configurable: {
            thread_id: sessionId,
          },
        }

        leadDiscoveryLogger.info(`Starting graph execution for session: ${sessionId}`)

        // Stream graph execution
        for await (const event of await leadDiscoveryGraph.stream(initialState, {
          ...config,
          streamMode: "values",
        })) {
          // Yield any accumulated SSE events
          while (events.length > 0) {
            const sseEvent = events.shift()
            if (sseEvent) {
              yield sseEvent
            }
          }

          // Check for interrupt (user selection required)
          // Cast to any to access __interrupt__ property which exists at runtime
          const eventWithInterrupt = event as Record<string, unknown>
          if (eventWithInterrupt.__interrupt__) {
            const interruptData = eventWithInterrupt.__interrupt__ as Array<{
              value?: Record<string, unknown>
            }>
            yield {
              event: "interrupt",
              data: {
                type: interruptData[0]?.value?.type || "selection_required",
                payload: interruptData[0]?.value,
                sessionId,
              },
            }
          }
        }

        // Get final state
        const finalState = await leadDiscoveryGraph.getState(config)
        const state = finalState.values as LeadDiscoveryState

        const duration = Date.now() - startTime
        const success = !state.error && state.searchResults.length > 0

        leadDiscoveryLogger.sessionEnd(sessionId, duration, success, state.totalResultCount)

        // Send complete event
        yield {
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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        leadDiscoveryLogger.error("Graph execution failed", { error: errorMessage })

        yield {
          event: "error",
          data: {
            sessionId,
            error: errorMessage,
            timestamp: Date.now(),
          },
        }
      } finally {
        sessionClosed = true
        sseSession.closed = true
      }
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
    async function* ({ body }) {
      const { sessionId, selectedRecommendationId } = body
      const startTime = Date.now()

      leadDiscoveryLogger.userSelectionReceived(selectedRecommendationId)

      // Create SSE session
      const events: Array<{ event: string; data: unknown }> = []
      let sessionClosed = false

      const sseSession: SSESession = {
        push: (event) => {
          if (!sessionClosed) {
            events.push(event)
            return true
          }
          return false
        },
        closed: false,
      }

      createNodeEmitter(sseSession)

      yield {
        event: "connected",
        data: { sessionId, resuming: true, timestamp: Date.now() },
      }

      try {
        const config = {
          configurable: {
            thread_id: sessionId,
          },
        }

        // Get current state to find the selected recommendation
        const currentState = await leadDiscoveryGraph.getState(config)
        const state = currentState.values as LeadDiscoveryState

        // Find the selected recommendation
        const selectedRec = state.buyerRecommendations.find(
          (r) => r.id === selectedRecommendationId,
        )

        if (!selectedRec) {
          yield {
            event: "error",
            data: {
              sessionId,
              error: "Selected recommendation not found",
              timestamp: Date.now(),
            },
          }
          return
        }

        leadDiscoveryLogger.recommendationSelected({
          country: selectedRec.country,
          industry: selectedRec.industry,
          reasoning: selectedRec.reasoning,
        })

        leadDiscoveryLogger.info(`Resuming graph with selection: ${selectedRecommendationId}`)

        // Resume graph with user selection
        // Using Command with resume: the selection value and update for state changes
        const resumeCommand = new Command({
          resume: { selectedId: selectedRecommendationId, confirmed: true },
          update: {
            selectedRecommendation: selectedRec,
            needsUserSelection: false,
            isConfirmed: true,
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
          // Yield accumulated events
          while (events.length > 0) {
            const sseEvent = events.shift()
            if (sseEvent) {
              yield sseEvent
            }
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

        yield {
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
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        leadDiscoveryLogger.error("Resume failed", { error: errorMessage })

        yield {
          event: "error",
          data: {
            sessionId,
            error: errorMessage,
            timestamp: Date.now(),
          },
        }
      } finally {
        sessionClosed = true
        sseSession.closed = true
      }
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
