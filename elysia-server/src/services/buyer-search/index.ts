/**
 * Buyer Search Module - Main Exports
 *
 * 온보딩용 바이어 서치 시스템
 *
 * 특징:
 * - Hunter.io Discover + Domain Search API 조합
 * - 공격적 병렬화 (Rate Limit까지 사용)
 * - Exponential Backoff 재시도 (최대 3회)
 * - Redis 캐싱 (24시간 TTL)
 * - 실시간 Progress 추적
 * - Fill 작업으로 목표 결과 수 보장 시도
 *
 * 아키텍처:
 * ┌─────────────────────────────────────┐
 * │         BuyerSearchOrchestrator     │
 * ├──────────────────┬──────────────────┤
 * │  CompanyFinder   │  ContactEnricher │
 * │  - Hunter        │  - Hunter        │
 * │  - Apollo (예정) │  - Apollo (예정) │
 * └──────────────────┴──────────────────┘
 *
 * @example
 * ```typescript
 * import { searchBuyers } from "./services/buyer-search"
 *
 * // 간단한 검색
 * const result = await searchBuyers({
 *   query: "AI startups in San Francisco",
 *   headcount: ["51-200", "201-500"],
 *   limit: 30,
 * })
 *
 * // Progress 추적
 * const result = await searchBuyers(
 *   { query: "SaaS companies", limit: 30 },
 *   {
 *     locale: "ko",
 *     onProgress: (event) => {
 *       console.log(`[${event.phase}] ${event.progress}% - ${event.message}`)
 *     },
 *   },
 * )
 *
 * // 결과 처리
 * for (const buyer of result.results) {
 *   console.log(`${buyer.company.name}: ${buyer.contact?.email}`)
 * }
 * ```
 */

// ==================== TYPES ====================

export type {
  // Search Result Types
  BuyerSearchOptions,
  BuyerSearchResult,
  // Company Types
  Company,
  CompanyDetails,
  CompanySearchParams,
  // Contact Types
  Contact,
  ContactSelectionCriteria,
  OrchestratorResult,
  // Progress Types
  ProgressCallback,
  ProgressEvent,
  // Error Types
  SearchError,
  SearchErrorType,
  SearchPhase,
} from "./types"

// ==================== ORCHESTRATOR ====================

export {
  BuyerSearchOrchestrator,
  createBuyerSearchOrchestrator,
  type OrchestratorOptions,
  searchBuyers,
} from "./orchestrator"

// ==================== PROGRESS TRACKER ====================

export {
  createProgressTracker,
  ProgressTracker,
  type ProgressTrackerOptions,
} from "./progress-tracker"

// ==================== PROVIDERS ====================

export {
  // Provider Types
  type CompanyFinderProvider,
  type CompanySearchResult,
  type ContactEnricherProvider,
  type ContactSearchResult,
  createHunterCompanyFinder,
  createHunterContactEnricher,
  // Hunter Provider
  HunterCompanyFinder,
  HunterContactEnricher,
  type ProviderResult,
} from "./providers"

// ==================== UTILITIES ====================

export {
  type CacheConfig,
  del,
  exists,
  generateCompanySearchCacheKey,
  generateContactCacheKey,
  generateDomainCacheKey,
  // Caching
  getBuyerSearchCache,
  getOrSet,
  mget,
  mset,
} from "./cache"
export {
  // Rate Limiting
  DualRateLimiter,
  getDiscoverExecutor,
  getDomainSearchExecutor,
  HUNTER_DISCOVER_RATE_LIMIT,
  HUNTER_DOMAIN_SEARCH_RATE_LIMIT,
  type RateLimitConfig,
  RateLimitedExecutor,
  type RetryConfig,
} from "./rate-limiter"
