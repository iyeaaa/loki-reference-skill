import { Annotation } from "@langchain/langgraph"
import type { NodeEventEmitter } from "./sse-context"

// State 타입 정의
export interface ChatbotState {
  // 대화 흐름
  messages: ChatMessage[]
  currentQuestion: string
  conversationId: string

  // Localization - language for AI responses
  locale: string // e.g., "ko", "en"

  // SSE Context for real-time events (not serialized, injected at runtime)
  _emitter?: NodeEventEmitter

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

  // CSV/File Processing
  csvData?: {
    headers: string[]
    rows: Record<string, string>[]
    rowCount: number
  }

  // Sequence Generation
  sequenceGenerationRequest?: {
    customerGroupId: string
    customerGroupName: string
    membersCount: number
  }
  pendingSequenceGeneration: boolean
  generatedSequenceId?: string
  isSequenceGenerationRequest?: boolean // Flag to bypass SQL generation

  // AI-Generated Sequence Strategy (Dynamic Steps)
  sequenceStrategy?: {
    dominant_business_type: string
    avg_company_size: number
    company_size_category: string
    avg_lead_score: number
    business_type_focus: string
    samples_analyzed: number
    strategy_summary: string
    timezone: string
    recommended_steps: number
    email_steps: Array<{
      step_order: number
      delay_days: number
      scheduled_hour: number
      scheduled_minute: number
      email_subject: string
      email_body: string
      strategy_note?: string
    }>
    personalization_tips?: string[]
    expected_performance?: {
      estimated_open_rate: string
      estimated_response_rate: string
      reasoning: string
    }
  }
}

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  attachment?: {
    fileName: string
    fileSize: number
    fileType: string
    content?: string // Raw CSV or file content
  }
  metadata?: {
    sql?: string
    result?: unknown[]
    insights?: Insight[]
    visualization?: VisualizationSuggestion[]
    followUpQuestions?: string[]
    leadGroupCreated?: {
      groupId: string
      groupName: string
      leadsCount: number
    }
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
  locale: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "ko",
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
  csvData: Annotation<
    | {
        headers: string[]
        rows: Record<string, string>[]
        rowCount: number
      }
    | undefined
  >({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  sequenceGenerationRequest: Annotation<
    | {
        customerGroupId: string
        customerGroupName: string
        membersCount: number
      }
    | undefined
  >({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  pendingSequenceGeneration: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  generatedSequenceId: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  isSequenceGenerationRequest: Annotation<boolean | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  sequenceStrategy: Annotation<
    | {
        dominant_business_type: string
        avg_company_size: number
        company_size_category: string
        avg_lead_score: number
        business_type_focus: string
        samples_analyzed: number
        strategy_summary: string
        timezone: string
        recommended_steps: number
        email_steps: Array<{
          step_order: number
          delay_days: number
          scheduled_hour: number
          scheduled_minute: number
          email_subject: string
          email_body: string
          strategy_note?: string
        }>
        personalization_tips?: string[]
        expected_performance?: {
          estimated_open_rate: string
          estimated_response_rate: string
          reasoning: string
        }
      }
    | undefined
  >({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  _emitter: Annotation<NodeEventEmitter | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
})
