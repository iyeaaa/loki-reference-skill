/**
 * Payment Routes
 *
 * 포트원 V2 결제 관련 API 엔드포인트
 * - 결제 완료 처리 (프론트엔드 → 서버 검증)
 * - 결제 조회
 * - 결제 취소
 *
 * 보안:
 * - 모든 라우트는 인증 필요 (permission-guard에서 처리)
 * - 워크스페이스 소유권 검증
 * - Idempotency 체크로 중복 결제 방지
 */

import { and, eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { billingPlans, billingProducts, subscriptions } from "../db/schema/billing"
import { workspaceMembers } from "../db/schema/workspaces"
import redisConnection from "../lib/redis/connection"
import * as billingService from "../services/billing.service"
import * as portoneService from "../services/portone.service"
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
async function checkIdempotency(paymentId: string): Promise<{ exists: boolean; result?: unknown }> {
  try {
    if (redisConnection.status !== "ready") return { exists: false }

    const cached = await redisConnection.get(`${IDEMPOTENCY_PREFIX}${paymentId}`)
    if (cached) {
      return { exists: true, result: JSON.parse(cached) }
    }
    return { exists: false }
  } catch (error) {
    logger.warn({ error, paymentId }, "[Payment] Idempotency check failed, proceeding")
    return { exists: false }
  }
}

/**
 * Store idempotency result
 */
async function setIdempotency(paymentId: string, result: unknown): Promise<void> {
  try {
    if (redisConnection.status !== "ready") return

    await redisConnection.setex(
      `${IDEMPOTENCY_PREFIX}${paymentId}`,
      IDEMPOTENCY_TTL_SECONDS,
      JSON.stringify(result),
    )
  } catch (error) {
    logger.warn({ error, paymentId }, "[Payment] Failed to store idempotency result")
  }
}

/**
 * Acquire distributed lock for payment processing
 * Prevents race condition between frontend /complete and webhook
 */
async function acquireLock(paymentId: string): Promise<boolean> {
  try {
    if (redisConnection.status !== "ready") {
      logger.warn({ paymentId }, "[Payment] Redis not ready, proceeding without lock")
      return true
    }

    // SETNX with TTL - returns 'OK' if lock acquired, null if already exists
    const result = await redisConnection.set(
      `${LOCK_PREFIX}${paymentId}`,
      Date.now().toString(),
      "EX",
      LOCK_TTL_SECONDS,
      "NX",
    )

    if (result === "OK") {
      logger.debug({ paymentId }, "[Payment] Lock acquired")
      return true
    }

    logger.info({ paymentId }, "[Payment] Lock already held by another process")
    return false
  } catch (error) {
    logger.warn({ error, paymentId }, "[Payment] Lock acquisition failed, proceeding")
    return true
  }
}

/**
 * Release distributed lock
 */
async function releaseLock(paymentId: string): Promise<void> {
  try {
    if (redisConnection.status !== "ready") return
    await redisConnection.del(`${LOCK_PREFIX}${paymentId}`)
    logger.debug({ paymentId }, "[Payment] Lock released")
  } catch (error) {
    logger.warn({ error, paymentId }, "[Payment] Failed to release lock")
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

export const paymentRoutes = new Elysia({ prefix: "/api/v1/payments" })
  // Derive userId from authorization header
  .derive(async ({ headers }) => {
    const { getUserIdFromToken } = await import("../utils/auth.util")
    const authorization = headers.authorization
    const userId = await getUserIdFromToken(authorization)
    return { userId }
  })
  /**
   * 결제 완료 처리
   *
   * 프론트엔드에서 PortOne.requestPayment() 완료 후 호출
   * 1. Idempotency 체크 (중복 결제 방지)
   * 2. 워크스페이스 접근 권한 검증
   * 3. 포트원 API로 결제 상태/금액 검증
   * 4. 구독 생성 또는 활성화
   */
  .post(
    "/complete",
    async ({ body, set, userId }) => {
      const { paymentId, planId, workspaceId, customerId, currency, amount } = body

      logger.info(
        { paymentId, planId, workspaceId, userId },
        "[Payment] Processing payment completion",
      )

      // 1. 인증 확인
      if (!userId) {
        logger.warn({ paymentId }, "[Payment] Unauthorized payment attempt")
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      // 2. customerId 검증 - 현재 로그인한 사용자와 일치해야 함
      // (보안: 타인 명의로 구독 생성 방지)
      if (customerId !== userId) {
        logger.warn(
          { paymentId, userId, customerId },
          "[Payment] customerId mismatch with authenticated user",
        )
        set.status = 403
        return errorResponse("결제 요청자 정보가 일치하지 않습니다.", ResponseCode.FORBIDDEN)
      }

      // 3. Idempotency 체크 - 이미 처리된 결제인지 확인
      const { exists, result } = await checkIdempotency(paymentId)
      if (exists) {
        logger.info({ paymentId }, "[Payment] Duplicate payment request - returning cached result")
        return result
      }

      // 4. 분산 락 획득 (Race Condition 방지)
      // 웹훅과 /complete가 동시에 호출될 경우 중복 구독 생성 방지
      const lockAcquired = await acquireLock(paymentId)
      if (!lockAcquired) {
        // 다른 프로세스가 처리 중 - Exponential Backoff로 재시도
        logger.info({ paymentId }, "[Payment] Another process is handling this payment")

        // Exponential Backoff: 1초 → 2초 → 4초 (최대 3회)
        const delays = [1000, 2000, 4000]
        for (const delay of delays) {
          await new Promise((resolve) => setTimeout(resolve, delay))
          const { exists: existsAfterWait, result: resultAfterWait } =
            await checkIdempotency(paymentId)
          if (existsAfterWait) {
            logger.info({ paymentId, delay }, "[Payment] Found result after backoff wait")
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
          logger.warn({ paymentId, userId, workspaceId }, "[Payment] Workspace access denied")
          set.status = 403
          return errorResponse("해당 워크스페이스에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
        }

        // 6. Plan 정보 조회 (금액 검증용)
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

        // 5. 포트원 결제 검증
        // 통화 단위 규칙:
        // - KRW: 원 단위 (예: 9900 = ₩9,900)
        // - USD: 센트 단위 (예: 999 = $9.99)
        // USD 결제 시 프론트엔드에서 전송한 금액(센트) 사용, 그 외는 플랜 금액(원) 사용
        const expectedAmount =
          currency === "USD" && amount !== undefined ? amount : billingPlan.amount
        const expectedCurrency = currency || "KRW"

        logger.info(
          { paymentId, expectedAmount, expectedCurrency, planAmount: billingPlan.amount },
          "[Payment] Verifying payment",
        )

        const { verified, payment, error } = await portoneService.verifyPayment(
          paymentId,
          expectedAmount,
          expectedCurrency, // 통화 검증 추가
        )

        if (!verified) {
          logger.error({ paymentId, planId, error }, "[Payment] Verification failed")
          set.status = 400
          return errorResponse(error || "결제 검증에 실패했습니다.", ResponseCode.BAD_REQUEST)
        }

        // 6. 기존 구독 확인 (동일 워크스페이스의 trialing/active 구독)
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
              externalSubscriptionId: paymentId,
              currentPeriodStart: new Date(),
              currentPeriodEnd: calculatePeriodEnd(billingPlan),
              trialEnd: null, // 트라이얼 종료
              metadata: {
                // typeof null === "object" 이슈 대비 명시적 null 체크
                ...(existingSub.metadata && typeof existingSub.metadata === "object"
                  ? existingSub.metadata
                  : {}),
                lastPayment: {
                  paymentId,
                  amount: payment?.amount.total,
                  currency: expectedCurrency,
                  paidAt: payment?.paidAt,
                  method: payment?.method?.type,
                },
              },
            },
            userId, // changedBy - 결제한 사용자
            "Payment completed via PortOne",
          )

          logger.info(
            { subscriptionId: existingSub.id, paymentId, newStatus: "active" },
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
            externalSubscriptionId: paymentId,
            currentPeriodStart: new Date(),
            currentPeriodEnd: calculatePeriodEnd(billingPlan),
            metadata: {
              firstPayment: {
                paymentId,
                amount: payment?.amount.total,
                currency: expectedCurrency,
                paidAt: payment?.paidAt,
                method: payment?.method?.type,
              },
            },
          })

          logger.info(
            { subscriptionId: subscription.id, paymentId },
            "[Payment] New subscription created",
          )
        }

        // 8. 성공 결과 생성 및 Idempotency 저장
        const successResult = {
          success: true,
          data: {
            subscriptionId: subscription?.id,
            paymentId,
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
          },
        }

        // Idempotency 결과 저장 (중복 요청 시 같은 결과 반환)
        await setIdempotency(paymentId, successResult)

        return successResult
      } finally {
        // 락 해제 (성공/실패 모두)
        await releaseLock(paymentId)
      }
    },
    {
      body: t.Object({
        paymentId: t.String({ minLength: 1 }),
        planId: t.String({ format: "uuid" }),
        workspaceId: t.String({ format: "uuid" }),
        customerId: t.String({ format: "uuid" }),
        currency: t.Optional(t.Union([t.Literal("KRW"), t.Literal("USD")])),
        amount: t.Optional(t.Number({ minimum: 0 })),
      }),
    },
  )

  /**
   * 결제 정보 조회 (포트원 API)
   *
   * 보안 정책:
   * - pg-test-* prefix: 공개 접근 허용 (PG 심사용)
   * - 그 외: 인증 필수 + 연결된 구독의 워크스페이스 접근 권한 검증
   */
  .get(
    "/:paymentId",
    async ({ params: { paymentId }, set, userId }) => {
      // PG 테스트 결제는 공개 접근 허용
      const isTestPayment = paymentId.startsWith("pg-test-")

      // 실제 결제는 인증 필요
      if (!isTestPayment && !userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const payment = await portoneService.getPayment(paymentId)

      if (!payment) {
        set.status = 404
        return errorResponse("결제 정보를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      // 실제 결제인 경우 소유자 검증
      if (!isTestPayment && userId) {
        const linkedSubscription = await db
          .select({ workspaceId: subscriptions.workspaceId })
          .from(subscriptions)
          .where(eq(subscriptions.externalSubscriptionId, paymentId))
          .limit(1)

        // 구독이 연결되어 있으면 워크스페이스 접근 권한 검증
        if (linkedSubscription[0]) {
          const hasAccess = await verifyWorkspaceAccess(userId, linkedSubscription[0].workspaceId)
          if (!hasAccess) {
            logger.warn({ paymentId, userId }, "[Payment] Unauthorized payment lookup attempt")
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
        // paymentId: 영문, 숫자, 하이픈, 언더스코어만 허용 (10-100자)
        paymentId: t.String({
          minLength: 10,
          maxLength: 100,
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
    "/:paymentId/cancel",
    async ({ params: { paymentId }, body, set, userId }) => {
      const { reason } = body

      // 1. 인증 확인
      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      // 2. 연결된 구독 찾기 (취소 권한 확인용)
      const linkedSubscription = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.externalSubscriptionId, paymentId))
        .limit(1)

      if (linkedSubscription[0]) {
        // 3. 워크스페이스 접근 권한 확인
        const hasAccess = await verifyWorkspaceAccess(userId, linkedSubscription[0].workspaceId)
        if (!hasAccess) {
          logger.warn({ paymentId, userId }, "[Payment] Cancel access denied")
          set.status = 403
          return errorResponse("결제 취소 권한이 없습니다.", ResponseCode.FORBIDDEN)
        }
      }

      // 4. 포트원 결제 취소
      const result = await portoneService.cancelPayment(paymentId, reason)

      if (!result.success) {
        set.status = 400
        return errorResponse(result.error || "결제 취소에 실패했습니다.", ResponseCode.BAD_REQUEST)
      }

      // 5. 연결된 구독 취소 처리
      let subscriptionCancelled = false
      if (linkedSubscription[0]) {
        try {
          await billingService.cancelSubscription(
            linkedSubscription[0].id,
            `Payment cancelled: ${reason} (cancellationId: ${result.cancellationId})`,
          )
          subscriptionCancelled = true
          logger.info(
            {
              paymentId,
              subscriptionId: linkedSubscription[0].id,
              cancellationId: result.cancellationId,
            },
            "[Payment] Subscription cancelled with payment",
          )
        } catch (error) {
          logger.error(
            { error, paymentId, subscriptionId: linkedSubscription[0].id },
            "[Payment] Failed to cancel subscription",
          )
        }
      }

      logger.info(
        { paymentId, cancellationId: result.cancellationId },
        "[Payment] Payment cancelled",
      )

      return {
        success: true,
        data: {
          paymentId,
          cancellationId: result.cancellationId,
          subscriptionCancelled,
        },
      }
    },
    {
      params: t.Object({
        // paymentId: 영문, 숫자, 하이픈, 언더스코어만 허용 (10-100자)
        paymentId: t.String({
          minLength: 10,
          maxLength: 100,
          pattern: "^[a-zA-Z0-9_-]+$",
        }),
      }),
      body: t.Object({
        reason: t.String({ minLength: 1, maxLength: 500 }),
      }),
    },
  )

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 결제 주기에 따른 다음 결제일 계산
 *
 * Note: Date 객체는 불변성을 위해 매번 새로 생성합니다.
 * setDate/setMonth 등은 원본을 변경하므로 주의해야 합니다.
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
      // 기본값: 월간
      const date = new Date()
      date.setMonth(date.getMonth() + 1)
      return date
    }
  }
}
