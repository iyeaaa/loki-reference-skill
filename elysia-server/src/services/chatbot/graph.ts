import { Command, END, interrupt, MemorySaver, StateGraph } from "@langchain/langgraph"
import { chatbotLogger } from "../../utils/logger"
// 노드 import
import { analyzeQuestion } from "./nodes/analyze"
import { generateFollowUpQuestions } from "./nodes/follow-up-generator"
import { generateInsights } from "./nodes/insight-generator"
import { executeQuery } from "./nodes/query-executor"
import { analyzeResults } from "./nodes/result-analyzer"
import {
  analyzeLeadsAndGenerateStrategy,
  generateSequenceWithStrategy,
  handleSequenceGenerationRequest,
} from "./nodes/sequence-generation"
import { executeSequential } from "./nodes/sequential-executor"
import { generateSQL } from "./nodes/sql-generator"
import { validateSQL } from "./nodes/sql-validator"
import type { ChatbotState } from "./state"
import { ChatbotStateAnnotation } from "./state"

// 노드 이름을 상수로 정의하여 타입 안전성 확보
const NODE_NAMES = {
  ANALYZE: "analyze",
  GENERATE_SQL: "generateSQL",
  VALIDATE_SQL: "validateSQL",
  ASK_CONFIRMATION: "askConfirmation",
  EXECUTE_QUERY: "executeQuery",
  EXECUTE_SEQUENTIAL: "executeSequential",
  ANALYZE_RESULTS: "analyzeResults",
  GENERATE_INSIGHTS: "generateInsights",
  GENERATE_FOLLOW_UPS: "generateFollowUps",
  FORMAT_RESPONSE: "formatResponse",
  HANDLE_ERROR: "handleError",
  ASK_CLARIFICATION: "askClarification",
  HANDLE_SEQUENCE_GENERATION_REQUEST: "handleSequenceGenerationRequest",
  ANALYZE_LEADS_AND_GENERATE_STRATEGY: "analyzeLeadsAndGenerateStrategy",
  GENERATE_SEQUENCE_WITH_STRATEGY: "generateSequenceWithStrategy",
} as const

type NodeName = (typeof NODE_NAMES)[keyof typeof NODE_NAMES]

// 헬퍼 노드
async function handleError(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("handleError")

  const result = {
    analysis:
      state.error ||
      "An unexpected error occurred. Please try rephrasing your question or contact support.",
  }

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("handleError", duration)

  return result
}

async function askClarification(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("askClarification")

  const result = {
    analysis: state.clarificationQuestion,
  }

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("askClarification", duration)

  return result
}

/**
 * askConfirmation node - Uses interrupt() for Human-in-the-Loop
 *
 * This node pauses execution and waits for user approval before continuing.
 * Uses LangGraph's interrupt() function which automatically:
 * 1. Saves the complete current state to checkpoint
 * 2. Pauses execution indefinitely
 * 3. Returns the resume value when execution continues
 */
async function askConfirmation(state: ChatbotState): Promise<Command> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("askConfirmation")

  chatbotLogger.nodeDetail("askConfirmation", {
    hasConfirmationMessage: !!state.confirmationMessage,
    messageLength: state.confirmationMessage?.length || 0,
    hasGeneratedSQL: !!state.generatedSQL,
    sqlLength: state.generatedSQL?.length || 0,
    hasSqlQueries: !!state.sqlQueries,
    sqlQueriesCount: state.sqlQueries?.length || 0,
    workspaceId: state.workspaceId,
    currentQuestion: state.currentQuestion,
  })

  // CRITICAL: Use interrupt() function to pause execution
  // This automatically saves the full state to checkpoint
  // The payload will be sent to the client in the __interrupt__ event
  const userDecision = interrupt({
    type: "confirmation_required",
    confirmationMessage: state.confirmationMessage,
    // Include metadata for client display
    metadata: {
      sql: state.generatedSQL,
      sqlQueries: state.sqlQueries,
      sqlExplanation: state.sqlExplanation,
      queryCount: state.sqlQueries?.length || 1,
      workspaceId: state.workspaceId,
      currentQuestion: state.currentQuestion,
    },
  })

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("askConfirmation", duration)

  // userDecision will be the value passed to Command({ resume: ... })
  chatbotLogger.info(
    `[LangGraph] User decision received: ${userDecision ? "approved" : "rejected"}`,
  )

  // Route based on user decision
  if (userDecision === true || (typeof userDecision === "object" && userDecision?.confirmed)) {
    // User approved - route to execution
    if (state.sqlQueries && state.sqlQueries.length > 1) {
      chatbotLogger.routeDecision(
        NODE_NAMES.ASK_CONFIRMATION,
        NODE_NAMES.EXECUTE_SEQUENTIAL,
        "user approved, executing sequential queries",
      )
      return new Command({ goto: NODE_NAMES.EXECUTE_SEQUENTIAL })
    }

    chatbotLogger.routeDecision(
      NODE_NAMES.ASK_CONFIRMATION,
      NODE_NAMES.EXECUTE_QUERY,
      "user approved, executing single query",
    )
    return new Command({ goto: NODE_NAMES.EXECUTE_QUERY })
  }

  // User rejected or cancelled
  chatbotLogger.routeDecision(
    NODE_NAMES.ASK_CONFIRMATION,
    NODE_NAMES.HANDLE_ERROR,
    "user rejected operation",
  )
  return new Command({
    goto: NODE_NAMES.HANDLE_ERROR,
    update: {
      error: "Operation cancelled.",
      analysis: "Operation cancelled.",
    },
  })
}

