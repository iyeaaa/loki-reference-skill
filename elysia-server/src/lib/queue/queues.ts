import { type Job, type JobsOptions, Queue } from "bullmq"
import * as jobLogService from "../../services/job-log.service"
import logger from "../../utils/logger"
import { redisConnection } from "../redis/connection"
import {
  type CampaignEmailJob,
  type FollowupEmailJob,
  type MetricsSyncJob,
  type OnboardingAutoGenerateJob,
  type OnboardingAutoGenerateResult,
  QUEUE_NAMES,
  type ScheduledEmailJob,
  type SequenceEmailJob,
  type SequenceEmailResult,
  type TestJob,
  type TestJobResult,
  type TrialExpirationJob,
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
 * Sequence Email Queue
 * BullMQ-based sequence email sending (replaces 60-second interval worker)
 *
 * Features:
 * - Event-driven processing (no polling)
 * - Built-in rate limiting for Hunter API (10 req/sec)
 * - Automatic retry with exponential backoff
 * - Stall detection and recovery
 * - Full lifecycle logging to PostgreSQL
 */
export const sequenceEmailQueue = new Queue<SequenceEmailJob>(QUEUE_NAMES.SEQUENCE_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30000, // 30 seconds base delay for email failures
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24 hours
      count: 5000, // Keep max 5000 completed jobs (higher volume)
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
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
 * Trial Expiration Queue
 * Checks for expired trial subscriptions daily at midnight
 * Marks expired trials and pauses their active campaigns
 */
export const trialExpirationQueue = new Queue<TrialExpirationJob>(QUEUE_NAMES.TRIAL_EXPIRATION, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2, // Retry once on failure
    backoff: {
      type: "fixed",
      delay: 60000, // 1 minute between retries
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      count: 30, // Keep max 30 completed jobs (1 month if daily)
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed jobs for 30 days
    },
  },
})

/**
 * Followup Email Queue
 * Checks for users who stopped at various onboarding steps
 * Sends personalized followup emails to re-engage them
 */
export const followupEmailQueue = new Queue<FollowupEmailJob>(QUEUE_NAMES.FOLLOWUP_EMAIL, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2, // Retry once on failure
    backoff: {
      type: "fixed",
      delay: 60000, // 1 minute between retries
    },
    removeOnComplete: {
      age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      count: 168, // Keep max 168 completed jobs (1 week if hourly)
    },
    removeOnFail: {
      age: 30 * 24 * 3600, // Keep failed jobs for 30 days
    },
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
    [QUEUE_NAMES.SEQUENCE_EMAIL]: sequenceEmailQueue,
    [QUEUE_NAMES.WORKFLOW_STEP]: workflowStepQueue,
    [QUEUE_NAMES.METRICS_SYNC]: metricsSyncQueue,
    [QUEUE_NAMES.ONBOARDING_GENERATION]: onboardingGenerationQueue,
    [QUEUE_NAMES.UNIPILE_INBOX_POLL]: unipileInboxPollQueue,
    [QUEUE_NAMES.TRIAL_EXPIRATION]: trialExpirationQueue,
    [QUEUE_NAMES.FOLLOWUP_EMAIL]: followupEmailQueue,
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
    sequenceEmailQueue.close(),
    workflowStepQueue.close(),
    metricsSyncQueue.close(),
    onboardingGenerationQueue.close(),
    unipileInboxPollQueue.close(),
    trialExpirationQueue.close(),
    followupEmailQueue.close(),
    testQueue.close(),
  ])
}

// ============================================================================
// Sequence Email Queue Helper with DB Logging
// ============================================================================

/**
 * Sequence Email Job 추가 (DB 로그 자동 생성)
 *
 * 시퀀스 스텝 실행 시 호출되어 이메일 발송 Job을 큐에 추가
 * DB에 Job 로그를 생성하여 모니터링 및 디버깅 지원
 *
 * @param data - SequenceEmailJob 데이터
 * @param opts - Job 옵션 (delay, priority 등)
 * @returns Job 객체
 */
