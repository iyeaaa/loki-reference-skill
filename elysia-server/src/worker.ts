/**
 * BullMQ Test Worker Entry Point
 *
 * This is the main entry point for the independent test worker process.
 * It runs separately from the API server and handles test job processing.
 *
 * Features:
 * - Graceful shutdown handling
 * - Health monitoring with HTTP endpoints
 * - Independent from API server lifecycle
 * - PostgreSQL job logging
 */

import { config } from "./config"
import { startHealthServer, stopHealthServer } from "./lib/health"
import { redisConnection } from "./lib/redis"
import logger from "./utils/logger"
import { getTestWorkerStatus, startTestWorker, stopTestWorker } from "./workers/bullmq"

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

    // Stop test worker (finish current jobs)
    await stopTestWorker()
    logger.info("[Worker] TestWorker stopped")

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
    const workerStatus = getTestWorkerStatus()

    if (!redisHealthy) {
      logger.error("[Worker] Redis health check failed")
    }

    if (!workerStatus.running) {
      logger.error("[Worker] Worker is not running")
    }

    // Log periodic status (debug level)
    logger.debug(
      {
        redis: redisHealthy,
        worker: workerStatus.running,
        activeJobs: workerStatus.activeJobs,
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
  BullMQ Test Worker Process
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment:   ${config.nodeEnv}
  Redis Host:    ${config.redis.host}:${config.redis.port}
  Health Port:   ${HEALTH_SERVER_PORT}
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
    logger.error("[Worker] Redis connection failed, exiting")
    process.exit(1)
  }
  logger.info("[Worker] Redis connection OK")

  // 2. Start Health Check HTTP Server
  startHealthServer(HEALTH_SERVER_PORT)
  logger.info(`[Worker] Health server started on port ${HEALTH_SERVER_PORT}`)

  // 3. Start Test Worker
  startTestWorker()
  const status = getTestWorkerStatus()
  logger.info(
    { running: status.running, concurrency: status.concurrency },
    "[Worker] TestWorker started",
  )

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
