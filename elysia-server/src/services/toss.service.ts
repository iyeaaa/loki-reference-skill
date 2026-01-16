/**
 * TossPayments Service
 *
 * 토스페이먼츠 공식 API 연동 서비스
 * - 결제 승인 (confirm)
 * - 결제 조회
 * - 결제 취소
 * - 웹훅 시그니처 검증
 */

import { createHmac } from "node:crypto"
import { eq } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import { subscriptions } from "../db/schema/billing"
import logger from "../utils/logger"
import * as billingService from "./billing.service"

const TOSS_API_BASE = "https://api.tosspayments.com/v1"

// ============================================================================
// Types
// ============================================================================

export interface TossPayment {
  paymentKey: string
  orderId: string
  orderName: string
  status:
    | "READY"
    | "IN_PROGRESS"
    | "WAITING_FOR_DEPOSIT"
    | "DONE"
    | "CANCELED"
    | "PARTIAL_CANCELED"
    | "ABORTED"
    | "EXPIRED"
  totalAmount: number
  balanceAmount: number
  suppliedAmount: number
  vat: number
  taxFreeAmount: number
  method?:
    | "카드"
    | "가상계좌"
    | "간편결제"
    | "휴대폰"
    | "계좌이체"
    | "문화상품권"
    | "도서문화상품권"
    | "게임문화상품권"
  requestedAt: string
  approvedAt?: string
  useEscrow: boolean
  cultureExpense: boolean
  card?: {
    company: string
    number: string
    installmentPlanMonths: number
    isInterestFree: boolean
    interestPayer?: string
    approveNo: string
    useCardPoint: boolean
    cardType: "신용" | "체크" | "기프트" | "미확인"
    ownerType: "개인" | "법인" | "미확인"
    acquireStatus: string
  }
  virtualAccount?: {
    accountNumber: string
    accountType: "일반" | "고정"
    bank: string
    customerName: string
    dueDate: string
    expired: boolean
    settlementStatus: string
  }
  transfer?: {
    bank: string
    settlementStatus: string
  }
  mobilePhone?: {
    carrier: string
    customerMobilePhone: string
    settlementStatus: string
  }
  easyPay?: {
    provider: string
    amount: number
    discountAmount: number
  }
  cancels?: Array<{
    cancelAmount: number
    cancelReason: string
    taxFreeAmount: number
    taxExemptionAmount: number
    refundableAmount: number
    easyPayDiscountAmount: number
    canceledAt: string
    transactionKey: string
  }>
  receipt?: {
    url: string
  }
  secret?: string
  type: "NORMAL" | "BILLING" | "BRANDPAY"
  country: string
  failure?: {
    code: string
    message: string
  }
  currency: string
  discount?: {
    amount: number
  }
}

export interface TossWebhookPayload {
  eventType:
    | "PAYMENT_STATUS_CHANGED"
    | "PAYOUT_STATUS_CHANGED"
    | "CASH_RECEIPT_ISSUE_COMPLETED"
    | "CASH_RECEIPT_CANCEL_COMPLETED"
  createdAt: string
  data: {
    paymentKey?: string
    orderId?: string
    status?: string
    transactionKey?: string
    secret?: string
  }
}

export interface PaymentConfirmResult {
  success: boolean
  payment?: TossPayment
  error?: string
  errorCode?: string
}

export interface PaymentCancelResult {
  success: boolean
  payment?: TossPayment
  error?: string
  errorCode?: string
}

// ============================================================================
// Billing Types (정기결제/빌링)
// ============================================================================

export interface TossBillingKey {
  mId: string
  customerKey: string
  billingKey: string
  authenticatedAt: string
  method: string
  cardCompany?: string
  cardNumber?: string
  card?: {
    issuerCode: string
    acquirerCode: string
    number: string
    cardType: "신용" | "체크" | "기프트" | "미확인"
    ownerType: "개인" | "법인" | "미확인"
  }
}

export interface IssueBillingKeyResult {
  success: boolean
  billingKey?: TossBillingKey
  error?: string
  errorCode?: string
}

export interface BillingPaymentResult {
  success: boolean
  payment?: TossPayment
  error?: string
  errorCode?: string
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * TossPayments API 인증 헤더 생성
 * Basic {base64(secretKey:)}
 */
function getAuthHeader(): string {
  const encoded = Buffer.from(`${config.toss.secretKey}:`).toString("base64")
  return `Basic ${encoded}`
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 결제 승인 API
 *
 * 프론트엔드에서 결제 인증 완료 후 반드시 호출해야 함
 * 10분 이내에 호출하지 않으면 결제가 만료됨
 */
export async function confirmPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
): Promise<PaymentConfirmResult> {
  if (!config.toss.secretKey) {
    logger.error("[Toss] Secret Key not configured")
    return { success: false, error: "Secret Key not configured", errorCode: "CONFIG_ERROR" }
  }

  try {
    const response = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(15_000), // 15초 타임아웃
    })