export async function addSequenceEmailJob(
  data: SequenceEmailJob,
  opts?: JobsOptions,
): Promise<Job<SequenceEmailJob, SequenceEmailResult>> {
  const jobName = `send-step-${data.stepOrder}`

  // 중복 방지: executionId 기반 고유 jobId 생성
  const deduplicationJobId = `seq-email-${data.executionId}`

  // 기존 Job 확인 (waiting, delayed, active 상태)
  const existingJob = await sequenceEmailQueue.getJob(deduplicationJobId)
  if (existingJob) {
    const state = await existingJob.getState()
    if (state === "waiting" || state === "delayed" || state === "active") {
      logger.debug(
        {
          jobId: deduplicationJobId,
          executionId: data.executionId,
          state,
        },
        "[SequenceEmailQueue] Job already exists, returning existing job",
      )
      return existingJob
    }
    // completed, failed 상태면 새로 생성 (기존 Job 제거 후)
    await existingJob.remove()
  }

  // Queue에 Job 추가
  const job = await sequenceEmailQueue.add(jobName, data, {
    jobId: deduplicationJobId,
    ...opts,
  })

  // DB에 Job 로그 생성
  if (job.id) {
    try {
      const delayMs = opts?.delay ?? 0
      const hasDelay = delayMs > 0
      const initialStatus = hasDelay ? "delayed" : "waiting"

      await jobLogService.createJobLog({
        jobId: job.id,
        queueName: QUEUE_NAMES.SEQUENCE_EMAIL,
        jobName,
        inputData: {
          executionId: data.executionId,
          enrollmentId: data.enrollmentId,
          stepId: data.stepId,
          stepOrder: data.stepOrder,
          leadId: data.leadId,
          leadCompanyName: data.leadCompanyName,
          sequenceId: data.sequenceId,
          sequenceName: data.sequenceName,
          workspaceId: data.workspaceId,
        } as unknown as Record<string, unknown>,
        priority: opts?.priority,
        maxAttempts: opts?.attempts ?? 3,
        delayedUntil: hasDelay ? new Date(Date.now() + delayMs) : undefined,
        jobOptions: opts ? ({ ...opts } as unknown as Record<string, unknown>) : undefined,
        status: initialStatus,
      })

      logger.debug(
        {
          jobId: job.id,
          executionId: data.executionId,
          stepOrder: data.stepOrder,
          leadCompanyName: data.leadCompanyName,
          status: initialStatus,
        },
        "[SequenceEmailQueue] Job added with DB logging",
      )
    } catch (logError) {
      // 로깅 실패해도 Job은 이미 Queue에 추가됨
      logger.warn(
        { jobId: job.id, error: logError },
        "[SequenceEmailQueue] Failed to create job log, but job was added to queue",
      )
    }
  }

  return job
}

/**
 * Sequence Email Jobs 대량 추가 (배치 처리용)
 *
 * 시퀀스 활성화 시 여러 리드에 대한 이메일 Job을 한번에 추가
 *
 * @param jobs - Job 배열 [{data, opts}]
 * @returns Job 객체 배열
 */
export async function addSequenceEmailJobs(
  jobs: Array<{ data: SequenceEmailJob; opts?: JobsOptions }>,
): Promise<Job<SequenceEmailJob, SequenceEmailResult>[]> {
  if (jobs.length === 0) return []

  // BullMQ addBulk 형식으로 변환
  const bulkJobs = jobs.map(({ data, opts }) => ({
    name: `send-step-${data.stepOrder}`,
    data,
    opts: {
      jobId: `seq-email-${data.executionId}`,
      ...opts,
    },
  }))

  // Queue에 대량 Job 추가
  const addedJobs = await sequenceEmailQueue.addBulk(bulkJobs)

  // DB에 Job 로그 대량 생성
  for (let i = 0; i < addedJobs.length; i++) {
    const job = addedJobs[i]
    const jobConfig = jobs[i]

    if (!job || !jobConfig) continue

    try {
      if (!job.id) continue

      const delayMs = jobConfig.opts?.delay ?? 0
      const hasDelay = delayMs > 0
      const initialStatus = hasDelay ? "delayed" : "waiting"

      await jobLogService.createJobLog({
        jobId: job.id,
        queueName: QUEUE_NAMES.SEQUENCE_EMAIL,
        jobName: `send-step-${jobConfig.data.stepOrder}`,
        inputData: {
          executionId: jobConfig.data.executionId,
          enrollmentId: jobConfig.data.enrollmentId,
          stepId: jobConfig.data.stepId,
          stepOrder: jobConfig.data.stepOrder,
          leadId: jobConfig.data.leadId,
          sequenceId: jobConfig.data.sequenceId,
        } as unknown as Record<string, unknown>,
        priority: jobConfig.opts?.priority,
        maxAttempts: jobConfig.opts?.attempts ?? 3,
        delayedUntil: hasDelay ? new Date(Date.now() + delayMs) : undefined,
        status: initialStatus,
      })
    } catch (logError) {
      logger.warn(
        { jobId: job.id, error: logError },
        "[SequenceEmailQueue] Failed to create job log for bulk job",
      )
    }
  }

  logger.info(
    { count: addedJobs.length, queueName: QUEUE_NAMES.SEQUENCE_EMAIL },
    "[SequenceEmailQueue] Bulk jobs added with DB logging",
  )

  return addedJobs
}

