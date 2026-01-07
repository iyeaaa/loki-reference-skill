/**
 * Web Extraction Queue Service
 *
 * High-level API for web extraction operations using BullMQ.
 * Handles job creation, progress tracking, and result retrieval.
 */

import { nanoid } from "nanoid"
import type { WebExtractionBatchProgress, WebExtractionResult } from "../lib/queue/types"
import { createRedisConnection } from "../lib/redis/connection"
import type { CompanyRecord, WebExtractionConfig } from "../types/web-extraction.types"
import logger from "../utils/logger"
import {
  addWebExtractionJobs,
  cancelBatchJobs,
  getBatchProgress,
  getBatchResults,
  getWebExtractionQueue,
} from "../workers/bullmq/web-extraction.worker"

// ============================================================================
// Types
// ============================================================================

export interface StartExtractionParams {
  workspaceId: string
  records: CompanyRecord[]
  config: WebExtractionConfig
  searchCriteria?: string[]
}

export interface StartExtractionResult {
  success: boolean
  batchJobId?: string
  totalRecords?: number
  error?: string
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Start web extraction batch job
 */
export async function startWebExtraction(
  params: StartExtractionParams,
): Promise<StartExtractionResult> {
  const { workspaceId, records, config, searchCriteria } = params

  try {
    // Generate unique batch job ID
    const batchJobId = `web-extract-${nanoid(12)}`

    // Convert config to worker format
    const workerConfig = {
      crawlDepth: config.crawlDepth,
      crawlTimeout: 3, // 3초 타임아웃 (고정)
      gptTimeout: config.gptTimeout,
    }

    // Convert records to worker format (index signature compatible)
    const workerRecords = records.map((r) => {
      const record: { websiteUrl: string; [key: string]: unknown } = {
        websiteUrl: r.websiteUrl,
      }
      // Copy all other properties
      for (const [key, value] of Object.entries(r)) {
        record[key] = value
      }
      return record
    })

    // Add jobs to queue
    await addWebExtractionJobs(batchJobId, workspaceId, workerRecords, workerConfig, searchCriteria)

    logger.info(
      { batchJobId, workspaceId, recordCount: records.length },
      "[WebExtractionQueue] Batch started",
    )

    return {
      success: true,
      batchJobId,
      totalRecords: records.length,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    logger.error({ error: errorMessage, workspaceId }, "[WebExtractionQueue] Failed to start batch")

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Get batch progress
 */
export async function getExtractionProgress(
  batchJobId: string,
): Promise<WebExtractionBatchProgress | null> {
  return getBatchProgress(batchJobId)
}

/**
 * Get batch results
 */
export async function getExtractionResults(
  batchJobId: string,
): Promise<WebExtractionResult["record"][]> {
  return getBatchResults(batchJobId)
}

/**
 * Cancel batch extraction
 */
export async function cancelExtraction(batchJobId: string): Promise<void> {
  await cancelBatchJobs(batchJobId)
  logger.info({ batchJobId }, "[WebExtractionQueue] Batch cancelled")
}

/**
 * Get queue statistics
 */
export async function getQueueStats(): Promise<{
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}> {
  const queue = getWebExtractionQueue()
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ])

  return { waiting, active, completed, failed, delayed }
}

/**
 * Subscribe to batch progress updates via Redis Pub/Sub
 * Returns an async generator that yields progress updates
 */
export async function* subscribeToProgress(
  batchJobId: string,
  signal?: AbortSignal,
): AsyncGenerator<WebExtractionBatchProgress> {
  const redis = createRedisConnection()
  const channel = `web-extraction:${batchJobId}`

  try {
    // Subscribe to channel
    await redis.subscribe(channel)

    // Create a promise-based message handler
    const messageQueue: WebExtractionBatchProgress[] = []
    let resolveWait: (() => void) | null = null
    let isCompleted = false

    redis.on("message", (_ch: string, message: string) => {
      try {
        const progress: WebExtractionBatchProgress = JSON.parse(message)
        messageQueue.push(progress)

        if (
          progress.status === "completed" ||
          progress.status === "error" ||
          progress.status === "cancelled"
        ) {
          isCompleted = true
        }

        if (resolveWait) {
          resolveWait()
          resolveWait = null
        }
      } catch {
        // Ignore parse errors
      }
    })

    // Yield initial progress
    const initialProgress = await getBatchProgress(batchJobId)
    if (initialProgress) {
      yield initialProgress
      if (initialProgress.status !== "processing") {
        return
      }
    }

    // Yield updates as they come
    while (!isCompleted && !signal?.aborted) {
      const progress = messageQueue.shift()
      if (progress) {
        yield progress

        if (progress.status !== "processing") {
          break
        }
      } else {
        // Wait for next message with timeout
        await Promise.race([
          new Promise<void>((resolve) => {
            resolveWait = resolve
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)), // 5s heartbeat
        ])
      }
    }
  } finally {
    await redis.unsubscribe(channel)
    await redis.quit()
  }
}

/**
 * Clean up old batch data from Redis
 */
export async function cleanupOldBatches(maxAgeDays: number = 7): Promise<number> {
  const redis = createRedisConnection()
  let cleaned = 0

  try {
    // Get all progress keys
    const progressKeys = await redis.keys("web-extraction:progress:*")
    const now = Date.now()
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000

    for (const key of progressKeys) {
      const progressJson = await redis.get(key)
      if (progressJson) {
        const progress: WebExtractionBatchProgress = JSON.parse(progressJson)
        const startedAt = new Date(progress.startedAt).getTime()

        if (now - startedAt > maxAgeMs) {
          const batchJobId = key.replace("web-extraction:progress:", "")
          await redis.del(key)
          await redis.del(`web-extraction:results:${batchJobId}`)
          cleaned++
        }
      }
    }

    logger.info({ cleaned }, "[WebExtractionQueue] Cleaned up old batches")
  } finally {
    await redis.quit()
  }

  return cleaned
}