    if (!response.ok) {
      let error: { code?: string; message?: string }
      try {
        error = (await response.json()) as { code?: string; message?: string }
      } catch {
        error = { code: `HTTP_${response.status}`, message: response.statusText }
      }
      logger.error({ error, paymentKey, orderId }, "[Toss] Confirm failed")
      return {
        success: false,
        error: error.message || "결제 승인에 실패했습니다.",
        errorCode: error.code,
      }
    }

    const payment = (await response.json()) as TossPayment
    logger.info(
      {
        paymentKey,
        orderId,
        amount: payment.totalAmount,
        method: payment.method,
        status: payment.status,
      },
      "[Toss] Payment confirmed successfully",
    )

    return { success: true, payment }
  } catch (error) {
    logger.error({ error, paymentKey, orderId }, "[Toss] Confirm API error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "결제 승인 중 오류가 발생했습니다.",
      errorCode: "API_ERROR",
    }
  }
}

/**
 * 결제 조회 API
 */
export async function getPayment(paymentKey: string): Promise<TossPayment | null> {
  if (!config.toss.secretKey) {
    logger.error("[Toss] Secret Key not configured")
    return null
  }

  try {
    const response = await fetch(`${TOSS_API_BASE}/payments/${encodeURIComponent(paymentKey)}`, {
      headers: {
        Authorization: getAuthHeader(),
      },
      signal: AbortSignal.timeout(10_000), // 10초 타임아웃
    })

    if (!response.ok) {
      let error: unknown
      try {
        error = await response.json()
      } catch {
        error = { status: response.status, statusText: response.statusText }
      }
      logger.error({ error, paymentKey }, "[Toss] Failed to get payment")
      return null
    }

    return (await response.json()) as TossPayment
  } catch (error) {
    logger.error({ error, paymentKey }, "[Toss] API error")
    return null
  }
}

/**
 * orderId로 결제 조회 API
 */
export async function getPaymentByOrderId(orderId: string): Promise<TossPayment | null> {
  if (!config.toss.secretKey) {
    logger.error("[Toss] Secret Key not configured")
    return null
  }

  try {
    const response = await fetch(
      `${TOSS_API_BASE}/payments/orders/${encodeURIComponent(orderId)}`,
      {
        headers: {
          Authorization: getAuthHeader(),
        },
        signal: AbortSignal.timeout(10_000),
      },
    )

    if (!response.ok) {
      let error: unknown
      try {
        error = await response.json()
      } catch {
        error = { status: response.status, statusText: response.statusText }
      }
      logger.error({ error, orderId }, "[Toss] Failed to get payment by orderId")
      return null
    }

    return (await response.json()) as TossPayment
  } catch (error) {
    logger.error({ error, orderId }, "[Toss] API error")
    return null
  }
}

/**
 * 결제 취소 API
 */
