/**
 * Payment API Hooks
 *
 * PortOne V2 결제 통합을 위한 TanStack Query hooks
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { exchangeRateApi, paymentApi, pricingApi } from "../services/payment"
import type { PaymentCancelRequest, PaymentCompleteRequest } from "../types/payment"
import { billingKeys } from "./billing"

// ============================================================================
// Query Keys
// ============================================================================

export const paymentKeys = {
  all: ["payment"] as const,
  detail: (paymentId: string) => [...paymentKeys.all, "detail", paymentId] as const,

  // Pricing
  pricing: () => ["pricing"] as const,
  pricingPlans: (currencies: string[], activeOnly: boolean) =>
    [...paymentKeys.pricing(), "plans", { currencies, activeOnly }] as const,

  // Exchange Rate
  exchangeRate: () => ["exchangeRate"] as const,
  exchangeRateDetail: (baseCurrency: string, targetCurrency: string) =>
    [...paymentKeys.exchangeRate(), baseCurrency, targetCurrency] as const,
}

// ============================================================================
// Payment Queries & Mutations
// ============================================================================

/**
 * 결제 정보 조회
 */
export function usePayment(paymentId: string, enabled = true) {
  return useQuery({
    queryKey: paymentKeys.detail(paymentId),
    queryFn: () => paymentApi.get(paymentId),
    enabled: enabled && !!paymentId,
    staleTime: 30 * 1000, // 30초
    gcTime: 5 * 60 * 1000, // 5분
    retry: 2,
  })
}

/**
 * 결제 완료 처리
 *
 * 에러 처리:
 * - INVALID_PAYMENT: 결제 정보 불일치
 * - PAYMENT_NOT_FOUND: 결제 정보 없음
 * - PAYMENT_FAILED: 포트원 결제 실패
 * - CONFLICT: 중복 결제 요청
 * - WORKSPACE_ACCESS_DENIED: 워크스페이스 접근 권한 없음
 */
export function usePaymentComplete() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: PaymentCompleteRequest) => paymentApi.complete(data),
    onSuccess: (response, variables) => {
      // 결제 성공 시 관련 캐시 갱신
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.paymentId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })

      if (response.success) {
        toast.success("결제가 완료되었습니다")
      }
    },
    onError: (error: Error) => {
      // 서버에서 전달된 에러 메시지 표시
      const message = getPaymentErrorMessage(error)
      toast.error(message)
    },
  })
}

/**
 * 결제 취소
 *
 * 에러 처리:
 * - PAYMENT_NOT_FOUND: 결제 정보 없음
 * - CANCEL_FAILED: 포트원 취소 실패
 * - ALREADY_CANCELLED: 이미 취소된 결제
 */
export function usePaymentCancel() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ paymentId, data }: { paymentId: string; data: PaymentCancelRequest }) =>
      paymentApi.cancel(paymentId, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.paymentId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.subscriptions() })

      if (response.success) {
        toast.success("결제가 취소되었습니다")
      }
    },
    onError: (error: Error) => {
      const message = getPaymentErrorMessage(error)
      toast.error(message)
    },
  })
}

// ============================================================================
// Pricing Queries
// ============================================================================

/**
 * 다중 통화 요금제 목록 조회
 *
 * - KRW, USD 가격 포함
 * - DB 저장 가격 우선, 없으면 환율로 계산
 */
export function usePricingPlans(currencies: string[] = ["KRW", "USD"], activeOnly = true) {
  return useQuery({
    queryKey: paymentKeys.pricingPlans(currencies, activeOnly),
    queryFn: () => pricingApi.getPlans(currencies, activeOnly),
    staleTime: 5 * 60 * 1000, // 5분
    gcTime: 30 * 60 * 1000, // 30분
  })
}

// ============================================================================
// Exchange Rate Queries
// ============================================================================

/**
 * 환율 조회
 *
 * - 네이버 환율 API (1순위)
 * - 1시간 캐시
 */
export function useExchangeRate(baseCurrency = "USD", targetCurrency = "KRW") {
  return useQuery({
    queryKey: paymentKeys.exchangeRateDetail(baseCurrency, targetCurrency),
    queryFn: () => exchangeRateApi.get(baseCurrency, targetCurrency),
    staleTime: 30 * 60 * 1000, // 30분 (서버 캐시가 1시간)
    gcTime: 60 * 60 * 1000, // 1시간
  })
}

// ============================================================================
// Error Handling Helpers
// ============================================================================

/**
 * 결제 에러 메시지 변환
 *
 * 서버 응답 코드를 사용자 친화적 메시지로 변환
 */
function getPaymentErrorMessage(error: Error): string {
  const message = error.message || ""

  // 서버에서 전달된 한글 메시지가 있으면 그대로 사용
  if (isKoreanMessage(message)) {
    return message
  }

  // 에러 코드별 메시지 매핑
  const errorMessages: Record<string, string> = {
    INVALID_PAYMENT: "결제 정보가 일치하지 않습니다",
    PAYMENT_NOT_FOUND: "결제 정보를 찾을 수 없습니다",
    PAYMENT_FAILED: "결제 처리에 실패했습니다",
    PAYMENT_AMOUNT_MISMATCH: "결제 금액이 일치하지 않습니다",
    PAYMENT_CURRENCY_MISMATCH: "결제 통화가 일치하지 않습니다",
    CONFLICT: "이미 처리 중인 결제입니다",
    WORKSPACE_ACCESS_DENIED: "워크스페이스 접근 권한이 없습니다",
    PLAN_NOT_FOUND: "요금제를 찾을 수 없습니다",
    ALREADY_CANCELLED: "이미 취소된 결제입니다",
    CANCEL_FAILED: "결제 취소에 실패했습니다",
    PORTONE_API_ERROR: "결제 서버 연결에 실패했습니다",
    TIMEOUT: "요청 시간이 초과되었습니다",
  }

  // 에러 코드 추출 시도
  for (const [code, msg] of Object.entries(errorMessages)) {
    if (message.includes(code)) {
      return msg
    }
  }

  return message || "결제 처리 중 오류가 발생했습니다"
}

/**
 * 한글 메시지 여부 확인
 */
function isKoreanMessage(message: string): boolean {
  return /[가-힣]/.test(message)
}

// ============================================================================
// Payment Error Types (for documentation)
// ============================================================================

/**
 * 포트원 V2 결제 에러 코드
 *
 * @see https://developers.portone.io/api/rest-v2/error
 */
export const PORTONE_ERROR_CODES = {
  // 결제 상태 관련
  PAYMENT_NOT_FOUND: "결제 건을 찾을 수 없음",
  PAYMENT_NOT_PAID: "결제가 완료되지 않음",
  ALREADY_PAID: "이미 결제 완료됨",
  ALREADY_CANCELLED: "이미 취소됨",

  // 금액/통화 관련
  AMOUNT_MISMATCH: "금액 불일치",
  CURRENCY_MISMATCH: "통화 불일치",

  // 취소 관련
  CANCEL_AMOUNT_EXCEEDED: "취소 가능 금액 초과",
  CANCEL_NOT_ALLOWED: "취소 불가 상태",

  // PG사 관련
  PG_PROVIDER_ERROR: "PG사 오류",
  UNAUTHORIZED: "인증 실패",
  FORBIDDEN: "권한 없음",
} as const
