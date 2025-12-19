/**
 * BullMQ Onboarding Auto-Generate Worker
 *
 * Handles auto-generation of onboarding data with checkpointing and resilience
 * Survives server restarts and continues from last checkpoint
 */

import { type Job, Worker } from "bullmq"
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

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

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

    // Phase 1: Discovery (if not completed)
    if (checkpoint.phase === "init" || checkpoint.phase === "discovery") {
      logger.info({ jobId }, "[OnboardingWorker] Starting discovery phase")
      const discoveryResult = await workerService.runDiscoveryPhase(job, context)
      leadIds = discoveryResult.leadIds
      logger.info(
        { jobId, leadsCount: discoveryResult.count },
        "[OnboardingWorker] Discovery phase complete",
      )

      // Report progress
      await job.updateProgress({
        phase: "discovery",
        leadsDiscovered: discoveryResult.count,
        progressPercent: 30,
      })
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
        .limit(300)
      leadIds = existingLeads.map((l) => l.id)
      logger.info(
        { jobId, leadsCount: leadIds.length },
        "[OnboardingWorker] Recovered lead IDs with emails from DB",
      )
    }

    // Phase 2: Customer Group (if not completed)
    if (!customerGroupId || checkpoint.phase === "group") {
      logger.info({ jobId }, "[OnboardingWorker] Starting group phase")
      customerGroupId = await workerService.runGroupPhase(job, context, leadIds)
      logger.info({ jobId, customerGroupId }, "[OnboardingWorker] Group phase complete")

      await job.updateProgress({
        phase: "group",
        customerGroupId,
        progressPercent: 50,
      })
    }

    // Phase 3: Templates (if not completed)
    let templates: Array<{
      stepOrder: number
      delayDays: number
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
    }> = []

    if (checkpoint.phase === "templates" || !sequenceId) {
      logger.info({ jobId }, "[OnboardingWorker] Starting templates phase")
      templates = await workerService.runTemplatesPhase(job, context)
      logger.info(
        { jobId, templatesCount: templates.length },
        "[OnboardingWorker] Templates phase complete",
      )

      await job.updateProgress({
        phase: "templates",
        templatesGenerated: templates.length,
        progressPercent: 65,
      })
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

    if (!sequenceId || checkpoint.phase === "sequence") {
      if (!customerGroupId) {
        throw new Error("Customer group ID missing for sequence phase")
      }

      logger.info({ jobId }, "[OnboardingWorker] Starting sequence phase")
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

      await job.updateProgress({
        phase: "sequence",
        sequenceId,
        stepsCreated: steps.length,
        progressPercent: 80,
      })
    }

    // Phase 5: Previews (if not completed)
    if (checkpoint.phase === "previews" || checkpoint.phase !== "complete") {
      if (!sequenceId) {
        throw new Error("Sequence ID missing for previews phase")
      }

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

      logger.info({ jobId }, "[OnboardingWorker] Starting previews phase")
      const previewCount = await workerService.runPreviewsPhase(
        job,
        context,
        sequenceId,
        steps,
        leadIds,
      )
      logger.info({ jobId, previewCount }, "[OnboardingWorker] Previews phase complete")

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

  // ========================================
  // Event Handlers with DB Logging
  // ========================================

  /**
   * Job 완료 이벤트
   */
  onboardingWorker.on("completed", async (job, result) => {
    const jobId = job.id || "unknown"
    const startTime = jobStartTimes.get(jobId) || Date.now()

    // Health 서버에 완료 기록
    recordJobCompleted()

    try {
      await jobLogService.logJobCompleted(job, result, startTime)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[OnboardingWorker] Failed to log job completion")
    } finally {
      jobStartTimes.delete(jobId)
    }

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

    try {
      await jobLogService.logJobFailed(job, err, startTime)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[OnboardingWorker] Failed to log job failure")
    } finally {
      if (jobId) jobStartTimes.delete(jobId)
    }

    logger.error(
      { jobId, error: err.message, attempts: job?.attemptsMade },
      "[OnboardingWorker] Job failed",
    )
  })

  /**
   * Job Stalled 이벤트
   */
  onboardingWorker.on("stalled", async (jobId) => {
    try {
      await jobLogService.logJobStalled(jobId, QUEUE_NAMES.ONBOARDING_GENERATION)
    } catch (logError) {
      logger.error({ jobId, error: logError }, "[OnboardingWorker] Failed to log job stall")
    }

    logger.warn({ jobId }, "[OnboardingWorker] Job stalled")
  })

  /**
   * Job Progress 이벤트
   */
  onboardingWorker.on("progress", (job, progress) => {
    const jobId = job.id || "unknown"
    logger.info({ jobId, progress }, "[OnboardingWorker] Job progress updated")
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
  onboardingWorker.on("ready", () => {
    logger.info("[OnboardingWorker] Worker is ready to process jobs")
  })

  /**
   * Worker 종료 이벤트
   */
  onboardingWorker.on("closed", () => {
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
