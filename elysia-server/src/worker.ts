/**
 * BullMQ Workers Entry Point
 *
 * This is the main entry point for the independent worker process.
 * It runs separately from the API server and handles background job processing.
 *
 * Workers:
 * - TestWorker: Test job processing
 * - OnboardingAutoGenerateWorker: Auto-generate onboarding data
 * - SequenceEmailWorker: Email sending via BullMQ
 * - TrialExpirationWorker: Trial expiration handling
 * - UnipileInboxPollWorker: Inbox polling backup
 *
 * Features:
 * - Graceful shutdown handling
 * - Health monitoring with HTTP endpoints
 * - Independent from API server lifecycle
 * - PostgreSQL job logging
 *
 * ============================================================================
 * DEPLOYMENT: Worker Independent Rebuild Conditions
 * ============================================================================
 *
 * This worker is deployed independently from the API server (elysia-server).
 * The CI/CD pipeline (.github/workflows/ci-cd.yml) detects changes and only
 * rebuilds/restarts the worker when worker-related files are modified.
 *
 * Worker is REBUILT when these files change:
 * - elysia-server/src/worker.ts           (this file)
 * - elysia-server/src/workers/*           (worker implementations)
 * - elysia-server/Dockerfile.worker       (worker Dockerfile)
 * - elysia-server/src/lib/queue/*         (BullMQ queue configurations)
 * - elysia-server/src/lib/redis/*         (Redis connection settings)
 * - elysia-server/src/lib/health.ts       (health check endpoints)
 * - elysia-server/package.json            (dependencies)
 * - elysia-server/bun.lockb               (lockfile)
 *
 * Worker is PRESERVED (not rebuilt) when these files change:
 * - elysia-server/src/routes/*            (API routes)
 * - elysia-server/src/services/*          (API services)
 * - elysia-server/src/index.ts            (API entry point)
 * - admin/*                               (Admin frontend)
 * - docs/*                                (Documentation)
 *
 * This ensures email processing continues uninterrupted during API deployments.
 * See: .github/workflows/ci-cd.yml "Detect Changed Components" step
 */

import { config } from "./config"
import { startHealthServer, stopHealthServer } from "./lib/health"
import {
  billingPaymentQueue,
  followupEmailQueue,
  migratePendingExecutionsToBullMQ,
  trialExpirationQueue,
  unipileInboxPollQueue,
} from "./lib/queue/queues"
import { redisConnection } from "./lib/redis"
import logger from "./utils/logger"
import {
  getBillingPaymentWorkerStatus,
  getFollowupEmailWorkerStatus,
  getOnboardingAutoGenerateWorkerStatus,
  getSequenceEmailWorkerStatus,
  getTestWorkerStatus,
  getTrialExpirationWorkerStatus,
  getUnipileInboxPollWorkerStatus,
  getWebExtractionWorkerStatus,
  startBillingPaymentWorker,
  startFollowupEmailWorker,
  startOnboardingAutoGenerateWorker,
  startSequenceEmailWorker,
  startTestWorker,
  startTrialExpirationWorker,
  startUnipileInboxPollWorker,
  startWebExtractionWorker,
  stopBillingPaymentWorker,
  stopFollowupEmailWorker,
  stopOnboardingAutoGenerateWorker,
  stopSequenceEmailWorker,
  stopTestWorker,
  stopTrialExpirationWorker,
  stopUnipileInboxPollWorker,
  stopWebExtractionWorker,
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

    await stopSequenceEmailWorker()
    logger.info("[Worker] SequenceEmailWorker stopped")

    await stopTrialExpirationWorker()
    logger.info("[Worker] TrialExpirationWorker stopped")

    await stopUnipileInboxPollWorker()
    logger.info("[Worker] UnipileInboxPollWorker stopped")

    await stopWebExtractionWorker()
    logger.info("[Worker] WebExtractionWorker stopped")

    await stopFollowupEmailWorker()
    logger.info("[Worker] FollowupEmailWorker stopped")

    await stopBillingPaymentWorker()
    logger.info("[Worker] BillingPaymentWorker stopped")

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
    const sequenceEmailWorkerStatus = getSequenceEmailWorkerStatus()

    if (!redisHealthy) {
      logger.error("[Worker] Redis health check failed")
    }

    if (!testWorkerStatus.running) {
      logger.error("[Worker] TestWorker is not running")
    }

    if (!onboardingWorkerStatus.running) {
      logger.error("[Worker] OnboardingWorker is not running")
    }

    if (!sequenceEmailWorkerStatus.running) {
      logger.error("[Worker] SequenceEmailWorker is not running")
    }

    // Log periodic status (debug level)
    logger.debug(
      {
        redis: redisHealthy,
        testWorker: testWorkerStatus.running,
        testWorkerActiveJobs: testWorkerStatus.activeJobs,
        onboardingWorker: onboardingWorkerStatus.running,
        onboardingWorkerActiveJobs: onboardingWorkerStatus.activeJobs,
        sequenceEmailWorker: sequenceEmailWorkerStatus.running,
        sequenceEmailWorkerActiveJobs: sequenceEmailWorkerStatus.activeJobs,
      },
      "[Worker] Health check",
    )
  }, HEALTH_CHECK_INTERVAL)
}

