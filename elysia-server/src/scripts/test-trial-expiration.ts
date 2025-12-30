/**
 * Trial Expiration Worker Test Script
 *
 * 체험판 만료 처리 worker를 테스트합니다.
 * 1. 만료된 체험판 subscription 확인
 * 2. Worker에 수동 job 추가
 * 3. 결과 확인
 */

import { QueueEvents } from "bullmq"
import { and, eq, lt } from "drizzle-orm"
import { db } from "../db"
import { subscriptions } from "../db/schema/billing"
import { trialExpirationQueue } from "../lib/queue/queues"
import { redisConnection } from "../lib/redis"
import logger from "../utils/logger"

async function main() {
  logger.info("[TestTrialExpiration] Starting test...")

  try {
    // 1. Check for expired trials in database
    const now = new Date()
    const expiredTrials = await db
      .select({
        id: subscriptions.id,
        workspaceId: subscriptions.workspaceId,
        status: subscriptions.status,
        trialEnd: subscriptions.trialEnd,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.status, "trialing"), lt(subscriptions.trialEnd, now)))

    logger.info(
      { count: expiredTrials.length, now: now.toISOString() },
      "[TestTrialExpiration] Found expired trials",
    )

    if (expiredTrials.length > 0) {
      for (const trial of expiredTrials) {
        logger.info(
          {
            subscriptionId: trial.id,
            workspaceId: trial.workspaceId,
            trialEnd: trial.trialEnd,
          },
          "[TestTrialExpiration] Expired trial details",
        )
      }
    }

    // 2. Add manual job to queue
    logger.info("[TestTrialExpiration] Adding manual job to queue...")
    const job = await trialExpirationQueue.add("manual-test", {
      trigger: "manual",
      checkDate: now.toISOString(),
    })

    logger.info(
      { jobId: job.id, jobName: job.name },
      "[TestTrialExpiration] Job added, waiting for completion...",
    )

    // 3. Wait for job completion (max 30 seconds)
    const queueEvents = new QueueEvents(trialExpirationQueue.name, {
      connection: redisConnection,
    })
    const result = await job.waitUntilFinished(queueEvents, 30000)
    await queueEvents.close()

    logger.info({ jobId: job.id, result }, "[TestTrialExpiration] Job completed!")

    if (result.success) {
      logger.info(
        {
          expiredCount: result.expiredCount,
          pausedSequencesCount: result.pausedSequencesCount,
        },
        "✅ [TestTrialExpiration] Success!",
      )
    } else {
      logger.error({ errors: result.errors }, "❌ [TestTrialExpiration] Job completed with errors")
    }

    // 4. Clean up
    await trialExpirationQueue.close()
    await redisConnection.quit()
    logger.info("[TestTrialExpiration] Test completed")
    process.exit(0)
  } catch (error) {
    logger.error({ error }, "[TestTrialExpiration] Test failed")
    await trialExpirationQueue.close()
    await redisConnection.quit()
    process.exit(1)
  }
}

main()
