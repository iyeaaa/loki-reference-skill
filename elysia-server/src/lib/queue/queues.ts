import { type Job, type JobsOptions, Queue } from "bullmq"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"
import { redisConnection } from "../redis/connection"
import {
  type CampaignEmailJob,
  type MetricsSyncJob,
  type OnboardingAutoGenerateJob,
  type OnboardingAutoGenerateResult,
  QUEUE_NAMES,
  type ScheduledEmailJob,
  type TestJob,
  type TestJobResult,
  type UnipileInboxPollJob,
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
 * Onboarding Auto-Generate Queue
 * Handles automated onboarding data generation (leads, emails, sequences)
 * Long-running job with checkpointing for resilience
 */
export const onboardingGenerationQueue = new Queue<OnboardingAutoGenerateJob>(
  QUEUE_NAMES.ONBOARDING_GENERATION,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 120000, // 2 min → 4 min → 8 min
      },
      removeOnComplete: {
        age: 7 * 24 * 3600, // 7 days
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // 30 days
      },
    },
  },
)

/**
 * Unipile Inbox Poll Queue
 * Polls Unipile accounts for new inbound emails and replies
 * Runs on a 5-minute schedule to detect replied emails
 */
export const unipileInboxPollQueue = new Queue<UnipileInboxPollJob>(
  QUEUE_NAMES.UNIPILE_INBOX_POLL,
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2, // Retry once on failure
      backoff: {
        type: "fixed",
        delay: 30000, // 30 seconds between retries
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 24 * 3600, // Keep failed jobs for 24 hours
      },
    },
  },
)

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
    [QUEUE_NAMES.ONBOARDING_GENERATION]: onboardingGenerationQueue,
    [QUEUE_NAMES.UNIPILE_INBOX_POLL]: unipileInboxPollQueue,
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
    onboardingGenerationQueue.close(),
    unipileInboxPollQueue.close(),
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

    // delay가 있으면 delayed 상태로, 없으면 waiting 상태로 생성
    const delayMs = opts?.delay ?? 0
    const hasDelay = delayMs > 0
    const initialStatus = hasDelay ? "delayed" : "waiting"

    await jobLogService.createJobLog({
      jobId: job.id,
      queueName: QUEUE_NAMES.TEST_QUEUE,
      jobName: name,
      inputData: { ...data } as unknown as Record<string, unknown>,
      priority: opts?.priority,
      maxAttempts: opts?.attempts ?? 3,
      delayedUntil: hasDelay ? new Date(Date.now() + delayMs) : undefined,
      jobOptions: opts ? ({ ...opts } as unknown as Record<string, unknown>) : undefined,
      status: initialStatus,
    })

    logger.debug(
      { jobId: job.id, name, queueName: QUEUE_NAMES.TEST_QUEUE, status: initialStatus },
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

      // delay가 있으면 delayed 상태로, 없으면 waiting 상태로 생성
      const delayMs = jobConfig.opts?.delay ?? 0
      const hasDelay = delayMs > 0
      const initialStatus = hasDelay ? "delayed" : "waiting"

      await jobLogService.createJobLog({
        jobId: job.id,
        queueName: QUEUE_NAMES.TEST_QUEUE,
        jobName: jobConfig.name,
        inputData: { ...jobConfig.data } as unknown as Record<string, unknown>,
        priority: jobConfig.opts?.priority,
        maxAttempts: jobConfig.opts?.attempts ?? 3,
        delayedUntil: hasDelay ? new Date(Date.now() + delayMs) : undefined,
        jobOptions: jobConfig.opts
          ? ({ ...jobConfig.opts } as unknown as Record<string, unknown>)
          : undefined,
        status: initialStatus,
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

// ============================================================================
// Onboarding Queue Helper with DB Logging
// ============================================================================

/** 로그 생성 재시도 설정 */
const LOG_RETRY_ATTEMPTS = 3
const LOG_RETRY_DELAY_MS = 100

/**
 * 재시도 로직이 포함된 로그 생성
 */
async function createJobLogWithRetry(
  params: Parameters<typeof jobLogService.createJobLog>[0],
  maxAttempts: number = LOG_RETRY_ATTEMPTS,
): Promise<string | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await jobLogService.createJobLog(params)
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error(
          { error, jobId: params.jobId, attempt },
          "[Queue] Failed to create job log after all retries",
        )
        return null
      }
      // 짧은 대기 후 재시도
      await new Promise((resolve) => setTimeout(resolve, LOG_RETRY_DELAY_MS * attempt))
    }
  }
  return null
}

