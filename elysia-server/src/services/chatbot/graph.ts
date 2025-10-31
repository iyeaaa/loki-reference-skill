import { END, MemorySaver, StateGraph } from "@langchain/langgraph"
import { chatbotLogger } from "../../utils/logger"
// 노드 import
import { analyzeQuestion } from "./nodes/analyze"
import { generateFollowUpQuestions } from "./nodes/follow-up-generator"
import { generateInsights } from "./nodes/insight-generator"
import { executeQuery } from "./nodes/query-executor"
import { analyzeResults } from "./nodes/result-analyzer"
import { generateSQL } from "./nodes/sql-generator"
import { validateSQL } from "./nodes/sql-validator"
import { suggestVisualizations } from "./nodes/visualization-suggester"
import type { ChatbotState } from "./state"
import { ChatbotStateAnnotation } from "./state"

// 최대 재시도 횟수
const MAX_RETRIES = 10

// 노드 이름을 상수로 정의하여 타입 안전성 확보
const NODE_NAMES = {
  ANALYZE: "analyze",
  GENERATE_SQL: "generateSQL",
  VALIDATE_SQL: "validateSQL",
  EXECUTE_QUERY: "executeQuery",
  ANALYZE_RESULTS: "analyzeResults",
  GENERATE_INSIGHTS: "generateInsights",
  SUGGEST_VISUALIZATIONS: "suggestVisualizations",
  GENERATE_FOLLOW_UPS: "generateFollowUps",
  FORMAT_RESPONSE: "formatResponse",
  HANDLE_ERROR: "handleError",
  ASK_CLARIFICATION: "askClarification",
} as const

type NodeName = (typeof NODE_NAMES)[keyof typeof NODE_NAMES]

// 헬퍼 노드
async function handleError(state: ChatbotState): Promise<Partial<ChatbotState>> {
  const startTime = Date.now()
  chatbotLogger.nodeStart("handleError")

  const result = {
    analysis:
      state.error ||
      "An unknown error occurred. Please try rephrasing your question or contact support.",
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
    },
  }

  const duration = Date.now() - startTime
  chatbotLogger.nodeSuccess("formatResponse", duration)

  return {
    messages: [assistantMessage],
  }
}

// 라우팅 함수
function routeAfterAnalysis(state: ChatbotState): NodeName {
  if (state.error) return NODE_NAMES.HANDLE_ERROR
  if (state.needsClarification) return NODE_NAMES.ASK_CLARIFICATION
  return NODE_NAMES.GENERATE_SQL
}

function routeAfterValidation(state: ChatbotState): NodeName {
  if (state.error) return NODE_NAMES.HANDLE_ERROR
  if (!state.isQuerySafe) return NODE_NAMES.HANDLE_ERROR
  return NODE_NAMES.EXECUTE_QUERY
}

function routeAfterExecution(state: ChatbotState): NodeName {
  // 쿼리 실행에 실패하고 재시도 횟수가 최대치보다 작으면 재시도
  if (state.error && state.queryResult.length === 0) {
    if (state.retryCount < MAX_RETRIES) {
      chatbotLogger.info(
        `[LangGraph] Query execution failed, retrying (${state.retryCount + 1}/${MAX_RETRIES})`,
      )
      return NODE_NAMES.GENERATE_SQL
    }
    chatbotLogger.error(`[LangGraph] Max retries (${MAX_RETRIES}) exceeded`)
    return NODE_NAMES.HANDLE_ERROR
  }
  return NODE_NAMES.ANALYZE_RESULTS
}

// 그래프 생성
export function createChatbotGraph() {
  const workflow = new StateGraph(ChatbotStateAnnotation)

  // 노드 추가
  workflow.addNode(NODE_NAMES.ANALYZE, analyzeQuestion)
  workflow.addNode(NODE_NAMES.GENERATE_SQL, generateSQL)
  workflow.addNode(NODE_NAMES.VALIDATE_SQL, validateSQL)
  workflow.addNode(NODE_NAMES.EXECUTE_QUERY, executeQuery)
  workflow.addNode(NODE_NAMES.ANALYZE_RESULTS, analyzeResults)
  workflow.addNode(NODE_NAMES.GENERATE_INSIGHTS, generateInsights)
  workflow.addNode(NODE_NAMES.SUGGEST_VISUALIZATIONS, suggestVisualizations)
  workflow.addNode(NODE_NAMES.GENERATE_FOLLOW_UPS, generateFollowUpQuestions)
  workflow.addNode(NODE_NAMES.FORMAT_RESPONSE, formatResponse)
  workflow.addNode(NODE_NAMES.HANDLE_ERROR, handleError)
  workflow.addNode(NODE_NAMES.ASK_CLARIFICATION, askClarification)

  // 엣지 정의
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.ANALYZE, routeAfterAnalysis, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ASK_CLARIFICATION]: NODE_NAMES.ASK_CLARIFICATION,
    [NODE_NAMES.GENERATE_SQL]: NODE_NAMES.GENERATE_SQL,
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ASK_CLARIFICATION, NODE_NAMES.FORMAT_RESPONSE)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.GENERATE_SQL, NODE_NAMES.VALIDATE_SQL)

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.VALIDATE_SQL, routeAfterValidation, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.EXECUTE_QUERY]: NODE_NAMES.EXECUTE_QUERY,
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addConditionalEdges(NODE_NAMES.EXECUTE_QUERY, routeAfterExecution, {
    [NODE_NAMES.HANDLE_ERROR]: NODE_NAMES.HANDLE_ERROR,
    [NODE_NAMES.ANALYZE_RESULTS]: NODE_NAMES.ANALYZE_RESULTS,
    [NODE_NAMES.GENERATE_SQL]: NODE_NAMES.GENERATE_SQL, // 재시도를 위한 경로
  })

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.HANDLE_ERROR, NODE_NAMES.FORMAT_RESPONSE)

  // 병렬 실행: 인사이트, 시각화, 후속질문
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ANALYZE_RESULTS, NODE_NAMES.GENERATE_INSIGHTS)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ANALYZE_RESULTS, NODE_NAMES.SUGGEST_VISUALIZATIONS)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.ANALYZE_RESULTS, NODE_NAMES.GENERATE_FOLLOW_UPS)

  // 모든 병렬 작업이 완료되면 formatResponse로
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.GENERATE_INSIGHTS, NODE_NAMES.FORMAT_RESPONSE)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.SUGGEST_VISUALIZATIONS, NODE_NAMES.FORMAT_RESPONSE)
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.GENERATE_FOLLOW_UPS, NODE_NAMES.FORMAT_RESPONSE)

  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.addEdge(NODE_NAMES.FORMAT_RESPONSE, END)

  // 진입점 설정
  // @ts-expect-error - LangGraph's StateGraph type inference doesn't properly handle dynamic node additions
  workflow.setEntryPoint(NODE_NAMES.ANALYZE)

  // 체크포인터 추가 (대화 히스토리 유지)
  const checkpointer = new MemorySaver()

  return workflow.compile({ checkpointer })
}