/**
 * Sequence에 대한 모든 대기 중인 Job을 취소
 *
 * 시퀀스 일시정지(pause) 시 호출
 * waiting 및 delayed 상태의 Job만 제거 (active 상태는 완료될 때까지 대기)
 *
 * @param sequenceId - 취소할 시퀀스 ID
 * @returns 취소된 Job 수
 */
export async function cancelSequenceJobs(sequenceId: string): Promise<{
  canceled: number
  failed: number
  active: number
}> {
  let canceled = 0
  let failed = 0
  let active = 0

  try {
    // Get all waiting jobs
    const waitingJobs = await sequenceEmailQueue.getJobs(["waiting", "delayed"])

    for (const job of waitingJobs) {
      if (job.data.sequenceId === sequenceId) {
        try {
          const state = await job.getState()
          if (state === "active") {
            active++
            continue // Active jobs cannot be canceled
          }

          await job.remove()
          canceled++

          // Update DB log (mark as failed with cancel reason)
          if (job.id) {
            await jobLogService.updateJobLog(job.id, QUEUE_NAMES.SEQUENCE_EMAIL, {
              status: "failed",
              errorMessage: "Job canceled: Sequence paused",
              failedAt: new Date(),
            })
          }
        } catch (error) {
          failed++
          logger.warn(
            { jobId: job.id, sequenceId, error },
            "[SequenceEmailQueue] Failed to cancel job",
          )
        }
      }
    }

    logger.info(
      { sequenceId, canceled, failed, active },
      "[SequenceEmailQueue] Sequence jobs canceled",
    )

    return { canceled, failed, active }
  } catch (error) {
    logger.error({ sequenceId, error }, "[SequenceEmailQueue] Failed to cancel sequence jobs")
    throw error
  }
}

/**
 * Sequence에 대한 모든 Job 상태 조회
 *
 * @param sequenceId - 조회할 시퀀스 ID
 * @returns Job 상태별 개수
 */
export async function getSequenceJobsStatus(sequenceId: string): Promise<{
  waiting: number
  delayed: number
  active: number
  completed: number
  failed: number
  total: number
}> {
  try {
    const allJobs = await sequenceEmailQueue.getJobs([
      "waiting",
      "delayed",
      "active",
      "completed",
      "failed",
    ])

    const stats = {
      waiting: 0,
      delayed: 0,
      active: 0,
      completed: 0,
      failed: 0,
      total: 0,
    }

    for (const job of allJobs) {
      if (job.data.sequenceId === sequenceId) {
        const state = await job.getState()
        if (state in stats) {
          stats[state as keyof typeof stats]++
        }
        stats.total++
      }
    }

    return stats
  } catch (error) {
    logger.error({ sequenceId, error }, "[SequenceEmailQueue] Failed to get sequence jobs status")
    throw error
  }
}

/**
 * Job ID로 Sequence Email Job 조회
 *
 * @param jobId - Job ID (예: seq-email-{executionId})
 * @returns Job 객체 또는 null
 */