async function formatResponse(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("formatResponse")

  // 최종 응답 메시지 생성
  const assistantMessage = {
    role: "assistant" as const,
    content: state.analysis,
    timestamp: new Date(),
    metadata: {
      sql: state.generatedSQL,
      result: state.queryResult,
      insights: state.insights,
      visualization: state.visualizationSuggestions,
      followUpQuestions: state.followUpQuestions,
      error: state.error, // Include error for frontend display
      hasError: !!state.error, // Flag to indicate error state
    },
  }

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("formatResponse", duration)

  // Log if this is an error response
  if (state.error) {
    chatbotLogger.info(`[LangGraph] Formatting error response: ${state.error}`)
  }

  return {
    messages: [assistantMessage],
  }
}

// 라우팅 함수
function routeAfterAnalysis(state: ChatbotState): NodeName {
  if (state.error) {
    chatbotLogger.routeDecision(NODE_NAMES.ANALYZE, NODE_NAMES.HANDLE_ERROR, "error occurred")
    return NODE_NAMES.HANDLE_ERROR
  }

  // PRIORITY 1: Check if sequence modal should be opened (detected from LLM analysis)
  // This is when user asks "시퀀스 생성해줘" without prior sequenceGenerationRequest metadata
  const metadata = state.metadata as { openSequenceModal?: boolean } | undefined
  if (metadata?.openSequenceModal) {
    chatbotLogger.routeDecision(
      NODE_NAMES.ANALYZE,
      NODE_NAMES.FORMAT_RESPONSE,
      "sequence modal open requested - ending workflow",
    )
    return NODE_NAMES.FORMAT_RESPONSE
  }

  // PRIORITY 2: Check for sequence generation request (from button click with metadata)
  if (state.isSequenceGenerationRequest || state.sequenceGenerationRequest) {
    chatbotLogger.routeDecision(
      NODE_NAMES.ANALYZE,
      NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST,
      "sequence generation detected - bypassing SQL generation",
    )
    return NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST
  }

  if (state.needsClarification) {
    chatbotLogger.routeDecision(
      NODE_NAMES.ANALYZE,
      NODE_NAMES.ASK_CLARIFICATION,
      "needs clarification",
    )
    return NODE_NAMES.ASK_CLARIFICATION
  }
  chatbotLogger.routeDecision(NODE_NAMES.ANALYZE, NODE_NAMES.GENERATE_SQL, "analysis complete")
  return NODE_NAMES.GENERATE_SQL
}

