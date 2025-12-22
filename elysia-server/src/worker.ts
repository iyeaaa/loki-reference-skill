/**
 * BullMQ Workers Entry Point
 *
 * This is the main entry point for the independent worker process.
 * It runs separately from the API server and handles background job processing.
 *
 * Workers:
 * - TestWorker: Test job processing
 * - OnboardingAutoGenerateWorker: Auto-generate onboarding data
 *
 * Features:
 * - Graceful shutdown handling
 * - Health monitoring with HTTP endpoints
 * - Independent from API server lifecycle
 * - PostgreSQL job logging
 */

import { config } from "./config"
import { startHealthServer, stopHealthServer } from "./lib/health"
import { unipileInboxPollQueue } from "./lib/queue/queues"
import { redisConnection } from "./lib/redis"
import logger from "./utils/logger"
import {
  getOnboardingAutoGenerateWorkerStatus,
  getTestWorkerStatus,
  getUnipileInboxPollWorkerStatus,
  startOnboardingAutoGenerateWorker,
  startTestWorker,
  startUnipileInboxPollWorker,
  stopOnboardingAutoGenerateWorker,
  stopTestWorker,
  stopUnipileInboxPollWorker,
} from "./workers/bullmq"

// ============================================================================
// Configuration
// ============================================================================

const HEALTH_SERVER_PORT = Number(process.env.HEALTH_PORT) || 3010
const GRACEFUL_SHUTDOWN_TIMEOUT = 30000 // 30 seconds
const HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

// ============================================================================
// State
// ============================================================================

let isShuttingDown = false
let healthCheckInterval: NodeJS.Timeout | null = null

// ============================================================================
// Shutdown Handler
// ============================================================================

/**
 * Handle graceful shutdown
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn("[Worker] Shutdown already in progress, ignoring signal")
    return
  }

  isShuttingDown = true
  logger.info(`[Worker] Received ${signal}, starting graceful shutdown...`)

  // Set a timeout for forced shutdown
  const forceShutdownTimeout = setTimeout(() => {
    logger.error("[Worker] Graceful shutdown timed out, forcing exit")
    process.exit(1)
  }, GRACEFUL_SHUTDOWN_TIMEOUT)

  try {
    // Clear health check interval
    if (healthCheckInterval) {
      clearInterval(healthCheckInterval)
      healthCheckInterval = null
    }

    // Stop health server first (stop accepting new requests)
    await stopHealthServer()
    logger.info("[Worker] Health server stopped")

    // Stop workers (finish current jobs)
    await stopTestWorker()
    logger.info("[Worker] TestWorker stopped")

    await stopOnboardingAutoGenerateWorker()
    logger.info("[Worker] OnboardingWorker stopped")

    await stopUnipileInboxPollWorker()
    logger.info("[Worker] UnipileInboxPollWorker stopped")

    // Close Redis connection
    await redisConnection.quit()
    logger.info("[Worker] Redis connection closed")

    clearTimeout(forceShutdownTimeout)
    logger.info("[Worker] Graceful shutdown completed")
    process.exit(0)
  } catch (error) {
    logger.error({ error }, "[Worker] Error during shutdown")
    clearTimeout(forceShutdownTimeout)
    process.exit(1)
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check Redis connection health
 */
async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redisConnection.ping()
    return result === "PONG"
  } catch {
    return false
  }
}

/**
 * Periodic internal health check
 */