/**
 * Onboarding Auto-Generate Job 추가 (DB 로그 자동 생성)
 *
 * 회원가입/온보딩 시 자동으로 리드 생성, 이메일 템플릿 생성 등을 처리하는 Job
 * Job 생성 시점부터 DB에 로그가 기록되어 모니터링/디버깅 가능
 *
 * 개선사항:
 * - workspaceId 기반 중복 Job 방지 (jobId 옵션)
 * - DB 로그 생성 재시도 로직
 * - surveyData 크기 제한 (민감정보 최소화)
 *
 * @param data - Onboarding Job 데이터 (workspaceId, userId, surveyData)
 * @param opts - Job 옵션 (attempts, backoff 등)
 * @returns Job 객체
 */
export async function addOnboardingJob(
  data: OnboardingAutoGenerateJob,
  opts?: JobsOptions,
): Promise<Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>> {
  const jobName = "auto-generate-onboarding"

  // 중복 방지: workspaceId 기반 고유 jobId 생성
  // 동일 workspaceId로 이미 대기 중인 Job이 있으면 해당 Job 반환
  const deduplicationJobId = `onboarding-${data.workspaceId}`

  // 기존 Job 확인 (waiting 또는 active 상태)
  const existingJob = await onboardingGenerationQueue.getJob(deduplicationJobId)
  if (existingJob) {
    const state = await existingJob.getState()
    if (state === "waiting" || state === "delayed" || state === "active") {
      logger.info(
        {
          jobId: deduplicationJobId,
          workspaceId: data.workspaceId,
          state,
        },
        "[OnboardingQueue] Job already exists, returning existing job",
      )
      return existingJob
    }
    // completed, failed 상태면 새로 생성 (기존 Job 제거 후)
    await existingJob.remove()
    logger.debug(
      { jobId: deduplicationJobId, state },
      "[OnboardingQueue] Removed old job to create new one",
    )
  }

  // Queue에 Job 추가 (중복 방지 jobId 사용)
  const job = await onboardingGenerationQueue.add(jobName, data, {
    jobId: deduplicationJobId,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 120000, // 2 min base delay
    },
    ...opts,
  })

  // DB에 Job 로그 생성 (재시도 로직 포함)
  if (job.id) {
    // 민감 정보 최소화: surveyData에서 필요한 필드만 저장
    const sanitizedInputData = {
      workspaceId: data.workspaceId,
      userId: data.userId,
      surveyData: {
        industry: data.surveyData.industry,
        country: data.surveyData.country,
        // target, experience는 로그에 저장하지 않음 (민감 정보)
      },
    }

    const logId = await createJobLogWithRetry({
      jobId: job.id,
      queueName: QUEUE_NAMES.ONBOARDING_GENERATION,
      jobName,
      inputData: sanitizedInputData as unknown as Record<string, unknown>,
      priority: opts?.priority,
      maxAttempts: opts?.attempts ?? 3,
      jobOptions: {
        attempts: opts?.attempts ?? 3,
        backoff: opts?.backoff ?? { type: "exponential", delay: 120000 },
      } as unknown as Record<string, unknown>,
      status: "waiting",
    })

    if (logId) {
      logger.info(
        {
          jobId: job.id,
          logId,
          workspaceId: data.workspaceId,
          queueName: QUEUE_NAMES.ONBOARDING_GENERATION,
        },
        "[OnboardingQueue] Job added with DB logging",
      )
    } else {
      // 로그 생성 실패 시 경고 (Job은 이미 실행됨)
      logger.warn(
        { jobId: job.id, workspaceId: data.workspaceId },
        "[OnboardingQueue] Job added but DB logging failed - job will run without tracking",
      )
    }
  }

  return job
}
