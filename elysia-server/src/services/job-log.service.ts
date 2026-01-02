/**
 * Job Log Service
 *
 * BullMQ Job의 라이프사이클을 PostgreSQL에 기록하는 서비스
 * Worker 이벤트와 연동하여 자동으로 Job 상태를 추적
 */

import os from "node:os"
import type { Job } from "bullmq"
import { and, desc, eq, gte, lte, sql } from "drizzle-orm"
import { db } from "../db"
import { type JobStatus, jobLogs, type NewJobLog } from "../db/schema/job-logs"
import logger from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

interface JobLogCreateParams {
  jobId: string
  queueName: string
  jobName?: string
  inputData?: Record<string, unknown>
  priority?: number
  maxAttempts?: number
  delayedUntil?: Date
  jobOptions?: Record<string, unknown>
  status?: JobStatus
}

interface JobLogUpdateParams {
  status?: JobStatus
  attemptsMade?: number
  processedAt?: Date
  completedAt?: Date
  failedAt?: Date
  durationMs?: number
  outputData?: Record<string, unknown>
  errorMessage?: string
  stackTrace?: string
  errorCode?: string
  workerName?: string
  processedBy?: string
}

interface JobLogQueryParams {
  queueName?: string
  status?: JobStatus
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}

interface JobLogStats {
  queueName: string
  status: JobStatus
  count: number
  avgDurationMs: number | null
  maxDurationMs: number | null
  minDurationMs: number | null
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * 현재 서버 식별자 생성
 */
function getServerIdentifier(): string {
  return `${os.hostname()}-${process.pid}`
}

/**
 * Job 로그 생성 (Job이 Queue에 추가될 때)
 */
export async function createJobLog(params: JobLogCreateParams): Promise<string> {
  try {
    const [result] = await db
      .insert(jobLogs)
      .values({
        jobId: params.jobId,
        queueName: params.queueName,
        jobName: params.jobName,
        status: params.status ?? "waiting",
        inputData: params.inputData,
        priority: params.priority ?? 0,
        maxAttempts: params.maxAttempts ?? 3,
        delayedUntil: params.delayedUntil,
        jobOptions: params.jobOptions,
        addedAt: new Date(),
      } satisfies NewJobLog)
      .returning({ id: jobLogs.id })

    if (!result) {
      throw new Error("Failed to create job log: no result returned")
    }

    logger.debug({ jobId: params.jobId, logId: result.id }, "[JobLogService] Created job log")
    return result.id
  } catch (error) {
    logger.error({ error, params }, "[JobLogService] Failed to create job log")
    throw error
  }
}

/**
 * Job 로그 업데이트 (상태 변경 시)
 */
export async function updateJobLog(
  jobId: string,
  queueName: string,
  params: JobLogUpdateParams,
): Promise<void> {
  try {
    await db
      .update(jobLogs)
      .set({
        ...params,
        updatedAt: new Date(),
      })
      .where(and(eq(jobLogs.jobId, jobId), eq(jobLogs.queueName, queueName)))

    logger.debug({ jobId, queueName, status: params.status }, "[JobLogService] Updated job log")
  } catch (error) {
    logger.error({ error, jobId, queueName, params }, "[JobLogService] Failed to update job log")
    throw error
  }
}

/**
 * Job 시작 기록 (Worker가 Job 처리 시작)
 *
 * 개선: retry 시 첫 번째 시도 정보를 유지하면서 현재 시도 정보 기록
 */
export async function logJobStarted(job: Job, workerName?: string): Promise<void> {
  if (!job.id) {
    logger.warn("[JobLogService] Cannot log job start: job.id is missing")
    return
  }

  const serverIdentifier = getServerIdentifier()
  const isRetry = job.attemptsMade > 0

  // retry인 경우 기존 로그 조회하여 첫 시도 정보 보존
  if (isRetry) {
    const existingLog = await getJobLogByJobId(job.id, job.queueName)
    if (existingLog) {
      // retry 시에는 processedAt을 덮어쓰지 않음 (첫 번째 시도 시간 유지)
      await updateJobLog(job.id, job.queueName, {
        status: "active",
        attemptsMade: job.attemptsMade + 1,
        workerName,
        processedBy: serverIdentifier,
        // 이전 에러 정보는 유지 (outputData에 retry 히스토리 저장)
        outputData: {
          ...(existingLog.outputData as Record<string, unknown> | null),
          lastRetryAt: new Date().toISOString(),
          previousError: existingLog.errorMessage,
          previousErrorCode: existingLog.errorCode,
        },
      })
      logger.debug(
        { jobId: job.id, attemptsMade: job.attemptsMade + 1 },
        "[JobLogService] Job retry started",
      )
      return
    }
  }

  // 첫 번째 시도
  await updateJobLog(job.id, job.queueName, {
    status: "active",
    attemptsMade: job.attemptsMade + 1,
    processedAt: new Date(),
    workerName,
    processedBy: serverIdentifier,
  })
}

/**
 * Job 완료 기록
 */
export async function logJobCompleted(job: Job, result: unknown, startTime: number): Promise<void> {
  if (!job.id) {
    logger.warn("[JobLogService] Cannot log job completion: job.id is missing")
    return
  }

  const durationMs = Date.now() - startTime

  await updateJobLog(job.id, job.queueName, {
    status: "completed",
    completedAt: new Date(),
    durationMs,
    outputData: result as Record<string, unknown>,
  })

  logger.info(
    { jobId: job.id, queueName: job.queueName, durationMs },
    "[JobLogService] Job completed and logged",
  )
}

/**
 * Job 실패 기록
 */
export async function logJobFailed(
  job: Job | undefined,
  error: Error,
  startTime?: number,
): Promise<void> {
  if (!job) {
    logger.warn({ error: error.message }, "[JobLogService] Job failed but job object is undefined")
    return
  }

  const durationMs = startTime ? Date.now() - startTime : undefined

  // 에러 코드 추출 (커스텀 에러인 경우)
  const errorCode = (error as Error & { code?: string }).code || extractErrorCode(error)

  if (job.id) {
    await updateJobLog(job.id, job.queueName, {
      status: "failed",
      failedAt: new Date(),
      durationMs,
      errorMessage: error.message,
      stackTrace: error.stack,
      errorCode,
      attemptsMade: job.attemptsMade,
    })
  }

  logger.error(
    { jobId: job.id, queueName: job.queueName, error: error.message, errorCode },
    "[JobLogService] Job failed and logged",
  )
}

/**
 * Job Stalled 기록 (Worker 응답 없음)
 */
export async function logJobStalled(jobId: string, queueName: string): Promise<void> {
  await updateJobLog(jobId, queueName, {
    status: "stalled",
  })

  logger.warn({ jobId, queueName }, "[JobLogService] Job stalled and logged")
}

/**
 * Job Delayed 기록
 */
export async function logJobDelayed(
  jobId: string,
  queueName: string,
  delayedUntil: Date,
): Promise<void> {
  await updateJobLog(jobId, queueName, {
    status: "delayed",
  })

  logger.debug({ jobId, queueName, delayedUntil }, "[JobLogService] Job delayed and logged")
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Job 로그 목록 조회
 */
export async function getJobLogs(
  params: JobLogQueryParams = {},
): Promise<(typeof jobLogs.$inferSelect)[]> {
  const { queueName, status, startDate, endDate, limit = 50, offset = 0 } = params

  const conditions = []
  if (queueName) conditions.push(eq(jobLogs.queueName, queueName))
  if (status) conditions.push(eq(jobLogs.status, status))
  if (startDate) conditions.push(gte(jobLogs.addedAt, startDate))
  if (endDate) conditions.push(lte(jobLogs.addedAt, endDate))

  return db
    .select()
    .from(jobLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(jobLogs.addedAt))
    .limit(limit)
    .offset(offset)
}

/**
 * 특정 Job 로그 조회
 */
export async function getJobLogByJobId(
  jobId: string,
  queueName: string,
): Promise<typeof jobLogs.$inferSelect | null> {
  const [result] = await db
    .select()
    .from(jobLogs)
    .where(and(eq(jobLogs.jobId, jobId), eq(jobLogs.queueName, queueName)))
    .limit(1)

  return result || null
}

/**
 * Queue별 통계 조회
 */
export async function getJobStats(queueName?: string, hours: number = 24): Promise<JobLogStats[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const conditions = [gte(jobLogs.addedAt, since)]
  if (queueName) conditions.push(eq(jobLogs.queueName, queueName))

  const result = await db
    .select({
      queueName: jobLogs.queueName,
      status: jobLogs.status,
      count: sql<number>`count(*)::int`,
      avgDurationMs: sql<number>`avg(${jobLogs.durationMs})::int`,
      maxDurationMs: sql<number>`max(${jobLogs.durationMs})::int`,
      minDurationMs: sql<number>`min(${jobLogs.durationMs})::int`,
    })
    .from(jobLogs)
    .where(and(...conditions))
    .groupBy(jobLogs.queueName, jobLogs.status)

  return result as JobLogStats[]
}

/**
 * 실패한 Job 수 조회
 */
export async function getFailedJobCount(queueName?: string, hours: number = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const conditions = [eq(jobLogs.status, "failed"), gte(jobLogs.addedAt, since)]
  if (queueName) conditions.push(eq(jobLogs.queueName, queueName))

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobLogs)
    .where(and(...conditions))

  return result?.count || 0
}

/**
 * 에러 코드별 통계
 */
export async function getErrorStats(
  queueName?: string,
  hours: number = 24,
): Promise<{ errorCode: string | null; count: number }[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  const conditions = [eq(jobLogs.status, "failed"), gte(jobLogs.addedAt, since)]
  if (queueName) conditions.push(eq(jobLogs.queueName, queueName))

  return db
    .select({
      errorCode: jobLogs.errorCode,
      count: sql<number>`count(*)::int`,
    })
    .from(jobLogs)
    .where(and(...conditions))
    .groupBy(jobLogs.errorCode)
    .orderBy(desc(sql`count(*)`))
}

// ============================================================================
// Cleanup Functions
// ============================================================================

/**
 * 오래된 Job 로그 삭제 (정리용)
 *
 * 개선: stalled 상태도 일정 기간 후 정리
 */
export async function cleanupOldJobLogs(retentionDays: number = 30): Promise<{
  completed: number
  stalled: number
  total: number
}> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)
  // stalled는 더 짧은 보존 기간 (7일)
  const stalledCutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  // completed 상태 정리
  const completedResult = await db
    .delete(jobLogs)
    .where(and(lte(jobLogs.addedAt, cutoffDate), eq(jobLogs.status, "completed")))
    .returning({ id: jobLogs.id })

  // stalled 상태 정리 (복구되지 않은 오래된 stalled job)
  const stalledResult = await db
    .delete(jobLogs)
    .where(and(lte(jobLogs.addedAt, stalledCutoffDate), eq(jobLogs.status, "stalled")))
    .returning({ id: jobLogs.id })

  const result = {
    completed: completedResult.length,
    stalled: stalledResult.length,
    total: completedResult.length + stalledResult.length,
  }

  if (result.total > 0) {
    logger.info(
      { ...result, retentionDays },
      "[JobLogService] Cleaned up old job logs (completed + stalled)",
    )
  }

  return result
}

