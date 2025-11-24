/**
 * Gemini File Search Types
 * Google Gemini File Search API 통합을 위한 타입 정의
 */

// Gemini File Search Store 정보
export interface GeminiFileSearchStore {
  name: string // stores/{store_id}
  displayName: string
  createTime: string
  updateTime: string
}

// 업로드된 파일 정보
export interface GeminiUploadedFile {
  name: string // files/{file_id}
  displayName: string
  mimeType: string
  sizeBytes: string
  createTime: string
  updateTime: string
  expirationTime: string
  sha256Hash: string
  uri: string
  state: "PROCESSING" | "ACTIVE" | "FAILED"
  metadata?: Record<string, string>
}

// CSV 업로드 요청
export interface UploadCSVRequest {
  workspaceId: string
  file: File
  storeName?: string // 선택적, 없으면 자동 생성
  metadata?: {
    country?: string
    region?: string
    vertical?: string // e.g., "bedding", "beauty", "skincare"
    source?: string
    dbVersion?: string
    [key: string]: string | undefined
  }
}

// CSV 업로드 응답
export interface UploadCSVResponse {
  success: boolean
  storeName: string
  fileName: string
  fileId: string
  totalRows: number
  message: string
  metadata?: Record<string, string>
}

// 리드 검색 요청
export interface LeadSearchRequest {
  workspaceId: string
  query: string // 자연어 쿼리 (e.g., "독일의 침구 도매업체")
  filters?: {
    country?: string
    region?: string
    vertical?: string
    dbVersion?: string
    [key: string]: string | undefined
  }
  limit?: number // 결과 개수 제한 (기본: 50)
  storeNames?: string[] // 검색할 스토어 지정 (없으면 모든 스토어)
}

// 리드 검색 결과 (단일 리드)
// CSV의 실제 컬럼명을 그대로 사용하므로 유연한 스키마 적용
export interface LeadSearchResult {
  // 필수 필드 (AI가 추가하는 정보)
  matchReason?: string // Gemini가 설명하는 매칭 이유
  confidenceScore?: number // 0-1 사이 신뢰도

  // CSV의 모든 컬럼을 동적으로 수용
  // 예: "Full name", "Company Name", "Emails", "Company Website", "Job title" 등
  [key: string]: string | number | boolean | undefined
}

// 리드 검색 응답
export interface LeadSearchResponse {
  success: boolean
  query: string
  results: LeadSearchResult[]
  totalResults: number
  explanation?: string // Gemini의 전체 설명
  processingTime: number // 초 단위
  citations?: Array<{
    startIndex: number
    endIndex: number
    uri: string
    title?: string
  }>
}

// Store 목록 조회 응답
export interface ListStoresResponse {
  success: boolean
  stores: Array<{
    name: string
    displayName: string
    fileCount: number
    createTime: string
    updateTime: string
  }>
  total: number
}

// 에러 응답
export interface GeminiErrorResponse {
  success: false
  error: string
  code: string
  details?: string
}

// 진행 상황 (SSE용)
export interface UploadProgress {
  type: "init" | "progress" | "complete" | "error"
  status: "uploading" | "processing" | "indexing" | "completed" | "error"
  message: string
  percentage?: number
  currentStep?: string
  totalSteps?: number
  elapsedTime?: number
}

// Gemini API 설정
export interface GeminiConfig {
  apiKey: string
  model: string // "gemini-2.0-flash-exp" 또는 "gemini-3-pro-preview"
  maxOutputTokens?: number
  temperature?: number
}

// 기본 설정
export const DEFAULT_GEMINI_CONFIG: Partial<GeminiConfig> = {
  model: "gemini-2.0-flash-exp",
  maxOutputTokens: 8192,
  temperature: 0.2,
}

// Gemini File Search 관련 상수
export const GEMINI_CONSTANTS = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_STORE_SIZE: 20 * 1024 * 1024 * 1024, // 20GB (권장)
  DEFAULT_STORE_PREFIX: "lead-db",
  SUPPORTED_MIME_TYPES: [
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
  ],
  INDEXING_COST_PER_MILLION_TOKENS: 0.15, // USD
  QUERY_INPUT_COST_PER_MILLION_TOKENS: 2.0, // USD (Gemini 3 Pro)
  QUERY_OUTPUT_COST_PER_MILLION_TOKENS: 12.0, // USD (Gemini 3 Pro)
} as const
