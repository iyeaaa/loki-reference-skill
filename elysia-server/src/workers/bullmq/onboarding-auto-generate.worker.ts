/**
 * BullMQ Onboarding Auto-Generate Worker
 *
 * Handles auto-generation of onboarding data with checkpointing and resilience
 * Survives server restarts and continues from last checkpoint
 */

import { type Job, Queue, Worker } from "bullmq"
import { and, eq, isNotNull } from "drizzle-orm"
import { db } from "../../db"
import { leadContacts } from "../../db/schema/lead-details"
import { leads } from "../../db/schema/leads"
import { onboardingProgress } from "../../db/schema/onboarding"
import { sequenceSteps } from "../../db/schema/sequences"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import {
  type OnboardingAutoGenerateJob,
  type OnboardingAutoGenerateResult,
  QUEUE_NAMES,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import * as jobLogService from "../../services/job-log.service"
import * as workerService from "../../services/onboarding-worker.service"
import logger from "../../utils/logger"

// ============================================================================
// Worker State
// ============================================================================

let onboardingWorker: Worker<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult> | null = null

/** Job별 시작 시간 추적 (duration 계산용) - WeakRef 대신 TTL 기반 cleanup */
const jobStartTimes = new Map<string, number>()

/** Memory Leak 방지: 오래된 jobStartTimes 엔트리 정리 (1시간 이상 된 엔트리) */
const JOB_START_TIME_TTL_MS = 60 * 60 * 1000 // 1 hour

function cleanupStaleJobStartTimes(): void {
  const now = Date.now()
  for (const [jobId, startTime] of jobStartTimes.entries()) {
    if (now - startTime > JOB_START_TIME_TTL_MS) {
      jobStartTimes.delete(jobId)
      logger.debug({ jobId }, "[OnboardingWorker] Cleaned up stale job start time entry")
    }
  }
}

/** Phase 순서 정의 (복구 로직에서 사용) */
const PHASE_ORDER = [
  "init",
  "discovery",
  "group",
  "templates",
  "sequence",
  "previews",
  "complete",
] as const
type Phase = (typeof PHASE_ORDER)[number]

/** 현재 phase가 target phase보다 이전인지 확인 */
function isPhaseBefore(current: string, target: Phase): boolean {
  const currentIndex = PHASE_ORDER.indexOf(current as Phase)
  const targetIndex = PHASE_ORDER.indexOf(target)
  return currentIndex < targetIndex
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Onboarding Auto-Generate Job 처리 함수
 *
 * Phase-based execution with checkpointing:
 * 1. Discovery - Discover and enrich leads, save incrementally
 * 2. Group - Create customer group
 * 3. Templates - Generate email templates
 * 4. Sequence - Create sequence and steps
 * 5. Previews - Generate preview emails
 * 6. Complete - Update onboarding progress
 */
async function processOnboardingJob(
  job: Job<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>,
): Promise<OnboardingAutoGenerateResult> {
  const { workspaceId, userId, surveyData } = job.data
  const jobId = job.id || "unknown"

  // 시작 시간 기록
  const startTime = Date.now()
  jobStartTimes.set(jobId, startTime)

  logger.info(
    { jobId, workspaceId, userId, attempt: job.attemptsMade + 1 },
    "[OnboardingWorker] Processing job",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, "onboarding-auto-generate-worker")
  } catch (logError) {
    logger.warn({ jobId, error: logError }, "[OnboardingWorker] Failed to log job start")
  }

  // Update job ID in onboarding_progress
  await db
    .update(onboardingProgress)
    .set({
      jobId,
      jobStatus: "active",
      updatedAt: new Date(),
    })
    .where(eq(onboardingProgress.workspaceId, workspaceId))

  try {
    // Validate required survey data fields
    if (
      !surveyData.industry ||
      !surveyData.target ||
      !surveyData.country ||
      !surveyData.experience
    ) {
      throw new Error(
        `Invalid survey data: missing required fields (industry: ${!!surveyData.industry}, target: ${!!surveyData.target}, country: ${!!surveyData.country}, experience: ${!!surveyData.experience})`,
      )
    }

    // Load checkpoint from BullMQ job data
    const checkpoint = workerService.loadCheckpoint(job)
    logger.info({ jobId, checkpoint }, "[OnboardingWorker] Loaded checkpoint from job data")

    const context: workerService.JobContext = {
      workspaceId,
      userId,
      surveyData: {
        industry: surveyData.industry,
        target: surveyData.target,
        country: surveyData.country,
        experience: surveyData.experience,
        lang: surveyData.lang,
      },
    }

    let leadIds: string[] = []
    let customerGroupId = checkpoint.customerGroupId
    let sequenceId = checkpoint.sequenceId
    let templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []

    // 🚀 Phase 1 & 3 병렬 실행: Discovery와 Templates는 독립적
    const shouldRunDiscovery = checkpoint.phase === "init" || checkpoint.phase === "discovery"
    const shouldRunTemplates =
      checkpoint.phase === "templates" ||
      isPhaseBefore(checkpoint.phase, "templates") ||
      !sequenceId

    if (shouldRunDiscovery || shouldRunTemplates) {
      logger.info(
        { jobId },
        `[OnboardingWorker] 🚀 Parallel execution: Discovery=${shouldRunDiscovery}, Templates=${shouldRunTemplates}`,
      )

      // 병렬 실행 (각 phase가 독립적으로 parallelProgress를 SSE로 전송)
      const [discoveryResult, templatesResult] = await Promise.allSettled([
        shouldRunDiscovery
          ? workerService.runDiscoveryPhase(job, context)
          : Promise.resolve({ leadIds: [], count: 0 }),
        shouldRunTemplates ? workerService.runTemplatesPhase(job, context) : Promise.resolve([]),
      ])

      // Phase 1 결과 처리
      if (shouldRunDiscovery) {
        if (discoveryResult.status === "fulfilled") {
          leadIds = discoveryResult.value.leadIds
          logger.info(
            { jobId, leadsCount: discoveryResult.value.count },
            "[OnboardingWorker] Discovery phase complete (parallel)",
          )

          await workerService.saveCheckpoint(job, { phase: "discovery" })
          await job.updateProgress({
            phase: "discovery",
            leadsDiscovered: discoveryResult.value.count,
            progressPercent: 25, // 병렬 실행이므로 낮게 조정
          })
        } else {
          logger.error(
            { jobId, error: discoveryResult.reason },
            "[OnboardingWorker] Discovery phase failed",
          )
          throw discoveryResult.reason
        }
      } else {
        // Recovery: Get existing lead IDs with emails from DB
        const existingLeads = await db
          .select({ id: leads.id })
          .from(leads)
          .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
          .where(
            and(
              eq(leads.workspaceId, workspaceId),
              eq(leadContacts.contactType, "email"),
              eq(leadContacts.isPrimary, true),
              isNotNull(leadContacts.contactValue),
            ),
          )
          .limit(150)
        leadIds = existingLeads.map((l) => l.id)
        logger.info(
          { jobId, leadsCount: leadIds.length },
          "[OnboardingWorker] Recovered lead IDs with emails from DB",
        )
      }

      // Phase 3 결과 처리 (병렬 실행)
      if (shouldRunTemplates) {
        if (templatesResult.status === "fulfilled") {
          templates = templatesResult.value
          logger.info(
            { jobId, templatesCount: templates.length },
            "[OnboardingWorker] Templates phase complete (parallel)",
          )

          await workerService.saveCheckpoint(job, {
            phase: "templates",
            generatedTemplates: templates,
          })
          await job.updateProgress({
            phase: "templates",
            templatesGenerated: templates.length,
            progressPercent: 40, // 병렬 실행 완료 시점
          })
        } else {
          logger.error(
            { jobId, error: templatesResult.reason },
            "[OnboardingWorker] Templates phase failed",
          )
          throw templatesResult.reason
        }
      }
    } else {
      // Recovery: Get existing lead IDs if not running discovery
      if (!shouldRunDiscovery) {
        const existingLeads = await db
          .select({ id: leads.id })
          .from(leads)
          .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
          .where(
            and(
              eq(leads.workspaceId, workspaceId),
              eq(leadContacts.contactType, "email"),
              eq(leadContacts.isPrimary, true),
              isNotNull(leadContacts.contactValue),
            ),
          )
          .limit(150)
        leadIds = existingLeads.map((l) => l.id)
        logger.info(
          { jobId, leadsCount: leadIds.length },
          "[OnboardingWorker] Recovered lead IDs with emails from DB",
        )
      }
    }

    // Phase 2: Customer Group (Discovery 완료 후 실행)
    if (!customerGroupId || checkpoint.phase === "group") {
      logger.info({ jobId }, "[OnboardingWorker] Starting group phase")
      customerGroupId = await workerService.runGroupPhase(job, context, leadIds)
      logger.info({ jobId, customerGroupId }, "[OnboardingWorker] Group phase complete")

      await workerService.saveCheckpoint(job, { phase: "group", customerGroupId })
      await job.updateProgress({
        phase: "group",
        customerGroupId,
        progressPercent: 55, // Discovery + Templates 병렬 완료 후
      })
    }

    // Recovery: Load templates from checkpoint if not generated in this run
    if (templates.length === 0 && checkpoint.generatedTemplates) {
      templates = checkpoint.generatedTemplates
      logger.info(
        { jobId, templatesCount: templates.length },
        "[OnboardingWorker] Recovered templates from checkpoint",
      )
    }

    // Phase 4: Sequence (if not completed)
    let steps: Array<{
      stepId: string
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string | null
    }> = []

    // 수정: sequence phase 조건 명확화
    const shouldRunSequence =
      !sequenceId || checkpoint.phase === "sequence" || isPhaseBefore(checkpoint.phase, "sequence")

    if (shouldRunSequence) {
      if (!customerGroupId) {
        throw new Error("Customer group ID missing for sequence phase")
      }

      logger.info(
        { jobId, currentPhase: checkpoint.phase },
        "[OnboardingWorker] Starting sequence phase",
      )
      const sequenceResult = await workerService.runSequencePhase(
        job,
        context,
        customerGroupId,
        leadIds,
        templates,
      )
      sequenceId = sequenceResult.sequenceId
      steps = sequenceResult.steps
      logger.info({ jobId, sequenceId }, "[OnboardingWorker] Sequence phase complete")

      // Checkpoint 저장: sequence 완료 (sequenceId 포함)
      await workerService.saveCheckpoint(job, { phase: "sequence", sequenceId })

      await job.updateProgress({
        phase: "sequence",
        sequenceId,
        stepsCreated: steps.length,
        progressPercent: 70, // 병렬 실행 반영한 진행률
      })
    }

    // Phase 5: Previews (if not completed)
    // 수정: 명확한 조건 - previews phase 이전이거나 previews에서 재시작하는 경우에만 실행
    const shouldRunPreviews =
      checkpoint.phase === "previews" || isPhaseBefore(checkpoint.phase, "previews")

    if (shouldRunPreviews && sequenceId) {
      // If steps array is empty, fetch from DB
      if (steps.length === 0) {
        const sequenceStepsData = await db
          .select()
          .from(sequenceSteps)
          .where(eq(sequenceSteps.sequenceId, sequenceId))
          .orderBy(sequenceSteps.stepOrder)

        steps = sequenceStepsData.map((s) => ({
          stepId: s.id,
          stepOrder: s.stepOrder,
          delayDays: s.delayDays,
          emailSubject: s.emailSubject || "",
          emailBodyText: s.emailBodyText || "",
          emailBodyHtml: s.emailBodyHtml,
        }))
      }

      logger.info(
        { jobId, currentPhase: checkpoint.phase },
        "[OnboardingWorker] Starting previews phase",
      )
      const previewCount = await workerService.runPreviewsPhase(
        job,
        context,
        sequenceId,
        steps,
        leadIds,
      )
      logger.info({ jobId, previewCount }, "[OnboardingWorker] Previews phase complete")

      // Checkpoint 저장: previews 완료
      await workerService.saveCheckpoint(job, { phase: "previews" })

      await job.updateProgress({
        phase: "previews",
        previewsGenerated: previewCount,
        progressPercent: 95,
      })
    }

    // Phase 6: Complete
    if (customerGroupId && sequenceId) {
      logger.info({ jobId }, "[OnboardingWorker] Starting complete phase")
      await workerService.completeOnboarding(job, context, customerGroupId, sequenceId, leadIds)
      logger.info({ jobId }, "[OnboardingWorker] Complete phase done")

      await job.updateProgress({
        phase: "complete",
        progressPercent: 100,
      })
    }

    // Update job status in onboarding_progress
    await db
      .update(onboardingProgress)
      .set({
        jobStatus: "completed",
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.workspaceId, workspaceId))

    const result: OnboardingAutoGenerateResult = {
      success: true,
      phase: "complete",
      leadsGenerated: leadIds.length,
      customerGroupId,
      sequenceId,
    }

    logger.info({ jobId, result }, "[OnboardingWorker] Job completed successfully")

    return result
  } catch (error) {
    logger.error({ jobId, error }, "[OnboardingWorker] Job failed")

    // Update job status in onboarding_progress
    await db
      .update(onboardingProgress)
      .set({
        jobStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(onboardingProgress.workspaceId, workspaceId))

    // Add error to checkpoint in BullMQ job data
    await workerService.addCheckpointError(job, "job", String(error))

    throw error
  }
}

// ============================================================================
// Worker Management
// ============================================================================

/** Memory cleanup interval reference */
let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * 서버 재시작 후 stuck 상태의 작업을 복구
 * - Active 상태로 남아있지만 실제로 처리되지 않는 작업을 감지
 * - 해당 작업을 waiting 상태로 되돌려서 재처리
 */
async function recoverStuckJobs(): Promise<void> {
  const queue = new Queue<OnboardingAutoGenerateJob>(QUEUE_NAMES.ONBOARDING_GENERATION, {
    connection: createRedisConnection(),
  })

  try {
    // Active 상태의 작업 가져오기
    const activeJobs = await queue.getActive()

    if (activeJobs.length === 0) {
      logger.info("[OnboardingWorker] No stuck jobs to recover")
      await queue.close()
      return
    }

    logger.info(
      { count: activeJobs.length },
      "[OnboardingWorker] Found active jobs to check for recovery",
    )

    for (const job of activeJobs) {
      // 작업 시작 시간 확인 (processedOn은 작업이 시작된 시간)
      const processedOn = job.processedOn
      const now = Date.now()

      // 10분 이상 진행 중인 작업은 stuck으로 간주
      // (lockDuration이 10분이므로, 정상적인 작업은 10분 내에 heartbeat를 보냄)
      const STUCK_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

      if (processedOn && now - processedOn > STUCK_THRESHOLD_MS) {
        logger.warn(
          {
            jobId: job.id,
            workspaceId: job.data.workspaceId,
            processedOn: new Date(processedOn).toISOString(),
            stuckDuration: `${Math.round((now - processedOn) / 1000 / 60)} minutes`,
          },
          "[OnboardingWorker] Recovering stuck job - moving back to waiting",
        )

        try {
          // 작업을 실패 상태로 변경 (자동으로 재시도됨)
          await job.moveToFailed(
            new Error("Job stuck after server restart - auto-recovering"),
            job.token || "recovery",
            false, // fetchNext = false
          )

          // 재시도가 남아있으면 자동으로 다시 queue에 추가됨
          // 재시도가 없으면 새 작업을 추가
          if (job.attemptsMade >= (job.opts.attempts || 3)) {
            // 최대 재시도 초과 - 새 작업 추가
            await queue.add("onboarding-recovery", job.data, {
              attempts: 3,
              backoff: { type: "exponential", delay: 5000 },
              jobId: `recovery-${job.data.workspaceId}-${Date.now()}`,
            })
            logger.info(
              { jobId: job.id, workspaceId: job.data.workspaceId },
              "[OnboardingWorker] Created new recovery job (max retries exceeded)",
            )
          } else {
            logger.info(
              { jobId: job.id, attemptsMade: job.attemptsMade },
              "[OnboardingWorker] Job will be auto-retried by BullMQ",
            )
          }
        } catch (moveError) {
          logger.error(
            { jobId: job.id, error: moveError },
            "[OnboardingWorker] Failed to recover stuck job",
          )
        }
      } else {
        logger.debug(
          {
            jobId: job.id,
            processedOn: processedOn ? new Date(processedOn).toISOString() : "N/A",
          },
          "[OnboardingWorker] Job is recently active, not stuck",
        )
      }
    }
  } catch (error) {
    logger.error({ error }, "[OnboardingWorker] Error during stuck job recovery")
  } finally {
    await queue.close()
  }
}

/** 로그 기록 재시도 헬퍼 */
async function logWithRetry<T>(
  operation: () => Promise<T>,
  context: { jobId?: string; operation: string },
  maxAttempts: number = 3,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error(
          { ...context, error, attempt },
          `[OnboardingWorker] ${context.operation} failed after all retries`,
        )
        return null
      }
      // 짧은 대기 후 재시도
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
    }
  }
  return null
}

