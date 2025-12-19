/**
 * Lead Discovery LangGraph State Definition
 * Manages state for website analysis and BigQuery search workflows
 */

import { Annotation } from "@langchain/langgraph"
import type { NodeEventEmitter } from "../chatbot/sse-context"

// Search modes
export type SearchMode = "basic" | "advanced"

// Clarification question for ambiguous queries
export interface ClarificationQuestion {
  field: "country" | "industry" | "employeeRange"
  label: string
  options: string[]
  required: boolean
}

// Clarification state for human-in-the-loop query refinement
export interface ClarificationState {
  needed: boolean
  questions: ClarificationQuestion[]
  answers: Record<string, string>
  confidence: number
  understood: {
    country?: string
    industry?: string
    employeeRange?: string
    keywords?: string[]
  }
}

// Buyer recommendation from AI analysis
export interface BuyerRecommendation {
  id: string
  country: string
  industry: string
  subIndustry?: string
  reasoning: string
  estimatedLeadCount?: number
  keywords?: string[]
}

// BigQuery search parameters
export interface BigQuerySearchParams {
  query: string
  country?: string
  industry?: string
  subIndustry?: string
  employeeRange?: string
  revenueRange?: string
  limit?: number
}

// BigQuery result item (B2B Leads + Crunchbase + Apollo 통합)
// 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
export interface BigQueryResult {
  companyName?: string // 회사명
  webAddress?: string // 웹사이트
  description?: string // Description
  fitScore?: number // Fit Score (0-100)
  country?: string // Country
  category?: string // Category (industry_category)
  mainIndustry?: string // Main Industry
  subIndustry?: string // Sub Industry ('-' if empty)
  email?: string // Company Email
  // 추가 필드 (내부 사용)
  phone?: string
  employee?: string
  revenue?: string
  source?: "apollo" | "fresh" | "b2b" | "crunchbase" | "perplexity" | "revation" // 데이터 소스
}

// Analyzed page info
export interface AnalyzedPage {
  url: string
  title?: string
  favicon?: string
  contentLength: number
  canEmbed?: boolean // X-Frame-Options 헤더 기반 iframe 임베딩 가능 여부
}

// Website analysis result
export interface WebsiteAnalysis {
  companyName?: string
  description?: string
  industry?: string
  products?: string[]
  targetMarkets?: string[]
  businessModel?: string
  strengths?: string[]
  rawContent?: string
  // 분석된 페이지 목록
  analyzedPages?: AnalyzedPage[]
  siteFavicon?: string
  // AI 분석 요약 (스트리밍)
  summary?: string
}

// Error types for structured error handling
export type LeadDiscoveryErrorType =
  | "network"
  | "timeout"
  | "session_expired"
  | "server"
  | "validation"
  | "rate_limit"
  | "bigquery"
  | "bigquery_query_invalid"
  | "bigquery_quota"
  | "bigquery_no_results"
  | "ai"
  | "ai_parse_error"
  | "website_unreachable"
  | "website_blocked"
  | "user_cancelled"
  | "unknown"

// Error codes for precise error identification
export type LeadDiscoveryErrorCode =
  | "E_NETWORK_FAILED"
  | "E_TIMEOUT"
  | "E_SESSION_EXPIRED"
  | "E_SERVER_ERROR"
  | "E_VALIDATION_FAILED"
  | "E_RATE_LIMITED"
  | "E_BIGQUERY_FAILED"
  | "E_BIGQUERY_INVALID_QUERY"
  | "E_BIGQUERY_QUOTA_EXCEEDED"
  | "E_BIGQUERY_NO_RESULTS"
  | "E_AI_FAILED"
  | "E_AI_PARSE_ERROR"
  | "E_WEBSITE_UNREACHABLE"
  | "E_WEBSITE_BLOCKED"
  | "E_USER_CANCELLED"
  | "E_UNKNOWN"

// Structured error context for centralized error handling
export interface ErrorContext {
  type: LeadDiscoveryErrorType
  code: LeadDiscoveryErrorCode
  message: string
  originalError?: string
  node: string
  timestamp: number
  retryable: boolean
  recoverable: boolean
  maxRetries: number
  suggestedAction?: string
  recoveryStrategy?: ErrorRecoveryStrategy
  details?: Record<string, unknown>
}