function startInternalHealthCheck(): void {
  healthCheckInterval = setInterval(async () => {
    const redisHealthy = await checkRedisHealth()
    const testWorkerStatus = getTestWorkerStatus()
    const onboardingWorkerStatus = getOnboardingAutoGenerateWorkerStatus()

    if (!redisHealthy) {
      logger.error("[Worker] Redis health check failed")
    }

    if (!testWorkerStatus.running) {
      logger.error("[Worker] TestWorker is not running")
    }

    if (!onboardingWorkerStatus.running) {
      logger.error("[Worker] OnboardingWorker is not running")
    }

    // Log periodic status (debug level)
    logger.debug(
      {
        redis: redisHealthy,
        testWorker: testWorkerStatus.running,
        testWorkerActiveJobs: testWorkerStatus.activeJobs,
        onboardingWorker: onboardingWorkerStatus.running,
        onboardingWorkerActiveJobs: onboardingWorkerStatus.activeJobs,
      },
      "[Worker] Health check",
    )
  }, HEALTH_CHECK_INTERVAL)
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main(): Promise<void> {
  logger.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BullMQ Workers Process
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment:   ${config.nodeEnv}
  Redis Host:    ${config.redis.host}:${config.redis.port}
  Health Port:   ${HEALTH_SERVER_PORT}
  Workers:       TestWorker, OnboardingAutoGenerateWorker, UnipileInboxPollWorker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  // ========================================
  // Signal Handlers
  // ========================================
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))

  process.on("uncaughtException", (error) => {
    logger.error({ error }, "[Worker] Uncaught exception")
    gracefulShutdown("uncaughtException")
  })

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "[Worker] Unhandled rejection")
    gracefulShutdown("unhandledRejection")
  })

  // ========================================
  // Initialization
  // ========================================

  // 1. Check Redis connection
  logger.info("[Worker] Checking Redis connection...")
  const redisHealthy = await checkRedisHealth()
  if (!redisHealthy) {
    logger.warn(
      "[Worker] Redis connection failed - Worker will not process jobs. To enable, configure Redis connection.",
    )
    logger.warn("[Worker] Skipping worker initialization due to missing Redis connection")
    // Redis가 없으면 worker 시작하지 않고 종료
    process.exit(0)
  }
  logger.info("[Worker] Redis connection OK")

  // 2. Start Health Check HTTP Server
  startHealthServer(HEALTH_SERVER_PORT)
  logger.info(`[Worker] Health server started on port ${HEALTH_SERVER_PORT}`)

  // 3. Start Workers
  startTestWorker()
  const testStatus = getTestWorkerStatus()
  logger.info(
    { running: testStatus.running, concurrency: testStatus.concurrency },
    "[Worker] TestWorker started",
  )

  startOnboardingAutoGenerateWorker()
  const onboardingStatus = getOnboardingAutoGenerateWorkerStatus()
  logger.info(
    { running: onboardingStatus.running, concurrency: onboardingStatus.concurrency },
    "[Worker] OnboardingAutoGenerateWorker started",
  )

  // Start Unipile Inbox Poll Worker (only if enabled)
  const unipileWorker = startUnipileInboxPollWorker()
  const unipileStatus = getUnipileInboxPollWorkerStatus()
  if (unipileWorker) {
    logger.info(
      { running: unipileStatus.running, enabled: unipileStatus.enabled },
      "[Worker] UnipileInboxPollWorker started",
    )

    // Schedule recurring inbox poll as backup (every 1 hour)
    // Primary method is webhook (real-time), polling is backup for missed events
    await unipileInboxPollQueue.add(
      "scheduled-poll",
      { trigger: "scheduled" },
      {
        repeat: {
          pattern: "0 * * * *", // Every hour at minute 0
        },
        jobId: "unipile-inbox-poll-recurring", // Prevent duplicates
      },
    )
    logger.info(
      "[Worker] Unipile inbox poll scheduled as backup (every 1 hour, primary method is webhook)",
    )
  } else {
    logger.info(
      { enabled: unipileStatus.enabled },
      "[Worker] UnipileInboxPollWorker not started (disabled)",
    )
  }

  // 4. Start internal health check interval
  startInternalHealthCheck()

  // ========================================
  // Ready
  // ========================================
  logger.info("[Worker] Worker process is running. Press Ctrl+C to stop.")
  logger.info(`[Worker] Health endpoints available at:
  - GET http://localhost:${HEALTH_SERVER_PORT}/healthz   (liveness)
  - GET http://localhost:${HEALTH_SERVER_PORT}/readyz    (readiness)
  - GET http://localhost:${HEALTH_SERVER_PORT}/health    (detailed)
  - GET http://localhost:${HEALTH_SERVER_PORT}/metrics   (metrics)
`)
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  logger.error({ error }, "[Worker] Fatal error in main")
  process.exit(1)
})
