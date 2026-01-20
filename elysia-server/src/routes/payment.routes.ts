/**
 * Payment Routes
 *
 * TossPayments 공식 API 결제 관련 엔드포인트
 * - 결제 승인 (confirm)
 * - 결제 조회
 * - 결제 취소
 *
 * 보안:
 * - 모든 라우트는 인증 필요 (permission-guard에서 처리)
 * - 워크스페이스 소유권 검증
 * - Idempotency 체크로 중복 결제 방지
 *
 * TossPayments 결제 흐름:
 * 1. 프론트엔드에서 SDK로 결제 인증
 * 2. 인증 완료 후 successUrl로 리다이렉트 (paymentKey, orderId, amount 파라미터 포함)
 * 3. 프론트엔드에서 /api/v1/payments/confirm 호출
 * 4. 백엔드에서 TossPayments confirm API 호출 (실제 결제 승인)
 * 5. 승인 성공 시 구독 생성
 */

import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { billingKeys, billingPlans, billingProducts, subscriptions } from "../db/schema/billing"
import { workspaceMembers } from "../db/schema/workspaces"
import redisConnection from "../lib/redis/connection"
import * as billingService from "../services/billing.service"
import * as tossService from "../services/toss.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Idempotency key prefix and TTL (24 hours)
const IDEMPOTENCY_PREFIX = "payment:idempotency:"
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24

// Distributed lock prefix and TTL (30 seconds)
const LOCK_PREFIX = "payment:lock:"
const LOCK_TTL_SECONDS = 30

/**
 * Check if payment is already processed (idempotency)
 */
async function checkIdempotency(orderId: string): Promise<{ exists: boolean; result?: unknown }> {
  try {
    if (redisConnection.status !== "ready") return { exists: false }

    const cached = await redisConnection.get(`${IDEMPOTENCY_PREFIX}${orderId}`)
    if (cached) {
      return { exists: true, result: JSON.parse(cached) }
    }
    return { exists: false }
  } catch (error) {
    logger.warn({ error, orderId }, "[Payment] Idempotency check failed, proceeding")
    return { exists: false }
  }
}

/**
 * Store idempotency result
 */
async function setIdempotency(orderId: string, result: unknown): Promise<void> {
  try {
    if (redisConnection.status !== "ready") return

    await redisConnection.setex(
      `${IDEMPOTENCY_PREFIX}${orderId}`,
      IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify(result),
    )
  } catch (error) {
    logger.warn({ error, orderId }, "[Payment] Failed to store idempotency result")
  }
}

/**
 * Acquire distributed lock for payment processing
 * Prevents race condition between frontend /confirm and webhook
 */
async function acquireLock(orderId: string): Promise<boolean> {
  try {
    if (redisConnection.status !== "ready") {
      logger.warn({ orderId }, "[Payment] Redis not ready, proceeding without lock")
      return true
    }

    // SETNX with TTL - returns 'OK' if lock acquired, null if already exists
    const result = await redisConnection.set(
      `${LOCK_PREFIX}${orderId}`,
      Date.now().toString(),
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    )

    if (result === "OK") {
      logger.debug({ orderId }, "[Payment] Lock acquired")
      return true
    }

    logger.info({ orderId }, "[Payment] Lock already held by another process")
    return false
  } catch (error) {
    logger.warn({ error, orderId }, "[Payment] Lock acquisition failed, proceeding")
    return true
  }
}

/**
 * Release distributed lock
 */
async function releaseLock(orderId: string): Promise<void> {
  try {
    if (redisConnection.status !== "ready") return
    await redisConnection.del(`${LOCK_PREFIX}${orderId}`)
    logger.debug({ orderId }, "[Payment] Lock released")
  } catch (error) {
    logger.warn({ error, orderId }, "[Payment] Failed to release lock")
  }
}

/**
 * Verify user has access to workspace
 */
async function verifyWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
  const members = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)))
    .limit(1)

  return members.length > 0
}

/**
 * Public Payment Routes (인증 불필요)
 *
 * PG 심사용 공개 결제 테스트 엔드포인트
 * - pg-test-* prefix orderId만 허용
 * - 구독 생성 없이 결제 확인만 수행
 */
/**
 * Public Billing Routes (인증 불필요)
 *
 * PG 심사용 공개 빌링키 발급/조회 엔드포인트
 * - pg-test prefix만 허용
 * - 정기결제(빌링) 테스트용
 */
