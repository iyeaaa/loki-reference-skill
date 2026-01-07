/**
 * Buyer Search - Common Type Definitions
 *
 * 바이어 서치 시스템의 공통 타입 정의
 * - 회사 정보, 담당자 정보, 검색 결과
 * - Progress 추적 타입
 * - 에러 처리 타입
 */

// ==================== COMPANY TYPES ====================

/**
 * 회사 기본 정보 (Discover API 결과)
 */
export interface Company {
  domain: string
  name: string
  emailsCount?: {
    personal: number
    generic: number
    total: number
  }
}

/**
 * 회사 상세 정보 (Domain Search API 결과)
 */
export interface CompanyDetails extends Company {
  description?: string | null
  industry?: string | null
  country?: string | null
  headcount?: string | null
  companyType?: string | null
  pattern?: string | null
}

// ==================== CONTACT TYPES ====================

/**
 * 담당자 정보
 */
export interface Contact {
  email: string
  type: "personal" | "generic"
  confidence: number
  firstName?: string | null
  lastName?: string | null
  position?: string | null
  seniority?: string | null
  department?: string | null
  linkedin?: string | null
  phone?: string | null
}

/**
 * 최적 담당자 선택 기준
 */
export interface ContactSelectionCriteria {
  /** 최소 신뢰도 (0-100) */
  minConfidence: number
  /** 선호하는 담당자 유형 순서 */
  preferredTypes: ("personal" | "generic")[]
  /** 선호하는 직급 순서 */
  preferredSeniorities: ("executive" | "senior" | "junior")[]
  /** 선호하는 부서 */
  preferredDepartments?: string[]
}

// ==================== SEARCH RESULT TYPES ====================

/**
 * 바이어 검색 결과 (회사 + 담당자)
 */
export interface BuyerSearchResult {
  company: CompanyDetails
  contact: Contact | null
  /** 검색 소스 */
  source: "hunter" | "apollo"
  /** 검색 시간 (ms) */
  searchTimeMs: number
  /** 캐시 히트 여부 */
  fromCache: boolean
  /** Reranking 점수 (0-100, 높을수록 좋음) */
  rankScore: number
}

/**
 * 바이어 검색 옵션
 */
export interface BuyerSearchOptions {
  /** 목표 결과 수 */
  targetCount: number
  /** 최대 재시도 횟수 */
  maxRetries: number
  /** 최소 담당자 신뢰도 */
  minContactConfidence: number
  /** 병렬 처리 수 */
  concurrency: number
  /** 타임아웃 (ms) */
  timeoutMs: number
}

// ==================== PROGRESS TYPES ====================

/**
 * 검색 Phase
 */
export type SearchPhase =
  | "init"
  | "discovery" // 회사 찾기
  | "enrichment" // 담당자 정보 수집
  | "fill" // 부족분 채우기
  | "complete"
  | "error"

/**
 * Progress 이벤트 타입
 */
export interface ProgressEvent {
  phase: SearchPhase
  /** 전체 진행률 (0-100) */
  progress: number
  /** 현재 Phase 내 진행률 (0-100) */
  phaseProgress: number
  /** 상태 메시지 */
  message: string
  /** 현재까지 찾은 결과 수 */
  resultsFound: number
  /** 목표 결과 수 */
  targetCount: number
  /** 현재 처리 중인 회사명 */
  currentCompany?: string
  /** Phase별 세부 진행 상황 */
  details?: {
    discovery?: { found: number; target: number }
    enrichment?: { completed: number; total: number }
    fill?: { attempts: number; maxAttempts: number }
  }
}

/**
 * Progress 콜백 함수 타입
 */
export type ProgressCallback = (event: ProgressEvent) => void

// ==================== ERROR TYPES ====================

/**
 * 에러 유형
 */
export type SearchErrorType =
  | "rate_limit"
  | "timeout"
  | "network"
  | "validation"
  | "not_found"
  | "api_error"
  | "unknown"

/**
 * 검색 에러
 */
export interface SearchError {
  type: SearchErrorType
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

// ==================== DISCOVER PARAMS ====================

/**
 * 회사 검색 파라미터 (Hunter.io Discover API 기반)
 * 확장성을 위해 공통 인터페이스로 정의
 */
export interface CompanySearchParams {
  /** 자연어 검색 쿼리 */
  query?: string
  /** 지역 필터 */
  location?: {
    country?: string
    continent?: string
    businessRegion?: "AMER" | "EMEA" | "APAC" | "LATAM"
  }
  /** 산업 필터 */
  industry?: {
    include?: string[]
    exclude?: string[]
  }
  /** 회사 규모 (직원 수) */
  headcount?: string[]
  /** 키워드 필터 */
  keywords?: {
    include?: string[]
    exclude?: string[]
    match?: "any" | "all"
  }
  /** 결과 개수 제한 */
  limit: number
  /** 오프셋 (페이지네이션) */
  offset?: number

  // ==================== ICP 기반 검색 ====================

  /**
   * 🆕 본인 회사 설명 (ICP 기반 고객사 검색에 사용)
   *
   * 예: "커피 찌꺼기를 활용한 고양이 모래 전문 기업"
   * → 잠재 고객: 펫샵, 유통업체, 대형마트 등
   */
  myCompanyDescription?: string

  /**
   * 🆕 타겟 고객 유형
   * 예: "B2B", "B2C", "기업 대상"
   */
  targetType?: string
}

// ==================== ORCHESTRATOR RESULT ====================

/**
 * 오케스트레이터 최종 결과
 */
export interface OrchestratorResult {
  /** 검색 성공 여부 */
  success: boolean
  /** 검색 결과 목록 */
  results: BuyerSearchResult[]
  /** 총 검색 시간 (ms) */
  totalTimeMs: number
  /** 통계 정보 */
  stats: {
    /** 시도한 회사 수 */
    companiesAttempted: number
    /** 성공한 회사 수 */
    companiesSucceeded: number
    /** 캐시 히트 수 */
    cacheHits: number
    /** 재시도 횟수 */
    retries: number
    /** Fill 시도 횟수 */
    fillAttempts: number
    /** Provider별 통계 */
    providerStats?: Record<string, { found: number; enriched: number }>
  }
  /** 에러 (실패 시) */
  error?: SearchError
}