export async function getSequenceEmailJob(
  jobId: string,
): Promise<Job<SequenceEmailJob, SequenceEmailResult> | null> {
  try {
    const job = await sequenceEmailQueue.getJob(jobId)
    return job || null
  } catch (error) {
    logger.error({ jobId, error }, "[SequenceEmailQueue] Failed to get job")
    return null
  }
}

/**
 * Execution ID로 Sequence Email Job 조회
 *
 * @param executionId - Step Execution ID
 * @returns Job 객체 또는 null
 */
export async function getSequenceEmailJobByExecutionId(
  executionId: string,
): Promise<Job<SequenceEmailJob, SequenceEmailResult> | null> {
  const jobId = `seq-email-${executionId}`
  return getSequenceEmailJob(jobId)
}

/**
 * 특정 Sequence의 Waiting/Delayed Job들의 delay 시간 업데이트
 *
 * 시퀀스 재개(resume) 시 호출하여 지연된 Job들의 실행 시간 재계산
 *
 * @param sequenceId - 대상 시퀀스 ID
 * @param adjustmentMs - 조정할 밀리초 (양수: 지연 추가, 음수: 지연 감소)
 * @returns 업데이트된 Job 수
 */
export async function adjustSequenceJobDelays(
  sequenceId: string,
  adjustmentMs: number,
): Promise<{ updated: number; failed: number }> {
  let updated = 0
  let failed = 0

  try {
    const delayedJobs = await sequenceEmailQueue.getJobs(["delayed"])

    for (const job of delayedJobs) {
      if (job.data.sequenceId === sequenceId) {
        try {
          // Get current delay
          const currentDelay = job.delay || 0
          const newDelay = Math.max(0, currentDelay + adjustmentMs)

          // BullMQ doesn't support direct delay modification
          // We need to remove and re-add the job
          const jobData = job.data
          const jobOpts = job.opts

          await job.remove()
          await addSequenceEmailJob(jobData, {
            ...jobOpts,
            delay: newDelay,
          })

          updated++
        } catch (error) {
          failed++
          logger.warn(
            { jobId: job.id, sequenceId, error },
            "[SequenceEmailQueue] Failed to adjust job delay",
          )
        }
      }
    }

    logger.info(
      { sequenceId, adjustmentMs, updated, failed },
      "[SequenceEmailQueue] Sequence job delays adjusted",
    )

    return { updated, failed }
  } catch (error) {
    logger.error({ sequenceId, error }, "[SequenceEmailQueue] Failed to adjust sequence job delays")
    throw error
  }
}

/**
 * Sequence Email Queue 상태 조회 (전체)
 *
 * @returns Queue 전체 상태
 */
export async function getSequenceEmailQueueStatus(): Promise<{
  waiting: number
  delayed: number
  active: number
  completed: number
  failed: number
  paused: boolean
}> {
  const [waiting, delayed, active, completed, failed] = await Promise.all([
    sequenceEmailQueue.getWaitingCount(),
    sequenceEmailQueue.getDelayedCount(),
    sequenceEmailQueue.getActiveCount(),
    sequenceEmailQueue.getCompletedCount(),
    sequenceEmailQueue.getFailedCount(),
  ])

  return {
    waiting,
    delayed,
    active,
    completed,
    failed,
    paused: await sequenceEmailQueue.isPaused(),
  }
}

/**
 * Sequence Email Queue 일시정지
 *
 * 모든 Worker가 새 Job 처리를 중단 (현재 처리 중인 Job은 완료됨)
 */
export async function pauseSequenceEmailQueue(): Promise<void> {
  await sequenceEmailQueue.pause()
  logger.info("[SequenceEmailQueue] Queue paused")
}

/**
 * Sequence Email Queue 재개
 */
export async function resumeSequenceEmailQueue(): Promise<void> {
  await sequenceEmailQueue.resume()
  logger.info("[SequenceEmailQueue] Queue resumed")
}

/**
 * 실패한 Job 재시도
 *
 * @param jobId - Job ID
 * @returns 성공 여부
 */
