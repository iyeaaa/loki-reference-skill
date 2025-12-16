import { type Job, Worker } from "bullmq"
import { QUEUE_NAMES, type TestJob, type TestJobResult } from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import logger from "../../utils/logger"

let testWorker: Worker<TestJob, TestJobResult> | null = null

/**
 * Process test jobs
 */
async function processTestJob(job: Job<TestJob, TestJobResult>): Promise<TestJobResult> {
  const { message, delay, shouldFail, data } = job.data

  logger.info(
    { jobId: job.id, message, attempt: job.attemptsMade + 1 },
    "[TestWorker] Processing job",
  )

  // Simulate processing delay
  if (delay && delay > 0) {
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  // Simulate failure for testing retry mechanism
  if (shouldFail) {
    throw new Error(`Intentional failure for testing: ${message}`)
  }

  const result: TestJobResult = {
    success: true,
    processedAt: new Date().toISOString(),
    message: `Processed: ${message}`,
    receivedData: data,
  }

  logger.info({ jobId: job.id, result }, "[TestWorker] Job completed")

  return result
}

/**
 * Start the test worker
 */
export function startTestWorker(): Worker<TestJob, TestJobResult> {
  if (testWorker) {
    logger.warn("[TestWorker] Worker already running")
    return testWorker
  }

  testWorker = new Worker<TestJob, TestJobResult>(QUEUE_NAMES.TEST_QUEUE, processTestJob, {
    connection: createRedisConnection(),
    concurrency: 5, // Process up to 5 jobs concurrently
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  })

  // Event handlers
  testWorker.on("completed", (job, result) => {
    logger.info({ jobId: job.id, result }, "[TestWorker] Job completed successfully")
  })

  testWorker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, error: err.message, attempts: job?.attemptsMade },
      "[TestWorker] Job failed",
    )
  })

  testWorker.on("error", (err) => {
    logger.error({ error: err.message }, "[TestWorker] Worker error")
  })

  testWorker.on("stalled", (jobId) => {
    logger.warn({ jobId }, "[TestWorker] Job stalled")
  })

  logger.info("[TestWorker] Started successfully")

  return testWorker
}

/**
 * Stop the test worker
 */
export async function stopTestWorker(): Promise<void> {
  if (testWorker) {
    await testWorker.close()
    testWorker = null
    logger.info("[TestWorker] Stopped")
  }
}

/**
 * Get test worker status
 */
export function getTestWorkerStatus(): { running: boolean; concurrency: number } {
  return {
    running: testWorker !== null && !testWorker.closing,
    concurrency: testWorker?.opts.concurrency || 0,
  }
}

export { testWorker }
