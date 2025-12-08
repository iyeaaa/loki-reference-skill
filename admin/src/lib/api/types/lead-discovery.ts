/**
 * Lead Discovery API Types
 * LangGraph 기반 리드 탐색 API 타입 정의
 */

// 바이어 추천 타입
export interface BuyerRecommendation {
  id: string
  country: string
  industry: string
  subIndustry?: string
  reasoning: string
  estimatedLeadCount?: number
  keywords?: string[]
}

// BigQuery 검색 결과 타입
export interface BigQueryResult {
  email?: string
  firstName?: string
  middleName?: string
  lastName?: string
  title?: string
  companyName?: string
  phone?: string
  country?: string
  city?: string
  primaryCity?: string
  primaryState?: string
  mailingAddress?: string
  zipCode?: string
  industry?: string
  subIndustry?: string
  webAddress?: string
  employee?: string
  revenue?: string
}

// 분석된 페이지 정보
export interface AnalyzedPage {
  url: string
  title?: string
  favicon?: string
  ogImage?: string
  description?: string
  contentLength: number
}

// 웹사이트 분석 결과
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

// SSE 이벤트 타입
export type SSEEventType =
  | "connected"
  | "node-start"
  | "progress"
  | "node-complete"
  | "interrupt"
  | "complete"
  | "error"

// SSE 이벤트 데이터
export interface SSEEventData {
  event: SSEEventType
  sessionId?: string
  node?: string
  message?: string
  progress?: number
  result?: Record<string, unknown>
  payload?: Record<string, unknown>
  results?: BigQueryResult[]
  totalCount?: number
  sql?: string
  explanation?: string
  selectedRecommendation?: BuyerRecommendation
  error?: string
}

// API 요청 타입
export interface LeadDiscoverySearchRequest {
  query: string
  workspaceId: string
  locale?: string
}

export interface LeadDiscoverySelectRequest {
  sessionId: string
  selectedRecommendationId: string
  workspaceId: string
}