export async function retrySequenceEmailJob(jobId: string): Promise<boolean> {
  try {
    const job = await sequenceEmailQueue.getJob(jobId)
    if (!job) {
      logger.warn({ jobId }, "[SequenceEmailQueue] Job not found for retry")
      return false
    }

    const state = await job.getState()
    if (state !== "failed") {
      logger.warn({ jobId, state }, "[SequenceEmailQueue] Job is not in failed state")
      return false
    }

    await job.retry()
    logger.info({ jobId }, "[SequenceEmailQueue] Job retry initiated")
    return true
  } catch (error) {
    logger.error({ jobId, error }, "[SequenceEmailQueue] Failed to retry job")
    return false
  }
}

/**
 * Sequence의 모든 실패한 Job 재시도
 *
 * @param sequenceId - 대상 시퀀스 ID
 * @returns 재시도된 Job 수
 */
export async function retryFailedSequenceJobs(
  sequenceId: string,
): Promise<{ retried: number; failed: number }> {
  let retried = 0
  let failed = 0

  try {
    const failedJobs = await sequenceEmailQueue.getJobs(["failed"])

    for (const job of failedJobs) {
      if (job.data.sequenceId === sequenceId) {
        try {
          await job.retry()
          retried++
        } catch (error) {
          failed++
          logger.warn(
            { jobId: job.id, sequenceId, error },
            "[SequenceEmailQueue] Failed to retry job",
          )
        }
      }
    }

    logger.info({ sequenceId, retried, failed }, "[SequenceEmailQueue] Failed jobs retry completed")

    return { retried, failed }
  } catch (error) {
    logger.error({ sequenceId, error }, "[SequenceEmailQueue] Failed to retry failed sequence jobs")
    throw error
  }
}

/**
 * Enrollment에 대한 모든 대기 중인 Job을 취소
 *
 * 등록 중단(stop) 시 호출
 * waiting 및 delayed 상태의 Job만 제거 (active 상태는 완료될 때까지 대기)
 *
 * @param enrollmentId - 취소할 등록 ID
 * @returns 취소된 Job 수
 */
export async function cancelEnrollmentJobs(enrollmentId: string): Promise<{
  canceled: number
  failed: number
  active: number
}> {
  let canceled = 0
  let failed = 0
  let active = 0

  try {
    const waitingJobs = await sequenceEmailQueue.getJobs(["waiting", "delayed"])

    for (const job of waitingJobs) {
      if (job.data.enrollmentId === enrollmentId) {
        try {
          const state = await job.getState()
          if (state === "active") {
            active++
            continue
          }

          await job.remove()
          canceled++

          if (job.id) {
            await jobLogService.updateJobLog(job.id, QUEUE_NAMES.SEQUENCE_EMAIL, {
              status: "failed",
              errorMessage: "Job canceled: Enrollment stopped",
              failedAt: new Date(),
            })
          }
        } catch (error) {
          failed++
          logger.warn(
            { jobId: job.id, enrollmentId, error },
            "[SequenceEmailQueue] Failed to cancel enrollment job",
          )
        }
      }
    }

    logger.info(
      { enrollmentId, canceled, failed, active },
      "[SequenceEmailQueue] Enrollment jobs canceled",
    )

    return { canceled, failed, active }
  } catch (error) {
    logger.error({ enrollmentId, error }, "[SequenceEmailQueue] Failed to cancel enrollment jobs")
    throw error
  }
}

/**
 * Lead에 대한 모든 대기 중인 Job을 취소
 *
 * 리드 구독취소(unsubscribe) 시 호출
 * waiting 및 delayed 상태의 Job만 제거
 *
 * @param leadId - 취소할 리드 ID
 * @returns 취소된 Job 수
 */
export async function cancelLeadJobs(leadId: string): Promise<{
  canceled: number
  failed: number
  active: number
}> {
  let canceled = 0
  let failed = 0
  let active = 0

  try {
    const waitingJobs = await sequenceEmailQueue.getJobs(["waiting", "delayed"])

    for (const job of waitingJobs) {
      if (job.data.leadId === leadId) {
        try {
          const state = await job.getState()
          if (state === "active") {
            active++
            continue
          }

          await job.remove()
          canceled++

          if (job.id) {
            await jobLogService.updateJobLog(job.id, QUEUE_NAMES.SEQUENCE_EMAIL, {
              status: "failed",
              errorMessage: "Job canceled: Lead unsubscribed",
              failedAt: new Date(),
            })
          }
        } catch (error) {
          failed++
          logger.warn(
            { jobId: job.id, leadId, error },
            "[SequenceEmailQueue] Failed to cancel lead job",
          )
        }
      }
    }

    logger.info({ leadId, canceled, failed, active }, "[SequenceEmailQueue] Lead jobs canceled")

    return { canceled, failed, active }
  } catch (error) {
    logger.error({ leadId, error }, "[SequenceEmailQueue] Failed to cancel lead jobs")
    throw error
  }
}

