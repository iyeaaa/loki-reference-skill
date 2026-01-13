/**
 * PortOne Payment Service
 *
 * 포트원 V2 API 연동 서비스
 * - 결제 조회 및 검증
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

const PORTONE_API_BASE = "https://api.portone.io"

// ============================================================================
// Types
// ============================================================================

export interface PortOnePayment {
  id: string
  status:
    | "PENDING"
    | "VIRTUAL_ACCOUNT_ISSUED"
    | "PAID"
    | "FAILED"
    | "CANCELLED"
    | "PARTIAL_CANCELLED"
  transactionId?: string
  merchantId: string
  storeId: string
  channel?: {
    id: string
    key: string
    name: string
    pgProvider: string
    pgMerchantId: string
  }
  amount: {
    total: number
    taxFree: number
    vat: number
    supply: number
    discount: number
    paid: number
    cancelled: number
    cancelledTaxFree: number
  }
  currency: string
  method?: {
    type: "CARD" | "TRANSFER" | "VIRTUAL_ACCOUNT" | "MOBILE" | "EASY_PAY" | "GIFT_CERTIFICATE"
    card?: {
      publisher: string
      issuer: string
      brand: string
      type: string
      ownerType: string
      bin: string
      number: string
      approvalNumber: string
      installment: {
        month: number
        isInterestFree: boolean
      }
    }
    easyPay?: {
      provider: string
    }
  }
  customer?: {
    id?: string
    name?: string
    email?: string
    phoneNumber?: string
  }
  requestedAt?: string
  paidAt?: string
  pgTxId?: string
  receiptUrl?: string
  orderName?: string
  customData?: string
}

export interface PortOneWebhookPayload {
  type:
    | "Transaction.Paid"
    | "Transaction.VirtualAccountIssued"
    | "Transaction.Cancelled"
    | "Transaction.PartialCancelled"
    | "Transaction.Failed"
    | "Transaction.PayPending"
    | "BillingKey.Issued"
    | "BillingKey.Deleted"
  timestamp: string
  data: {
    paymentId?: string
    transactionId?: string
    billingKey?: string
    storeId?: string
    cancellationId?: string
  }
}

export interface PaymentVerificationResult {
  verified: boolean
  payment?: PortOnePayment
  error?: string
}

export interface PaymentCancelResult {
  success: boolean
  cancellationId?: string
  error?: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 포트원 결제 조회 API
 */
export async function getPayment(paymentId: string): Promise<PortOnePayment | null> {
  if (!config.portone.apiSecret) {
    logger.error("[PortOne] API Secret not configured")
    return null
  }

  try {
    const response = await fetch(`${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}`, {
      headers: {
        Authorization: `PortOne ${config.portone.apiSecret}`,
      },
      signal: AbortSignal.timeout(10_000), // 10초 타임아웃
    })

    if (!response.ok) {
      // 503 HTML 응답 등 JSON 파싱 실패 대비
      let error: unknown
      try {
        error = await response.json()
      } catch {
        error = { status: response.status, statusText: response.statusText }
      }
      logger.error({ error, paymentId }, "[PortOne] Failed to get payment")
      return null
    }

    return (await response.json()) as PortOnePayment
  } catch (error) {
    logger.error({ error, paymentId }, "[PortOne] API error")
    return null
  }
}

/**
 * 결제 검증
 * - 결제 상태 확인 (PAID)
 * - 금액 일치 확인
 * - 통화 일치 확인
 */
export async function verifyPayment(
  paymentId: string,
  expectedAmount: number,
  expectedCurrency?: string,
): Promise<PaymentVerificationResult> {
  const payment = await getPayment(paymentId)

  if (!payment) {
    return { verified: false, error: "결제 정보를 찾을 수 없습니다" }
  }

  if (payment.status !== "PAID") {
    return {
      verified: false,
      payment,
      error: `결제가 완료되지 않았습니다 (상태: ${payment.status})`,
    }
  }

  if (payment.amount.total !== expectedAmount) {
    logger.warn(
      { paymentId, expected: expectedAmount, actual: payment.amount.total },
      "[PortOne] Amount mismatch detected",
    )
    return {
      verified: false,
      payment,
      error: `결제 금액이 일치하지 않습니다 (${payment.amount.total} !== ${expectedAmount})`,
    }
  }

  // 통화 검증 (Defense in Depth)
  if (expectedCurrency && payment.currency !== expectedCurrency) {
    logger.warn(
      { paymentId, expected: expectedCurrency, actual: payment.currency },
      "[PortOne] Currency mismatch detected",
    )
    return {
      verified: false,
      payment,
      error: `결제 통화가 일치하지 않습니다 (${payment.currency} !== ${expectedCurrency})`,
    }
  }

  logger.info(
    {
      paymentId,
      amount: payment.amount.total,
      currency: payment.currency,
      method: payment.method?.type,
    },
    "[PortOne] Payment verified successfully",
  )

  return { verified: true, payment }
}

