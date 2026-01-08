/**
 * Followup Email Worker
 *
 * 매 시간마다 실행되어 팔로업 이메일 대상자를 찾고 발송합니다.
 * - 온보딩 단계별 진행 중단 사용자 찾기
 * - 팔로업 이메일 발송
 * - 발송 기록 저장
 *
 * Job Logging: 모든 Job 라이프사이클이 job_logs 테이블에 기록됨
 */

import { type Job, Worker } from "bullmq"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import { type FollowupEmailJob, type FollowupEmailResult, QUEUE_NAMES } from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import * as followupEmailService from "../../services/followup-email.service"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"

const QUEUE_NAME = QUEUE_NAMES.FOLLOWUP_EMAIL
const WORKER_NAME = "followup-email-worker"

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

let worker: Worker<FollowupEmailJob, FollowupEmailResult> | null = null

/**
 * Process followup email check
 */
async function processFollowupEmail(
  job: Job<FollowupEmailJob, FollowupEmailResult>,
): Promise<FollowupEmailResult> {
  const { trigger, checkDate } = job.data
  const now = checkDate ? new Date(checkDate) : new Date()
  const jobId = job.id || "unknown"

  // 시작 시간 기록
  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, trigger, checkDate: now.toISOString() },
    "[FollowupEmailWorker] Starting followup email check",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, WORKER_NAME)
  } catch (logError) {
    logger.warn({ jobId, error: logError }, "[FollowupEmailWorker] Failed to log job start")
  }

  const errors: string[] = []

  try {
    // 팔로업 이메일 처리
    const result = await followupEmailService.processAllFollowupEmails()

    logger.info(
      {
        total: result.total,
        sent: result.sent,
        failed: result.failed,
      },
      "[FollowupEmailWorker] Followup email check completed",
    )

    return {
      success: result.failed === 0,
      total: result.total,
      sent: result.sent,
      failed: result.failed,
      errors,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    errors.push(errorMsg)
    logger.error({ error }, "[FollowupEmailWorker] Fatal error during followup email check")
    throw error
  }
}

/**
 * Start followup email worker
 */
export function startFollowupEmailWorker(): Worker<FollowupEmailJob, FollowupEmailResult> | null {
  if (worker) {
    logger.warn("[FollowupEmailWorker] Worker already running")
    return worker
  }

  try {
    worker = new Worker<FollowupEmailJob, FollowupEmailResult>(QUEUE_NAME, processFollowupEmail, {
      connection: createRedisConnection(),
      concurrency: 1, // 순차 처리
      limiter: {
        max: 1,
        duration: 60000, // 1분에 1개만
      },
    })

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
          "[FollowupEmailWorker] Failed to log job completion",
        )
      } finally {
        jobStartTimes.delete(jobId)
      }

      logger.info(
        {
          jobId: job.id,
          result: job.returnvalue,
        },
        "[FollowupEmailWorker] Job completed",
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
        logger.error({ jobId, error: logError }, "[FollowupEmailWorker] Failed to log job failure")
      } finally {
        if (jobId) jobStartTimes.delete(jobId)
      }

      logger.error(
        {
          jobId: job?.id,
          error: err.message,
        },
        "[FollowupEmailWorker] Job failed",
      )
    })

    worker.on("stalled", async (jobId) => {
      try {
        await jobLogService.logJobStalled(jobId, QUEUE_NAME)
      } catch (logError) {
        logger.error({ jobId, error: logError }, "[FollowupEmailWorker] Failed to log job stall")
      }
      logger.warn({ jobId }, "[FollowupEmailWorker] Job stalled")
    })

    worker.on("error", (err) => {
      logger.error({ error: err.message, stack: err.stack }, "[FollowupEmailWorker] Worker error")
    })

    logger.info(
      { queueName: QUEUE_NAME },
      "[FollowupEmailWorker] Worker started with DB logging enabled",
    )
    return worker
  } catch (error) {
    logger.error({ error }, "[FollowupEmailWorker] Failed to start worker")
    return null
  }
}

/**
 * Stop followup email worker
 */
export async function stopFollowupEmailWorker(): Promise<void> {
  if (!worker) {
    return
  }

  await worker.close()
  worker = null
  logger.info("[FollowupEmailWorker] Worker stopped")
}

/**
 * Get worker status
 */
export function getFollowupEmailWorkerStatus(): {
  running: boolean
  activeJobs: number
} {
  return {
    running: worker !== null && !worker.closing,
    activeJobs: 0, // BullMQ Worker doesn't expose active job count directly
  }
}
