/**
 * Buyer Search Provider - Interface Definitions
 *
 * Provider 패턴을 사용한 확장 가능한 인터페이스 정의
 * - CompanyFinderProvider: 회사 검색 (Hunter Discover, Apollo 등)
 * - ContactEnricherProvider: 담당자 정보 수집 (Hunter Domain Search 등)
 *
 * 새로운 데이터 소스 추가 시 이 인터페이스를 구현하면 됨
 */

import type {
  Company,
  CompanyDetails,
  CompanySearchParams,
  Contact,
  ContactSelectionCriteria,
} from "../types"

// ==================== PROVIDER RESULT TYPES ====================

/**
 * Provider 작업 결과 공통 타입
 */
export interface ProviderResult<T> {
  success: boolean
  data: T | null
  /** 캐시에서 가져왔는지 여부 */
  fromCache: boolean
  /** 처리 시간 (ms) */
  timeMs: number
  /** 에러 메시지 (실패 시) */
  error?: string
  /** 재시도 가능 여부 (에러 시) */
  retryable?: boolean
}

/**
 * 회사 검색 결과
 */
export interface CompanySearchResult {
  companies: Company[]
  totalAvailable: number
}

/**
 * 담당자 검색 결과
 */
export interface ContactSearchResult {
  contact: Contact | null
  companyDetails: CompanyDetails | null
  /** 검색된 모든 이메일 (우선순위 정렬) */
  allContacts: Contact[]
}

// ==================== PROVIDER INTERFACES ====================

/**
 * 회사 검색 Provider 인터페이스
 *
 * 회사 목록을 검색하는 기능 제공
 * - Hunter.io Discover API
 * - Apollo.io People Search API
 * - etc.
 */
export interface CompanyFinderProvider {
  /** Provider 이름 (로깅용) */
  readonly name: string

  /**
   * 회사 검색 실행
   *
   * @param params - 검색 파라미터
   * @returns 검색 결과 (회사 목록)
   */
  searchCompanies(params: CompanySearchParams): Promise<ProviderResult<CompanySearchResult>>

  /**
   * Rate Limit 상태 확인
   */
  getRateLimitStatus(): {
    remainingRequests: number
    resetTimeMs: number
  }
}

/**
 * 담당자 정보 수집 Provider 인터페이스
 *
 * 회사 도메인으로 담당자 정보 수집
 * - Hunter.io Domain Search API
 * - Apollo.io People Search API
 * - etc.
 */
export interface ContactEnricherProvider {
  /** Provider 이름 (로깅용) */
  readonly name: string

  /**
   * 도메인으로 담당자 정보 수집
   *
   * @param domain - 회사 도메인
   * @param criteria - 담당자 선택 기준
   * @returns 최적 담당자 정보 + 회사 상세 정보
   */
  enrichContact(
    domain: string,
    criteria: ContactSelectionCriteria,
  ): Promise<ProviderResult<ContactSearchResult>>

  /**
   * 여러 도메인 병렬 처리
   *
   * @param domains - 도메인 목록
   * @param criteria - 담당자 선택 기준
   * @param onProgress - 진행 상황 콜백 (선택)
   * @returns 결과 Map (domain -> result)
   */
  enrichContactsBatch(
    domains: string[],
    criteria: ContactSelectionCriteria,
    onProgress?: (completed: number, total: number) => void,
  ): Promise<Map<string, ProviderResult<ContactSearchResult>>>

  /**
   * Rate Limit 상태 확인
   */
  getRateLimitStatus(): {
    remainingRequests: number
    resetTimeMs: number
  }
}

// ==================== PROVIDER FACTORY ====================

/**
 * Provider 생성 옵션
 */
export interface ProviderOptions {
  /** API 키 */
  apiKey: string
  /** 캐시 활성화 여부 */
  cacheEnabled?: boolean
  /** 캐시 TTL (초) */
  cacheTtlSeconds?: number
  /** 최대 동시 요청 수 */
  maxConcurrency?: number
  /** 요청당 재시도 횟수 */
  maxRetries?: number
  /** 요청 타임아웃 (ms) */
  timeoutMs?: number
}

/**
 * Provider Factory 인터페이스
 */
export interface BuyerSearchProviderFactory {
  createCompanyFinder(options: ProviderOptions): CompanyFinderProvider
  createContactEnricher(options: ProviderOptions): ContactEnricherProvider
}
