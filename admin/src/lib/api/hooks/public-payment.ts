/**
 * Public Payment Hooks
 *
 * PG 심사용 결제 테스트 페이지에서 사용하는 hooks
 * - 인증 불필요 (publicApiFetch 사용)
 * - tanstack query 사용
 * - 백엔드에서 amount/amountUSD 직접 제공 (프론트 변환 불필요)
 */

import { useQuery } from "@tanstack/react-query"
import { publicApiFetch } from "../client"

// ============================================================================
// Types
// ============================================================================

export type PlanPriceInfo = {
  currency: string
  amount: number // minor unit (원, 센트)
  displayAmount: string // "₩9,900", "$9.99"
  isCalculated: boolean // true = 환율 계산, false = DB 저장값
}

/**
 * 백엔드에서 직접 제공하는 요금제 타입
 * - amount/amountUSD: 프론트엔드에서 바로 사용 가능
 * - prices: 모든 통화 가격 배열 (상세 정보용)
 */
export type BillingPlan = {
  id: string
  productId: string
  name: string
  description: string | null
  billingInterval: "day" | "week" | "month" | "year" | null
  intervalCount: number | null
  isActive: boolean
  product?: {
    id: string
    name: string
    tier: string
    description: string | null
  }
  prices: PlanPriceInfo[]
  // 백엔드에서 직접 제공 (변환 불필요)
  amount: number // KRW 금액
  amountUSD: number // USD 금액 (센트 단위)
  displayAmount: string // "₩9,900"
  displayAmountUSD: string // "$9.99"
}

export type BillingPlansResponse = {
  plans: BillingPlan[]
}

export type ExchangeRateResponse = {
  baseCurrency: string
  targetCurrency: string
  rate: number
  source: "realtime" | "cached" | "manual" | "fallback"
  timestamp: string
}

export type PaymentVerifyResponse = {
  success: boolean
  data: {
    id: string
    status: string
    amount: { total: number }
    method?: { type: string }
    paidAt?: string
  }
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchPublicBillingPlans(
  currencies: string[] = ["KRW", "USD"],
  activeOnly = true,
): Promise<BillingPlansResponse> {
  const currencyParam = currencies.join(",")
  return publicApiFetch<BillingPlansResponse>(
    `/api/v1/billing/pricing/plans?currencies=${currencyParam}&activeOnly=${activeOnly}`,
  )
}

async function fetchExchangeRate(base = "USD", target = "KRW"): Promise<ExchangeRateResponse> {
  return publicApiFetch<ExchangeRateResponse>(
    `/api/v1/billing/exchange-rates?base=${base}&target=${target}`,
  )
}

async function verifyPaymentPublic(paymentId: string): Promise<PaymentVerifyResponse> {
  // 결제 검증은 인증 필요하지만, 테스트 페이지에서는 조회만 함
  return publicApiFetch<PaymentVerifyResponse>(`/api/v1/payments/${paymentId}`)
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * 요금제 목록 조회 (Public)
 *
 * 백엔드에서 amount/amountUSD/displayAmount/displayAmountUSD 직접 제공
 * - 프론트엔드에서 데이터 변환 불필요
 * - 무한 루프 발생 원인 제거
 */
export function usePublicBillingPlans(currencies: string[] = ["KRW", "USD"], activeOnly = true) {
  return useQuery({
    queryKey: ["public", "billing", "plans", currencies, activeOnly],
    queryFn: () => fetchPublicBillingPlans(currencies, activeOnly),
    staleTime: 5 * 60 * 1000, // 5분
    retry: 2,
    // 백엔드에서 직접 제공하므로 select 불필요
    select: (data) => data.plans,
  })
}

/**
 * 환율 조회 (Public)
 */
export function usePublicExchangeRate(base = "USD", target = "KRW") {
  return useQuery({
    queryKey: ["public", "billing", "exchange-rate", base, target],
    queryFn: () => fetchExchangeRate(base, target),
    staleTime: 10 * 60 * 1000, // 10분
    retry: 2,
  })
}

/**
 * 결제 검증 조회 (Public - read only)
 */
export function usePublicPaymentVerify(paymentId: string | null) {
  return useQuery({
    queryKey: ["public", "payment", "verify", paymentId],
    queryFn: () => verifyPaymentPublic(paymentId as string),
    enabled: !!paymentId,
    staleTime: 0, // 항상 최신 데이터
    retry: 1,
  })
}