/**
 * Onboarding Auto-Generate Worker 시작
 */
export function startOnboardingAutoGenerateWorker(): Worker<
  OnboardingAutoGenerateJob,
  OnboardingAutoGenerateResult
> {
  if (onboardingWorker) {
    logger.warn("[OnboardingWorker] Worker already running")
    return onboardingWorker
  }

  onboardingWorker = new Worker<OnboardingAutoGenerateJob, OnboardingAutoGenerateResult>(
    QUEUE_NAMES.ONBOARDING_GENERATION,
    processOnboardingJob,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Process one job at a time to avoid API rate limits
      lockDuration: 600000, // 10 minutes - job lock duration (prevents stalling for long operations)
      stalledInterval: 30000, // Check for stalled jobs every 30s (default)
      maxStalledCount: 3, // Allow job to be stalled 3 times before failing (job can take up to 30 min)
      removeOnComplete: {
        age: 7 * 24 * 3600, // Keep completed jobs for 7 days
      },
      removeOnFail: {
        age: 30 * 24 * 3600, // Keep failed jobs for 30 days
      },
    },
  )

  // Memory Leak 방지: 주기적으로 오래된 jobStartTimes 정리 (5분마다)
  cleanupInterval = setInterval(
    () => {
      cleanupStaleJobStartTimes()
    },
    5 * 60 * 1000,
  )

  // ========================================
  // Event Handlers with DB Logging (재시도 로직 포함)
  // ========================================

  /**
   * Job 완료 이벤트
   */
  onboardingWorker.on("completed", async (job, result) => {
    const jobId = job.id || "unknown"
    const startTime = jobStartTimes.get(jobId) || Date.now()

    // Health 서버에 완료 기록
    recordJobCompleted()

    // DB 로깅 (재시도 포함)
    await logWithRetry(() => jobLogService.logJobCompleted(job, result, startTime), {
      jobId,
      operation: "logJobCompleted",
    })

    // Cleanup
    jobStartTimes.delete(jobId)

    logger.info({ jobId, result }, "[OnboardingWorker] Job completed successfully")
  })

  /**
   * Job 실패 이벤트
   */
  onboardingWorker.on("failed", async (job, err) => {
    const jobId = job?.id
    const startTime = jobId ? jobStartTimes.get(jobId) : undefined

    // Health 서버에 실패 기록
    recordJobFailed()

    // DB 로깅 (재시도 포함)
    await logWithRetry(() => jobLogService.logJobFailed(job, err, startTime), {
      jobId,
      operation: "logJobFailed",
    })

    // Cleanup
    if (jobId) jobStartTimes.delete(jobId)

    logger.error(
      { jobId, error: err.message, attempts: job?.attemptsMade },
      "[OnboardingWorker] Job failed",
    )
  })

  /**
   * Job Stalled 이벤트
   */
  onboardingWorker.on("stalled", async (jobId) => {
    // DB 로깅 (재시도 포함)
    await logWithRetry(
      () => jobLogService.logJobStalled(jobId, QUEUE_NAMES.ONBOARDING_GENERATION),
      { jobId, operation: "logJobStalled" },
    )

    logger.warn({ jobId }, "[OnboardingWorker] Job stalled")
  })

  /**
   * Job Progress 이벤트
   */
  onboardingWorker.on("progress", (job, progress) => {
    const jobId = job.id || "unknown"
    logger.debug({ jobId, progress }, "[OnboardingWorker] Job progress updated")
  })

  /**
   * Worker 에러 이벤트
   */
  onboardingWorker.on("error", (err) => {
    logger.error({ error: err.message, stack: err.stack }, "[OnboardingWorker] Worker error")
  })

  /**
   * Worker 준비 완료 이벤트
   */
  onboardingWorker.on("ready", async () => {
    logger.info("[OnboardingWorker] Worker is ready to process jobs")

    // 서버 재시작 후 stuck 작업 복구 시도
    try {
      await recoverStuckJobs()
    } catch (error) {
      logger.error({ error }, "[OnboardingWorker] Failed to recover stuck jobs on startup")
    }
  })

  /**
   * Worker 종료 이벤트
   */
  onboardingWorker.on("closed", () => {
    // Cleanup interval 정리
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
    logger.info("[OnboardingWorker] Worker has been closed")
  })

  logger.info(
    {
      concurrency: onboardingWorker.opts.concurrency,
      queueName: QUEUE_NAMES.ONBOARDING_GENERATION,
    },
    "[OnboardingWorker] Started successfully with DB logging enabled",
  )

  return onboardingWorker
}

/**
 * Onboarding Auto-Generate Worker 중지
 */
export async function stopOnboardingAutoGenerateWorker(): Promise<void> {
  if (onboardingWorker) {
    await onboardingWorker.close()
    onboardingWorker = null
    jobStartTimes.clear()
    logger.info("[OnboardingWorker] Stopped")
  }
}

/**
 * Onboarding Auto-Generate Worker 상태 조회
 */
export function getOnboardingAutoGenerateWorkerStatus(): {
  running: boolean
  concurrency: number
  activeJobs: number
} {
  return {
    running: onboardingWorker !== null && !onboardingWorker.closing,
    concurrency: onboardingWorker?.opts.concurrency || 0,
    activeJobs: jobStartTimes.size,
  }
}

// ============================================================================
// Exports
// ============================================================================

export { onboardingWorker }
