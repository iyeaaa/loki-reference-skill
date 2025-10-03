/**
 * Email Sequence Worker
 *
 * This worker runs periodically to process pending sequence step executions.
 * It fetches pending steps, sends emails via SendGrid, and updates execution status.
 */

import sgMail from "@sendgrid/mail"
import { and, eq } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { leadContacts } from "../db/schema/lead-details"
import * as sequenceService from "../services/sequence.service"
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

async function sendSequenceEmail(execution: {
  executionId: string
  enrollmentId: string
  leadId: string
  leadCompanyName: string | null
  emailAccountId: string
  emailSubject: string
  emailBodyText: string | null
  emailBodyHtml: string | null
  sequenceName: string
}): Promise<EmailSendResult> {
  try {
    // Get lead's primary email
    const [leadContact] = await db
      .select({ email: leadContacts.contactValue })
      .from(leadContacts)
      .where(
        and(
          eq(leadContacts.leadId, execution.leadId),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )
      .limit(1)

    if (!leadContact) {
      return {
        success: false,
        error: "Lead email not found",
      }
    }

    // Get email account details
    const [emailAccount] = await db
      .select({
        emailAddress: userEmailAccounts.emailAddress,
        displayName: userEmailAccounts.displayName,
        apiKey: userEmailAccounts.apiKey,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, execution.emailAccountId))
      .limit(1)

    if (!emailAccount) {
      return {
        success: false,
        error: "Email account not found",
      }
    }

    // Use account-specific API key or default
    const apiKey = emailAccount.apiKey || config.sendgrid.apiKey
    if (!apiKey) {
      return {
        success: false,
        error: "SendGrid API key not configured",
      }
    }

    // Set API key for this request
    sgMail.setApiKey(apiKey)

    // Prepare email message
    const msg = {
      to: leadContact.email,
      from: {
        email: emailAccount.emailAddress,
        name: emailAccount.displayName || emailAccount.emailAddress,
      },
      subject: execution.emailSubject,
      text: execution.emailBodyText || undefined,
      html: execution.emailBodyHtml || undefined,
    }

    // Send email
    const [response] = await sgMail.send(msg as never)

    return {
      success: true,
      messageId: response.headers["x-message-id"] as string,
    }
  } catch (error: unknown) {
    logger.error(
      { err: error, leadId: execution.leadId, executionId: execution.executionId },
      "Error sending sequence email",
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function processSequenceEmails() {
  logger.info("Starting email processing")

  try {
    // Get pending step executions
    const pendingExecutions = await sequenceService.getPendingStepExecutions(50)

    if (pendingExecutions.length === 0) {
      logger.debug("No pending emails to send")
      return
    }

    logger.info({ count: pendingExecutions.length }, "Found pending emails")

    // Process each execution
    for (const execution of pendingExecutions) {
      logger.info(
        {
          executionId: execution.executionId,
          leadId: execution.leadId,
          leadCompanyName: execution.leadCompanyName,
        },
        "Processing execution",
      )

      // Send email
      const result = await sendSequenceEmail(execution)

      if (result.success) {
        // Update execution status to 'sent'
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "sent",
          undefined,
          result.messageId,
        )

        // Update enrollment progress
        await sequenceService.updateEnrollmentProgress(execution.enrollmentId, execution.stepOrder)

        logger.info(
          { executionId: execution.executionId, messageId: result.messageId },
          "Email sent successfully",
        )
      } else {
        // Update execution status to 'failed'
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "failed",
          result.error,
        )

        logger.error(
          { executionId: execution.executionId, error: result.error },
          "Email send failed",
        )
      }
    }

    logger.info("Finished processing emails")
  } catch (error) {
    logger.error({ err: error }, "Error in processSequenceEmails")
  }
}

// Run worker every minute
export function startEmailSequenceWorker() {
  logger.info("Starting email sequence worker")

  // Run immediately
  processSequenceEmails()

  // Then run every minute
  const intervalId = setInterval(processSequenceEmails, 60 * 1000) // 60 seconds

  // Return function to stop worker
  return () => {
    logger.info("Stopping email sequence worker")
    clearInterval(intervalId)
  }
}

// Export for manual testing
export { processSequenceEmails }
