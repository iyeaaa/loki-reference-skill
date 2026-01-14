/**
 * Trial Expiration Worker
 *
 * 매일 자정에 실행되어 만료된 체험판 유저를 처리합니다.
 * - subscriptions 테이블에서 만료된 체험판 찾기
 * - subscription status를 'expired'로 변경
 * - 활성 캠페인 일시 정지
 * - 로그 기록
 *
 * Job Logging: 모든 Job 라이프사이클이 job_logs 테이블에 기록됨
 */

import { type Job, Worker } from "bullmq"
import { and, eq, lt } from "drizzle-orm"
import { db } from "../../db"
import { billingPlans, billingProducts, subscriptions } from "../../db/schema/billing"
import { sequences } from "../../db/schema/sequences"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import { createRedisConnection } from "../../lib/redis/connection"
import { hasEverBeenPaidSubscriber } from "../../services/billing.service"
import { disconnectWorkspaceUnipileAccounts } from "../../services/email-account.service"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"

/** Unipile 해지 유예 기간 (일) */
const UNIPILE_DISCONNECT_GRACE_PERIOD_DAYS = 3

const QUEUE_NAME = "trial-expiration"
const WORKER_NAME = "trial-expiration-worker"

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

export interface TrialExpirationJob {
  trigger: "scheduled" | "manual"
  checkDate?: string
}

export interface TrialExpirationResult {
  success: boolean
  expiredCount: number
  pausedSequencesCount: number
  unipileDisconnectedCount: number
  errors: string[]
}

let worker: Worker<TrialExpirationJob, TrialExpirationResult> | null = null

/**
 * Process trial expiration check
 */
async function processTrialExpiration(
  job: Job<TrialExpirationJob, TrialExpirationResult>,
): Promise<TrialExpirationResult> {
  const { trigger, checkDate } = job.data
  const now = checkDate ? new Date(checkDate) : new Date()
  const jobId = job.id || "unknown"

  // 시작 시간 기록
  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, trigger, checkDate: now.toISOString() },
    "[TrialExpirationWorker] Starting trial expiration check",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, WORKER_NAME)
  } catch (logError) {
    logger.warn({ jobId, error: logError }, "[TrialExpirationWorker] Failed to log job start")
  }

  const errors: string[] = []
  let expiredCount = 0
  let pausedSequencesCount = 0
  let unipileDisconnectedCount = 0

  try {
    // 1. 만료된 체험판 subscription 찾기
    // - status = 'trialing'
    // - trialEnd < now
    const expiredSubscriptions = await db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        customerId: subscriptions.customerId,
        trialEnd: subscriptions.trialEnd,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "trialing"), lt(subscriptions.trialEnd, now)))

    logger.info(
      { count: expiredSubscriptions.length },
      "[TrialExpirationWorker] Found expired trial subscriptions",
    )

    // 2. 각 만료된 subscription 처리
    for (const subscription of expiredSubscriptions) {
      try {
        // 2a. subscription status를 'expired'로 변경
        await db
          .update(subscriptions)
          .set({
            status: "expired",
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscription.id))

        expiredCount++

        logger.info(
          {
            subscriptionId: subscription.id,
            workspaceId: subscription.workspaceId,
            trialEnd: subscription.trialEnd,
          },
          "[TrialExpirationWorker] Subscription marked as expired",
        )

        // 2b. 해당 workspace의 활성 캠페인 일시 정지
        const activeSequences = await db
          .select({ id: sequences.id, name: sequences.name })
          .from(sequences)
          .where(
            and(
              eq(sequences.workspaceId, subscription.workspaceId),
              eq(sequences.status, "active"),
            ),
          )

        if (activeSequences.length > 0) {
          await db
            .update(sequences)
            .set({
              status: "paused",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(sequences.workspaceId, subscription.workspaceId),
                eq(sequences.status, "active"),
              ),
            )

          pausedSequencesCount += activeSequences.length

          logger.info(
            {
              workspaceId: subscription.workspaceId,
              sequenceCount: activeSequences.length,
              sequenceNames: activeSequences.map((s) => s.name),
            },
            "[TrialExpirationWorker] Paused active sequences",
          )
        }
      } catch (error) {
        const errorMsg = `Failed to process subscription ${subscription.id}: ${error instanceof Error ? error.message : String(error)}`
        errors.push(errorMsg)
        logger.error({ error, subscriptionId: subscription.id }, errorMsg)
      }
    }

    // 3. 3일 유예 기간 후 Unipile 계정 해지
    // - status = 'expired'
    // - tier = 'trial'
    // - trialEnd < (now - 3일)
    const gracePeriodCutoff = new Date(now)
    gracePeriodCutoff.setDate(gracePeriodCutoff.getDate() - UNIPILE_DISCONNECT_GRACE_PERIOD_DAYS)

    const unipileDisconnectTargets = await db
      .select({
        subscriptionId: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        trialEnd: subscriptions.trialEnd,
      })
      .from(subscriptions)
      .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
      .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
      .where(
        and(
          eq(subscriptions.status, "expired"),
          lt(subscriptions.trialEnd, gracePeriodCutoff),
          eq(billingProducts.tier, "trial"),
          eq(subscriptions.isPrimary, true),
        ),
      )

    logger.info(
      {
        count: unipileDisconnectTargets.length,
        gracePeriodCutoff: gracePeriodCutoff.toISOString(),
      },
      "[TrialExpirationWorker] Found expired trial subscriptions for Unipile disconnect",
    )

    // 3a. 각 대상에 대해 Unipile 계정 해지
    for (const target of unipileDisconnectTargets) {
      try {
        // 안전장치: 유료 전환 이력이 있는 경우 건너뛰기
        const hasPaidHistory = await hasEverBeenPaidSubscriber(target.workspaceId)
        if (hasPaidHistory) {
          logger.info(
            { workspaceId: target.workspaceId },
            "[TrialExpirationWorker] Skipping Unipile disconnect - workspace has paid subscription history",
          )
          continue
        }

        const disconnected = await disconnectWorkspaceUnipileAccounts(
          target.workspaceId,
          `Trial expired without conversion (${UNIPILE_DISCONNECT_GRACE_PERIOD_DAYS}-day grace period ended)`,
        )
        unipileDisconnectedCount += disconnected

        if (disconnected > 0) {
          logger.info(
            {
              workspaceId: target.workspaceId,
              subscriptionId: target.subscriptionId,
              disconnectedCount: disconnected,
            },
            "[TrialExpirationWorker] Unipile accounts disconnected",
          )
        }
      } catch (error) {
        const errorMsg = `Failed to disconnect Unipile for workspace ${target.workspaceId}: ${error instanceof Error ? error.message : String(error)}`
        errors.push(errorMsg)
        logger.error({ error, workspaceId: target.workspaceId }, errorMsg)
      }
    }

    logger.info(
      {
        expiredCount,
        pausedSequencesCount,
        unipileDisconnectedCount,
        errorCount: errors.length,
      },
      "[TrialExpirationWorker] Trial expiration check completed",
    )

    return {
      success: errors.length === 0,
      expiredCount,
      pausedSequencesCount,
      unipileDisconnectedCount,
      errors,
    }
  } catch (error) {
    logger.error({ error }, "[TrialExpirationWorker] Fatal error during trial expiration check")
    throw error
  }
}

