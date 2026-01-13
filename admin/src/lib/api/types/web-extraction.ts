export type SearchCriteriaResult = {
  result: string // "true" or "false"
  reasons: string[] // 3 specific reasons
}

// 백엔드 상세 에러 응답 타입
export type WebExtractionErrorResponse = {
  success: false
  error: string
  errorCode?: string
  detail?: string
  suggestion?: string
  fileName?: string
  currentCount?: number
  maxAllowed?: number
  availableColumns?: string[]
  recommendedAction?: string
}

// 대용량 파일 경고 타입
export type LargeBatchWarning = {
  type: "LARGE_BATCH"
  message: string
  estimatedMinutes: number
}

// Redis 연결 불가 경고 타입
export type RedisWarning = {
  type: "REDIS_UNAVAILABLE"
  message: string
}

// Init 이벤트 데이터 타입
export type ExtractionInitData = {
  type: "init"
  message: string
  timestamp: string
  total: number
  redisAvailable?: boolean
  warning?: LargeBatchWarning
  redisWarning?: RedisWarning
}

export type ExtractionResult = {
  website_url: string
  final_url?: string | null
  http_status?: number | null
  found_company_name?: string | null
  description?: string | null
  address?: string | null
  country?: string | null
  city?: string | null
  state?: string | null
  founded_year?: string | null
  phone_number?: string | null
  email?: string | null
  facebook_url?: string | null
  instagram_url?: string | null
  twitter_url?: string | null
  linkedin_url?: string | null
  employee_count?: string | null
  products?: string | null
  business_sectors?: string | null
  product_categories?: string | null
  industry_types?: string | null
  custom_search_results?: Record<string, SearchCriteriaResult> | null
  crawl_time_seconds?: number | null
  gpt_time_seconds?: number | null
  collected_at?: string | null
  error_message?: string | null
}

export type ExtractionProgress = {
  status: "processing" | "completed" | "error"
  total: number
  processed: number
  success: number
  errors: number
  emailFound: number
  phoneFound: number
  addressFound: number
  socialFound: number
  gptRequests: number
  percentage: number
  currentCompany?: string
  elapsedTime: number
  estimatedTimeRemaining: number
  itemsPerSecond: number
  message?: string
  errorDetails?: string
  type?: "init" | "progress" | "complete" | "error"
  jobId?: string
  latestResult?: ExtractionResult // 최신 처리된 결과
  estimatedCost?: number // 예상 GPT API 비용 (USD)
  // 새로 추가된 필드들
  redisAvailable?: boolean
  warning?: LargeBatchWarning
  redisWarning?: RedisWarning
}

export type WebExtractionUploadRequest = {
  file: File
  workspaceId: string
  searchCriteria?: string[]
}

export type WebExtractionProgressCallback = {
  onProgress: (progress: ExtractionProgress) => void
  onComplete: (jobId: string, progress: ExtractionProgress) => void
  onError: (error: Error) => void
}

// 단일 URL 분석 관련 타입
export type WebsiteAnalysisRequest = {
  websiteUrl: string
  workspaceId: string
  searchCriteria?: string[]
}

export type WebsiteAnalysisProgress = {
  type: "init" | "progress" | "complete" | "error"
  status?: "crawling" | "analyzing"
  message?: string
  timestamp: string
  success?: boolean
  result?: ExtractionResult
  error?: string
}

export type PageInfo = {
  url: string
  title?: string
  contentLength: number
}

export type WebsiteAnalysisCallbacks = {
  onInit?: (message: string) => void
  onProgress?: (status: string, message: string) => void
  onPageFound?: (pageInfo: PageInfo) => void
  onChunk?: (content: string) => void
  onComplete: (success: boolean, result: ExtractionResult | null) => void
  onError: (error: string) => void
}