export async function cancelPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount?: number,
): Promise<PaymentCancelResult> {
  if (!config.toss.secretKey) {
    return { success: false, error: "Secret Key not configured", errorCode: "CONFIG_ERROR" }
  }

  try {
    const body: Record<string, unknown> = { cancelReason }
    if (cancelAmount !== undefined) {
      body.cancelAmount = cancelAmount
    }

    const response = await fetch(
      `${TOSS_API_BASE}/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000), // 15초 타임아웃
      },
    )

    if (!response.ok) {
      let error: { code?: string; message?: string }
      try {
        error = (await response.json()) as { code?: string; message?: string }
      } catch {
        error = { code: `HTTP_${response.status}`, message: response.statusText }
      }
      logger.error({ error, paymentKey, cancelReason }, "[Toss] Failed to cancel payment")
      return {
        success: false,
        error: error.message || "결제 취소에 실패했습니다.",
        errorCode: error.code,
      }
    }

    const payment = (await response.json()) as TossPayment
    logger.info({ paymentKey, cancelReason, status: payment.status }, "[Toss] Payment cancelled")

    return { success: true, payment }
  } catch (error) {
    logger.error({ error, paymentKey }, "[Toss] Cancel API error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "결제 취소 중 오류가 발생했습니다.",
      errorCode: "API_ERROR",
    }
  }
}

// ============================================================================
// Billing API Functions (정기결제/빌링)
// ============================================================================

/**
 * 빌링키 발급 API
 *
 * 프론트엔드에서 requestBillingAuth() 완료 후 리다이렉트된 authKey로 빌링키 발급
 * - authKey는 5분간 유효
 * - 빌링키는 한 번 발급 후 재조회 불가 (반드시 저장 필요)
 */
export async function issueBillingKey(
  authKey: string,
  customerKey: string,
): Promise<IssueBillingKeyResult> {
  if (!config.toss.secretKey) {
    logger.error("[Toss] Secret Key not configured")
    return { success: false, error: "Secret Key not configured", errorCode: "CONFIG_ERROR" }
  }

  try {
    const response = await fetch(`${TOSS_API_BASE}/billing/authorizations/issue`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ authKey, customerKey }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!response.ok) {
      let error: { code?: string; message?: string }
      try {
        error = (await response.json()) as { code?: string; message?: string }
      } catch {
        error = { code: `HTTP_${response.status}`, message: response.statusText }
      }
      logger.error({ error, customerKey }, "[Toss] Issue billing key failed")
      return {
        success: false,
        error: error.message || "빌링키 발급에 실패했습니다.",
        errorCode: error.code,
      }
    }

    const billingKey = (await response.json()) as TossBillingKey
    logger.info(
      {
        customerKey,
        billingKey: billingKey.billingKey,
        cardCompany: billingKey.cardCompany,
        cardNumber: billingKey.cardNumber,
      },
      "[Toss] Billing key issued successfully",
    )

    return { success: true, billingKey }
  } catch (error) {
    logger.error({ error, customerKey }, "[Toss] Issue billing key API error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "빌링키 발급 중 오류가 발생했습니다.",
      errorCode: "API_ERROR",
    }
  }
}

/**
 * 빌링키로 자동결제 요청 API
 *
 * 저장된 빌링키로 구매자 인증 없이 결제 요청
 * - 정기결제, 재결제 등에 사용
 */
export async function requestBillingPayment(
  billingKey: string,
  customerKey: string,
  amount: number,
  orderId: string,
  orderName: string,
  customerEmail?: string,
  customerName?: string,
): Promise<BillingPaymentResult> {
  if (!config.toss.secretKey) {
    logger.error("[Toss] Secret Key not configured")
    return { success: false, error: "Secret Key not configured", errorCode: "CONFIG_ERROR" }
  }

  try {
    const response = await fetch(`${TOSS_API_BASE}/billing/${encodeURIComponent(billingKey)}`, {
      method: "POST",
      headers: {
        Authorization: getAuthHeader(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customerKey,
        amount,
        orderId,
        orderName,
        customerEmail,
        customerName,
      }),
      signal: AbortSignal.timeout(30_000), // 결제 처리는 더 긴 타임아웃
    })

    if (!response.ok) {
      let error: { code?: string; message?: string }
      try {
        error = (await response.json()) as { code?: string; message?: string }
      } catch {
        error = { code: `HTTP_${response.status}`, message: response.statusText }
      }
      logger.error({ error, billingKey, orderId }, "[Toss] Billing payment failed")
      return {
        success: false,
        error: error.message || "자동결제에 실패했습니다.",
        errorCode: error.code,
      }
    }

    const payment = (await response.json()) as TossPayment
    logger.info(
      {
        billingKey,
        orderId,
        amount: payment.totalAmount,
        status: payment.status,
      },
      "[Toss] Billing payment completed",
    )

    return { success: true, payment }
  } catch (error) {
    logger.error({ error, billingKey, orderId }, "[Toss] Billing payment API error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "자동결제 중 오류가 발생했습니다.",
      errorCode: "API_ERROR",
    }
  }
}

// ============================================================================
// Webhook Functions
// ============================================================================

/**
 * 웹훅 시그니처 검증
 *
 * TossPayments 웹훅은 두 가지 검증 방식을 제공:
 * 1. secret 값 비교 (결제 응답의 secret과 웹훅의 data.secret 비교)
 * 2. HMAC-SHA256 시그니처 검증 (지급대행 웹훅)
 *
 * @security 프로덕션 환경에서는 webhookSecret이 필수입니다.
 */
export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!config.toss.webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      logger.error("[Toss] SECURITY: Webhook secret not configured in production - rejecting")
      return false
    }
    logger.warn("[Toss] Webhook secret not configured (development only) - skipping verification")
    return true
  }

  if (!signature) {
    logger.warn("[Toss] No signature provided")
    return false
  }

  const expected = createHmac("sha256", config.toss.webhookSecret).update(payload).digest("base64")

  const isValid = signature === expected

  if (!isValid) {
    logger.warn(
      {
        expected: `${expected.substring(0, 10)}...`,
        received: `${signature?.substring(0, 10)}...`,
      },
      "[Toss] Webhook signature mismatch",
    )
  }

  return isValid
}

/**
 * 웹훅 secret 값 검증 (결제 완료 웹훅용)
 *
 * 결제 승인 응답에 포함된 secret 값과 웹훅의 data.secret 값을 비교
 */
export function verifyWebhookSecret(webhookSecret: string, paymentSecret: string): boolean {
  return webhookSecret === paymentSecret
}

/**
 * 웹훅 이벤트 처리
 */
export async function handleWebhookEvent(
  event: TossWebhookPayload,
): Promise<{ success: boolean; message: string }> {
  const { eventType, data, createdAt } = event

  logger.info({ eventType, data, createdAt }, "[Toss] Webhook event received")

  switch (eventType) {
    case "PAYMENT_STATUS_CHANGED":
      return handlePaymentStatusChanged(data)

    case "CASH_RECEIPT_ISSUE_COMPLETED":
      logger.info({ data }, "[Toss] Cash receipt issued")
      return { success: true, message: "Cash receipt processed" }

    case "CASH_RECEIPT_CANCEL_COMPLETED":
      logger.info({ data }, "[Toss] Cash receipt cancelled")
      return { success: true, message: "Cash receipt cancellation processed" }

    default:
      logger.info({ eventType }, "[Toss] Unhandled webhook event type")
      return { success: true, message: `Unhandled event type: ${eventType}` }
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handlePaymentStatusChanged(
  data: TossWebhookPayload["data"],
): Promise<{ success: boolean; message: string }> {
  const { paymentKey, orderId } = data

  if (!paymentKey || !orderId) {
    return { success: false, message: "Missing paymentKey or orderId" }
  }

  // 결제 정보 조회
  const payment = await getPayment(paymentKey)

  if (!payment) {
    return { success: false, message: "Payment not found" }
  }

  logger.info(
    {
      paymentKey,
      orderId,
      status: payment.status,
      amount: payment.totalAmount,
      method: payment.method,
    },
    "[Toss] Payment status changed via webhook",
  )

  // 결제 완료 (DONE)
  if (payment.status === "DONE") {
    // orderId로 연결된 구독 찾기
    const linkedSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.externalSubscriptionId, orderId))
      .limit(1)

    if (linkedSubscription[0]) {
      const sub = linkedSubscription[0]

      // 이미 처리된 결제
      if (sub.status === "active") {
        logger.info({ paymentKey, subscriptionId: sub.id }, "[Toss] Payment already processed")
        return { success: true, message: "Payment already processed" }
      }

      // 구독 활성화
      await billingService.updateSubscription(
        sub.id,
        {
          status: "active",
          metadata: {
            ...(sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}),
            webhookConfirmed: true,
            webhookReceivedAt: new Date().toISOString(),
            tossPaymentKey: paymentKey,
          },
        },
        undefined,
        "Payment confirmed via Toss webhook",
      )

      logger.info(
        { paymentKey, subscriptionId: sub.id },
        "[Toss] Subscription activated via webhook",
      )
      return { success: true, message: "Subscription activated" }
    }

    // 구독이 없는 경우 (프론트엔드에서 아직 처리 안됨)
    logger.warn(
      { paymentKey, orderId },
      "[Toss] No subscription found for payment - waiting for frontend completion",
    )
    return { success: true, message: "Payment logged, awaiting subscription creation" }
  }

  // 결제 취소 (CANCELED, PARTIAL_CANCELED)
  if (payment.status === "CANCELED" || payment.status === "PARTIAL_CANCELED") {
    const linkedSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.externalSubscriptionId, orderId))
      .limit(1)

    if (linkedSubscription[0]) {
      const sub = linkedSubscription[0]

      await billingService.cancelSubscription(
        sub.id,
        `Payment cancelled (paymentKey: ${paymentKey})`,
      )

      logger.info(
        { paymentKey, subscriptionId: sub.id },
        "[Toss] Subscription cancelled via webhook",
      )
    }

    return { success: true, message: "Cancellation processed" }
  }

  // 기타 상태
  logger.info({ paymentKey, status: payment.status }, "[Toss] Payment status noted")
  return { success: true, message: `Payment status: ${payment.status}` }
}
