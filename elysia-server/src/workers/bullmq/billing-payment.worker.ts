/**
 * Billing Payment Worker
 *
 * 정기결제 자동 승인 처리 Worker
 * - 매일 오전 9시 (KST)에 실행되어 결제 대상 구독 처리
 * - subscriptions.currentPeriodEnd <= now인 활성 구독에 대해 결제 수행
 * - 빌링키를 사용하여 TossPayments 자동결제 API 호출
 * - 성공 시 다음 결제일 업데이트, 실패 시 status를 past_due로 변경
 *
 * Job Logging: 모든 Job 라이프사이클이 job_logs 테이블에 기록됨
 */

import { type Job, Worker } from "bullmq"
import { and, eq, lte } from "drizzle-orm"
import { db } from "../../db"
import { billingCustomers, billingKeys, billingPlans, subscriptions } from "../../db/schema/billing"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import {
  type BillingPaymentJob,
  type BillingPaymentResult,
  QUEUE_NAMES,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import * as jobLogService from "../../services/job-log.service"
import { requestBillingPayment } from "../../services/toss.service"
import logger from "../../utils/logger"

const QUEUE_NAME = QUEUE_NAMES.BILLING_PAYMENT
const WORKER_NAME = "billing-payment-worker"

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

let worker: Worker<BillingPaymentJob, BillingPaymentResult> | null = null

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 다음 결제 기간 종료일 계산
 */
function calculateNextPeriodEnd(
  currentPeriodEnd: Date,
  billingInterval: "day" | "week" | "month" | "year" | null,
  intervalCount: number | null,
): Date {
  const nextEnd = new Date(currentPeriodEnd)
  const count = intervalCount || 1

  switch (billingInterval) {
    case "day":
      nextEnd.setDate(nextEnd.getDate() + count)
      break
    case "week":
      nextEnd.setDate(nextEnd.getDate() + count * 7)
      break
    case "month":
      nextEnd.setMonth(nextEnd.getMonth() + count)
      break
    case "year":
      nextEnd.setFullYear(nextEnd.getFullYear() + count)
      break
    default:
      // 기본값: 한 달 추가
      nextEnd.setMonth(nextEnd.getMonth() + 1)
  }

  return nextEnd
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * 빌링 결제 Job 처리
 */
async function processBillingPayment(
  job: Job<BillingPaymentJob, BillingPaymentResult>,
): Promise<BillingPaymentResult> {
  const { trigger, subscriptionId: targetSubscriptionId } = job.data
  const jobId = job.id || "unknown"
  const now = new Date()

  // 시작 시간 기록
  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, trigger, targetSubscriptionId },
    "[BillingPaymentWorker] Starting billing payment processing",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, WORKER_NAME)
  } catch (logError) {
    logger.warn({ jobId, error: logError }, "[BillingPaymentWorker] Failed to log job start")
  }

  const payments: BillingPaymentResult["payments"] = []
  let processedCount = 0
  let successCount = 0
  let failedCount = 0

  try {
    // 1. 결제 대상 구독 조회
    // - currentPeriodEnd <= now (결제 기간 만료)
    // - status = 'active' (활성 구독만)
    // - cancelAtPeriodEnd = false (취소 예정 아님)
    const conditions = [
      lte(subscriptions.currentPeriodEnd, now),
      eq(subscriptions.status, "active"),
      eq(subscriptions.cancelAtPeriodEnd, false),
    ]

    // 특정 구독만 처리 (수동 트리거)
    if (targetSubscriptionId) {
      conditions.push(eq(subscriptions.id, targetSubscriptionId))
    }

    const dueSubscriptions = await db
      .select({
        subscriptionId: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        customerId: subscriptions.customerId,
        planId: subscriptions.planId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        metadata: subscriptions.metadata,
        // Plan info
        planName: billingPlans.name,
        planAmount: billingPlans.amount,
        billingInterval: billingPlans.billingInterval,
        intervalCount: billingPlans.intervalCount,
        // Customer info
        customerEmail: billingCustomers.email,
        customerName: billingCustomers.name,
      })
      .from(subscriptions)
      .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
      .innerJoin(billingCustomers, eq(subscriptions.customerId, billingCustomers.id))
      .where(and(...conditions))

    logger.info(
      { count: dueSubscriptions.length },
      "[BillingPaymentWorker] Found subscriptions due for payment",
    )

    // 2. 각 구독에 대해 결제 처리
    for (const sub of dueSubscriptions) {
      processedCount++

      try {
        // 2a. 해당 고객의 활성 빌링키 조회
        const activeBillingKey = await db
          .select()
          .from(billingKeys)
          .where(and(eq(billingKeys.customerId, sub.customerId), eq(billingKeys.isActive, true)))
          .limit(1)

        if (activeBillingKey.length === 0) {
          // 빌링키 없음 - 결제 불가
          logger.warn(
            { subscriptionId: sub.subscriptionId, customerId: sub.customerId },
            "[BillingPaymentWorker] No active billing key found",
          )

          payments.push({
            subscriptionId: sub.subscriptionId,
            billingKeyId: "none",
            orderId: "",
            amount: Number(sub.planAmount),
            status: "failed",
            error: "활성화된 빌링키가 없습니다.",
          })

          failedCount++

          // past_due로 상태 변경
          await db
            .update(subscriptions)
            .set({
              status: "past_due",
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, sub.subscriptionId))

          continue
        }

        // length === 0 체크 후이므로 activeBillingKey[0]는 항상 존재함
        const billingKeyRecord = activeBillingKey[0]!

        // 2b. 결제 요청
        const orderId = `sub-${sub.subscriptionId}-${Date.now()}`

        logger.info(
          {
            subscriptionId: sub.subscriptionId,
            billingKey: billingKeyRecord.billingKey,
            amount: sub.planAmount,
            orderId,
          },
          "[BillingPaymentWorker] Requesting billing payment",
        )

        const paymentResult = await requestBillingPayment(
          billingKeyRecord.billingKey,
          billingKeyRecord.customerKey,
          Number(sub.planAmount),
          orderId,
          `${sub.planName} 정기결제`,
          sub.customerEmail || undefined,
          sub.customerName || undefined,
        )

        if (paymentResult.success && paymentResult.payment) {
          // 2c. 결제 성공 - 다음 결제일 계산 및 업데이트
          const currentPeriodEnd = sub.currentPeriodEnd || new Date()
          const nextPeriodEnd = calculateNextPeriodEnd(
            currentPeriodEnd,
            sub.billingInterval,
            sub.intervalCount,
          )

          await db
            .update(subscriptions)
            .set({
              currentPeriodStart: currentPeriodEnd,
              currentPeriodEnd: nextPeriodEnd,
              status: "active", // 확실히 active 유지
              metadata: {
                ...(sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}),
                lastPayment: {
                  orderId,
                  paymentKey: paymentResult.payment.paymentKey,
                  amount: paymentResult.payment.totalAmount,
                  paidAt: paymentResult.payment.approvedAt || new Date().toISOString(),
                  method: paymentResult.payment.method,
                },
              },
              updatedAt: new Date(),
            })
            .where(eq(subscriptions.id, sub.subscriptionId))

          payments.push({
            subscriptionId: sub.subscriptionId,
            billingKeyId: billingKeyRecord.id,
            orderId,
            amount: Number(sub.planAmount),
            status: "success",
            paymentKey: paymentResult.payment.paymentKey,
          })

          successCount++

          logger.info(
            {
              subscriptionId: sub.subscriptionId,
              orderId,
              paymentKey: paymentResult.payment.paymentKey,
              nextPeriodEnd: nextPeriodEnd.toISOString(),
            },
            "[BillingPaymentWorker] Payment successful, subscription period updated",
          )
        } else {
          // 2d. 결제 실패
          payments.push({
            subscriptionId: sub.subscriptionId,
            billingKeyId: billingKeyRecord.id,
            orderId,
            amount: Number(sub.planAmount),
            status: "failed",
            error: paymentResult.error || "결제 실패",
          })

          failedCount++

          // 마지막 재시도인 경우 past_due로 상태 변경
          const isLastAttempt = job.attemptsMade >= (job.opts.attempts || 3) - 1
          if (isLastAttempt) {
            await db
              .update(subscriptions)
              .set({
                status: "past_due",
                metadata: {
                  ...(sub.metadata && typeof sub.metadata === "object" ? sub.metadata : {}),
                  lastPaymentError: {
                    orderId,
                    error: paymentResult.error,
                    errorCode: paymentResult.errorCode,
                    failedAt: new Date().toISOString(),
                  },
                },
                updatedAt: new Date(),
              })
              .where(eq(subscriptions.id, sub.subscriptionId))

            logger.warn(
              {
                subscriptionId: sub.subscriptionId,
                error: paymentResult.error,
              },
              "[BillingPaymentWorker] Payment failed - subscription marked as past_due",
            )
          } else {
            // 재시도를 위해 에러 throw
            throw new Error(
              `Payment failed for subscription ${sub.subscriptionId}: ${paymentResult.error}`,
            )
          }
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error during payment processing"

        logger.error(
          { subscriptionId: sub.subscriptionId, error: errorMsg },
          "[BillingPaymentWorker] Error processing subscription",
        )

        // 결제 배열에 아직 추가 안됐으면 추가
        const alreadyAdded = payments.some((p) => p.subscriptionId === sub.subscriptionId)
        if (!alreadyAdded) {
          payments.push({
            subscriptionId: sub.subscriptionId,
            billingKeyId: "unknown",
            orderId: "",
            amount: Number(sub.planAmount),
            status: "failed",
            error: errorMsg,
          })
          failedCount++
        }

        // 재시도를 위해 에러 전파
        if (targetSubscriptionId) {
          // 특정 구독 처리 시에만 재시도
          throw error
        }
      }
    }

    const durationMs = Date.now() - startTime

    logger.info(
      {
        processedCount,
        successCount,
        failedCount,
        durationMs,
      },
      "[BillingPaymentWorker] Billing payment processing completed",
    )

    return {
      success: failedCount === 0,
      processedCount,
      successCount,
      failedCount,
      payments,
      durationMs,
    }
  } catch (error) {
    logger.error({ error }, "[BillingPaymentWorker] Fatal error during billing payment processing")
    throw error
  }
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Billing Payment Worker 시작
 */
