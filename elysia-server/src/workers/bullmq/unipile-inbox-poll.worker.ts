/**
 * Unipile Inbox Poll Worker
 *
 * Backup polling for Unipile accounts (primary method is webhook)
 * - Runs every 1 hour as backup (primary: real-time webhook)
 * - Detects new emails and saves them to database
 * - Updates replied-emails when replies are detected
 * - Only runs on deployment servers (controlled by UNIPILE_INBOX_POLL_ENABLED env var)
 */

import { type Job, Worker } from "bullmq"
import { eq } from "drizzle-orm"
import { db } from "../../db"
import { userEmailAccounts } from "../../db/schema/email-accounts"
import {
  QUEUE_NAMES,
  type UnipileInboxPollJob,
  type UnipileInboxPollResult,
} from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import * as unipileService from "../../services/unipile.service"
import logger from "../../utils/logger"

// ============================================================================
// Worker State
// ============================================================================

let unipileInboxPollWorker: Worker<UnipileInboxPollJob, UnipileInboxPollResult> | null = null

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process Unipile Inbox Poll Job
 */
async function processUnipileInboxPoll(
  job: Job<UnipileInboxPollJob, UnipileInboxPollResult>,
): Promise<UnipileInboxPollResult> {
  const { trigger, accountId } = job.data
  const jobId = job.id || "unknown"

  logger.info({ jobId, trigger, accountId }, "[UnipileInboxPoll] Starting inbox poll")

  const result: UnipileInboxPollResult = {
    success: true,
    accountsPolled: 0,
    newEmailsFound: 0,
    repliesDetected: 0,
    errors: [],
  }

  try {
    // Get Unipile accounts to poll
    let accounts: Array<{ id: string; apiKey: string; emailAddress: string }>

    if (accountId) {
      // Poll specific account
      const account = await db.query.userEmailAccounts.findFirst({
        where: (userEmailAccounts, { eq, and }) =>
          and(
            eq(userEmailAccounts.apiKey, accountId),
            eq(userEmailAccounts.provider, "unipile"),
            eq(userEmailAccounts.status, "active"),
          ),
        columns: {
          id: true,
          apiKey: true,
          emailAddress: true,
        },
      })

      if (!account) {
        logger.warn({ accountId }, "[UnipileInboxPoll] Account not found or not active")
        return result
      }

      accounts = [account]
    } else {
      // Poll all active Unipile accounts
      accounts = await db
        .select({
          id: userEmailAccounts.id,
          apiKey: userEmailAccounts.apiKey,
          emailAddress: userEmailAccounts.emailAddress,
        })
        .from(userEmailAccounts)
        .where(eq(userEmailAccounts.provider, "unipile"))
        .execute()

      logger.info({ accountCount: accounts.length }, "[UnipileInboxPoll] Found Unipile accounts")
    }

    // Poll each account
    for (const account of accounts) {
      try {
        logger.debug(
          { accountId: account.apiKey, email: account.emailAddress },
          "[UnipileInboxPoll] Polling account",
        )

        const syncResult = await unipileService.syncAccountEmails(account.apiKey)

        result.accountsPolled++
        result.newEmailsFound += syncResult.newEmails
        result.repliesDetected += syncResult.repliesDetected

        logger.info(
          {
            accountId: account.apiKey,
            newEmails: syncResult.newEmails,
            repliesDetected: syncResult.repliesDetected,
          },
          "[UnipileInboxPoll] Account polled successfully",
        )
      } catch (accountError) {
        const errorMessage = accountError instanceof Error ? accountError.message : "Unknown error"

        result.errors.push({
          accountId: account.apiKey,
          error: errorMessage,
        })

        logger.error(
          { accountId: account.apiKey, error: errorMessage },
          "[UnipileInboxPoll] Error polling account",
        )
      }
    }

    // Mark as failed if all accounts failed
    if (result.accountsPolled === 0 && result.errors.length > 0) {
      result.success = false
    }

    logger.info(
      {
        jobId,
        accountsPolled: result.accountsPolled,
        newEmailsFound: result.newEmailsFound,
        repliesDetected: result.repliesDetected,
        errors: result.errors.length,
      },
      "[UnipileInboxPoll] Inbox poll completed",
    )

    return result
  } catch (error) {
    logger.error({ jobId, error }, "[UnipileInboxPoll] Job failed")
    throw error
  }
}

// ============================================================================
// Worker Management
// ============================================================================

/**
 * Start Unipile Inbox Poll Worker
 */
export function startUnipileInboxPollWorker(): Worker<
  UnipileInboxPollJob,
  UnipileInboxPollResult
> | null {
  // Check if polling is enabled (deployment server only)
  const isEnabled = process.env.UNIPILE_INBOX_POLL_ENABLED === "true"

  if (!isEnabled) {
    logger.info(
      "[UnipileInboxPoll] Worker disabled - set UNIPILE_INBOX_POLL_ENABLED=true to enable",
    )
    return null
  }

  if (unipileInboxPollWorker) {
    logger.warn("[UnipileInboxPoll] Worker already running")
    return unipileInboxPollWorker
  }

  unipileInboxPollWorker = new Worker<UnipileInboxPollJob, UnipileInboxPollResult>(
    QUEUE_NAMES.UNIPILE_INBOX_POLL,
    processUnipileInboxPoll,
    {
      connection: createRedisConnection(),
      concurrency: 1, // Process one poll at a time to avoid race conditions
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    },
  )

  // ========================================
  // Event Handlers
  // ========================================

  unipileInboxPollWorker.on("completed", (job, result) => {
    logger.info(
      {
        jobId: job.id,
        accountsPolled: result.accountsPolled,
        newEmailsFound: result.newEmailsFound,
        repliesDetected: result.repliesDetected,
      },
      "[UnipileInboxPoll] Job completed successfully",
    )
  })

  unipileInboxPollWorker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, "[UnipileInboxPoll] Job failed")
  })

  unipileInboxPollWorker.on("error", (err) => {
    logger.error({ error: err.message }, "[UnipileInboxPoll] Worker error")
  })

  unipileInboxPollWorker.on("ready", () => {
    logger.info("[UnipileInboxPoll] Worker is ready to process jobs")
  })

  unipileInboxPollWorker.on("closed", () => {
    logger.info("[UnipileInboxPoll] Worker has been closed")
  })

  logger.info(
    { queueName: QUEUE_NAMES.UNIPILE_INBOX_POLL },
    "[UnipileInboxPoll] Worker started successfully",
  )

  return unipileInboxPollWorker
}

/**
 * Stop Unipile Inbox Poll Worker
 */
export async function stopUnipileInboxPollWorker(): Promise<void> {
  if (unipileInboxPollWorker) {
    await unipileInboxPollWorker.close()
    unipileInboxPollWorker = null
    logger.info("[UnipileInboxPoll] Worker stopped")
  }
}

/**
 * Get Worker Status
 */
export function getUnipileInboxPollWorkerStatus(): {
  running: boolean
  enabled: boolean
  concurrency: number
} {
  const isEnabled = process.env.UNIPILE_INBOX_POLL_ENABLED === "true"

  return {
    running: unipileInboxPollWorker !== null && !unipileInboxPollWorker.closing,
    enabled: isEnabled,
    concurrency: unipileInboxPollWorker?.opts.concurrency || 0,
  }
}

// ============================================================================
// Exports
// ============================================================================

export { unipileInboxPollWorker }
