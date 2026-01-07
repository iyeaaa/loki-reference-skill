/**
 * BullMQ Web Extraction Worker
 *
 * Event-driven web data extraction worker that processes URLs in parallel.
 * Features:
 * - Crawl websites and extract company/contact information
 * - GPT-based content analysis with custom search criteria
 * - 3-second timeout per HTTP request
 * - Automatic retry with exponential backoff
 * - Redis Pub/Sub for real-time progress updates to SSE clients
 * - Fault-tolerant: jobs survive server restarts
 */

import { type Job, Queue, Worker } from "bullmq"
import {
  QUEUE_NAMES,
  type WebExtractionBatchProgress,
  type WebExtractionJob,
  type WebExtractionResult,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import {
  extractContactsWithGPTLegacy,
  fetchWithDepthLegacy,
} from "../../services/web-extraction-legacy.service"
import logger from "../../utils/logger"

// ============================================================================
// Configuration
// ============================================================================

/** Worker concurrency - API 키 1개당 20개 병렬 처리 */
const WORKER_CONCURRENCY = 20

/** Redis key prefix for batch progress */
const PROGRESS_KEY_PREFIX = "web-extraction:progress:"

/** Redis key prefix for batch results */
const RESULTS_KEY_PREFIX = "web-extraction:results:"

/** Progress data TTL (24 hours) */
const PROGRESS_TTL_SECONDS = 24 * 60 * 60

/** Results data TTL (7 days) */
const RESULTS_TTL_SECONDS = 7 * 24 * 60 * 60

/** GPT cost constants */
const GPT_COST_PER_REQUEST = {
  INPUT_TOKENS: 8000,
  OUTPUT_TOKENS: 800,
  INPUT_PRICE_PER_MILLION: 0.15,
  OUTPUT_PRICE_PER_MILLION: 0.6,
}

// ============================================================================
// Worker State
// ============================================================================

let webExtractionWorker: Worker<WebExtractionJob, WebExtractionResult> | null = null
let webExtractionQueue: Queue<WebExtractionJob, WebExtractionResult> | null = null

/** Shared Redis connection for progress updates */
let progressRedis: ReturnType<typeof createRedisConnection> | null = null

// ============================================================================
// Progress Management
// ============================================================================

/**
 * Get or create shared Redis connection for progress
 */
function getProgressRedis() {
  if (!progressRedis) {
    progressRedis = createRedisConnection()
  }
  return progressRedis
}

/**
 * Get progress key for a batch job
 */
function getProgressKey(batchJobId: string): string {
  return `${PROGRESS_KEY_PREFIX}${batchJobId}`
}

/**
 * Get results key for a batch job
 */
function getResultsKey(batchJobId: string): string {
  return `${RESULTS_KEY_PREFIX}${batchJobId}`
}

/**
 * Initialize batch progress in Redis
 */
export async function initBatchProgress(
  batchJobId: string,
  workspaceId: string,
  totalRecords: number,
): Promise<void> {
  const redis = getProgressRedis()
  const progress: WebExtractionBatchProgress = {
    batchJobId,
    workspaceId,
    status: "processing",
    total: totalRecords,
    processed: 0,
    success: 0,
    errors: 0,
    emailFound: 0,
    phoneFound: 0,
    addressFound: 0,
    socialFound: 0,
    gptRequests: 0,
    percentage: 0,
    elapsedTime: 0,
    estimatedTimeRemaining: 0,
    itemsPerSecond: 0,
    estimatedCost: 0,
    startedAt: new Date().toISOString(),
    logs: [
      {
        timestamp: Date.now(),
        message: `${totalRecords}개 웹사이트 데이터 추출 시작 (동시성: ${WORKER_CONCURRENCY})`,
        type: "info",
      },
    ],
  }

  await redis.setex(getProgressKey(batchJobId), PROGRESS_TTL_SECONDS, JSON.stringify(progress))

  // Initialize empty results array
  await redis.setex(getResultsKey(batchJobId), RESULTS_TTL_SECONDS, JSON.stringify([]))

  logger.info({ batchJobId, totalRecords }, "[WebExtractionWorker] Batch progress initialized")
}

/**
 * Update batch progress after job completion
 */
async function updateBatchProgress(
  batchJobId: string,
  result: WebExtractionResult,
  startTime: number,
): Promise<WebExtractionBatchProgress | null> {
  const redis = getProgressRedis()
  const progressKey = getProgressKey(batchJobId)
  const resultsKey = getResultsKey(batchJobId)

  // Get current progress
  const progressJson = await redis.get(progressKey)
  if (!progressJson) {
    logger.warn({ batchJobId }, "[WebExtractionWorker] Progress not found")
    return null
  }

  const progress: WebExtractionBatchProgress = JSON.parse(progressJson)
  const record = result.record

  // Update counters
  progress.processed++

  if (result.success && record) {
    progress.success++
    if (record.email) progress.emailFound++
    if (record.phoneNumber) progress.phoneFound++
    if (record.address) progress.addressFound++
    if (record.facebookUrl || record.instagramUrl || record.twitterUrl || record.linkedinUrl) {
      progress.socialFound++
    }
    if (record.collectedAt) {
      progress.gptRequests++
      const inputCost =
        (GPT_COST_PER_REQUEST.INPUT_TOKENS / 1_000_000) *
        GPT_COST_PER_REQUEST.INPUT_PRICE_PER_MILLION
      const outputCost =
        (GPT_COST_PER_REQUEST.OUTPUT_TOKENS / 1_000_000) *
        GPT_COST_PER_REQUEST.OUTPUT_PRICE_PER_MILLION
      progress.estimatedCost += inputCost + outputCost
    }
  } else {
    progress.errors++
  }

  // Calculate timing
  const elapsedMs = Date.now() - startTime
  progress.elapsedTime = elapsedMs / 1000
  progress.itemsPerSecond = progress.processed / progress.elapsedTime
  progress.percentage = (progress.processed / progress.total) * 100
  progress.estimatedTimeRemaining =
    progress.itemsPerSecond > 0
      ? (progress.total - progress.processed) / progress.itemsPerSecond
      : 0

  // Update latest result
  progress.latestResult = record

  // Add log entry
  const displayName = record?.foundCompanyName || record?.websiteUrl || "Unknown"
  const httpStatusText = record?.httpStatus ? `[${record.httpStatus}] ` : ""

  if (result.success && record && !record.errorMessage) {
    const details: string[] = []
    if (record.email) details.push("이메일")
    if (record.phoneNumber) details.push("전화")
    if (record.address) details.push("주소")
    const detailText = details.length > 0 ? ` (${details.join(", ")})` : ""

    progress.logs.push({
      timestamp: Date.now(),
      message: `[${progress.processed}/${progress.total}] ${httpStatusText}✓ ${displayName}${detailText}`,
      type: "success",
    })
  } else {
    progress.logs.push({
      timestamp: Date.now(),
      message: `[${progress.processed}/${progress.total}] ${httpStatusText}✗ ${displayName}: ${record?.errorMessage || result.error || "Unknown error"}`,
      type: "error",
    })
  }

  // Keep only last 50 logs
  if (progress.logs.length > 50) {
    progress.logs = progress.logs.slice(-50)
  }

  // Check if batch is complete
  if (progress.processed >= progress.total) {
    progress.status = "completed"
    progress.completedAt = new Date().toISOString()
    progress.logs.push({
      timestamp: Date.now(),
      message: `✓ 처리 완료: 성공 ${progress.success}개, 실패 ${progress.errors}개 (총 ${progress.total}개)`,
      type: "success",
    })
  }

  // Save updated progress
  await redis.setex(progressKey, PROGRESS_TTL_SECONDS, JSON.stringify(progress))

  // Append result to results array
  if (record) {
    const resultsJson = await redis.get(resultsKey)
    const results = resultsJson ? JSON.parse(resultsJson) : []
    results.push(record)
    await redis.setex(resultsKey, RESULTS_TTL_SECONDS, JSON.stringify(results))
  }

  // Publish progress update via Redis Pub/Sub
  await redis.publish(`web-extraction:${batchJobId}`, JSON.stringify(progress))

  return progress
}

/**
 * Get batch progress from Redis
 */
export async function getBatchProgress(
  batchJobId: string,
): Promise<WebExtractionBatchProgress | null> {
  const redis = getProgressRedis()
  const progressJson = await redis.get(getProgressKey(batchJobId))
  return progressJson ? JSON.parse(progressJson) : null
}

/**
 * Get batch results from Redis
 */
export async function getBatchResults(
  batchJobId: string,
): Promise<WebExtractionResult["record"][]> {
  const redis = getProgressRedis()
  const resultsJson = await redis.get(getResultsKey(batchJobId))
  return resultsJson ? JSON.parse(resultsJson) : []
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process single web extraction job
 */
async function processWebExtractionJob(
  job: Job<WebExtractionJob, WebExtractionResult>,
): Promise<WebExtractionResult> {
  const startTime = Date.now()
  const { batchJobId, workspaceId, recordIndex, totalRecords, record, config, searchCriteria } =
    job.data

  logger.debug(
    {
      jobId: job.id,
      batchJobId,
      recordIndex,
      totalRecords,
      websiteUrl: record.websiteUrl,
    },
    "[WebExtractionWorker] Processing job",
  )

  try {
    // Validate URL
    if (!record.websiteUrl || record.websiteUrl.trim().length < 3) {
      const result: WebExtractionResult = {
        success: false,
        record: {
          ...record,
          collectedAt: new Date().toISOString(),
          errorMessage: "웹사이트 URL이 비어있습니다",
        },
        error: "웹사이트 URL이 비어있습니다",
        durationMs: Date.now() - startTime,
      }

      // Update progress
      const progressStartTime = await getProgressStartTime(batchJobId)
      await updateBatchProgress(batchJobId, result, progressStartTime)

      return result
    }

    // Crawl website (3-second timeout)
    const crawlStartTime = Date.now()
    const { pagesContent, httpStatus } = await fetchWithDepthLegacy(
      record.websiteUrl,
      config.crawlDepth,
      config.crawlTimeout,
    )
    const crawlElapsed = (Date.now() - crawlStartTime) / 1000

    // Check HTTP error
    if (httpStatus >= 400) {
      const result: WebExtractionResult = {
        success: false,
        record: {
          ...record,
          httpStatus,
          crawlTimeSeconds: crawlElapsed,
          collectedAt: new Date().toISOString(),
          errorMessage: `HTTP ${httpStatus} 에러`,
        },
        error: `HTTP ${httpStatus} 에러`,
        durationMs: Date.now() - startTime,
      }

      const progressStartTime = await getProgressStartTime(batchJobId)
      await updateBatchProgress(batchJobId, result, progressStartTime)

      return result
    }

    // Check empty content
    if (pagesContent.size === 0) {
      const result: WebExtractionResult = {
        success: false,
        record: {
          ...record,
          httpStatus,
          crawlTimeSeconds: crawlElapsed,
          collectedAt: new Date().toISOString(),
          errorMessage:
            httpStatus === 0
              ? "웹사이트 접속 실패 (타임아웃)"
              : "웹사이트 콘텐츠를 가져오는데 실패했습니다",
        },
        error: "웹사이트 콘텐츠를 가져오는데 실패했습니다",
        durationMs: Date.now() - startTime,
      }

      const progressStartTime = await getProgressStartTime(batchJobId)
      await updateBatchProgress(batchJobId, result, progressStartTime)

      return result
    }

    // Extract contacts with GPT
    const gptStartTime = Date.now()
    const contacts = await extractContactsWithGPTLegacy(
      pagesContent,
      config.gptTimeout,
      workspaceId,
      searchCriteria,
    )
    const gptElapsed = (Date.now() - gptStartTime) / 1000

    // Build result record
    const resultRecord = {
      ...record,
      ...contacts,
      httpStatus,
      crawlTimeSeconds: crawlElapsed,
      gptTimeSeconds: gptElapsed,
      collectedAt: new Date().toISOString(),
    }

    const result: WebExtractionResult = {
      success: !contacts.errorMessage,
      record: resultRecord,
      error: contacts.errorMessage,
      durationMs: Date.now() - startTime,
    }

    // Update progress
    const progressStartTime = await getProgressStartTime(batchJobId)
    await updateBatchProgress(batchJobId, result, progressStartTime)

    logger.debug(
      {
        jobId: job.id,
        batchJobId,
        websiteUrl: record.websiteUrl,
        success: result.success,
        durationMs: result.durationMs,
      },
      "[WebExtractionWorker] Job completed",
    )

    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    const result: WebExtractionResult = {
      success: false,
      record: {
        ...record,
        crawlTimeSeconds: (Date.now() - startTime) / 1000,
        collectedAt: new Date().toISOString(),
        errorMessage,
      },
      error: errorMessage,
      durationMs: Date.now() - startTime,
    }

    // Update progress
    const progressStartTime = await getProgressStartTime(batchJobId)
    await updateBatchProgress(batchJobId, result, progressStartTime)

    logger.error(
      { jobId: job.id, batchJobId, error: errorMessage },
      "[WebExtractionWorker] Job failed",
    )

    throw error // Re-throw to trigger BullMQ retry
  }
}

/**
 * Get batch start time from progress
 */
async function getProgressStartTime(batchJobId: string): Promise<number> {
  const progress = await getBatchProgress(batchJobId)
  return progress ? new Date(progress.startedAt).getTime() : Date.now()
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get or create web extraction queue
 */
export function getWebExtractionQueue(): Queue<WebExtractionJob, WebExtractionResult> {
  if (!webExtractionQueue) {
    webExtractionQueue = new Queue(QUEUE_NAMES.WEB_EXTRACTION, {
      connection: createRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000, // 2초, 4초, 8초
        },
        removeOnComplete: {
          age: 24 * 3600, // 24시간 후 삭제
        },
        removeOnFail: {
          age: 7 * 24 * 3600, // 7일 후 삭제
        },
      },
    })
  }
  return webExtractionQueue
}

/**
 * Add extraction jobs to queue
 */
export async function addWebExtractionJobs(
  batchJobId: string,
  workspaceId: string,
  records: Array<{ websiteUrl: string; [key: string]: unknown }>,
  config: WebExtractionJob["config"],
  searchCriteria?: string[],
): Promise<void> {
  const queue = getWebExtractionQueue()

  // Initialize batch progress
  await initBatchProgress(batchJobId, workspaceId, records.length)

  // Add jobs in bulk
  const jobs = records.map((record, index) => ({
    name: `extract-${batchJobId}-${index}`,
    data: {
      batchJobId,
      workspaceId,
      recordIndex: index,
      totalRecords: records.length,
      record,
      config,
      searchCriteria,
    } as WebExtractionJob,
  }))

  await queue.addBulk(jobs)

  logger.info({ batchJobId, jobCount: jobs.length }, "[WebExtractionWorker] Jobs added to queue")
}

/**
 * Cancel batch jobs
 */
export async function cancelBatchJobs(batchJobId: string): Promise<void> {
  const queue = getWebExtractionQueue()
  const redis = getProgressRedis()

  // Get all jobs for this batch
  const jobs = await queue.getJobs(["waiting", "active", "delayed"])

  for (const job of jobs) {
    if (job.data.batchJobId === batchJobId) {
      try {
        await job.remove()
      } catch {
        // Job might be active, try to move to failed
        await job.moveToFailed(new Error("Cancelled by user"), "cancelled")
      }
    }
  }

  // Update progress status
  const progress = await getBatchProgress(batchJobId)
  if (progress) {
    progress.status = "cancelled"
    progress.completedAt = new Date().toISOString()
    progress.logs.push({
      timestamp: Date.now(),
      message: "작업이 사용자에 의해 취소되었습니다",
      type: "warning",
    })
    await redis.setex(getProgressKey(batchJobId), PROGRESS_TTL_SECONDS, JSON.stringify(progress))
  }

  logger.info({ batchJobId }, "[WebExtractionWorker] Batch cancelled")
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Start Web Extraction Worker
 */
export function startWebExtractionWorker(): Worker<WebExtractionJob, WebExtractionResult> {
  if (webExtractionWorker) {
    logger.warn("[WebExtractionWorker] Worker already running")
    return webExtractionWorker
  }

  webExtractionWorker = new Worker<WebExtractionJob, WebExtractionResult>(
    QUEUE_NAMES.WEB_EXTRACTION,
    processWebExtractionJob,
    {
      connection: createRedisConnection(),
      concurrency: WORKER_CONCURRENCY,
      lockDuration: 60000, // 1분 락 (크롤링 + GPT)
      stalledInterval: 30000,
      maxStalledCount: 2,
      removeOnComplete: {
        age: 24 * 3600,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
  )

  // Event handlers
  webExtractionWorker.on("completed", (job, result) => {
    logger.debug(
      {
        jobId: job.id,
        batchJobId: job.data.batchJobId,
        success: result.success,
      },
      "[WebExtractionWorker] Job completed",
    )
  })

  webExtractionWorker.on("failed", (job, err) => {
    logger.error(
      {
        jobId: job?.id,
        batchJobId: job?.data.batchJobId,
        error: err.message,
      },
      "[WebExtractionWorker] Job failed",
    )
  })

  webExtractionWorker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "[WebExtractionWorker] Job stalled")
  })

  webExtractionWorker.on("error", (err) => {
    logger.error({ error: err.message }, "[WebExtractionWorker] Worker error")
  })

  logger.info({ concurrency: WORKER_CONCURRENCY }, "[WebExtractionWorker] Worker started")

  return webExtractionWorker
}

/**
 * Stop Web Extraction Worker
 */
export async function stopWebExtractionWorker(): Promise<void> {
  if (webExtractionWorker) {
    await webExtractionWorker.close()
    webExtractionWorker = null
    logger.info("[WebExtractionWorker] Worker stopped")
  }

  if (webExtractionQueue) {
    await webExtractionQueue.close()
    webExtractionQueue = null
  }

  if (progressRedis) {
    await progressRedis.quit()
    progressRedis = null
  }
}

/**
 * Get worker status
 */
export function getWebExtractionWorkerStatus(): {
  running: boolean
  concurrency: number
} {
  return {
    running: webExtractionWorker !== null,
    concurrency: WORKER_CONCURRENCY,
  }
}

export { webExtractionWorker }
