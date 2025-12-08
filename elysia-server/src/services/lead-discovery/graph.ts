/**
 * Lead Discovery LangGraph Builder
 * Orchestrates the lead discovery workflow with two modes:
 * - Basic (Website): Website Analysis → Buyer Recommendations → Selection → BigQuery
 * - Advanced (Direct): Mode Detection → BigQuery Params → BigQuery Execution
 */

import { END, MemorySaver, StateGraph } from "@langchain/langgraph"
import { leadDiscoveryLogger } from "./logger"
import { executeBigQuery } from "./nodes/bigquery-executor"
import { generateBigQueryParams } from "./nodes/bigquery-param-generator"
import { recommendBuyers } from "./nodes/buyer-recommender"
import { routeMode } from "./nodes/mode-router"
import { analyzeWebsite } from "./nodes/website-analyzer"
import type { LeadDiscoveryState } from "./state"
import { LeadDiscoveryStateAnnotation } from "./state"

// Node names as constants
const NODE_NAMES = {
  ROUTE_MODE: "routeMode",
  ANALYZE_WEBSITE: "analyzeWebsite",
  RECOMMEND_BUYERS: "recommendBuyers",
  GENERATE_PARAMS: "generateParams",
  EXECUTE_BIGQUERY: "executeBigQuery",
  FORMAT_RESPONSE: "formatResponse",
  HANDLE_ERROR: "handleError",
} as const

type NodeName = (typeof NODE_NAMES)[keyof typeof NODE_NAMES]

// === Helper Nodes ===

async function handleError(state: LeadDiscoveryState): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  leadDiscoveryLogger.nodeStart("handleError", { error: state.error })

  const errorMessage = state.error || "An unexpected error occurred. Please try again."

  const duration = Date.now() - startTime
  leadDiscoveryLogger.nodeSuccess("handleError", duration)

  return {
    messages: [
      {
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
        metadata: {
          error: errorMessage,
        },
      },
    ],
  }
}

async function formatResponse(state: LeadDiscoveryState): Promise<Partial<LeadDiscoveryState>> {
  const startTime = Date.now()
  const emitter = state._emitter

  leadDiscoveryLogger.nodeStart("formatResponse", {
    resultCount: state.searchResults.length,
    totalCount: state.totalResultCount,
  })

  if (emitter) {
    emitter.nodeStart("formatResponse", "Preparing results...")
  }

  // Build response message
  let content = ""

  if (state.error) {
    content = state.error
  } else if (state.searchResults.length > 0) {
    content = `검색이 완료되었습니다.\n\n`
    content += `**검색 결과**: ${state.searchResults.length}개 / 총 ${state.totalResultCount}개\n`

    if (state.bigQueryExplanation) {
      content += `\n${state.bigQueryExplanation}\n`
    }

    if (state.selectedRecommendation) {
      content += `\n**선택된 타겟**: ${state.selectedRecommendation.country} - ${state.selectedRecommendation.industry}`
    }
  } else {
    content = "검색 결과가 없습니다. 다른 조건으로 검색해 보세요."
  }

  const assistantMessage = {
    role: "assistant" as const,
    content,
    timestamp: new Date(),
    metadata: {
      mode: state.searchMode,
      websiteUrl: state.websiteUrl,
      recommendations: state.buyerRecommendations,
      selectedRecommendation: state.selectedRecommendation,
      searchParams: state.bigQueryParams,
      resultCount: state.searchResults.length,
    },
  }

  const duration = Date.now() - startTime

  if (emitter) {
    emitter.nodeComplete("formatResponse", "Results ready", {
      resultCount: state.searchResults.length,
      totalCount: state.totalResultCount,
    })
  }

  leadDiscoveryLogger.nodeSuccess("formatResponse", duration, {
    resultCount: state.searchResults.length,
  })

  return {
    messages: [assistantMessage],
  }
}

// === Routing Functions ===

function routeAfterModeDetection(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ROUTE_MODE,
      NODE_NAMES.HANDLE_ERROR,
      "error occurred",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  if (state.isWebsiteMode && state.websiteUrl) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ROUTE_MODE,
      NODE_NAMES.ANALYZE_WEBSITE,
      `website mode - URL: ${state.websiteUrl}`,
    )
    return NODE_NAMES.ANALYZE_WEBSITE
  }

  // Advanced mode - skip to BigQuery params
  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.ROUTE_MODE,
    NODE_NAMES.GENERATE_PARAMS,
    "advanced mode - direct search",
  )
  return NODE_NAMES.GENERATE_PARAMS
}

function routeAfterWebsiteAnalysis(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.ANALYZE_WEBSITE,
      NODE_NAMES.HANDLE_ERROR,
      "website analysis failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.ANALYZE_WEBSITE,
    NODE_NAMES.RECOMMEND_BUYERS,
    `analysis complete - ${state.websiteAnalysis?.companyName || "company analyzed"}`,
  )
  return NODE_NAMES.RECOMMEND_BUYERS
}