/**
 * 결제 취소
 */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  amount?: number, // 부분 취소 시 취소 금액
): Promise<PaymentCancelResult> {
  if (!config.portone.apiSecret) {
    return { success: false, error: "API Secret not configured" }
  }

  try {
    const body: Record<string, unknown> = { reason }
    if (amount !== undefined) {
      body.amount = amount
    }

    const response = await fetch(
      `${PORTONE_API_BASE}/payments/${encodeURIComponent(paymentId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${config.portone.apiSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000), // 15초 타임아웃 (취소는 좀 더 여유있게)
      },
    )

    if (!response.ok) {
      // 503 HTML 응답 등 JSON 파싱 실패 대비
      let errorData: { message?: string }
      try {
        errorData = (await response.json()) as { message?: string }
      } catch {
        errorData = { message: `HTTP ${response.status}: ${response.statusText}` }
      }
      logger.error({ error: errorData, paymentId, reason }, "[PortOne] Failed to cancel payment")
      return { success: false, error: errorData.message || "Cancel failed" }
    }

    const result = (await response.json()) as { cancellationId?: string }
    logger.info(
      { paymentId, reason, cancellationId: result.cancellationId },
      "[PortOne] Payment cancelled",
    )

    return { success: true, cancellationId: result.cancellationId }
  } catch (error) {
    logger.error({ error, paymentId }, "[PortOne] Cancel API error")
    return { success: false, error: String(error) }
  }
}

// ============================================================================
// Webhook Functions
// ============================================================================

/**
 * 웹훅 시그니처 검증
 *
 * 포트원 V2 웹훅은 x-portone-signature 헤더에 HMAC-SHA256 시그니처를 포함
 *
 * @security 프로덕션 환경에서는 webhookSecret이 필수입니다.
 *           설정되지 않으면 모든 웹훅을 거부합니다.
 */
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!config.portone.webhookSecret) {
    // 프로덕션에서는 webhookSecret 필수 - 없으면 거부
    if (process.env.NODE_ENV === "production") {
      logger.error(
        "[PortOne] SECURITY: Webhook secret not configured in production - rejecting all webhooks",
      )
      return false
    }
    // 개발 환경에서만 경고 후 통과
    logger.warn(
      "[PortOne] Webhook secret not configured (development only) - skipping verification",
    )
    return true
  }

  const expected = createHmac("sha256", config.portone.webhookSecret).update(payload).digest("hex")

  const isValid = signature === expected

  if (!isValid) {
    logger.warn(
      {
        expected: `${expected.substring(0, 10)}...`,
        received: `${signature?.substring(0, 10)}...`,
      },
      "[PortOne] Webhook signature mismatch",
    )
  }

  return isValid
}

/**
 * 웹훅 이벤트 타입별 처리 함수
 */
export async function handleWebhookEvent(
  event: PortOneWebhookPayload,
): Promise<{ success: boolean; message: string }> {
  const { type, data, timestamp } = event

  logger.info({ type, data, timestamp }, "[PortOne] Webhook event received")

  switch (type) {
    case "Transaction.Paid":
      return handlePaymentPaid(data)

    case "Transaction.VirtualAccountIssued":
      return handleVirtualAccountIssued(data)

    case "Transaction.Cancelled":
    case "Transaction.PartialCancelled":
      return handlePaymentCancelled(data)

    case "Transaction.Failed":
      return handlePaymentFailed(data)

    case "BillingKey.Issued":
      return handleBillingKeyIssued(data)

    case "BillingKey.Deleted":
      return handleBillingKeyDeleted(data)

    default:
      logger.info({ type }, "[PortOne] Unhandled webhook event type")
      return { success: true, message: `Unhandled event type: ${type}` }
  }
}

// ============================================================================
// Event Handlers
// ============================================================================

async function handlePaymentPaid(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { paymentId, transactionId } = data

  if (!paymentId) {
    return { success: false, message: "Missing paymentId" }
  }

  // 결제 정보 조회
  const payment = await getPayment(paymentId)

  if (!payment) {
    return { success: false, message: "Payment not found" }
  }

  logger.info(
    {
      paymentId,
      transactionId,
      amount: payment.amount.total,
      method: payment.method?.type,
      customer: payment.customer?.email,
    },
    "[PortOne] Payment completed via webhook",
  )

  // 연결된 구독 찾기 (externalSubscriptionId = paymentId)
  const linkedSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.externalSubscriptionId, paymentId))
    .limit(1)

  if (linkedSubscription[0]) {
    // 이미 처리된 결제 (프론트엔드에서 먼저 처리됨)
    const sub = linkedSubscription[0]
    if (sub.status === "active") {
      logger.info({ paymentId, subscriptionId: sub.id }, "[PortOne] Payment already processed")
      return { success: true, message: "Payment already processed" }
    }

    // 구독 활성화 (trialing → active)
    await billingService.updateSubscription(
      sub.id,
      {
        status: "active",
        metadata: {
          // typeof null === "object" 이슈 대비 명시적 null 체크
          ...(sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}),
          webhookConfirmed: true,
          webhookReceivedAt: new Date().toISOString(),
        },
      },
      undefined,
      "Payment confirmed via webhook",
    )

    logger.info(
      { paymentId, subscriptionId: sub.id },
      "[PortOne] Subscription activated via webhook",
    )
    return { success: true, message: "Subscription activated" }
  }

  // 구독이 없는 경우 (프론트엔드에서 아직 처리 안됨)
  // 웹훅이 먼저 도착한 경우 - 로그만 남기고 프론트엔드 처리 대기
  logger.warn(
    { paymentId },
    "[PortOne] No subscription found for payment - waiting for frontend completion",
  )

  return { success: true, message: "Payment logged, awaiting subscription creation" }
}

async function handleVirtualAccountIssued(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { paymentId } = data

  if (!paymentId) {
    return { success: false, message: "Missing paymentId" }
  }

  // 가상계좌 정보 조회
  const payment = await getPayment(paymentId)

  if (!payment) {
    return { success: false, message: "Payment not found" }
  }

  logger.info(
    {
      paymentId,
      amount: payment.amount.total,
    },
    "[PortOne] Virtual account issued",
  )

  // TODO: 가상계좌 정보 저장 및 사용자에게 안내 메일 발송

  return { success: true, message: "Virtual account processed" }
}

async function handlePaymentCancelled(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { paymentId, cancellationId } = data

  if (!paymentId) {
    return { success: false, message: "Missing paymentId" }
  }

  logger.info({ paymentId, cancellationId }, "[PortOne] Payment cancelled via webhook")

  // 연결된 구독 찾기
  const linkedSubscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.externalSubscriptionId, paymentId))
    .limit(1)

  if (linkedSubscription[0]) {
    const sub = linkedSubscription[0]

    // 구독 취소 처리
    await billingService.cancelSubscription(
      sub.id,
      `Payment cancelled (cancellationId: ${cancellationId})`,
    )

    logger.info(
      { paymentId, subscriptionId: sub.id, cancellationId },
      "[PortOne] Subscription cancelled via webhook",
    )
  }

  return { success: true, message: "Cancellation processed" }
}

async function handlePaymentFailed(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { paymentId } = data

  if (!paymentId) {
    return { success: false, message: "Missing paymentId" }
  }

  logger.warn({ paymentId }, "[PortOne] Payment failed")

  // TODO: 결제 실패 처리 (사용자 알림 등)

  return { success: true, message: "Failure logged" }
}

async function handleBillingKeyIssued(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { billingKey } = data

  logger.info({ billingKey }, "[PortOne] Billing key issued (for recurring payments)")

  // TODO: 정기결제용 빌링키 저장

  return { success: true, message: "Billing key processed" }
}

async function handleBillingKeyDeleted(data: PortOneWebhookPayload["data"]): Promise<{
  success: boolean
  message: string
}> {
  const { billingKey } = data

  logger.info({ billingKey }, "[PortOne] Billing key deleted")

  // TODO: 정기결제 해지 처리

  return { success: true, message: "Billing key deletion processed" }
}