/**
 * 특정 상태의 오래된 Job 로그 삭제
 */
export async function cleanupJobLogsByStatus(
  status: JobStatus,
  retentionDays: number,
): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(jobLogs)
    .where(and(lte(jobLogs.addedAt, cutoffDate), eq(jobLogs.status, status)))
    .returning({ id: jobLogs.id })

  if (result.length > 0) {
    logger.info(
      { deletedCount: result.length, status, retentionDays },
      `[JobLogService] Cleaned up old ${status} job logs`,
    )
  }

  return result.length
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 에러 메시지에서 에러 코드 추출
 *
 * 개선: 더 많은 에러 패턴 지원 (BigQuery, Hunter.io, AI 서비스 등)
 */
function extractErrorCode(error: Error): string | undefined {
  const message = error.message.toLowerCase()
  const errorName = error.name?.toLowerCase() || ""

  // ========================================
  // 네트워크/연결 에러
  // ========================================
  if (message.includes("timeout") || message.includes("timed out")) return "TIMEOUT"
  if (message.includes("econnrefused") || message.includes("connection refused"))
    return "CONNECTION_REFUSED"
  if (message.includes("econnreset") || message.includes("connection reset"))
    return "CONNECTION_RESET"
  if (message.includes("enotfound") || message.includes("dns")) return "DNS_ERROR"
  if (message.includes("connection") && message.includes("error")) return "CONNECTION_ERROR"
  if (message.includes("network")) return "NETWORK_ERROR"

  // ========================================
  // API/서비스 에러
  // ========================================
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("429")
  )
    return "RATE_LIMIT"
  if (message.includes("quota") || message.includes("exceeded")) return "QUOTA_EXCEEDED"
  if (message.includes("unauthorized") || message.includes("401")) return "UNAUTHORIZED"
  if (message.includes("forbidden") || message.includes("403")) return "FORBIDDEN"
  if (message.includes("not found") || message.includes("404")) return "NOT_FOUND"
  if (message.includes("bad request") || message.includes("400")) return "BAD_REQUEST"
  if (message.includes("internal server error") || message.includes("500")) return "SERVER_ERROR"
  if (message.includes("service unavailable") || message.includes("503"))
    return "SERVICE_UNAVAILABLE"

  // ========================================
  // BigQuery 에러
  // ========================================
  if (message.includes("bigquery")) {
    if (message.includes("invalid query")) return "BIGQUERY_INVALID_QUERY"
    if (message.includes("access denied")) return "BIGQUERY_ACCESS_DENIED"
    return "BIGQUERY_ERROR"
  }

  // ========================================
  // Hunter.io / 이메일 enrichment 에러
  // ========================================
  if (message.includes("hunter") || message.includes("email finder")) {
    if (message.includes("credit")) return "HUNTER_CREDIT_EXHAUSTED"
    return "HUNTER_ERROR"
  }

  // ========================================
  // AI/LLM 에러
  // ========================================
  if (message.includes("openai") || message.includes("anthropic") || message.includes("claude")) {
    if (message.includes("context") || message.includes("token")) return "AI_CONTEXT_LIMIT"
    if (message.includes("content filter") || message.includes("safety"))
      return "AI_CONTENT_FILTERED"
    return "AI_SERVICE_ERROR"
  }

  // ========================================
  // 데이터베이스 에러
  // ========================================
  if (message.includes("database") || message.includes("postgres") || message.includes("sql")) {
    if (message.includes("duplicate") || message.includes("unique")) return "DB_DUPLICATE_KEY"
    if (message.includes("foreign key")) return "DB_FOREIGN_KEY"
    if (message.includes("deadlock")) return "DB_DEADLOCK"
    return "DB_ERROR"
  }

  // ========================================
  // Redis 에러
  // ========================================
  if (message.includes("redis")) {
    if (message.includes("memory")) return "REDIS_OOM"
    return "REDIS_ERROR"
  }

  // ========================================
  // 검증/비즈니스 로직 에러
  // ========================================
  if (message.includes("validation") || message.includes("invalid")) return "VALIDATION_ERROR"
  if (message.includes("missing") && (message.includes("field") || message.includes("required")))
    return "MISSING_REQUIRED_FIELD"

  // ========================================
  // 테스트 에러
  // ========================================
  if (message.includes("intentional failure") || message.includes("test failure"))
    return "TEST_FAILURE"

  // ========================================
  // 일반 에러 타입
  // ========================================
  if (errorName.includes("typeerror")) return "TYPE_ERROR"
  if (errorName.includes("syntaxerror")) return "SYNTAX_ERROR"
  if (errorName.includes("referenceerror")) return "REFERENCE_ERROR"

  return "UNKNOWN_ERROR"
}

