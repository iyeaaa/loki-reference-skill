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
 */
export async function logJobStarted(job: Job, workerName?: string): Promise<void> {
  if (!job.id) {
    logger.warn("[JobLogService] Cannot log job start: job.id is missing")
    return
  }

  const serverIdentifier = getServerIdentifier()

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
 */
export async function cleanupOldJobLogs(retentionDays: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(jobLogs)
    .where(
      and(
        lte(jobLogs.addedAt, cutoffDate),
        // completed 상태만 삭제 (failed는 분석용으로 유지)
        eq(jobLogs.status, "completed"),
      ),
    )
    .returning({ id: jobLogs.id })

  const deletedCount = result.length
  logger.info({ deletedCount, retentionDays }, "[JobLogService] Cleaned up old job logs")

  return deletedCount
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * 에러 메시지에서 에러 코드 추출
 */
function extractErrorCode(error: Error): string | undefined {
  const message = error.message.toLowerCase()

  // 일반적인 에러 패턴 매칭
  if (message.includes("timeout")) return "TIMEOUT"
  if (message.includes("connection")) return "CONNECTION_ERROR"
  if (message.includes("validation")) return "VALIDATION_ERROR"
  if (message.includes("not found")) return "NOT_FOUND"
  if (message.includes("unauthorized")) return "UNAUTHORIZED"
  if (message.includes("rate limit")) return "RATE_LIMIT"
  if (message.includes("intentional failure")) return "TEST_FAILURE"

  return undefined
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