export function startBillingPaymentWorker(): Worker<
  BillingPaymentJob,
  BillingPaymentResult
> | null {
  if (worker) {
    logger.warn("[BillingPaymentWorker] Worker already running")
    return worker
  }

  try {
    worker = new Worker<BillingPaymentJob, BillingPaymentResult>(
      QUEUE_NAME,
      processBillingPayment,
      {
        connection: createRedisConnection(),
        concurrency: 1, // 순차 처리 (결제는 동시성 낮게)
        limiter: {
          max: 1,
          duration: 60000, // 1분에 1개만
        },
      },
    )

    // ========================================
    // Event Handlers with DB Logging
    // ========================================

    worker.on("completed", async (job, result) => {
      const jobId = job.id || "unknown"
      const startTime = jobStartTimes.get(jobId) || Date.now()

      // Health 서버에 완료 기록
      recordJobCompleted()

      try {
        await jobLogService.logJobCompleted(job, result, startTime)
      } catch (logError) {
        logger.error(
          { jobId, error: logError },
          "[BillingPaymentWorker] Failed to log job completion",
        )
      } finally {
        jobStartTimes.delete(jobId)
      }

      logger.info(
        {
          jobId: job.id,
          result: {
            processedCount: result.processedCount,
            successCount: result.successCount,
            failedCount: result.failedCount,
          },
        },
        "[BillingPaymentWorker] Job completed",
      )
    })

    worker.on("failed", async (job, err) => {
      const jobId = job?.id
      const startTime = jobId ? jobStartTimes.get(jobId) : undefined

      // Health 서버에 실패 기록
      recordJobFailed()

      try {
        await jobLogService.logJobFailed(job, err, startTime)
      } catch (logError) {
        logger.error({ jobId, error: logError }, "[BillingPaymentWorker] Failed to log job failure")
      } finally {
        if (jobId) jobStartTimes.delete(jobId)
      }

      logger.error(
        {
          jobId: job?.id,
          error: err.message,
          attemptsMade: job?.attemptsMade,
        },
        "[BillingPaymentWorker] Job failed",
      )
    })

    worker.on("stalled", async (jobId) => {
      try {
        await jobLogService.logJobStalled(jobId, QUEUE_NAME)
      } catch (logError) {
        logger.error({ jobId, error: logError }, "[BillingPaymentWorker] Failed to log job stall")
      }
      logger.warn({ jobId }, "[BillingPaymentWorker] Job stalled")
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message, stack: err.stack }, "[BillingPaymentWorker] Worker error")
    })

    logger.info(
      { queueName: QUEUE_NAME },
      "[BillingPaymentWorker] Worker started with DB logging enabled",
    )
    return worker
  } catch (error) {
    logger.error({ error }, "[BillingPaymentWorker] Failed to start worker")
    return null
  }
}

/**
 * Billing Payment Worker 중지
 */
export async function stopBillingPaymentWorker(): Promise<void> {
  if (!worker) {
    return
  }

  await worker.close()
  worker = null
  jobStartTimes.clear()
  logger.info("[BillingPaymentWorker] Worker stopped")
}

/**
 * Worker 상태 조회
 */
export function getBillingPaymentWorkerStatus(): {
  running: boolean
  concurrency: number
  activeJobs: number
} {
  return {
    running: worker !== null && !worker.closing,
    concurrency: worker?.opts.concurrency || 0,
    activeJobs: jobStartTimes.size,
  }
}
