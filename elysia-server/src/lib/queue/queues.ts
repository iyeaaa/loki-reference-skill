import { type Job, type JobsOptions, Queue } from "bullmq"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"
import { redisConnection } from "../redis/connection"
import {
  type CampaignEmailJob,
  type MetricsSyncJob,
  QUEUE_NAMES,
  type ScheduledEmailJob,
  type TestJob,
  type TestJobResult,
  type WorkflowStepJob,
} from "./types"

/**
 * Default job options for all queues
 */
const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 60000, // 1 minute base delay
  },
  removeOnComplete: {
    age: 24 * 3600, // Keep completed jobs for 24 hours
    count: 1000, // Keep max 1000 completed jobs
  },
  removeOnFail: {
    age: 7 * 24 * 3600, // Keep failed jobs for 7 days
  },
}

/**
 * Campaign Email Queue
 * Handles scheduled campaign email sending with lead targeting
 */
export const campaignEmailQueue = new Queue<CampaignEmailJob>(QUEUE_NAMES.CAMPAIGN_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
  },
})

/**
 * Scheduled Email Queue
 * Handles one-off scheduled emails
 */
export const scheduledEmailQueue = new Queue<ScheduledEmailJob>(QUEUE_NAMES.SCHEDULED_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
  },
})

/**
 * Workflow Step Queue
 * Handles workflow automation step execution
 */
export const workflowStepQueue = new Queue<WorkflowStepJob>(QUEUE_NAMES.WORKFLOW_STEP, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 3,
  },
})

/**
 * Metrics Sync Queue
 * Handles periodic Redis to PostgreSQL sync
 */
export const metricsSyncQueue = new Queue<MetricsSyncJob>(QUEUE_NAMES.METRICS_SYNC, {
  connection: redisConnection,
  defaultJobOptions: {
    ...defaultJobOptions,
    attempts: 2,
    removeOnComplete: true,
  },
})

/**
 * Test Queue
 * For testing BullMQ functionality
 * DB에 로그가 저장되므로 Redis 보존 기간은 짧게 유지
 */
export const testQueue = new Queue<TestJob>(QUEUE_NAMES.TEST_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: {
      age: 24 * 3600, // 24시간 (DB에 영구 저장됨)
      count: 500,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // 7일 (DB에 영구 저장됨)
    },
  },
})

/**
 * Get all queues for monitoring
 */
export function getAllQueues() {
  return {
    [QUEUE_NAMES.CAMPAIGN_EMAIL]: campaignEmailQueue,
    [QUEUE_NAMES.SCHEDULED_EMAIL]: scheduledEmailQueue,
    [QUEUE_NAMES.WORKFLOW_STEP]: workflowStepQueue,
    [QUEUE_NAMES.METRICS_SYNC]: metricsSyncQueue,
    [QUEUE_NAMES.TEST_QUEUE]: testQueue,
  }
}

/**
 * Close all queue connections gracefully
 */
export async function closeAllQueues(): Promise<void> {
  await Promise.all([
    campaignEmailQueue.close(),
    scheduledEmailQueue.close(),
    workflowStepQueue.close(),
    metricsSyncQueue.close(),
    testQueue.close(),
  ])
}

// ============================================================================
// Test Queue Helper with DB Logging
// ============================================================================

/**
 * Test Job 추가 (DB 로그 자동 생성)
 *
 * @param name - Job 이름
 * @param data - Job 데이터
 * @param opts - Job 옵션
 * @returns Job 객체
 */
export async function addTestJob(
  name: string,
  data: TestJob,
  opts?: JobsOptions,
): Promise<Job<TestJob, TestJobResult>> {
  // Queue에 Job 추가
  const job = await testQueue.add(name, data, opts)

  // DB에 Job 로그 생성
  try {
    if (!job.id) {
      throw new Error("Job ID is missing")
    }

    await jobLogService.createJobLog({
      jobId: job.id,
      queueName: QUEUE_NAMES.TEST_QUEUE,
      jobName: name,
      inputData: { ...data } as unknown as Record<string, unknown>,
      priority: opts?.priority,
      maxAttempts: opts?.attempts ?? 3,
      delayedUntil: opts?.delay ? new Date(Date.now() + opts.delay) : undefined,
      jobOptions: opts ? ({ ...opts } as unknown as Record<string, unknown>) : undefined,
    })

    logger.debug(
      { jobId: job.id, name, queueName: QUEUE_NAMES.TEST_QUEUE },
      "[TestQueue] Job added with DB logging",
    )
  } catch (logError) {
    // 로깅 실패해도 Job은 이미 Queue에 추가됨
    logger.warn(
      { jobId: job.id, error: logError },
      "[TestQueue] Failed to create job log, but job was added to queue",
    )
  }

  return job
}

/**
 * Test Job 대량 추가 (DB 로그 자동 생성)
 *
 * @param jobs - Job 배열 [{name, data, opts}]
 * @returns Job 객체 배열
 */
export async function addTestJobs(
  jobs: Array<{ name: string; data: TestJob; opts?: JobsOptions }>,
): Promise<Job<TestJob, TestJobResult>[]> {
  // Queue에 대량 Job 추가
  const addedJobs = await testQueue.addBulk(jobs)

  // DB에 Job 로그 대량 생성
  for (let i = 0; i < addedJobs.length; i++) {
    const job = addedJobs[i]
    const jobConfig = jobs[i]

    if (!job || !jobConfig) {
      logger.warn({ index: i }, "[TestQueue] Missing job or jobConfig in bulk add")
      continue
    }

    try {
      if (!job.id) {
        throw new Error("Job ID is missing")
      }

      await jobLogService.createJobLog({
        jobId: job.id,
        queueName: QUEUE_NAMES.TEST_QUEUE,
        jobName: jobConfig.name,
        inputData: { ...jobConfig.data } as unknown as Record<string, unknown>,
        priority: jobConfig.opts?.priority,
        maxAttempts: jobConfig.opts?.attempts ?? 3,
        delayedUntil: jobConfig.opts?.delay
          ? new Date(Date.now() + jobConfig.opts.delay)
          : undefined,
        jobOptions: jobConfig.opts
          ? ({ ...jobConfig.opts } as unknown as Record<string, unknown>)
          : undefined,
      })
    } catch (logError) {
      logger.warn(
        { jobId: job.id, error: logError },
        "[TestQueue] Failed to create job log for bulk job",
      )
    }
  }

  logger.debug(
    { count: addedJobs.length, queueName: QUEUE_NAMES.TEST_QUEUE },
    "[TestQueue] Bulk jobs added with DB logging",
  )

  return addedJobs
}