export const publicBillingRoutes = new Elysia({ prefix: "/api/v1/public/billing" })
  /**
   * 빌링키 발급
   *
   * 프론트엔드에서 requestBillingAuth() 완료 후 리다이렉트된 authKey로 빌링키 발급
   * - 토스페이먼츠 API 호출 후 DB에 저장
   */
  .post(
    "/issue-key",
    async ({ body, set }) => {
      const { authKey, customerKey } = body

      logger.info({ customerKey }, "[Billing:Public] Processing billing key issuance")

      // 1. 이미 발급된 빌링키가 있는지 확인 (중복 방지)
      const existingKey = await db
        .select()
        .from(billingKeys)
        .where(eq(billingKeys.customerKey, customerKey))
        .limit(1)

      if (existingKey[0]) {
        logger.info({ customerKey }, "[Billing:Public] Billing key already exists")
        return {
          success: true,
          data: {
            billingKey: existingKey[0].billingKey,
            customerKey: existingKey[0].customerKey,
            cardCompany: existingKey[0].cardCompany,
            cardNumber: existingKey[0].cardNumber,
            authenticatedAt: existingKey[0].authenticatedAt?.toISOString(),
          },
        }
      }

      // 2. TossPayments 빌링키 발급 API 호출
      const result = await tossService.issueBillingKey(authKey, customerKey)

      if (!result.success || !result.billingKey) {
        logger.error(
          { customerKey, error: result.error },
          "[Billing:Public] Billing key issuance failed",
        )
        set.status = 400
        return errorResponse(
          result.error || "빌링키 발급에 실패했습니다.",
          ResponseCode.BAD_REQUEST,
        )
      }

      const billingKeyData = result.billingKey

      // 3. DB에 빌링키 저장
      try {
        await db.insert(billingKeys).values({
          customerKey: billingKeyData.customerKey,
          billingKey: billingKeyData.billingKey,
          cardCompany: billingKeyData.cardCompany,
          cardNumber: billingKeyData.cardNumber,
          cardType: billingKeyData.card?.cardType,
          ownerType: billingKeyData.card?.ownerType,
          authenticatedAt: billingKeyData.authenticatedAt
            ? new Date(billingKeyData.authenticatedAt)
            : new Date(),
          metadata: {
            mId: billingKeyData.mId,
            method: billingKeyData.method,
            card: billingKeyData.card,
          },
        })

        logger.info(
          { customerKey, billingKey: billingKeyData.billingKey },
          "[Billing:Public] Billing key saved to DB",
        )
      } catch (dbError) {
        logger.error(
          { customerKey, error: dbError },
          "[Billing:Public] Failed to save billing key to DB",
        )
        // DB 저장 실패해도 발급은 성공했으므로 결과는 반환
      }

      // 4. 성공 결과 반환
      const successResult = {
        success: true,
        data: {
          billingKey: billingKeyData.billingKey,
          customerKey: billingKeyData.customerKey,
          cardCompany: billingKeyData.cardCompany,
          cardNumber: billingKeyData.cardNumber,
          authenticatedAt: billingKeyData.authenticatedAt,
          card: billingKeyData.card,
        },
      }

      logger.info(
        { customerKey, billingKey: billingKeyData.billingKey },
        "[Billing:Public] Billing key issued successfully",
      )
      return successResult
    },
    {
      body: t.Object({
        authKey: t.String({ minLength: 1, maxLength: 500 }),
        customerKey: t.String({ minLength: 1, maxLength: 200 }),
      }),
    },
  )
  /**
   * 빌링키 정보 조회
   *
   * DB에 저장된 빌링키 정보 조회
   * - 토스페이먼츠는 빌링키 재조회 API를 제공하지 않음
   * - 발급 시 저장된 정보만 조회 가능
   */
  .get(
    "/:billingKeyParam",
    async ({ params: { billingKeyParam }, set }) => {
      logger.info({ billingKey: billingKeyParam }, "[Billing:Public] Billing key lookup requested")

      // DB에서 빌링키 조회
      const savedKey = await db
        .select()
        .from(billingKeys)
        .where(eq(billingKeys.billingKey, billingKeyParam))
        .limit(1)

      if (!savedKey[0]) {
        set.status = 404
        return errorResponse("빌링키를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      const keyData = savedKey[0]

      return {
        success: true,
        data: {
          id: keyData.id,
          billingKey: keyData.billingKey,
          customerKey: keyData.customerKey,
          cardCompany: keyData.cardCompany,
          cardNumber: keyData.cardNumber,
          cardType: keyData.cardType,
          ownerType: keyData.ownerType,
          authenticatedAt: keyData.authenticatedAt?.toISOString(),
          isActive: keyData.isActive,
          createdAt: keyData.createdAt.toISOString(),
        },
      }
    },
    {
      params: t.Object({
        billingKeyParam: t.String({
          minLength: 10,
          maxLength: 300,
        }),
      }),
    },
  )
  /**
   * 빌링키 비활성화 (결제 중단)
   *
   * 정기결제 중단용 - soft delete 방식
   * - isActive = false로 설정
   * - Worker에서 해당 빌링키로 결제하지 않음
   */
  .post(
    "/:billingKeyParam/deactivate",
    async ({ params: { billingKeyParam }, set }) => {
      logger.info({ billingKey: billingKeyParam }, "[Billing:Public] Deactivating billing key")

      // DB에서 빌링키 조회
      const savedKey = await db
        .select()
        .from(billingKeys)
        .where(eq(billingKeys.billingKey, billingKeyParam))
        .limit(1)

      if (!savedKey[0]) {
        set.status = 404
        return errorResponse("빌링키를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      if (!savedKey[0].isActive) {
        return {
          success: true,
          message: "빌링키가 이미 비활성화 상태입니다.",
          data: {
            billingKey: billingKeyParam,
            isActive: false,
          },
        }
      }

      // 비활성화
      await db
        .update(billingKeys)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(billingKeys.billingKey, billingKeyParam))

      logger.info({ billingKey: billingKeyParam }, "[Billing:Public] Billing key deactivated")

      return {
        success: true,
        message: "빌링키가 비활성화되었습니다. 정기결제가 중단됩니다.",
        data: {
          billingKey: billingKeyParam,
          isActive: false,
        },
      }
    },
    {
      params: t.Object({
        billingKeyParam: t.String({
          minLength: 10,
          maxLength: 300,
        }),
      }),
    },
  )
  /**
   * 빌링키 재활성화
   *
   * 비활성화된 빌링키 다시 활성화
   */
  .post(
    "/:billingKeyParam/reactivate",
    async ({ params: { billingKeyParam }, set }) => {
      logger.info({ billingKey: billingKeyParam }, "[Billing:Public] Reactivating billing key")

      // DB에서 빌링키 조회
      const savedKey = await db
        .select()
        .from(billingKeys)
        .where(eq(billingKeys.billingKey, billingKeyParam))
        .limit(1)

      if (!savedKey[0]) {
        set.status = 404
        return errorResponse("빌링키를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      if (savedKey[0].isActive) {
        return {
          success: true,
          message: "빌링키가 이미 활성화 상태입니다.",
          data: {
            billingKey: billingKeyParam,
            isActive: true,
          },
        }
      }

      // 재활성화
      await db
        .update(billingKeys)
        .set({
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(billingKeys.billingKey, billingKeyParam))

      logger.info({ billingKey: billingKeyParam }, "[Billing:Public] Billing key reactivated")

      return {
        success: true,
        message: "빌링키가 재활성화되었습니다. 정기결제가 재개됩니다.",
        data: {
          billingKey: billingKeyParam,
          isActive: true,
        },
      }
    },
    {
      params: t.Object({
        billingKeyParam: t.String({
          minLength: 10,
          maxLength: 300,
        }),
      }),
    },
  )
  /**
   * 수동 결제 테스트
   *
   * 테스트용 - 빌링키로 즉시 결제 요청
   * - 정기결제 Worker를 거치지 않고 바로 결제
   */
  .post(
    "/:billingKeyParam/charge",
    async ({ params: { billingKeyParam }, body, set }) => {
      const { amount, orderName } = body

      logger.info(
        { billingKey: billingKeyParam, amount, orderName },
        "[Billing:Public] Manual charge request",
      )

      // DB에서 빌링키 조회
      const savedKey = await db
        .select()
        .from(billingKeys)
        .where(eq(billingKeys.billingKey, billingKeyParam))
        .limit(1)

      if (!savedKey[0]) {
        set.status = 404
        return errorResponse("빌링키를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      const keyData = savedKey[0]

      if (!keyData.isActive) {
        set.status = 400
        return errorResponse(
          "비활성화된 빌링키입니다. 결제를 진행하려면 먼저 재활성화하세요.",
          ResponseCode.BAD_REQUEST,
        )
      }

      // 고유 orderId 생성
      const orderId = `manual-${Date.now()}`

      // TossPayments 빌링 결제 요청
      const result = await tossService.requestBillingPayment(
        keyData.billingKey,
        keyData.customerKey,
        amount,
        orderId,
        orderName || "수동 테스트 결제",
      )

      if (!result.success || !result.payment) {
        logger.error(
          { billingKey: billingKeyParam, error: result.error },
          "[Billing:Public] Manual charge failed",
        )
        set.status = 400
        return errorResponse(result.error || "결제에 실패했습니다.", ResponseCode.BAD_REQUEST)
      }

      logger.info(
        {
          billingKey: billingKeyParam,
          orderId,
          paymentKey: result.payment.paymentKey,
          amount: result.payment.totalAmount,
        },
        "[Billing:Public] Manual charge successful",
      )

      return {
        success: true,
        message: "결제가 성공적으로 완료되었습니다.",
        data: {
          paymentKey: result.payment.paymentKey,
          orderId,
          amount: result.payment.totalAmount,
          status: result.payment.status,
          method: result.payment.method,
          approvedAt: result.payment.approvedAt,
          card: result.payment.card
            ? {
                company: result.payment.card.company,
                number: result.payment.card.number,
              }
            : undefined,
        },
      }
    },
    {
      params: t.Object({
        billingKeyParam: t.String({
          minLength: 10,
          maxLength: 300,
        }),
      }),
      body: t.Object({
        amount: t.Number({ minimum: 100 }), // 최소 100원
        orderName: t.Optional(t.String({ maxLength: 100 })),
      }),
    },
  )

export const publicPaymentRoutes = new Elysia({ prefix: "/api/v1/public/payments" })
  /**
   * 공개 결제 승인 (PG 심사용)
   *
   * - pg-test-* orderId만 허용
   * - 구독 생성 없이 TossPayments confirm만 수행
   */
  .post(
    "/confirm",
    async ({ body, set }) => {
      const { paymentKey, orderId, amount } = body

      logger.info(
        { paymentKey, orderId, amount },
        "[Payment:Public] Processing public payment confirmation",
      )

      // 1. orderId prefix 검증 - pg-test-* 만 허용
      if (!orderId.startsWith("pg-test-")) {
        logger.warn({ orderId }, "[Payment:Public] Invalid orderId prefix for public confirm")
        set.status = 403
        return errorResponse(
          "공개 결제 확인은 pg-test- prefix 주문만 허용됩니다.",
          ResponseCode.FORBIDDEN,
        )
      }

      // 2. Idempotency 체크
      const { exists, result } = await checkIdempotency(orderId)
      if (exists) {
        logger.info({ orderId }, "[Payment:Public] Returning cached result")
        return result
      }

      try {
        // 3. TossPayments 결제 승인 API 호출
        const confirmResult = await tossService.confirmPayment(paymentKey, orderId, amount)

        if (!confirmResult.success || !confirmResult.payment) {
          logger.error(
            { paymentKey, orderId, error: confirmResult.error },
            "[Payment:Public] TossPayments confirm failed",
          )
          set.status = 400
          return errorResponse(
            confirmResult.error || "결제 승인에 실패했습니다.",
            ResponseCode.BAD_REQUEST,
          )
        }

        const payment = confirmResult.payment

        // 4. 결제 상태 확인
        if (payment.status !== "DONE") {
          set.status = 400
          return errorResponse(
            `결제가 완료되지 않았습니다. (상태: ${payment.status})`,
            ResponseCode.BAD_REQUEST,
          )
        }

        // 5. 금액 검증
        if (payment.totalAmount !== amount) {
          logger.error(
            { paymentKey, orderId, expected: amount, actual: payment.totalAmount },
            "[Payment:Public] Amount mismatch",
          )
          await tossService.cancelPayment(paymentKey, "금액 불일치로 인한 자동 취소")
          set.status = 400
          return errorResponse("결제 금액이 일치하지 않습니다.", ResponseCode.BAD_REQUEST)
        }

        // 6. 성공 결과 (구독 생성 없음)
        const successResult = {
          success: true,
          data: {
            paymentKey,
            orderId,
            status: payment.status,
            totalAmount: payment.totalAmount,
            method: payment.method,
            approvedAt: payment.approvedAt,
            receiptUrl: payment.receipt?.url,
            card: payment.card
              ? {
                  company: payment.card.company,
                  number: payment.card.number,
                  cardType: payment.card.cardType,
                }
              : undefined,
          },
        }

        await setIdempotency(orderId, successResult)

        logger.info({ paymentKey, orderId }, "[Payment:Public] Payment confirmed successfully")
        return successResult
      } catch (error) {
        logger.error({ error, paymentKey, orderId }, "[Payment:Public] Unexpected error")
        set.status = 500
        return errorResponse("결제 처리 중 오류가 발생했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: t.Object({
        paymentKey: t.String({ minLength: 1, maxLength: 200 }),
        orderId: t.String({ minLength: 6, maxLength: 64, pattern: "^[a-zA-Z0-9_-]+$" }),
        amount: t.Number({ minimum: 0 }),
      }),
    },
  )
  /**
   * 공개 결제 조회
   */
  .get(
    "/:paymentKey",
    async ({ params: { paymentKey }, set }) => {
      const payment = await tossService.getPayment(paymentKey)

      if (!payment) {
        set.status = 404
        return errorResponse("결제 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // pg-test-* orderId만 공개 조회 허용
      if (!payment.orderId.startsWith("pg-test-")) {
        set.status = 403
        return errorResponse("공개 조회는 테스트 결제만 허용됩니다.", ResponseCode.FORBIDDEN)
      }

      return {
        success: true,
        data: payment,
      }
    },
    {
      params: t.Object({
        paymentKey: t.String({
          minLength: 10,
          maxLength: 200,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
      }),
    },
  )

export const paymentRoutes = new Elysia({ prefix: "/api/v1/payments" })
  // Derive userId from authorization header
  .derive(async ({ headers }) => {
    const { getUserIdFromToken } = await import("../utils/auth.util")
    const authorization = headers.authorization
    const userId = await getUserIdFromToken(authorization)
    return { userId }
  })
  /**
   * 결제 승인 (TossPayments Confirm API)
   *
   * 프론트엔드에서 TossPayments SDK 인증 완료 후 호출
   * - 10분 이내에 호출해야 함 (만료 시 결제 실패)
   *
   * 1. Idempotency 체크 (중복 결제 방지)
   * 2. 워크스페이스 접근 권한 검증
   * 3. TossPayments confirm API 호출 (실제 결제 승인!)
   * 4. 금액 검증
   * 5. 구독 생성 또는 활성화
   */
  .post(
    "/confirm",
    async ({ body, set, userId }) => {
      const { paymentKey, orderId, amount, planId, workspaceId, customerId } = body

      logger.info(
        { paymentKey, orderId, amount, planId, workspaceId, userId },
        "[Payment] Processing payment confirmation",
      )

      // 1. 인증 확인
      if (!userId) {
        logger.warn({ orderId }, "[Payment] Unauthorized payment attempt")
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      // 2. customerId 검증 - 현재 로그인한 사용자와 일치해야 함
      if (customerId !== userId) {
        logger.warn(
          { orderId, userId, customerId },
          "[Payment] customerId mismatch with authenticated user",
        )
        set.status = 403
        return errorResponse("결제 요청자 정보가 일치하지 않습니다.", ResponseCode.FORBIDDEN)
      }

      // 3. Idempotency 체크 - 이미 처리된 결제인지 확인
      const { exists, result } = await checkIdempotency(orderId)
      if (exists) {
        logger.info({ orderId }, "[Payment] Duplicate payment request - returning cached result")
        return result
      }

      // 4. 분산 락 획득 (Race Condition 방지)
      const lockAcquired = await acquireLock(orderId)
      if (!lockAcquired) {
        logger.info({ orderId }, "[Payment] Another process is handling this payment")

        // Exponential Backoff: 1초 → 2초 → 4초 (최대 3회)
        const delays = [1000, 2000, 4000]
        for (const delay of delays) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          const { exists: existsAfterWait, result: resultAfterWait } =
            await checkIdempotency(orderId)
          if (existsAfterWait) {
            logger.info({ orderId, delay }, "[Payment] Found result after backoff wait")
            return resultAfterWait
          }
        }

        set.status = 409
        return errorResponse(
          "결제가 처리 중입니다. 잠시 후 다시 시도해주세요.",
          ResponseCode.CONFLICT,
        )
      }

      try {
        // 5. 워크스페이스 접근 권한 검증
        const hasAccess = await verifyWorkspaceAccess(userId, workspaceId)
        if (!hasAccess) {
          logger.warn({ orderId, userId, workspaceId }, "[Payment] Workspace access denied")
          set.status = 403
          return errorResponse("해당 워크스페이스에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
        }

        // 6. Plan 정보 조회
        const plan = await db
          .select({
            plan: billingPlans,
            product: billingProducts,
          })
          .from(billingPlans)
          .leftJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
          .where(eq(billingPlans.id, planId))
          .limit(1)

        if (!plan[0]) {
          logger.warn({ planId }, "[Payment] Plan not found")
          set.status = 400
          return errorResponse("요금제를 찾을 수 없습니다.", ResponseCode.BAD_REQUEST)
        }

        const { plan: billingPlan, product } = plan[0]

        // 7. TossPayments 결제 승인 API 호출 (핵심!)
        logger.info(
          { paymentKey, orderId, amount, planAmount: billingPlan.amount },
          "[Payment] Calling TossPayments confirm API",
        )

        const confirmResult = await tossService.confirmPayment(paymentKey, orderId, amount)

        if (!confirmResult.success || !confirmResult.payment) {
          logger.error(
            { paymentKey, orderId, error: confirmResult.error, errorCode: confirmResult.errorCode },
            "[Payment] TossPayments confirm failed",
          )
          set.status = 400
          return errorResponse(
            confirmResult.error || "결제 승인에 실패했습니다.",
            ResponseCode.BAD_REQUEST,
          )
        }

        const payment = confirmResult.payment

        // 8. 결제 상태 확인
        if (payment.status !== "DONE") {
          logger.error(
            { paymentKey, orderId, status: payment.status },
            "[Payment] Payment not completed",
          )
          set.status = 400
          return errorResponse(
            `결제가 완료되지 않았습니다. (상태: ${payment.status})`,
            ResponseCode.BAD_REQUEST,
          )
        }

        // 9. 금액 검증
        if (payment.totalAmount !== amount) {
          logger.error(
            { paymentKey, orderId, expected: amount, actual: payment.totalAmount },
            "[Payment] Amount mismatch - cancelling payment",
          )

          // 보안: 금액 불일치 시 결제 취소
          await tossService.cancelPayment(paymentKey, "금액 불일치로 인한 자동 취소")

          set.status = 400
          return errorResponse("결제 금액이 일치하지 않습니다.", ResponseCode.BAD_REQUEST)
        }

        // 10. 기존 구독 확인 (동일 워크스페이스의 trialing/active 구독)
        const existingSubscriptions = await billingService.listSubscriptions(1, 0, {
          workspaceId,
          statuses: ["trialing", "active"],
          isPrimary: true,
        })

        let subscription:
          | Awaited<ReturnType<typeof billingService.createSubscription>>
          | null
          | undefined

        const existingSub = existingSubscriptions[0]
        if (existingSub) {
          // 기존 구독 업데이트 (trialing → active, 플랜 변경)
          subscription = await billingService.updateSubscription(
            existingSub.id,
            {
              planId,
              status: "active",
              externalSubscriptionId: orderId,
              currentPeriodStart: new Date(),
              currentPeriodEnd: calculatePeriodEnd(billingPlan),
              trialEnd: null,
              metadata: {
                ...(existingSub.metadata && typeof existingSub.metadata === "object"
                  ? existingSub.metadata
                  : {}),
                lastPayment: {
                  paymentKey,
                  orderId,
                  amount: payment.totalAmount,
                  currency: payment.currency,
                  paidAt: payment.approvedAt,
                  method: payment.method,
                  card: payment.card
                    ? {
                        company: payment.card.company,
                        number: payment.card.number,
                        cardType: payment.card.cardType,
                      }
                    : undefined,
                },
              },
            },
            userId,
            "Payment completed via TossPayments",
          )

          logger.info(
            { subscriptionId: existingSub.id, orderId, newStatus: "active" },
            "[Payment] Subscription upgraded from trial",
          )
        } else {
          // 새 구독 생성
          subscription = await billingService.createSubscription({
            workspaceId,
            customerId,
            planId,
            status: "active",
            isPrimary: true,
            externalSubscriptionId: orderId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: calculatePeriodEnd(billingPlan),
            metadata: {
              firstPayment: {
                paymentKey,
                orderId,
                amount: payment.totalAmount,
                currency: payment.currency,
                paidAt: payment.approvedAt,
                method: payment.method,
                card: payment.card
                  ? {
                      company: payment.card.company,
                      number: payment.card.number,
                      cardType: payment.card.cardType,
                    }
                  : undefined,
              },
            },
          })

          logger.info(
            { subscriptionId: subscription.id, orderId },
            "[Payment] New subscription created",
          )
        }

        // 10.5. 유료 플랜 온보딩 자동 완료 (온보딩 미완료 시)
        if (subscription?.status === "active") {
          try {
            // workspaceId로 구독 조회 → planId → productId → tier 확인
            const workspaceSubscription = await db
              .select({
                subscriptionId: subscriptions.id,
                planId: subscriptions.planId,
                tier: billingProducts.tier,
              })
              .from(subscriptions)
              .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
              .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
              .where(
                and(
                  eq(subscriptions.workspaceId, workspaceId),
                  eq(subscriptions.isPrimary, true),
                  eq(subscriptions.status, "active"),
                ),
              )
              .limit(1)

            // trial이 아닌 경우 온보딩 자동 완료
            if (workspaceSubscription[0] && workspaceSubscription[0].tier !== "trial") {
              const { onboardingProgress } = await import("../db/schema/onboarding")
              const [onboarding] = await db
                .select({ id: onboardingProgress.id, completedAt: onboardingProgress.completedAt })
                .from(onboardingProgress)
                .where(eq(onboardingProgress.workspaceId, workspaceId))
                .limit(1)

              // 온보딩이 있고, 완료되지 않았으면 자동 완료
              if (onboarding && !onboarding.completedAt) {
                await db
                  .update(onboardingProgress)
                  .set({
                    status: "completed",
                    completedAt: new Date(),
                    updatedAt: new Date(),
                  })
                  .where(eq(onboardingProgress.id, onboarding.id))

                logger.info(
                  { workspaceId, tier: workspaceSubscription[0].tier },
                  "[Payment] Auto-completed onboarding for paid subscription",
                )
              }
            }
          } catch (error) {
            // 에러가 나도 결제 프로세스는 계속 진행
            logger.error(
              { error, workspaceId },
              "[Payment] Failed to auto-complete onboarding, continuing",
            )
          }
        }

        // 11. 성공 결과 생성 및 Idempotency 저장
        const successResult = {
          success: true,
          data: {
            subscriptionId: subscription?.id,
            paymentKey,
            orderId,
            status: subscription?.status,
            plan: {
              id: billingPlan.id,
              name: billingPlan.name,
              amount: billingPlan.amount,
            },
            product: product
              ? {
                  id: product.id,
                  name: product.name,
                  tier: product.tier,
                }
              : null,
            currentPeriodEnd: subscription?.currentPeriodEnd,
            payment: {
              totalAmount: payment.totalAmount,
              method: payment.method,
              approvedAt: payment.approvedAt,
              receiptUrl: payment.receipt?.url,
            },
          },
        }

        await setIdempotency(orderId, successResult)

        return successResult
      } finally {
        await releaseLock(orderId)
      }
    },
    {
      body: t.Object({
        paymentKey: t.String({ minLength: 1, maxLength: 200 }),
        orderId: t.String({ minLength: 6, maxLength: 64, pattern: "^[a-zA-Z0-9_-]+$" }),
        amount: t.Number({ minimum: 0 }),
        planId: t.String({ format: "uuid" }),
        workspaceId: t.String({ format: "uuid" }),
        customerId: t.String({ format: "uuid" }),
      }),
    },
  )

  /**
   * 결제 정보 조회 (TossPayments API)
   *
   * 보안 정책:
   * - pg-test-* 또는 order-test-* prefix: 공개 접근 허용 (PG 심사용)
   * - 그 외: 인증 필수 + 연결된 구독의 워크스페이스 접근 권한 검증
   */
  .get(
    "/:paymentKey",
    async ({ params: { paymentKey }, set, userId }) => {
      // PG 테스트 결제는 공개 접근 허용
      const isTestPayment =
        paymentKey.startsWith("pg-test-") || paymentKey.startsWith("order-test-")

      // 실제 결제는 인증 필요
      if (!isTestPayment && !userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const payment = await tossService.getPayment(paymentKey)

      if (!payment) {
        set.status = 404
        return errorResponse("결제 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 실제 결제인 경우 소유자 검증
      if (!isTestPayment && userId) {
        // orderId로 연결된 구독 찾기
        const linkedSubscription = await db
          .select({ workspaceId: subscriptions.workspaceId })
          .from(subscriptions)
          .where(eq(subscriptions.externalSubscriptionId, payment.orderId))
          .limit(1)

        // 구독이 연결되어 있으면 워크스페이스 접근 권한 검증
        if (linkedSubscription[0]) {
          const hasAccess = await verifyWorkspaceAccess(userId, linkedSubscription[0].workspaceId)
          if (!hasAccess) {
            logger.warn({ paymentKey, userId }, "[Payment] Unauthorized payment lookup attempt")
            set.status = 403
            return errorResponse("결제 정보에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
          }
        }
      }

      return {
        success: true,
        data: payment,
      }
    },
    {
      params: t.Object({
        // paymentKey: 영문, 숫자, 하이픈, 언더스코어만 허용 (10-200자)
        paymentKey: t.String({
          minLength: 10,
          maxLength: 200,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
      }),
    },
  )

  /**
   * orderId로 결제 정보 조회
   */
  .get(
    "/orders/:orderId",
    async ({ params: { orderId }, set, userId }) => {
      // 테스트 결제는 공개 접근 허용
      const isTestPayment = orderId.startsWith("order-test-") || orderId.startsWith("pg-test-")

      if (!isTestPayment && !userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const payment = await tossService.getPaymentByOrderId(orderId)

      if (!payment) {
        set.status = 404
        return errorResponse("결제 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 실제 결제인 경우 소유자 검증
      if (!isTestPayment && userId) {
        const linkedSubscription = await db
          .select({ workspaceId: subscriptions.workspaceId })
          .from(subscriptions)
          .where(eq(subscriptions.externalSubscriptionId, orderId))
          .limit(1)

        if (linkedSubscription[0]) {
          const hasAccess = await verifyWorkspaceAccess(userId, linkedSubscription[0].workspaceId)
          if (!hasAccess) {
            set.status = 403
            return errorResponse("결제 정보에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
          }
        }
      }

      return {
        success: true,
        data: payment,
      }
    },
    {
      params: t.Object({
        orderId: t.String({
          minLength: 6,
          maxLength: 64,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
      }),
    },
  )

  /**
   * 결제 취소
   *
   * 결제 취소 및 연결된 구독 상태 업데이트
   */
  .post(
    "/:paymentKey/cancel",
    async ({ params: { paymentKey }, body, set, userId }) => {
      const { reason, cancelAmount } = body

      // 1. 인증 확인
      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      // 2. 결제 정보 조회
      const payment = await tossService.getPayment(paymentKey)
      if (!payment) {
        set.status = 404
        return errorResponse("결제 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 3. 연결된 구독 찾기 (취소 권한 확인용)
      const linkedSubscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.externalSubscriptionId, payment.orderId))
        .limit(1)

      if (linkedSubscription[0]) {
        // 4. 워크스페이스 접근 권한 확인
        const hasAccess = await verifyWorkspaceAccess(userId, linkedSubscription[0].workspaceId)
        if (!hasAccess) {
          logger.warn({ paymentKey, userId }, "[Payment] Cancel access denied")
          set.status = 403
          return errorResponse("결제 취소 권한이 없습니다.", ResponseCode.FORBIDDEN)
        }
      }

      // 5. TossPayments 결제 취소
      const result = await tossService.cancelPayment(paymentKey, reason, cancelAmount)

      if (!result.success) {
        set.status = 400
        return errorResponse(result.error || "결제 취소에 실패했습니다.", ResponseCode.BAD_REQUEST)
      }

      // 6. 연결된 구독 취소 처리 (전액 취소인 경우만)
      let subscriptionCancelled = false
      if (linkedSubscription[0] && !cancelAmount) {
        try {
          await billingService.cancelSubscription(
            linkedSubscription[0].id,
            `Payment cancelled: ${reason} (paymentKey: ${paymentKey})`,
          )
          subscriptionCancelled = true
          logger.info(
            { paymentKey, subscriptionId: linkedSubscription[0].id },
            "[Payment] Subscription cancelled with payment",
          )
        } catch (error) {
          logger.error(
            { error, paymentKey, subscriptionId: linkedSubscription[0].id },
            "[Payment] Failed to cancel subscription",
          )
        }
      }

      logger.info({ paymentKey, reason }, "[Payment] Payment cancelled")

      return {
        success: true,
        data: {
          paymentKey,
          orderId: payment.orderId,
          cancelledAmount: cancelAmount || payment.totalAmount,
          subscriptionCancelled,
        },
      }
    },
    {
      params: t.Object({
        paymentKey: t.String({
          minLength: 10,
          maxLength: 200,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
      }),
      body: t.Object({
        reason: t.String({ minLength: 1, maxLength: 500 }),
        cancelAmount: t.Optional(t.Number({ minimum: 0 })),
      }),
    },
  )

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 결제 주기에 따른 다음 결제일 계산
 */
function calculatePeriodEnd(plan: typeof billingPlans.$inferSelect): Date {
  const intervalCount = plan.intervalCount || 1

  switch (plan.billingInterval) {
    case "day": {
      const date = new Date()
      date.setDate(date.getDate() + intervalCount)
      return date
    }
    case "week": {
      const date = new Date()
      date.setDate(date.getDate() + 7 * intervalCount)
      return date
    }
    case "month": {
      const date = new Date()
      date.setMonth(date.getMonth() + intervalCount)
      return date
    }
    case "year": {
      const date = new Date()
      date.setFullYear(date.getFullYear() + intervalCount)
      return date
    }
    default: {
      const date = new Date()
      date.setMonth(date.getMonth() + 1)
      return date
    }
  }
}
