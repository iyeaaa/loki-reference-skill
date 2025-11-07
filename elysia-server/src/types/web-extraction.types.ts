/**
 * Web Data Extraction Types
 * 웹사이트에서 회사 정보 및 연락처를 추출하는 기능 관련 타입
 */

export interface CompanyRecord {
  websiteUrl: string
  businessType?: string
  companyName?: string
  finalUrl?: string
  httpStatus?: number
  foundCompanyName?: string
  nameUrlMatch?: string
  isBusinessTypeMatched?: string
  description?: string
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
  crawlTimeSeconds?: number
  gptTimeSeconds?: number
  collectedAt?: string
  errorMessage?: string
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
  companyName?: string
  foundCompanyName?: string
  nameUrlMatch?: string
  isBusinessTypeMatched?: string
  description?: string
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
  maxConcurrent: 20, // 기본값 (API 키 개수에 따라 자동 조정됨: 키 개수 * 20)
  timeoutSeconds: 120,
  gptTimeout: 180,
  crawlDepth: 1,
  deduplicateByUrl: true,
  expandEmailsToRows: true,
  randomDelayMin: 1000,
  randomDelayMax: 3000,
}