// ============================================================================
// One-Time Migration
// ============================================================================

const MIGRATION_KEY = "migration:pending-executions-to-bullmq:v1"

/**
 * Run one-time migration of pending executions to BullMQ
 *
 * This migrates existing pending step executions from DB to BullMQ jobs.
 * Uses a Redis flag to ensure it only runs once, even across restarts.
 *
 * Safe to call multiple times - will skip if already completed.
 */
async function runOneTimePendingMigration(): Promise<void> {
  try {
    // Check if migration already completed
    const alreadyMigrated = await redisConnection.get(MIGRATION_KEY)
    if (alreadyMigrated) {
      logger.info(
        { completedAt: alreadyMigrated },
        "[Worker] Pending executions migration already completed, skipping",
      )
      return
    }

    // Run migration
    logger.info("[Worker] Starting one-time pending executions migration to BullMQ...")
    const startTime = Date.now()

    const result = await migratePendingExecutionsToBullMQ()

    const duration = Date.now() - startTime
    logger.info(
      {
        migrated: result.migrated,
        skipped: result.skipped,
        failed: result.failed,
        durationMs: duration,
      },
      "[Worker] ✅ Pending executions migration completed",
    )

    // Mark migration as completed (store completion timestamp)
    await redisConnection.set(MIGRATION_KEY, new Date().toISOString())
    logger.info({ key: MIGRATION_KEY }, "[Worker] Migration completion flag saved to Redis")
  } catch (error) {
    // Log error but don't fail worker startup
    // Migration can be retried on next restart (flag not set)
    logger.error(
      { error },
      "[Worker] ❌ Pending executions migration failed - will retry on next restart",
    )
  }
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
  Workers:       TestWorker, OnboardingAutoGenerateWorker, SequenceEmailWorker,
                 TrialExpirationWorker, UnipileInboxPollWorker, FollowupEmailWorker
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

  // ========================================
  // Development Environment Check
  // ========================================
  // if (isDevelopment) {
  //   logger.warn(
  //     "[Worker] Skipping worker initialization in development environment (EC2 handles production jobs)",
  //   )
  //   logger.warn(
  //     "[Worker] To test workers locally, set NODE_ENV=production or use dev:worker script",
  //   )
  //   process.exit(0)
  // }

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

  // Start Sequence Email Worker (BullMQ-based email sending)
  startSequenceEmailWorker()
  const sequenceEmailStatus = getSequenceEmailWorkerStatus()
  logger.info(
    { running: sequenceEmailStatus.running, concurrency: sequenceEmailStatus.concurrency },
    "[Worker] SequenceEmailWorker started",
  )

  // Start Web Extraction Worker (BullMQ-based web data extraction)
  startWebExtractionWorker()
  const webExtractionStatus = getWebExtractionWorkerStatus()
  logger.info(
    { running: webExtractionStatus.running, concurrency: webExtractionStatus.concurrency },
    "[Worker] WebExtractionWorker started",
  )

  // Run one-time migration of pending executions to BullMQ (non-blocking)
  // This migrates existing DB records to Redis jobs (runs only once via Redis flag)
  // Run in background to avoid blocking worker startup and health checks
  runOneTimePendingMigration().catch((error) => {
    logger.error({ error }, "[Worker] Background migration failed")
  })

  // Start Trial Expiration Worker
  const trialWorker = startTrialExpirationWorker()
  const trialStatus = getTrialExpirationWorkerStatus()
  if (trialWorker) {
    logger.info({ running: trialStatus.running }, "[Worker] TrialExpirationWorker started")

    // Clean up old daily job (migrated to hourly)
    try {
      const repeatableJobs = await trialExpirationQueue.getRepeatableJobs()
      const oldDailyJob = repeatableJobs.find((job) => job.id === "trial-expiration-daily")
      if (oldDailyJob) {
        await trialExpirationQueue.removeRepeatableByKey(oldDailyJob.key)
        logger.info("[Worker] Removed old daily trial expiration job (migrated to hourly)")
      }
    } catch (error) {
      logger.warn({ error }, "[Worker] Failed to clean up old daily job")
    }

    // 1. Run immediately on startup to catch any missed expirations (deployment timing issue)
    await trialExpirationQueue.add(
      "startup-check",
      { trigger: "manual" },
      {
        jobId: `trial-expiration-startup-${Date.now()}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )
    logger.info("[Worker] Trial expiration startup check queued (immediate execution)")

    // 2. Schedule hourly trial expiration check (changed from daily for faster response)
    // Cron: "0 * * * *" = Every hour at minute 0
    await trialExpirationQueue.add(
      "hourly-check",
      { trigger: "scheduled" },
      {
        repeat: {
          pattern: "0 * * * *", // Every hour at minute 0
        },
        jobId: "trial-expiration-hourly", // Prevent duplicates
      },
    )
    logger.info("[Worker] Trial expiration check scheduled (hourly at minute 0)")
  } else {
    logger.error({ running: trialStatus.running }, "[Worker] TrialExpirationWorker failed to start")
  }

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

  // Start Followup Email Worker
  const followupWorker = startFollowupEmailWorker()
  const followupStatus = getFollowupEmailWorkerStatus()
  if (followupWorker) {
    logger.info({ running: followupStatus.running }, "[Worker] FollowupEmailWorker started")

    // Schedule hourly followup email check
    // Cron: "30 * * * *" = Every hour at minute 30 (offset from trial expiration at minute 0)
    await followupEmailQueue.add(
      "hourly-check",
      { trigger: "scheduled" },
      {
        repeat: {
          pattern: "30 * * * *", // Every hour at minute 30
        },
        jobId: "followup-email-hourly", // Prevent duplicates
      },
    )
    logger.info("[Worker] Followup email check scheduled (hourly at minute 30)")
  } else {
    logger.error(
      { running: followupStatus.running },
      "[Worker] FollowupEmailWorker failed to start",
    )
  }

  // Start Billing Payment Worker (정기결제 자동 승인)
  const billingPaymentWorker = startBillingPaymentWorker()
  const billingPaymentStatus = getBillingPaymentWorkerStatus()
  if (billingPaymentWorker) {
    logger.info(
      { running: billingPaymentStatus.running, concurrency: billingPaymentStatus.concurrency },
      "[Worker] BillingPaymentWorker started",
    )

    // Schedule daily billing payment check
    // Cron: "0 0 * * *" = Every day at UTC 00:00 = KST 09:00
    await billingPaymentQueue.add(
      "daily-billing",
      { trigger: "scheduled" },
      {
        repeat: {
          pattern: "0 0 * * *", // UTC 00:00 = KST 09:00
        },
        jobId: "billing-payment-daily", // Prevent duplicates
      },
    )
    logger.info("[Worker] Billing payment check scheduled (daily at KST 09:00)")
  } else {
    logger.error(
      { running: billingPaymentStatus.running },
      "[Worker] BillingPaymentWorker failed to start",
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