// ============================================================================
// BullMQ Integration Helper
// ============================================================================

/**
 * BullMQ Job에서 로그 생성에 필요한 정보 추출
 */
export function extractJobLogParams(job: Job): JobLogCreateParams {
  if (!job.id) {
    throw new Error("Job ID is required")
  }

  return {
    jobId: job.id,
    queueName: job.queueName,
    jobName: job.name,
    inputData: job.data as Record<string, unknown>,
    priority: job.opts?.priority,
    maxAttempts: job.opts?.attempts,
    delayedUntil: job.opts?.delay ? new Date(Date.now() + job.opts.delay) : undefined,
    jobOptions: {
      attempts: job.opts?.attempts,
      backoff: job.opts?.backoff,
      delay: job.opts?.delay,
      priority: job.opts?.priority,
      removeOnComplete: job.opts?.removeOnComplete,
      removeOnFail: job.opts?.removeOnFail,
    },
  }
}

// ============================================================================
// Sequence Lifecycle Logging
// ============================================================================

/**
 * 시퀀스/캠페인 이벤트 타입
 */
export type SequenceEventType =
  | "sequence_created"
  | "sequence_started"
  | "sequence_paused"
  | "sequence_resumed"
  | "sequence_completed"
  | "sequence_deleted"
  | "enrollment_created"
  | "enrollment_completed"
  | "enrollment_paused"
  | "enrollment_stopped"
  | "step_scheduled"
  | "step_sent"
  | "step_failed"
  | "step_skipped"