/**
 * Start trial expiration worker
 */
export function startTrialExpirationWorker(): Worker<
  TrialExpirationJob,
  TrialExpirationResult
> | null {
  if (worker) {
    logger.warn("[TrialExpirationWorker] Worker already running")
    return worker
  }

  try {
    worker = new Worker<TrialExpirationJob, TrialExpirationResult>(
      "trial-expiration",
      processTrialExpiration,
      {
        connection: createRedisConnection(),
        concurrency: 1, // 순차 처리
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
          "[TrialExpirationWorker] Failed to log job completion",
        )
      } finally {
        jobStartTimes.delete(jobId)
      }

      logger.info(
        {
          jobId: job.id,
          result: job.returnvalue,
        },
        "[TrialExpirationWorker] Job completed",
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
        logger.error(
          { jobId, error: logError },
          "[TrialExpirationWorker] Failed to log job failure",
        )
      } finally {
        if (jobId) jobStartTimes.delete(jobId)
      }

      logger.error(
        {
          jobId: job?.id,
          error: err.message,
        },
        "[TrialExpirationWorker] Job failed",
      )
    })

    worker.on("stalled", async (jobId) => {
      try {
        await jobLogService.logJobStalled(jobId, QUEUE_NAME)
      } catch (logError) {
        logger.error({ jobId, error: logError }, "[TrialExpirationWorker] Failed to log job stall")
      }
      logger.warn({ jobId }, "[TrialExpirationWorker] Job stalled")
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message, stack: err.stack }, "[TrialExpirationWorker] Worker error")
    })

    logger.info(
      { queueName: QUEUE_NAME },
      "[TrialExpirationWorker] Worker started with DB logging enabled",
    )
    return worker
  } catch (error) {
    logger.error({ error }, "[TrialExpirationWorker] Failed to start worker")
    return null
  }
}

/**
 * Stop trial expiration worker
 */
export async function stopTrialExpirationWorker(): Promise<void> {
  if (!worker) {
    return
  }

  await worker.close()
  worker = null
  logger.info("[TrialExpirationWorker] Worker stopped")
}

/**
 * Get worker status
 */
export function getTrialExpirationWorkerStatus(): {
  running: boolean
  activeJobs: number
} {
  return {
    running: worker !== null && !worker.closing,
    activeJobs: 0, // BullMQ Worker doesn't expose active job count directly
  }
}
