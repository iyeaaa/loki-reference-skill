/**
 * Locale Detection Utility
 *
 * 사용자의 지역/언어를 감지하여 적절한 결제 수단을 추천합니다.
 */

export type PaymentRegion = "KR" | "INTL"

export type LocaleInfo = {
  language: string
  region: PaymentRegion
  isKorean: boolean
  currency: "KRW" | "USD"
}

/**
 * 브라우저 언어 설정 기반 지역 감지
 *
 * 우선순위:
 * 1. navigator.language (예: "ko-KR", "en-US")
 * 2. navigator.languages[0]
 * 3. Intl.DateTimeFormat().resolvedOptions().locale
 */
export function detectLocale(): LocaleInfo {
  // 브라우저 언어 감지
  const browserLang =
    navigator.language ||
    navigator.languages?.[0] ||
    Intl.DateTimeFormat().resolvedOptions().locale ||
    "en-US"

  // 한국어 여부 판단 (ko, ko-KR, ko-kr 등)
  const isKorean = browserLang.toLowerCase().startsWith("ko")

  return {
    language: browserLang,
    region: isKorean ? "KR" : "INTL",
    isKorean,
    currency: isKorean ? "KRW" : "USD",
  }
}

/**
 * 결제 수단 타입
 */
export type PaymentMethod = "TOSS" | "PAYPAL"

/**
 * 지역 기반 기본 결제 수단 반환
 */
export function getDefaultPaymentMethod(locale?: LocaleInfo): PaymentMethod {
  const { isKorean } = locale || detectLocale()
  return isKorean ? "TOSS" : "PAYPAL"
}

/**
 * 환율 정보 타입
 */
export type ExchangeRateInfo = {
  rate: number
  source: "cache" | "cached" | "naver" | "api" | "realtime" | "manual" | "fallback"
  fetchedAt: Date
  expiresAt?: Date
}

/**
 * Fallback 환율 (API 실패 시)
 * 서버의 fallback과 동일하게 유지
 */
const FALLBACK_EXCHANGE_RATE = 1450

/**
 * 백엔드에서 환율 조회
 */
export async function fetchExchangeRate(
  baseCurrency = "USD",
  targetCurrency = "KRW",
): Promise<ExchangeRateInfo> {
  try {
    const response = await fetch(
      `/api/v1/billing/exchange-rates?base=${baseCurrency}&target=${targetCurrency}`,
      { signal: AbortSignal.timeout(5000) },
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = (await response.json()) as ExchangeRateInfo
    return {
      ...data,
      fetchedAt: new Date(data.fetchedAt),
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    }
  } catch (error) {
    console.error("[Locale] Failed to fetch exchange rate:", error)
    return {
      rate: FALLBACK_EXCHANGE_RATE,
      source: "fallback",
      fetchedAt: new Date(),
    }
  }
}

/**
 * KRW를 USD로 변환 (fallback 환율)
 *
 * 주의: 이 함수는 API 응답 전 초기 렌더링용입니다.
 * 실제 결제에는 서버에서 검증한 금액을 사용합니다.
 *
 * Fallback 환율: 1 USD = 1,450 KRW (서버와 동일)
 */
export function convertKRWtoUSD(krwAmount: number, rate?: number): number {
  const exchangeRate = rate ?? FALLBACK_EXCHANGE_RATE
  // 소수점 둘째자리까지 (센트 단위)
  return Math.round((krwAmount / exchangeRate) * 100) / 100
}

/**
 * 환율 소스 표시 문자열
 */
export function getExchangeRateSourceLabel(source: ExchangeRateInfo["source"]): string {
  switch (source) {
    case "naver":
      return "네이버 환율 API"
    case "api":
    case "realtime":
      return "실시간 환율"
    case "cache":
    case "cached":
      return "캐시"
    case "manual":
      return "수동 설정"
    case "fallback":
      return "기본값"
    default:
      return source
  }
}

/**
 * 가격을 통화에 맞게 포맷팅
 */
export function formatPrice(amount: number, currency: "KRW" | "USD"): string {
  if (currency === "KRW") {
    return `₩${amount.toLocaleString()}`
  }
  return `$${amount.toFixed(2)}`
}

/**
 * 결제 수단 정보
 */
export const PAYMENT_METHODS = {
  TOSS: {
    id: "TOSS",
    name: "카드결제",
    nameEn: "Card (Korea)",
    description: "한국 신용/체크카드",
    currency: "KRW" as const,
    icon: "💳",
  },
  PAYPAL: {
    id: "PAYPAL",
    name: "PayPal",
    nameEn: "PayPal",
    description: "International payments",
    currency: "USD" as const,
    icon: "🅿️",
  },
} as const