/**
 * 시퀀스 이벤트 로그 파라미터
 */
interface SequenceEventParams {
  eventType: SequenceEventType
  sequenceId: string
  sequenceName?: string
  workspaceId: string
  enrollmentId?: string
  executionId?: string
  leadId?: string
  leadCompanyName?: string
  stepOrder?: number
  previousStatus?: string
  newStatus?: string
  reason?: string
  metadata?: Record<string, unknown>
}

const SEQUENCE_LIFECYCLE_QUEUE = "sequence-lifecycle"

/**
 * 시퀀스 라이프사이클 이벤트 로깅
 *
 * 기존 job_logs 테이블을 활용하여 시퀀스/캠페인 이벤트를 기록합니다.
 * queueName: "sequence-lifecycle"로 구분됩니다.
 */
export async function logSequenceEvent(params: SequenceEventParams): Promise<string | null> {
  const {
    eventType,
    sequenceId,
    sequenceName,
    workspaceId,
    enrollmentId,
    executionId,
    leadId,
    leadCompanyName,
    stepOrder,
    previousStatus,
    newStatus,
    reason,
    metadata,
  } = params

  const jobId = `seq-event-${sequenceId}-${eventType}-${Date.now()}`
  const serverIdentifier = getServerIdentifier()

  try {
    const [result] = await db
      .insert(jobLogs)
      .values({
        jobId,
        queueName: SEQUENCE_LIFECYCLE_QUEUE,
        jobName: eventType,
        status: "completed", // 이벤트는 즉시 완료 상태
        attemptsMade: 1,
        maxAttempts: 1,
        priority: 0,
        addedAt: new Date(),
        processedAt: new Date(),
        completedAt: new Date(),
        durationMs: 0,
        workerName: "sequence-lifecycle-logger",
        processedBy: serverIdentifier,
        inputData: {
          eventType,
          sequenceId,
          sequenceName,
          workspaceId,
          enrollmentId,
          executionId,
          leadId,
          leadCompanyName,
          stepOrder,
          previousStatus,
          newStatus,
          reason,
          ...metadata,
        },
        outputData: {
          success: true,
          eventType,
          timestamp: new Date().toISOString(),
        },
      } satisfies NewJobLog)
      .returning({ id: jobLogs.id })

    if (!result) {
      logger.warn(
        { eventType, sequenceId },
        "[JobLogService] Failed to log sequence event: no result",
      )
      return null
    }

    logger.debug(
      { eventType, sequenceId, workspaceId, logId: result.id },
      "[JobLogService] Logged sequence event",
    )
    return result.id
  } catch (error) {
    // 로깅 실패는 주요 작업을 방해하면 안됨
    logger.warn({ error, eventType, sequenceId }, "[JobLogService] Failed to log sequence event")
    return null
  }
}

