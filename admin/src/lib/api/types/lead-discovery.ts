/**
 * Lead Discovery API Types
 * LangGraph 기반 리드 탐색 API 타입 정의
 */

// 바이어 추천 타입
export type BuyerRecommendation = {
  id: string
  country: string
  industry: string
  subIndustry?: string
  reasoning: string
  estimatedLeadCount?: number
  keywords?: string[]
}

// BigQuery 검색 결과 타입
// 컬럼 순서: 회사명, 웹사이트, Description, Fit Score, Country, Category, Main Industry, Sub Industry, Company Email
export type BigQueryResult = {
  companyName?: string // 회사명
  webAddress?: string // 웹사이트
  website?: string // 웹사이트 (alias)
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
  source?: string // 데이터 소스 (apollo, fresh, b2b, crunchbase)
}

// 분석된 페이지 정보
export type AnalyzedPage = {
  url: string
  title?: string
  favicon?: string
  ogImage?: string
  description?: string
  contentLength: number
}

// 웹사이트 분석 결과
export type WebsiteAnalysis = {
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
export type SSEEventData = {
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
export type LeadDiscoverySearchRequest = {
  query: string
  workspaceId: string
  locale?: string
}

export type LeadDiscoverySelectRequest = {
  sessionId: string
  selectedRecommendationId: string
  workspaceId: string
}
