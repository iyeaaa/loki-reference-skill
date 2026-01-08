/**
 * Buyer Search Types
 * 기획서 v2 기반 타입 정의
 */

// ============================================================================
// Input/Output Types (공개 API)
// ============================================================================

/**
 * 산업군 타입
 */
export type Industry =
  | "manufacturing_parts" // 제조 부품
  | "it_software" // IT 소프트웨어
  | "beauty_cosmetics" // 뷰티 화장품
  | "food_supplements" // 식품 건기식
  | "fashion_apparel" // 패션 의류
  | "electronics" // 전자제품
  | "healthcare" // 헬스케어
  | "other" // 기타

/**
 * 타겟 고객 타입
 */
export type TargetCustomer = "b2b" | "b2c" | "both"

/**
 * 회사 규모 타입
 */
export type CompanySize =
  | "startup" // 스타트업/신생기업 (직원 1-10명)
  | "small" // 소기업 (직원 10-50명)
  | "medium" // 중기업 (직원 50-250명)
  | "large" // 대기업 (직원 250-1000명)
  | "enterprise" // 글로벌 대기업 (직원 1000명+)

/**
 * 국가 타입
 */
export type Country =
  | "japan" // 일본
  | "usa" // 미국
  | "china" // 중국
  | "southeast_asia" // 동남아
  | "europe" // 유럽
  | "middle_east" // 중동

/**
 * 바이어 검색 입력
 */
export interface BuyerSearchInput {
  companyName: string // 회사명
  companyDescription: string // 회사 설명 (주요 제품 포함)
  industry: Industry // 산업군
  target: TargetCustomer // 타겟 고객
  country: Country[] // 희망 진출 국가 (복수 선택)
  locale: "en" | "ko" // 언어
  companySize: CompanySize // 회사 규모
}

/**
 * 바이어 정보
 */
export interface Buyer {
  companyName: string // "ABC Trading Co."
  website: string // "https://abc-trading.com"
  email: string // "buyer@abc-trading.com"
  industry: string // "Industrial Equipment Distributor"
  country: string // "Japan"
  description: string // "일본 산업용 장비 전문 유통사..."
  size?: CompanySize // 회사 규모 (선택적)
}

/**
 * 검색 메타데이터
 */
export interface SearchMetadata {
  totalSearched: number // 전체 검색된 회사 수
  totalWithEmail: number // 이메일 확보한 회사 수
  searchTimeSeconds: number // 검색 소요 시간 (초)
  sources: string[] // 사용된 데이터 소스 목록
}

/**
 * 바이어 검색 결과
 */
export interface BuyerSearchResult {
  buyers: Buyer[]
  metadata: SearchMetadata
}

/**
 * SSE 진행률 이벤트
 */
export interface ProgressEvent {
  phase: string // 현재 단계 (intelligence, search_perplexity, ...)
  progress: number // 진행률 0-100
  message: string // 사용자에게 표시할 메시지
  detail?: unknown // 추가 상세 정보
}

// ============================================================================
// Internal Types (내부 파이프라인용)
// ============================================================================

/**
 * 바이어 페르소나
 */
export interface BuyerPersona {
  type: string // 바이어 유형명 (영문)
  typeKo: string // 바이어 유형명 (한글)
  description: string // 왜 이 유형이 적합한지
  decisionMakers: string[] // 의사결정자 직책
  targetCompanySize: CompanySize[] // 타겟 회사 규모 (우선순위)
  searchKeywords: {
    en: string[] // 영문 키워드
    local: Record<string, string[]> // 국가별 현지어 키워드
  }
}

/**
 * 바이어 인텔리전스 (Phase 1 출력)
 */
export interface BuyerIntelligence {
  productSummary: string // 제품/서비스 요약
  buyerPersonas: BuyerPersona[] // 바이어 페르소나 (3-5개)
  industryFilters: {
    keywords: string[] // 산업 필터 키워드
    excludeKeywords: string[] // 제외할 키워드 (경쟁사 등)
  }
  searchStrategy: {
    priorityPersonas: string[] // 우선순위 페르소나
    notes: string // 검색 전략 메모
  }
}

/**
 * 원시 회사 데이터 (Phase 2 검색 결과)
 */
export interface RawCompany {
  companyName: string
  website?: string
  domain?: string
  industry?: string
  country?: string
  description?: string
  size?: CompanySize // 회사 규모
  contacts?: RawContact[]
  source: "perplexity" | "apollo" | "serper" | "places" // 데이터 소스
}

/**
 * 원시 연락처 정보
 */
export interface RawContact {
  email?: string
  name?: string
  title?: string
  phone?: string
}

/**
 * 정규화된 고유 회사 (Phase 2E 중복 제거 후)
 */
export interface UniqueCompany {
  id: string // normalized domain or generated ID
  companyName: string
  domain: string | null
  website: string | null
  industry: string | null
  country: string
  description: string | null
  size: CompanySize | null // 회사 규모
  contacts: RawContact[]
  sources: string[] // 데이터 소스 목록
}

/**
 * 이메일 정보
 */
export interface EmailInfo {
  email: string
  source: "apollo" | "hunter" | "snov"
  verified: boolean
  confidence: number // 0-100
  contactName?: string
  title?: string
}

/**
 * 이메일 Enrichment된 회사 (Phase 3 출력)
 */
export interface EnrichedCompany extends UniqueCompany {
  primaryEmail: EmailInfo // 최적 이메일
}

/**
 * LLM 평가 결과
 */
export interface LLMEvaluation {
  score: number // 0-10
  matchedPersona: string // 매칭된 페르소나
  reason: string // 적합한 이유
}

/**
 * 스코어링된 회사 (Phase 4 출력)
 */
export interface ScoredCompany extends EnrichedCompany {
  llmEvaluation: LLMEvaluation
  finalScore: number // 0-1 (가중치 적용된 최종 스코어)
  scoreBreakdown: {
    llmRelevance: number // 0-1
    companySizeMatch: number // 0-1 (판매자-바이어 규모 적합성)
    emailQuality: number // 0-1
    dataCompleteness: number // 0-1
    sourceReliability: number // 0-1
  }
}

/**
 * 최종 바이어 (Phase 5 출력)
 */
export interface FinalBuyer {
  companyName: string
  website: string
  email: string
  industry: string
  country: string
  description: string // LLM 생성 설명
  size?: CompanySize // 회사 규모
  matchedPersona?: string
  score?: number
}
