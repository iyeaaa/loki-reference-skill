/**
 * Buyer Search Constants
 * 국가/산업 매핑 및 API 상수
 */

import type { CompanySize, Country, Industry } from "./types"

// ============================================================================
// 회사 규모 매핑
// ============================================================================

/**
 * 회사 규모 설명 매핑
 */
export const COMPANY_SIZE_LABELS: Record<CompanySize, string> = {
  startup: "Startup (1-10 employees)",
  small: "Small Business (10-50 employees)",
  medium: "Medium Business (50-250 employees)",
  large: "Large Enterprise (250-1000 employees)",
  enterprise: "Global Enterprise (1000+ employees)",
}

// ============================================================================
// 국가 매핑
// ============================================================================

/**
 * 국가 코드 → 영문명
 */
export const COUNTRY_NAMES: Record<Country, string> = {
  japan: "Japan",
  usa: "United States",
  china: "China",
  southeast_asia: "Southeast Asia",
  europe: "Europe",
  middle_east: "Middle East",
}

/**
 * 국가 코드 → 한국어명
 */
export const COUNTRY_DISPLAY_KO: Record<Country, string> = {
  japan: "일본",
  usa: "미국",
  china: "중국",
  southeast_asia: "동남아시아",
  europe: "유럽",
  middle_east: "중동",
}

/**
 * 국가 → Apollo API 국가 목록
 */
export const COUNTRY_TO_APOLLO: Record<Country, string[]> = {
  japan: ["Japan"],
  usa: ["United States"],
  china: ["China"],
  southeast_asia: ["Vietnam", "Thailand", "Indonesia", "Malaysia", "Singapore", "Philippines"],
  europe: [
    "Germany",
    "France",
    "United Kingdom",
    "Netherlands",
    "Italy",
    "Spain",
    "Poland",
    "Belgium",
  ],
  middle_east: ["United Arab Emirates", "Saudi Arabia", "Israel", "Turkey", "Qatar"],
}

/**
 * 국가 → Google Places 검색 중심점 (주요 도시)
 */
export const COUNTRY_TO_PLACES: Record<
  Country,
  Array<{ city: string; lat: number; lng: number; radius: number }>
> = {
  japan: [
    { city: "Tokyo", lat: 35.6762, lng: 139.6503, radius: 50000 },
    { city: "Osaka", lat: 34.6937, lng: 135.5023, radius: 50000 },
  ],
  usa: [
    { city: "New York", lat: 40.7128, lng: -74.006, radius: 50000 },
    { city: "Los Angeles", lat: 34.0522, lng: -118.2437, radius: 50000 },
    { city: "Chicago", lat: 41.8781, lng: -87.6298, radius: 50000 },
  ],
  china: [
    { city: "Shanghai", lat: 31.2304, lng: 121.4737, radius: 50000 },
    { city: "Beijing", lat: 39.9042, lng: 116.4074, radius: 50000 },
  ],
  southeast_asia: [
    { city: "Singapore", lat: 1.3521, lng: 103.8198, radius: 30000 },
    { city: "Bangkok", lat: 13.7563, lng: 100.5018, radius: 50000 },
    { city: "Jakarta", lat: -6.2088, lng: 106.8456, radius: 50000 },
  ],
  europe: [
    { city: "London", lat: 51.5074, lng: -0.1278, radius: 50000 },
    { city: "Paris", lat: 48.8566, lng: 2.3522, radius: 50000 },
    { city: "Berlin", lat: 52.52, lng: 13.405, radius: 50000 },
  ],
  middle_east: [
    { city: "Dubai", lat: 25.2048, lng: 55.2708, radius: 50000 },
    { city: "Riyadh", lat: 24.7136, lng: 46.6753, radius: 50000 },
  ],
}

// ============================================================================
// 산업 매핑
// ============================================================================

/**
 * 산업별 컨텍스트 힌트 (LLM 프롬프트용)
 */
export const INDUSTRY_HINTS: Record<Industry, string> = {
  manufacturing_parts: "산업용 부품, OEM/ODM, 제조 장비, 기계 부품 등",
  it_software: "SaaS, 기업용 소프트웨어, IT 솔루션, 클라우드 서비스 등",
  beauty_cosmetics: "화장품, 스킨케어, 뷰티 디바이스, K-뷰티 제품 등",
  food_supplements: "식품, 건강기능식품, 음료, 건기식, 영양제 등",
  fashion_apparel: "의류, 액세서리, 패션 잡화, 텍스타일 등",
  electronics: "가전제품, 전자기기, IoT 디바이스, 스마트 기기 등",
  healthcare: "의료기기, 헬스케어 제품, 웰니스, 의료용품 등",
  other: "기타 제품/서비스",
}

/**
 * 산업별 Google Places 검색 타입
 */
export const INDUSTRY_TO_PLACE_TYPE: Record<Industry, string> = {
  beauty_cosmetics: "beauty_salon|spa|cosmetics_store",
  food_supplements: "health_food_store|grocery_store|pharmacy",
  fashion_apparel: "clothing_store|department_store|shoe_store",
  electronics: "electronics_store|home_goods_store",
  healthcare: "pharmacy|drugstore|hospital",
  manufacturing_parts: "hardware_store|home_goods_store",
  it_software: "electronics_store",
  other: "store",
}

// ============================================================================
// API 설정
// ============================================================================

/**
 * 검색 소스별 기대 결과 수
 */
export const EXPECTED_RESULTS_PER_SOURCE = {
  perplexity: 40, // 페르소나 × 국가당 10-15개
  apollo: 60, // 구조화된 B2B DB
  serper: 30, // Google 검색 결과
  places: 20, // 로컬 비즈니스 (B2C만)
}

/**
 * Phase별 진행률 범위 (%)
 */
export const PHASE_PROGRESS_RANGES = {
  intelligence: { start: 0, end: 15 },
  search_perplexity: { start: 15, end: 30 },
  search_apollo: { start: 30, end: 45 },
  search_serper: { start: 45, end: 55 },
  search_places: { start: 55, end: 65 },
  dedup: { start: 65, end: 70 },
  enrichment: { start: 70, end: 85 },
  scoring: { start: 85, end: 92 },
  finalizing: { start: 92, end: 100 },
}

/**
 * 스코어링 가중치
 */
export const SCORING_WEIGHTS = {
  llmRelevance: 0.35, // LLM 관련성 평가 (45% → 35%)
  companySizeMatch: 0.2, // 판매자-바이어 규모 적합성 (신규)
  emailQuality: 0.25, // 이메일 품질 (30% → 25%)
  dataCompleteness: 0.15, // 데이터 완성도
  sourceReliability: 0.05, // 소스 신뢰도 (10% → 5%)
}

/**
 * 소스별 신뢰도 점수
 */
export const SOURCE_RELIABILITY: Record<string, number> = {
  apollo: 1.0, // 구조화된 B2B DB
  hunter: 0.9, // 검증된 이메일
  perplexity: 0.8, // AI 웹 검색
  serper: 0.7, // 웹 검색
  places: 0.6, // 로컬 비즈니스
}

/**
 * 최종 선정 시 페르소나당 최대 수
 */
export const MAX_PER_PERSONA = 10

/**
 * 최종 바이어 수
 */
export const FINAL_BUYER_COUNT = 30

/**
 * LLM 배치 크기 (스코어링 시)
 */
export const LLM_BATCH_SIZE = 12