function routeAfterRecommendation(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.RECOMMEND_BUYERS,
      NODE_NAMES.HANDLE_ERROR,
      "recommendation failed or cancelled",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  if (state.selectedRecommendation) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.RECOMMEND_BUYERS,
      NODE_NAMES.GENERATE_PARAMS,
      `selected: ${state.selectedRecommendation.country} - ${state.selectedRecommendation.industry}`,
    )
    return NODE_NAMES.GENERATE_PARAMS
  }

  // Still waiting for selection (shouldn't reach here due to interrupt)
  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.RECOMMEND_BUYERS,
    NODE_NAMES.HANDLE_ERROR,
    "no selection made",
  )
  return NODE_NAMES.HANDLE_ERROR
}

function routeAfterParamGeneration(state: LeadDiscoveryState): NodeName {
  if (state.error) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.GENERATE_PARAMS,
      NODE_NAMES.HANDLE_ERROR,
      "param generation failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.GENERATE_PARAMS,
    NODE_NAMES.EXECUTE_BIGQUERY,
    `params ready - query: ${state.bigQueryParams?.query?.substring(0, 30)}...`,
  )
  return NODE_NAMES.EXECUTE_BIGQUERY
}

function routeAfterBigQuery(state: LeadDiscoveryState): NodeName {
  if (state.error && state.searchResults.length === 0) {
    leadDiscoveryLogger.routeDecision(
      NODE_NAMES.EXECUTE_BIGQUERY,
      NODE_NAMES.HANDLE_ERROR,
      "BigQuery execution failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  leadDiscoveryLogger.routeDecision(
    NODE_NAMES.EXECUTE_BIGQUERY,
    NODE_NAMES.FORMAT_RESPONSE,
    `found ${state.searchResults.length} results`,
  )
  return NODE_NAMES.FORMAT_RESPONSE
}

// === Graph Builder ===

export function createLeadDiscoveryGraph() {
  const workflow = new StateGraph(LeadDiscoveryStateAnnotation)

  // Add nodes
  workflow.addNode(NODE_NAMES.ROUTE_MODE, routeMode)
  workflow.addNode(NODE_NAMES.ANALYZE_WEBSITE, analyzeWebsite)
  workflow.addNode(NODE_NAMES.RECOMMEND_BUYERS, recommendBuyers)
  workflow.addNode(NODE_NAMES.GENERATE_PARAMS, generateBigQueryParams)
  workflow.addNode(NODE_NAMES.EXECUTE_BIGQUERY, executeBigQuery)
  workflow.addNode(NODE_NAMES.FORMAT_RESPONSE, formatResponse)
  workflow.addNode(NODE_NAMES.HANDLE_ERROR, handleError)

  // Set entry point
  // @ts-expect-error - LangGraph type inference issue
  workflow.setEntryPoint(NODE_NAMES.ROUTE_MODE)

  // Add conditional edges
  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.ROUTE_MODE, routeAfterModeDetection, {
    [NODE_NAMES.ANALYZE_WEBSITE]: NODE_NAMES.ANALYZE_WEBSITE,
    [NODE_NAMES.GENERATE_PARAMS]: NODE_NAMES.GENERATE_PARAMS,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.ANALYZE_WEBSITE, routeAfterWebsiteAnalysis, {
    [NODE_NAMES.RECOMMEND_BUYERS]: NODE_NAMES.RECOMMEND_BUYERS,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.RECOMMEND_BUYERS, routeAfterRecommendation, {
    [NODE_NAMES.GENERATE_PARAMS]: NODE_NAMES.GENERATE_PARAMS,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.GENERATE_PARAMS, routeAfterParamGeneration, {
    [NODE_NAMES.EXECUTE_BIGQUERY]: NODE_NAMES.EXECUTE_BIGQUERY,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // @ts-expect-error - LangGraph type inference issue
  workflow.addConditionalEdges(NODE_NAMES.EXECUTE_BIGQUERY, routeAfterBigQuery, {
    [NODE_NAMES.FORMAT_RESPONSE]: NODE_NAMES.FORMAT_RESPONSE,
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
  })

  // Terminal edges
  // @ts-expect-error - LangGraph type inference issue
  workflow.addEdge(NODE_NAMES.FORMAT_RESPONSE, END)
  // @ts-expect-error - LangGraph type inference issue
  workflow.addEdge(NODE_NAMES.HANDLE_ERROR, END)

  // Compile with checkpointer for interrupt/resume support
  return workflow.compile({
    checkpointer: getSharedCheckpointer(),
  })
}

// Singleton MemorySaver for interrupt/resume
let sharedCheckpointer: MemorySaver | null = null

export function getSharedCheckpointer(): MemorySaver {
  if (!sharedCheckpointer) {
    leadDiscoveryLogger.info("Creating new shared MemorySaver instance")
    sharedCheckpointer = new MemorySaver()
  }
  return sharedCheckpointer
}

export function clearCheckpoints(): void {
  leadDiscoveryLogger.info("Clearing all checkpoints")
  sharedCheckpointer = null
}

// Export node names for external use
export { NODE_NAMES }