// Error recovery strategies
export type ErrorRecoveryStrategy =
  | "retry" // 단순 재시도
  | "simplify_query" // 쿼리 단순화 (BigQuery)
  | "fallback_source" // 대체 데이터 소스 사용
  | "reduce_scope" // 검색 범위 축소
  | "restart_session" // 새 세션 시작
  | "user_intervention" // 사용자 입력 필요
  | "skip_step" // 현재 단계 건너뛰기
  | "none" // 복구 불가

// Chat message for conversation history
export interface LeadDiscoveryMessage {
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
  metadata?: {
    mode?: SearchMode
    websiteUrl?: string
    recommendations?: BuyerRecommendation[]
    selectedRecommendation?: BuyerRecommendation
    searchParams?: BigQuerySearchParams
    resultCount?: number
    error?: string
    errorContext?: ErrorContext
  }
}

// Main state interface
export interface LeadDiscoveryState {
  // Session info
  sessionId: string
  workspaceId: string
  locale: string

  // SSE emitter for real-time events
  _emitter?: NodeEventEmitter

  // User input
  userInput: string
  websiteUrl?: string

  // Crawl timeout settings (사용자 설정 가능)
  crawlTimeoutSeconds: number // 웹사이트 크롤링 타임아웃 (초)
  useAutoTimeout: boolean // true면 사이트 응답 시간에 따라 자동 조절

  // Mode detection
  searchMode: SearchMode
  isWebsiteMode: boolean

  // Website analysis (basic mode)
  websiteAnalysis?: WebsiteAnalysis
  analysisProgress: number
  analysisStatus: string

  // Buyer recommendations
  buyerRecommendations: BuyerRecommendation[]
  selectedRecommendation?: BuyerRecommendation
  needsUserSelection: boolean

  // BigQuery search
  bigQueryParams?: BigQuerySearchParams
  bigQuerySQL?: string
  bigQueryExplanation?: string

  // Results
  searchResults: BigQueryResult[]
  totalResultCount: number
  executionTime: number

  // 더 가져오기 기능
  hasMore: boolean
  totalAvailable: number

  // Customer analysis (GPT analysis of search results)
  customerAnalysisSummary?: string

  // Error handling
  error: string | null
  errorContext?: ErrorContext
  retryCount: number

  // Conversation
  messages: LeadDiscoveryMessage[]

  // Human-in-the-loop confirmation
  isConfirmed: boolean
  confirmationMessage?: string

  // Clarification for ambiguous queries (advanced mode)
  clarification?: ClarificationState
  needsClarification: boolean
}

// LangGraph State Annotation
export const LeadDiscoveryStateAnnotation = Annotation.Root({
  sessionId: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  workspaceId: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  locale: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "ko",
  }),
  _emitter: Annotation<NodeEventEmitter | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  userInput: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  websiteUrl: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  crawlTimeoutSeconds: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 30, // 기본 30초
  }),
  useAutoTimeout: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => true, // 기본적으로 자동 타임아웃 활성화
  }),
  searchMode: Annotation<SearchMode>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "basic",
  }),
  isWebsiteMode: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  websiteAnalysis: Annotation<WebsiteAnalysis | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  analysisProgress: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  analysisStatus: Annotation<string>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => "",
  }),
  buyerRecommendations: Annotation<BuyerRecommendation[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  selectedRecommendation: Annotation<BuyerRecommendation | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  needsUserSelection: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  bigQueryParams: Annotation<BigQuerySearchParams | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  bigQuerySQL: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  bigQueryExplanation: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  searchResults: Annotation<BigQueryResult[]>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => [],
  }),
  totalResultCount: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  executionTime: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  hasMore: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  totalAvailable: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  customerAnalysisSummary: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  error: Annotation<string | null>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => null,
  }),
  errorContext: Annotation<ErrorContext | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  retryCount: Annotation<number>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => 0,
  }),
  messages: Annotation<LeadDiscoveryMessage[]>({
    reducer: (prev, next) => [...prev, ...next],
    default: () => [],
  }),
  isConfirmed: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
  confirmationMessage: Annotation<string | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  clarification: Annotation<ClarificationState | undefined>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => undefined,
  }),
  needsClarification: Annotation<boolean>({
    reducer: (prev, next) => (next !== undefined ? next : prev),
    default: () => false,
  }),
})
