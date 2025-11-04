import { Annotation } from "@langchain/langgraph"

// State 타입 정의
export interface ChatbotState {
  // 대화 흐름
  messages: ChatMessage[]
  currentQuestion: string
  conversationId: string

  // 메타데이터
  metadata?: {
    intent?: string
    requiredTables?: string[]
    timeRange?: string | null
    analysisType?: string
    operationType?: "read" | "create" | "update" | "delete"
  }

  // SQL 생성
  generatedSQL: string
  sqlExplanation: string
  isQuerySafe: boolean

  // 순차 실행을 위한 SQL 배열 (복잡한 mutation의 경우)
  sqlQueries: string[] // 순차적으로 실행할 SQL 쿼리 배열
  currentQueryIndex: number // 현재 실행 중인 쿼리 인덱스
  sequentialResults: unknown[][] // 각 쿼리의 실행 결과

  // 실행 결과
  queryResult: unknown[]
  executionTime: number
  error: string | null
  fromCache?: boolean
  retryCount: number
  affectedRows?: number // For UPDATE/DELETE/INSERT queries

  // 분석
  analysis: string
  insights: Insight[]
  visualizationSuggestions: VisualizationSuggestion[]

  // 컨텍스트
  workspaceId: string
  userId: string
  schemaContext: string
  previousQueries: QueryHistory[]

  // 추가 질문
  followUpQuestions: string[]
  needsClarification: boolean
  clarificationQuestion: string

  // Human-in-the-Loop: Mutation 확인
  needsConfirmation: boolean
  confirmationMessage: string
  isConfirmed: boolean
}

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  metadata?: {
    sql?: string
    result?: unknown[]
    insights?: Insight[]
    visualization?: VisualizationSuggestion[]
    followUpQuestions?: string[]
  }
}

export interface Insight {
  insight: string
  recommendation: string
  impact: "high" | "medium" | "low"
  category?: string
}

export interface VisualizationSuggestion {
  type: "bar" | "line" | "pie" | "table" | "metric"
  title: string
  xAxis?: string
  yAxis?: string
  description: string
  config?: unknown
}

export interface QueryHistory {
  question: string
  sql: string
  executedAt: Date
  resultCount: number
}

// Annotation을 사용한 State 정의 (LangGraph용)
export const ChatbotStateAnnotation = Annotation.Root({
  messages: Annotation<ChatMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  currentQuestion: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  conversationId: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  metadata: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  generatedSQL: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  sqlExplanation: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  isQuerySafe: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  queryResult: Annotation<unknown[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  executionTime: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  error: Annotation<string | null>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => null,
  }),
  fromCache: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  retryCount: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  affectedRows: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  analysis: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  insights: Annotation<Insight[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  visualizationSuggestions: Annotation<VisualizationSuggestion[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  workspaceId: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  userId: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  schemaContext: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  previousQueries: Annotation<QueryHistory[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  followUpQuestions: Annotation<string[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  needsClarification: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  clarificationQuestion: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  needsConfirmation: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  confirmationMessage: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  isConfirmed: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  sqlQueries: Annotation<string[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  currentQueryIndex: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  sequentialResults: Annotation<unknown[][]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
})