/**
 * Execution ID로 특정 Job 취소
 *
 * @param executionId - Step Execution ID
 * @returns 취소 성공 여부
 */
export async function cancelExecutionJob(executionId: string): Promise<boolean> {
  try {
    const jobId = `seq-email-${executionId}`
    const job = await sequenceEmailQueue.getJob(jobId)

    if (!job) {
      logger.debug({ executionId }, "[SequenceEmailQueue] Job not found for cancellation")
      return false
    }

    const state = await job.getState()
    if (state === "active") {
      logger.warn({ executionId, state }, "[SequenceEmailQueue] Cannot cancel active job")
      return false
    }

    await job.remove()

    await jobLogService.updateJobLog(jobId, QUEUE_NAMES.SEQUENCE_EMAIL, {
      status: "failed",
      errorMessage: "Job canceled manually",
      failedAt: new Date(),
    })

    logger.info({ executionId }, "[SequenceEmailQueue] Execution job canceled")
    return true
  } catch (error) {
    logger.error({ executionId, error }, "[SequenceEmailQueue] Failed to cancel execution job")
    return false
  }
}

/**
 * 기존 pending execution을 BullMQ Job으로 마이그레이션
 *
 * 60초 워커에서 BullMQ 워커로 전환 시 일회성 실행
 * Active 시퀀스의 pending 상태 step execution만 BullMQ Job으로 생성
 *
 * 최적화:
 * - Active 시퀀스만 필터링 (paused 시퀀스는 resume 시 enqueueExistingPendingExecutions로 처리)
 * - 배치 처리 (50개씩) - 메모리 효율성
 * - 커서 기반 페이지네이션 - OFFSET 성능 이슈 방지
 *
 * @param sequenceId - 특정 시퀀스만 마이그레이션 (optional, 없으면 전체)
 * @returns 마이그레이션 결과
 */
