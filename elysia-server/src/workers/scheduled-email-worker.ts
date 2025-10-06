/**
 * Scheduled Email Worker
 *
 * This worker runs periodically to process scheduled emails.
 * It fetches emails where scheduledAt <= now and status = 'scheduled',
 * sends them via SendGrid, and updates their status.
 */

import sgMail from "@sendgrid/mail"
import { and, eq, lte } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import logger from "../utils/logger"

interface EmailSendResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send a single email via SendGrid using user_email_accounts
 */
async function sendScheduledEmail(email: {
  id: string
  userEmailAccountId: string
  fromEmail: string
  toEmail: string
  ccEmails: string[] | null
  bccEmails: string[] | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
}): Promise<EmailSendResult> {
  try {
    // Get email account details from user_email_accounts
    const [emailAccount] = await db
      .select({
        emailAddress: userEmailAccounts.emailAddress,
        displayName: userEmailAccounts.displayName,
        apiKey: userEmailAccounts.apiKey,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, email.userEmailAccountId))
      .limit(1)

    if (!emailAccount) {
      return {
        success: false,
        error: "Email account not found",
      }
    }

    // Use account-specific API key
    const apiKey = emailAccount.apiKey
    if (!apiKey) {
      return {
        success: false,
        error: "SendGrid API key not configured for this account",
      }
    }

    // Set API key for this request
    sgMail.setApiKey(apiKey)

    // Prepare email message
    const msg = {
      to: email.toEmail,
      from: {
        email: emailAccount.emailAddress,
        name: emailAccount.displayName || emailAccount.emailAddress,
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
  try {
    const now = new Date()

    // Query emails where:
    // - status = 'scheduled'
    // - scheduledAt <= now
    const scheduledEmails = await db
      .select({
        id: emails.id,
        userEmailAccountId: emails.userEmailAccountId,
        fromEmail: emails.fromEmail,
        toEmail: emails.toEmail,
        ccEmails: emails.ccEmails,
        bccEmails: emails.bccEmails,
        subject: emails.subject,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
        retryCount: emails.retryCount,
      })
      .from(emails)
      .where(and(eq(emails.status, "scheduled"), lte(emails.scheduledAt, now)))
      .limit(100) // Process max 100 emails per run

    if (scheduledEmails.length === 0) {
      logger.trace("No scheduled emails to send")
      return
    }

    logger.info({ count: scheduledEmails.length }, "Processing scheduled emails")

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
  logger.debug("✅ Scheduled email worker started")

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
