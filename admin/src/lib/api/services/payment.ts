/**
 * Payment API Services
 *
 * PortOne V2 결제 통합 API 호출 함수
 */

import { apiFetch } from "@/lib/api/client"
import type {
  ConvertCurrencyResponse,
  ExchangeRate,
  PaymentCancelRequest,
  PaymentCancelResponse,
  PaymentCompleteRequest,
  PaymentCompleteResponse,
  PaymentResponse,
  PricingPlansResponse,
} from "../types/payment"

// ============================================================================
// Payment API
// ============================================================================

export const paymentApi = {
  /**
   * 결제 완료 처리
   * - 포트원 결제 검증
   * - 구독 생성/업데이트
   * - Idempotency 보장
   */
  complete: (data: PaymentCompleteRequest) =>
    apiFetch<PaymentCompleteResponse>("/api/v1/payments/complete", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * 결제 조회
   * - 포트원 API를 통해 결제 정보 조회
   */
  get: (paymentId: string) => apiFetch<PaymentResponse>(`/api/v1/payments/${paymentId}`),

  /**
   * 결제 취소
   * - 포트원 결제 취소
   * - 연결된 구독 상태 업데이트
   */
  cancel: (paymentId: string, data: PaymentCancelRequest) =>
    apiFetch<PaymentCancelResponse>(`/api/v1/payments/${paymentId}/cancel`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
}

// ============================================================================
// Pricing API
// ============================================================================

export const pricingApi = {
  /**
   * 다중 통화 요금제 목록 조회
   * - KRW, USD 가격 포함
   * - 환율 기반 자동 계산 or DB 저장 가격
   */
  getPlans: (currencies: string[] = ["KRW", "USD"], activeOnly = true) =>
    apiFetch<PricingPlansResponse>(
      `/api/v1/billing/pricing/plans?currencies=${currencies.join(",")}&activeOnly=${activeOnly}`,
    ),
}

// ============================================================================
// Exchange Rate API
// ============================================================================

export const exchangeRateApi = {
  /**
   * 환율 조회
   * - 네이버 환율 API (1순위)
   * - ExchangeRate-API (2순위)
   * - DB 캐시 (1시간 TTL)
   */
  get: (baseCurrency = "USD", targetCurrency = "KRW") =>
    apiFetch<ExchangeRate>(
      `/api/v1/billing/exchange-rates?base=${baseCurrency}&target=${targetCurrency}`,
    ),

  /**
   * 통화 변환
   */
  convert: (amount: number, fromCurrency: string, toCurrency: string) =>
    apiFetch<ConvertCurrencyResponse>(
      `/api/v1/billing/exchange-rates/convert?amount=${amount}&from=${fromCurrency}&to=${toCurrency}`,
    ),
}
