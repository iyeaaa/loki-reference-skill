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
  }

  // SQL 생성
  generatedSQL: string
  sqlExplanation: string
  isQuerySafe: boolean

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
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  conversationId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  metadata: Annotation<Record<string, unknown>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),
  generatedSQL: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  sqlExplanation: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  isQuerySafe: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  queryResult: Annotation<unknown[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  executionTime: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  fromCache: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  retryCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  affectedRows: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  analysis: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  insights: Annotation<Insight[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  visualizationSuggestions: Annotation<VisualizationSuggestion[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  workspaceId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  userId: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  schemaContext: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
  previousQueries: Annotation<QueryHistory[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  followUpQuestions: Annotation<string[]>({
    reducer: (_prev, next) => next,
    default: () => [],
  }),
  needsClarification: Annotation<boolean>({
    reducer: (_prev, next) => next,
    default: () => false,
  }),
  clarificationQuestion: Annotation<string>({
    reducer: (_prev, next) => next,
    default: () => "",
  }),
})
