/**
 * BullMQ Test Worker
 *
 * 테스트용 BullMQ Worker - Job 처리 및 DB 로깅 통합
 * 모든 Job 라이프사이클이 PostgreSQL에 기록됨
 */

import { type Job, Worker } from "bullmq"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import { QUEUE_NAMES, type TestJob, type TestJobResult } from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"

// ============================================================================
// Worker State
// ============================================================================

let testWorker: Worker<TestJob, TestJobResult> | null = null

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Test Job 처리 함수
 */
async function processTestJob(job: Job<TestJob, TestJobResult>): Promise<TestJobResult> {
  const { message, delay, shouldFail, data } = job.data
  const jobId = job.id || "unknown"

  // 시작 시간 기록
  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, message, attempt: job.attemptsMade + 1, maxAttempts: job.opts.attempts },
    "[TestWorker] Processing job",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, "test-worker")
  } catch (logError) {
    // 로깅 실패해도 Job 처리는 계속
    logger.warn({ jobId, error: logError }, "[TestWorker] Failed to log job start")
  }

  // 처리 지연 시뮬레이션
  if (delay && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  // 실패 시뮬레이션 (재시도 테스트용)
  if (shouldFail) {
    throw new Error(`Intentional failure for testing: ${message}`)
  }

  const result: TestJobResult = {
    success: true,
    processedAt: new Date().toISOString(),
    message: `Processed: ${message}`,
    receivedData: data,
  }

  logger.info({ jobId, result }, "[TestWorker] Job completed")

  return result
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Test Worker 시작
 */
export function startTestWorker(): Worker<TestJob, TestJobResult> {
  if (testWorker) {
    logger.warn("[TestWorker] Worker already running")
    return testWorker
  }

  testWorker = new Worker<TestJob, TestJobResult>(QUEUE_NAMES.TEST_QUEUE, processTestJob, {
    connection: createRedisConnection(),
    concurrency: Number(process.env.BULLMQ_CONCURRENCY) || 20,
    limiter: {
      max: Number(process.env.BULLMQ_RATE_LIMIT_MAX) || 50,
      duration: Number(process.env.BULLMQ_RATE_LIMIT_DURATION) || 1000,
    },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 86400, // Keep failed jobs for 24 hours
    },
  })

  // ========================================
  // Event Handlers with DB Logging
  // ========================================

  /**
   * Job 완료 이벤트
   */
  testWorker.on("completed", async (job, result) => {
    const jobId = job.id || "unknown"
    const startTime = jobStartTimes.get(jobId) || Date.now()

    // Health 서버에 완료 기록 (마지막 처리 시간 업데이트)
    recordJobCompleted()

    try {
      await jobLogService.logJobCompleted(job, result, startTime)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[TestWorker] Failed to log job completion")
    } finally {
      jobStartTimes.delete(jobId)
    }

    logger.info({ jobId, result }, "[TestWorker] Job completed successfully")
  })

  /**
   * Job 실패 이벤트
   */
  testWorker.on("failed", async (job, err) => {
    const jobId = job?.id
    const startTime = jobId ? jobStartTimes.get(jobId) : undefined

    // Health 서버에 실패 기록
    recordJobFailed()

    try {
      await jobLogService.logJobFailed(job, err, startTime)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[TestWorker] Failed to log job failure")
    } finally {
      if (jobId) jobStartTimes.delete(jobId)
    }

    logger.error(
      { jobId, error: err.message, attempts: job?.attemptsMade },
      "[TestWorker] Job failed",
    )
  })

  /**
   * Job Stalled 이벤트 (Worker 응답 없음)
   */
  testWorker.on("stalled", async (jobId) => {
    try {
      await jobLogService.logJobStalled(jobId, QUEUE_NAMES.TEST_QUEUE)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[TestWorker] Failed to log job stall")
    }

    logger.warn({ jobId }, "[TestWorker] Job stalled")
  })

  /**
   * Worker 에러 이벤트
   */
  testWorker.on("error", (err) => {
    logger.error({ error: err.message, stack: err.stack }, "[TestWorker] Worker error")
  })

  /**
   * Worker 준비 완료 이벤트
   */
  testWorker.on("ready", () => {
    logger.info("[TestWorker] Worker is ready to process jobs")
  })

  /**
   * Worker 종료 이벤트
   */
  testWorker.on("closed", () => {
    logger.info("[TestWorker] Worker has been closed")
  })

  logger.info(
    { concurrency: testWorker.opts.concurrency, queueName: QUEUE_NAMES.TEST_QUEUE },
    "[TestWorker] Started successfully with DB logging enabled",
  )

  return testWorker
}

/**
 * Test Worker 중지
 */
export async function stopTestWorker(): Promise<void> {
  if (testWorker) {
    await testWorker.close()
    testWorker = null
    jobStartTimes.clear()
    logger.info("[TestWorker] Stopped")
  }
}

/**
 * Test Worker 상태 조회
 */
export function getTestWorkerStatus(): {
  running: boolean
  concurrency: number
  activeJobs: number
} {
  return {
    running: testWorker !== null && !testWorker.closing,
    concurrency: testWorker?.opts.concurrency || 0,
    activeJobs: jobStartTimes.size,
  }
}

// ============================================================================
// Exports
// ============================================================================

export { testWorker }
