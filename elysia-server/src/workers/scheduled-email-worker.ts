/**
 * Scheduled Email Worker
 *
 * This worker runs periodically to process scheduled emails.
 * It fetches emails where scheduledAt <= now and status = 'scheduled',
 * sends them via SendGrid, and updates their status.
 */

import sgMail from "@sendgrid/mail"
import { and, eq, lte } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { emails } from "../db/schema/emails"
import logger from "../utils/logger"

// Initialize SendGrid
if (config.sendgrid.apiKey) {
  sgMail.setApiKey(config.sendgrid.apiKey)
}

interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a single email via SendGrid
 */
async function sendScheduledEmail(email: {
  id: string
  fromEmail: string
  toEmail: string
  ccEmails: string[] | null
  bccEmails: string[] | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
}): Promise<EmailSendResult> {
  try {
    // Use fixed sender configuration from config
    const fixedFromEmail = config.sendgrid.fromEmail
    const fixedFromName = config.sendgrid.fromName

    // Prepare email message
    const msg = {
      to: email.toEmail,
      from: {
        email: fixedFromEmail,
        name: fixedFromName,
      },
      subject: email.subject || "(제목 없음)",
      text: email.bodyText || (email.bodyHtml ? undefined : "(본문 없음)"),
      html: email.bodyHtml || undefined,
      cc: email.ccEmails && email.ccEmails.length > 0 ? email.ccEmails : undefined,
      bcc: email.bccEmails && email.bccEmails.length > 0 ? email.bccEmails : undefined,
    }

    // Send email
    const [response] = await sgMail.send(msg as never)

    return {
      success: true,
      messageId: response.headers["x-message-id"] as string,
    }
  } catch (error: unknown) {
    logger.error({ err: error, emailId: email.id }, "SendGrid error")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Process all scheduled emails that are due
 */
async function processScheduledEmails() {
  logger.info("Starting scheduled email processing")

  try {
    const now = new Date()

    // Query emails where:
    // - status = 'scheduled'
    // - scheduledAt <= now
    const scheduledEmails = await db
      .select()
      .from(emails)
      .where(and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)))
      .limit(100) // Process max 100 emails per run

    if (scheduledEmails.length === 0) {
      logger.debug("No scheduled emails to send")
      return
    }

    logger.info({ count: scheduledEmails.length }, "Found scheduled emails")

    let successCount = 0
    let failureCount = 0

    // Process each scheduled email
    for (const email of scheduledEmails) {
      logger.info({ emailId: email.id, to: email.toEmail }, "Processing email")

      // Update status to 'queued' to prevent duplicate processing
      await db
        .update(emails)
        .set({ status: "queued", updatedAt: new Date() })
        .where(eq(emails.id, email.id))

      // Send email
      const result = await sendScheduledEmail(email)

      if (result.success) {
        // Update status to 'sent'
        await db
          .update(emails)
          .set({
            status: "sent",
            sentAt: new Date(),
            sendgridMessageId: result.messageId,
            updatedAt: new Date(),
          })
          .where(eq(emails.id, email.id))

        successCount++
        logger.info({ emailId: email.id, messageId: result.messageId }, "Email sent successfully")
      } else {
        // Update status to 'failed' and increment retry count
        await db
          .update(emails)
          .set({
            status: "failed",
            errorMessage: result.error,
            retryCount: email.retryCount + 1,
            lastRetryAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(emails.id, email.id))

        failureCount++
        logger.error({ emailId: email.id, error: result.error }, "Email send failed")
      }
    }

    logger.info(
      { successCount, failureCount, total: scheduledEmails.length },
      "Finished processing scheduled emails",
    )
  } catch (error) {
    logger.error({ err: error }, "Error in processScheduledEmails")
  }
}

/**
 * Start the scheduled email worker
 * Runs every 30 seconds to check for due emails
 */
export function startScheduledEmailWorker() {
  logger.info("Starting scheduled email worker")

  // Run immediately on startup
  processScheduledEmails()

  // Then run every 30 seconds
  const intervalId = setInterval(processScheduledEmails, 30 * 1000) // 30 seconds

  // Return function to stop worker
  return () => {
    logger.info("Stopping scheduled email worker")
    clearInterval(intervalId)
  }
}

// Export for manual testing
export { processScheduledEmails }
