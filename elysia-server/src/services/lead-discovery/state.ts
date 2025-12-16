/**
 * Lead Discovery LangGraph State Definition
 * Manages state for website analysis and BigQuery search workflows
 */

import { Annotation } from "@langchain/langgraph"
import type { NodeEventEmitter } from "../chatbot/sse-context"

// Search modes
export type SearchMode = "basic" | "advanced"

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
  retryCount: number

  // Conversation
  messages: LeadDiscoveryMessage[]

  // Human-in-the-loop confirmation
  isConfirmed: boolean
  confirmationMessage?: string
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
})
