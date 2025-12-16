/**
 * BullMQ Test Worker Entry Point
 *
 * This is the main entry point for the independent test worker process.
 * It runs separately from the API server and handles test job processing.
 *
 * Features:
 * - Graceful shutdown handling
 * - Health monitoring
 * - Independent from API server lifecycle
 */

import { config } from "./config"
import { redisConnection } from "./lib/redis"
import logger from "./utils/logger"
import { getTestWorkerStatus, startTestWorker, stopTestWorker } from "./workers/bullmq"

// Graceful shutdown flag
let isShuttingDown = false

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
  }, 30000) // 30 seconds timeout

  try {
    // Stop test worker
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
 * Main entry point
 */
async function main(): Promise<void> {
  logger.info(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  BullMQ Test Worker Process
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Environment: ${config.nodeEnv}
  Redis Host:  ${config.redis.host}:${config.redis.port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  // Register signal handlers for graceful shutdown
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))
  process.on("SIGINT", () => gracefulShutdown("SIGINT"))

  // Handle uncaught errors
  process.on("uncaughtException", (error) => {
    logger.error({ error }, "[Worker] Uncaught exception")
    gracefulShutdown("uncaughtException")
  })

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "[Worker] Unhandled rejection")
    gracefulShutdown("unhandledRejection")
  })

  // Check Redis connection
  logger.info("[Worker] Checking Redis connection...")
  const redisHealthy = await checkRedisHealth()
  if (!redisHealthy) {
    logger.error("[Worker] Redis connection failed, exiting")
    process.exit(1)
  }
  logger.info("[Worker] Redis connection OK")

  // Start test worker
  startTestWorker()
  logger.info("[Worker] TestWorker started")

  const status = getTestWorkerStatus()
  logger.info(
    `[Worker] Worker status: running=${status.running}, concurrency=${status.concurrency}`,
  )

  // Keep the process running
  logger.info("[Worker] Worker process is running. Press Ctrl+C to stop.")

  // Periodic health check (every 30 seconds)
  setInterval(async () => {
    const healthy = await checkRedisHealth()
    if (!healthy) {
      logger.error("[Worker] Redis health check failed")
    }
  }, 30000)
}

// Run main
main().catch((error) => {
  logger.error({ error }, "[Worker] Fatal error in main")
  process.exit(1)
})