/**
 * 시퀀스 시작 이벤트 로깅
 */
export async function logSequenceStarted(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  enrollmentCount?: number,
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "sequence_started",
    sequenceId,
    sequenceName,
    workspaceId,
    metadata: { enrollmentCount },
  })
}

/**
 * 시퀀스 일시정지 이벤트 로깅
 */
export async function logSequencePaused(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  reason?: string,
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "sequence_paused",
    sequenceId,
    sequenceName,
    workspaceId,
    previousStatus: "active",
    newStatus: "paused",
    reason,
  })
}

/**
 * 시퀀스 재시작 이벤트 로깅
 */
export async function logSequenceResumed(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "sequence_resumed",
    sequenceId,
    sequenceName,
    workspaceId,
    previousStatus: "paused",
    newStatus: "active",
  })
}

/**
 * 시퀀스 완료 이벤트 로깅
 */
export async function logSequenceCompleted(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  stats?: { totalEnrollments: number; completedEnrollments: number },
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "sequence_completed",
    sequenceId,
    sequenceName,
    workspaceId,
    previousStatus: "active",
    newStatus: "completed",
    metadata: stats,
  })
}

/**
 * Enrollment 생성 이벤트 로깅
 */
export async function logEnrollmentCreated(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  enrollmentId: string,
  leadId: string,
  leadCompanyName?: string,
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "enrollment_created",
    sequenceId,
    sequenceName,
    workspaceId,
    enrollmentId,
    leadId,
    leadCompanyName,
    newStatus: "active",
  })
}

/**
 * Enrollment 완료 이벤트 로깅
 */
export async function logEnrollmentCompleted(
  sequenceId: string,
  sequenceName: string,
  workspaceId: string,
  enrollmentId: string,
  leadId: string,
  leadCompanyName?: string,
  stepsCompleted?: number,
): Promise<string | null> {
  return logSequenceEvent({
    eventType: "enrollment_completed",
    sequenceId,
    sequenceName,
    workspaceId,
    enrollmentId,
    leadId,
    leadCompanyName,
    previousStatus: "active",
    newStatus: "completed",
    metadata: { stepsCompleted },
  })
}