export async function migratePendingExecutionsToBullMQ(sequenceId?: string): Promise<{
  migrated: number
  skipped: number
  failed: number
}> {
  // Lazy import to avoid circular dependencies
  const { db } = await import("../../db")
  const { and, eq, lte, gt, asc } = await import("drizzle-orm")
  const { sequenceStepExecutions, sequenceSteps, sequenceEnrollments, sequences } = await import(
    "../../db/schema/sequences"
  )
  const { leads } = await import("../../db/schema/leads")

  let migrated = 0
  let skipped = 0
  let failed = 0

  const BATCH_SIZE = 50 // 메모리 효율을 위해 50개씩 처리
  let lastId: string | null = null
  let batchNumber = 0

  try {
    const now = new Date()

    logger.info(
      { sequenceId, batchSize: BATCH_SIZE },
      "[SequenceEmailQueue] Starting batch migration for ACTIVE sequences only",
    )

    // 배치 처리 루프 (커서 기반)
    while (true) {
      // Build query conditions
      // Active 시퀀스 + Active enrollment만 마이그레이션
      // Paused 시퀀스의 pending은 resume 시 enqueueExistingPendingExecutions()로 처리됨
      const conditions = [
        eq(sequenceStepExecutions.status, "pending"),
        lte(sequenceStepExecutions.scheduledAt, now),
        eq(sequences.status, "active"), // Active 시퀀스만
        eq(sequenceEnrollments.status, "active"), // Active enrollment만
      ]

      if (sequenceId) {
        conditions.push(eq(sequences.id, sequenceId))
      }

      // 커서 기반 페이지네이션 (OFFSET 대신 ID 기반)
      if (lastId) {
        conditions.push(gt(sequenceStepExecutions.id, lastId))
      }

      // 배치 조회
      const batch = await db
        .select({
          executionId: sequenceStepExecutions.id,
          enrollmentId: sequenceStepExecutions.enrollmentId,
          stepId: sequenceStepExecutions.stepId,
          stepOrder: sequenceStepExecutions.stepOrder,
          scheduledAt: sequenceStepExecutions.scheduledAt,
          emailSubject: sequenceSteps.emailSubject,
          emailBodyText: sequenceSteps.emailBodyText,
          emailBodyHtml: sequenceSteps.emailBodyHtml,
          attachments: sequenceSteps.attachments,
          leadId: sequenceEnrollments.leadId,
          emailAccountId: sequenceEnrollments.userEmailAccountId,
          sequenceId: sequenceEnrollments.sequenceId,
          sequenceName: sequences.name,
          workspaceId: sequences.workspaceId,
          userId: sequences.createdBy,
          leadCompanyName: leads.companyName,
        })
        .from(sequenceStepExecutions)
        .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
        .innerJoin(
          sequenceEnrollments,
          eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id),
        )
        .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
        .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
        .where(and(...conditions))
        .orderBy(asc(sequenceStepExecutions.id))
        .limit(BATCH_SIZE)

      // 더 이상 처리할 데이터 없음
      if (batch.length === 0) {
        break
      }

      batchNumber++
      logger.info(
        { batchNumber, batchSize: batch.length, totalProcessed: migrated + skipped + failed },
        "[SequenceEmailQueue] Processing batch",
      )

      // 배치 내 각 execution 처리
      for (const exec of batch) {
        try {
          // Check if job already exists
          const existingJob = await sequenceEmailQueue.getJob(`seq-email-${exec.executionId}`)
          if (existingJob) {
            const state = await existingJob.getState()
            if (state === "waiting" || state === "delayed" || state === "active") {
              skipped++
              continue
            }
            // Remove completed/failed job to recreate
            await existingJob.remove()
          }

          const delayMs = Math.max(0, exec.scheduledAt.getTime() - Date.now())

          await addSequenceEmailJob(
            {
              executionId: exec.executionId,
              enrollmentId: exec.enrollmentId,
              stepId: exec.stepId,
              stepOrder: exec.stepOrder,
              leadId: exec.leadId,
              leadCompanyName: exec.leadCompanyName,
              emailAccountId: exec.emailAccountId,
              emailSubject: exec.emailSubject || "",
              emailBodyText: exec.emailBodyText,
              emailBodyHtml: exec.emailBodyHtml,
              sequenceName: exec.sequenceName,
              sequenceId: exec.sequenceId,
              workspaceId: exec.workspaceId,
              userId: exec.userId,
              attachments: exec.attachments as Array<{
                filename: string
                type: string
                content: string
              }> | null,
            },
            { delay: delayMs },
          )

          migrated++
        } catch (error) {
          failed++
          logger.warn(
            { executionId: exec.executionId, error },
            "[SequenceEmailQueue] Failed to migrate execution to BullMQ",
          )
        }
      }

      // 다음 배치를 위해 마지막 ID 저장
      const lastItem = batch[batch.length - 1]
      if (lastItem) {
        lastId = lastItem.executionId
      }

      // 배치가 BATCH_SIZE보다 작으면 마지막 배치
      if (batch.length < BATCH_SIZE) {
        break
      }
    }

    logger.info(
      { migrated, skipped, failed, sequenceId, totalBatches: batchNumber },
      "[SequenceEmailQueue] Migration completed",
    )

    return { migrated, skipped, failed }
  } catch (error) {
    logger.error({ sequenceId, error }, "[SequenceEmailQueue] Migration failed")
    throw error
  }
}

/**
 * 특정 시퀀스의 pending execution을 BullMQ Job으로 enqueue
 *
 * 시퀀스 Resume 시 호출하여 pending execution들을 다시 처리 대상으로 등록
 *
 * @param sequenceId - 대상 시퀀스 ID
 * @returns enqueue된 Job 수
 */
export async function enqueueExistingPendingExecutions(sequenceId: string): Promise<{
  migrated: number
  skipped: number
  failed: number
}> {
  return migratePendingExecutionsToBullMQ(sequenceId)
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
