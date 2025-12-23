/**
 * Web Data Extraction Types
 * 웹사이트에서 회사 정보 및 연락처를 추출하는 기능 관련 타입
 */

export interface SearchCriteriaResult {
  result: string // "true" or "false"
  reasons: string[] // 3 specific reasons
}

export interface CompanyRecord {
  websiteUrl: string
  finalUrl?: string
  httpStatus?: number
  foundCompanyName?: string
  description?: string
  companyType?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: string
  phoneNumber?: string
  email?: string
  facebookUrl?: string
  instagramUrl?: string
  twitterUrl?: string
  linkedinUrl?: string
  employeeCount?: string
  products?: string
  businessSectors?: string
  productCategories?: string
  industryTypes?: string
  isKoreaHeadquartered?: string
  koreaHeadquarteredReason?: string
  isBeddingBrandOwner?: string
  beddingBrandOwnerReason?: string
  isDistributor?: string
  distributorReason?: string
  customSearchResults?: Record<string, SearchCriteriaResult> // Dynamic search criteria results with reasons
  crawlTimeSeconds?: number
  gptTimeSeconds?: number
  collectedAt?: string
  errorMessage?: string
}

export interface ProgressLog {
  timestamp: number
  message: string
  type: "info" | "success" | "warning" | "error"
  processed?: number
  total?: number
}

// GPT API 비용 계산 상수 (GPT-4o-mini 기준)
export const GPT_COST_PER_REQUEST = {
  // 평균 입력 토큰: 웹사이트 콘텐츠(7000) + 시스템 프롬프트(100) + 사용자 프롬프트(900) = 약 8000 토큰
  INPUT_TOKENS: 8000,
  // 평균 출력 토큰: JSON 응답 약 800 토큰
  OUTPUT_TOKENS: 800,
  // GPT-4o-mini 가격 (2024년 기준)
  INPUT_PRICE_PER_MILLION: 0.15, // $0.15 per 1M tokens
  OUTPUT_PRICE_PER_MILLION: 0.6, // $0.60 per 1M tokens
}

export interface ExtractionProgress {
  type?: "init" | "progress" | "complete" | "error" // SSE 이벤트 타입
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
  timestamp?: string // SSE 타임스탬프
  jobId?: string // 작업 ID (완료 시 포함)
  totalRecords?: number // 완료 시 총 레코드 수
  logs?: ProgressLog[] // 실시간 로그
  latestResult?: CompanyRecord // 최신 처리된 결과
  estimatedCost?: number // 예상 GPT API 비용 (USD)
}

export interface ExtractionJob {
  id: string
  workspaceId: string
  fileName: string
  status: "pending" | "processing" | "completed" | "error"
  totalRecords: number
  processedRecords: number
  successCount: number
  errorCount: number
  startedAt: Date
  completedAt?: Date
  resultFileUrl?: string
  errorFileUrl?: string
  errorMessage?: string
}

export interface FetchResult {
  content: string
  statusCode: number
  finalUrl: string
  error?: string
}

export interface ExtractedContacts {
  foundCompanyName?: string
  description?: string
  companyType?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: string
  phoneNumber?: string
  email?: string
  facebookUrl?: string
  instagramUrl?: string
  twitterUrl?: string
  linkedinUrl?: string
  employeeCount?: string
  products?: string
  businessSectors?: string
  productCategories?: string
  industryTypes?: string
  isKoreaHeadquartered?: string
  koreaHeadquarteredReason?: string
  isBeddingBrandOwner?: string
  beddingBrandOwnerReason?: string
  isDistributor?: string
  distributorReason?: string
  customSearchResults?: Record<string, SearchCriteriaResult> // Dynamic search criteria results with reasons
  httpStatus?: number
  errorMessage?: string
}

export interface WebExtractionConfig {
  maxConcurrent: number // 동시 처리 수 (자동 계산: Workspace 활성 API 키 개수 * 20)
  timeoutSeconds: number // 웹사이트 가져오기 타임아웃
  gptTimeout: number // GPT API 타임아웃
  crawlDepth: number // 크롤링 깊이
  deduplicateByUrl: boolean // URL 기준 중복 제거
  expandEmailsToRows: boolean // 여러 이메일을 별도 행으로 분리
  randomDelayMin: number // 최소 랜덤 지연 (ms)
  randomDelayMax: number // 최대 랜덤 지연 (ms)
}

export const DEFAULT_EXTRACTION_CONFIG: WebExtractionConfig = {
  maxConcurrent: 2, // 메모리 최적화: 동시 처리 수 감소 (기존 20 → 2)
  timeoutSeconds: 60, // 타임아웃 단축 (기존 120 → 60)
  gptTimeout: 120, // GPT 타임아웃 단축 (기존 180 → 120)
  crawlDepth: 1,
  deduplicateByUrl: true,
  expandEmailsToRows: true,
  randomDelayMin: 2000, // 지연 시간 단축 (기존 3000 → 2000)
  randomDelayMax: 4000, // 지연 시간 단축 (기존 6000 → 4000)
}

// 메모리 최적화 상수
export const MEMORY_OPTIMIZATION = {
  MAX_BATCH_SIZE: 200, // 한 번에 처리 가능한 최대 URL 수
  MAX_LOGS_IN_MEMORY: 50, // 메모리에 유지할 최대 로그 수 (기존 500 → 50)
  CHUNK_SIZE: 10, // 청크당 URL 수 (Promise.all 대신 청크 단위 처리)
  GC_INTERVAL_MS: 5000, // 가비지 컬렉션 힌트 간격
}
