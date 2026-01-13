/**
 * Payment API Types
 *
 * PortOne V2 결제 통합 관련 타입 정의
 */

// ============================================================================
// Payment Types
// ============================================================================

export type PaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "PARTIAL_CANCELLED"
  | "READY"
  | "VIRTUAL_ACCOUNT_ISSUED"

export type PaymentMethodType =
  | "CARD"
  | "VIRTUAL_ACCOUNT"
  | "TRANSFER"
  | "MOBILE"
  | "GIFT_CERTIFICATE"
  | "EASY_PAY"

export type PaymentAmount = {
  total: number
  taxFree?: number
  vat?: number
  supply?: number
  discount?: number
  paid?: number
  cancelled?: number
  cancelledTaxFree?: number
}

export type PaymentMethod = {
  type: PaymentMethodType
  card?: {
    issuer?: string
    acquirer?: string
    number?: string
    installmentMonth?: number
    isInterestFree?: boolean
    approvalNumber?: string
  }
  easyPay?: {
    provider?: string
  }
}

export type Payment = {
  id: string
  transactionId?: string
  merchantId?: string
  storeId?: string
  channel?: {
    type: string
    id: string
    key: string
    name: string
  }
  status: PaymentStatus
  amount: PaymentAmount
  currency: string
  method?: PaymentMethod
  requestedAt?: string
  paidAt?: string
  cancelledAt?: string
  failedAt?: string
  customData?: string
  customer?: {
    id?: string
    name?: string
    email?: string
    phoneNumber?: string
  }
  orderName?: string
}

// ============================================================================
// API Requests
// ============================================================================

export type PaymentCompleteRequest = {
  paymentId: string
  workspaceId: string
  planId: string
  amount?: number // USD 결제 시 센트 단위
  currency?: "KRW" | "USD"
}

export type PaymentCancelRequest = {
  reason: string
}

// ============================================================================
// API Responses
// ============================================================================

/**
 * 결제 완료 API 응답
 * 백엔드 payment.routes.ts L335-360 구조와 일치
 */
export type PaymentCompleteResponse = {
  success: boolean
  message?: string
  code?: string
  data?: {
    subscriptionId: string
    paymentId: string
    status: string
    plan: {
      id: string
      name: string
      amount: number
    }
    product: {
      id: string
      name: string
      tier: string
    } | null
    currentPeriodEnd: string | null
  }
}

export type PaymentResponse = {
  success: boolean
  data?: Payment
  message?: string
  code?: string
}

/**
 * 결제 취소 API 응답
 * 백엔드 payment.routes.ts L511-518 구조와 일치
 */
export type PaymentCancelResponse = {
  success: boolean
  message?: string
  code?: string
  data?: {
    paymentId: string
    cancellationId?: string
    subscriptionCancelled: boolean
  }
}

// ============================================================================
// Pricing Types
// ============================================================================

/**
 * 요금제 가격 정보
 * 백엔드 pricing.service.ts PlanPriceInfo와 일치
 */
export type PlanPrice = {
  currency: string
  amount: number
  displayAmount: string
  isCalculated: boolean
}

export type PricingPlan = {
  id: string
  productId: string
  name: string
  description: string | null
  currency: string
  amount: number
  planType: "one_time" | "recurring"
  billingInterval: "day" | "week" | "month" | "year" | null
  intervalCount: number
  trialDays: number
  isActive: boolean
  isDefault: boolean
  product: {
    id: string
    name: string
    tier: string
    features: string[]
  }
  prices: PlanPrice[]
}

export type PricingPlansResponse = {
  plans: PricingPlan[]
}

// ============================================================================
// Exchange Rate Types
// ============================================================================

export type ExchangeRateSource = "cache" | "naver" | "api" | "fallback"

/**
 * 환율 정보
 * 백엔드 exchange-rate.service.ts ExchangeRateResult와 일치
 *
 * 주의: 백엔드에서 Date 객체로 반환하지만 JSON 직렬화 시 ISO 문자열로 변환됨
 */
export type ExchangeRate = {
  rate: number
  source: ExchangeRateSource
  fetchedAt: string // ISO 8601 문자열 (JSON 직렬화됨)
  expiresAt?: string // ISO 8601 문자열 (JSON 직렬화됨)
}

export type ConvertCurrencyResponse = {
  from: {
    currency: string
    amount: number
  }
  to: {
    currency: string
    amount: number
  }
}