function routeAfterSQLGeneration(state: ChatbotState): NodeName {
  // 1. Error check - SQL generation failed
  if (state.error) {
    chatbotLogger.routeDecision(
      NODE_NAMES.GENERATE_SQL,
      NODE_NAMES.HANDLE_ERROR,
      "SQL generation failed",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  // 2. Missing SQL check - should not happen but safeguard
  if (!state.generatedSQL || state.generatedSQL.trim().length === 0) {
    chatbotLogger.routeDecision(
      NODE_NAMES.GENERATE_SQL,
      NODE_NAMES.HANDLE_ERROR,
      "no SQL generated",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  // 3. Success - proceed to validation
  chatbotLogger.routeDecision(
    NODE_NAMES.GENERATE_SQL,
    NODE_NAMES.VALIDATE_SQL,
    "SQL generated successfully",
  )
  return NODE_NAMES.VALIDATE_SQL
}

function routeAfterValidation(state: ChatbotState): NodeName {
  // 1. Error check
  if (state.error) {
    chatbotLogger.routeDecision(NODE_NAMES.VALIDATE_SQL, NODE_NAMES.HANDLE_ERROR, "error occurred")
    return NODE_NAMES.HANDLE_ERROR
  }

  // 2. Safety check (only if not already confirmed)
  // When resuming after confirmation, isQuerySafe should already be true
  if (!state.isQuerySafe && !state.isConfirmed) {
    chatbotLogger.routeDecision(
      NODE_NAMES.VALIDATE_SQL,
      NODE_NAMES.HANDLE_ERROR,
      "unsafe query detected",
    )
    return NODE_NAMES.HANDLE_ERROR
  }

  // 3. Check if needs user confirmation (mutation queries)
  if (state.needsConfirmation && !state.isConfirmed) {
    chatbotLogger.routeDecision(
      NODE_NAMES.VALIDATE_SQL,
      NODE_NAMES.ASK_CONFIRMATION,
      `confirmation required (message length: ${state.confirmationMessage?.length || 0})`,
    )
    return NODE_NAMES.ASK_CONFIRMATION
  }

  // 4. Route to appropriate executor based on query count
  // Check if we have sequential queries to execute
  if (state.sqlQueries && state.sqlQueries.length > 1) {
    chatbotLogger.routeDecision(
      NODE_NAMES.VALIDATE_SQL,
      NODE_NAMES.EXECUTE_SEQUENTIAL,
      `sequential execution (${state.sqlQueries.length} queries, confirmed: ${!!state.isConfirmed})`,
    )
    return NODE_NAMES.EXECUTE_SEQUENTIAL
  }

  // 5. Default: single query execution
  chatbotLogger.routeDecision(
    NODE_NAMES.VALIDATE_SQL,
    NODE_NAMES.EXECUTE_QUERY,
    `validation passed, confirmed: ${!!state.isConfirmed}`,
  )
  return NODE_NAMES.EXECUTE_QUERY
}

function routeAfterExecution(state: ChatbotState): NodeName {
  // 쿼리 실행 실패 시 재시도 없이 바로 에러 처리
  if (state.error && state.queryResult.length === 0) {
    chatbotLogger.routeDecision(
      NODE_NAMES.EXECUTE_QUERY,
      NODE_NAMES.HANDLE_ERROR,
      "query execution failed",
    )
    chatbotLogger.error("[LangGraph] Query execution failed, routing to error handler")
    return NODE_NAMES.HANDLE_ERROR
  }

  chatbotLogger.routeDecision(
    NODE_NAMES.EXECUTE_QUERY,
    NODE_NAMES.ANALYZE_RESULTS,
    "execution successful",
  )
  return NODE_NAMES.ANALYZE_RESULTS
}

// 그래프 생성
export function createChatbotGraph() {
  const workflow = new StateGraph(ChatbotStateAnnotation)

  // 노드 추가
  workflow.addNode(NODE_NAMES.ANALYZE, analyzeQuestion)
  workflow.addNode(NODE_NAMES.GENERATE_SQL, generateSQL)
  workflow.addNode(NODE_NAMES.VALIDATE_SQL, validateSQL)
  workflow.addNode(NODE_NAMES.ASK_CONFIRMATION, askConfirmation)
  workflow.addNode(NODE_NAMES.EXECUTE_QUERY, executeQuery)
  workflow.addNode(NODE_NAMES.EXECUTE_SEQUENTIAL, executeSequential)
  workflow.addNode(NODE_NAMES.ANALYZE_RESULTS, analyzeResults)
  workflow.addNode(NODE_NAMES.GENERATE_INSIGHTS, generateInsights)
  workflow.addNode(NODE_NAMES.GENERATE_FOLLOW_UPS, generateFollowUpQuestions)
  workflow.addNode(NODE_NAMES.FORMAT_RESPONSE, formatResponse)
  workflow.addNode(NODE_NAMES.HANDLE_ERROR, handleError)
  workflow.addNode(NODE_NAMES.ASK_CLARIFICATION, askClarification)
  workflow.addNode(NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST, handleSequenceGenerationRequest, {
    ends: [END, NODE_NAMES.ANALYZE_LEADS_AND_GENERATE_STRATEGY],
  })
  workflow.addNode(
    NODE_NAMES.ANALYZE_LEADS_AND_GENERATE_STRATEGY,
    analyzeLeadsAndGenerateStrategy,
    {
      ends: [END, NODE_NAMES.GENERATE_SEQUENCE_WITH_STRATEGY],
    },
  )
  workflow.addNode(NODE_NAMES.GENERATE_SEQUENCE_WITH_STRATEGY, generateSequenceWithStrategy, {
    ends: [END],
  })

  // 엣지 정의
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.ANALYZE, routeAfterAnalysis, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ASK_CLARIFICATION]: NODE_NAMES.ASK_CLARIFICATION,
    [NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST]: NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST,
    [NODE_NAMES.GENERATE_SQL]: NODE_NAMES.GENERATE_SQL,
    [NODE_NAMES.FORMAT_RESPONSE]: NODE_NAMES.FORMAT_RESPONSE,
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ASK_CLARIFICATION, NODE_NAMES.FORMAT_RESPONSE)

  // FIXED: Add conditional routing after SQL generation to catch errors
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.GENERATE_SQL, routeAfterSQLGeneration, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.VALIDATE_SQL]: NODE_NAMES.VALIDATE_SQL,
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.VALIDATE_SQL, routeAfterValidation, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ASK_CONFIRMATION]: NODE_NAMES.ASK_CONFIRMATION,
    [NODE_NAMES.EXECUTE_QUERY]: NODE_NAMES.EXECUTE_QUERY,
    [NODE_NAMES.EXECUTE_SEQUENTIAL]: NODE_NAMES.EXECUTE_SEQUENTIAL,
  })

  // Human-in-the-loop: askConfirmation now returns Command, so no edges needed
  // The Command will automatically route to the specified node
  // No conditional edges required!

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.EXECUTE_QUERY, routeAfterExecution, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ANALYZE_RESULTS]: NODE_NAMES.ANALYZE_RESULTS,
  })

  // executeSequential도 동일한 라우팅 로직 사용 (재시도 없음)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.EXECUTE_SEQUENTIAL, routeAfterExecution, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ANALYZE_RESULTS]: NODE_NAMES.ANALYZE_RESULTS,
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.HANDLE_ERROR, NODE_NAMES.FORMAT_RESPONSE)

  // 병렬 실행: 인사이트, 후속질문 동시 실행
  // LangGraph는 자동으로 두 노드가 모두 완료될 때까지 대기 후 formatResponse 실행
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ANALYZE_RESULTS, NODE_NAMES.GENERATE_INSIGHTS)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ANALYZE_RESULTS, NODE_NAMES.GENERATE_FOLLOW_UPS)

  // 두 병렬 노드가 모두 완료되면 formatResponse 실행
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.GENERATE_INSIGHTS, NODE_NAMES.FORMAT_RESPONSE)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.GENERATE_FOLLOW_UPS, NODE_NAMES.FORMAT_RESPONSE)

  // Format response routes to sequence generation request handler
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.FORMAT_RESPONSE, NODE_NAMES.HANDLE_SEQUENCE_GENERATION_REQUEST)

  // handleSequenceGenerationRequest returns Command, so no edges needed
  // It will route to either END or generateSequenceForGroup based on user decision

  // generateSequenceForGroup returns Command routing back to analyze
  // No edges needed - Command handles routing automatically

  // 진입점 설정
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.setEntryPoint(NODE_NAMES.ANALYZE)

  // CRITICAL: Use singleton checkpointer to persist state across requests
  // This ensures that checkpoint data is available when resuming after user confirmation
  return workflow.compile({
    checkpointer: getSharedCheckpointer(),
    // NOTE: No interruptBefore/After needed!
    // The interrupt() function in askConfirmation handles everything automatically
  })
}

// Singleton MemorySaver instance shared across all graph instances
// This is CRITICAL for interrupt/resume to work correctly:
// - /ask request creates checkpoint when interrupt() is called
// - /confirm request resumes from that checkpoint
// Without a shared instance, the checkpoint would be lost between requests
let sharedCheckpointer: MemorySaver | null = null

export function getSharedCheckpointer(): MemorySaver {
  if (!sharedCheckpointer) {
    chatbotLogger.info("[LangGraph] Creating new shared MemorySaver instance")
    sharedCheckpointer = new MemorySaver()
  }
  return sharedCheckpointer
}

// Optional: Function to clear all checkpoints (useful for testing or cleanup)
export function clearCheckpoints(): void {
  chatbotLogger.info("[LangGraph] Clearing all checkpoints")
  sharedCheckpointer = null
}
