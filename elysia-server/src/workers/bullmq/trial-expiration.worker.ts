/**
 * Trial Expiration Worker
 *
 * 매일 자정에 실행되어 만료된 체험판 유저를 처리합니다.
 * - subscriptions 테이블에서 만료된 체험판 찾기
 * - subscription status를 'expired'로 변경
 * - 활성 캠페인 일시 정지
 * - 로그 기록
 */

import { type Job, Worker } from "bullmq"
import { and, eq, lt } from "drizzle-orm"
import { db } from "../../db"
import { subscriptions } from "../../db/schema/billing"
import { sequences } from "../../db/schema/sequences"
import { createRedisConnection } from "../../lib/redis/connection"
import logger from "../../utils/logger"

export interface TrialExpirationJob {
  trigger: "scheduled" | "manual"
  checkDate?: string
}

export interface TrialExpirationResult {
  success: boolean
  expiredCount: number
  pausedSequencesCount: number
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

  logger.info(
    { trigger, checkDate: now.toISOString() },
    "[TrialExpirationWorker] Starting trial expiration check",
  )

  const errors: string[] = []
  let expiredCount = 0
  let pausedSequencesCount = 0

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

    if (expiredSubscriptions.length === 0) {
      return {
        success: true,
        expiredCount: 0,
        pausedSequencesCount: 0,
        errors: [],
      }
    }

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

    logger.info(
      {
        expiredCount,
        pausedSequencesCount,
        errorCount: errors.length,
      },
      "[TrialExpirationWorker] Trial expiration check completed",
    )

    return {
      success: errors.length === 0,
      expiredCount,
      pausedSequencesCount,
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

    worker.on("completed", (job) => {
      logger.info(
        {
          jobId: job.id,
          result: job.returnvalue,
        },
        "[TrialExpirationWorker] Job completed",
      )
    })

    worker.on("failed", (job, err) => {
      logger.error(
        {
          jobId: job?.id,
          error: err.message,
        },
        "[TrialExpirationWorker] Job failed",
      )
    })

    logger.info("[TrialExpirationWorker] Worker started")
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
