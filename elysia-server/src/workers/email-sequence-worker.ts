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
    logger.debug(
      {
        executionId: execution.executionId,
        leadId: execution.leadId,
        leadCompanyName: execution.leadCompanyName,
      },
      "🔍 [STEP-WORKER] Fetching lead email",
    )

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
      logger.error(
        { executionId: execution.executionId, leadId: execution.leadId },
        "❌ [STEP-WORKER] Lead email not found",
      )
      return {
        success: false,
        error: "Lead email not found",
      }
    }

    logger.debug(
      {
        executionId: execution.executionId,
        toEmail: leadContact.email,
      },
      "✅ [STEP-WORKER] Found lead email",
    )

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
      logger.error(
        { executionId: execution.executionId, emailAccountId: execution.emailAccountId },
        "❌ [STEP-WORKER] Email account not found",
      )
      return {
        success: false,
        error: "Email account not found",
      }
    }

    logger.debug(
      {
        executionId: execution.executionId,
        fromEmail: emailAccount.emailAddress,
        displayName: emailAccount.displayName,
      },
      "✅ [STEP-WORKER] Found email account",
    )

    // Use account-specific API key or default
    const apiKey = emailAccount.apiKey || config.sendgrid.apiKey
    if (!apiKey) {
      logger.error(
        { executionId: execution.executionId },
        "❌ [STEP-WORKER] SendGrid API key not configured",
      )
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

    logger.info(
      {
        executionId: execution.executionId,
        from: emailAccount.emailAddress,
        to: leadContact.email,
        subject: execution.emailSubject,
      },
      "📤 [STEP-WORKER] Sending email via SendGrid",
    )

    // Send email
    const [response] = await sgMail.send(msg as never)

    logger.info(
      {
        executionId: execution.executionId,
        messageId: response.headers["x-message-id"],
      },
      "✅ [STEP-WORKER] SendGrid accepted email",
    )

    return {
      success: true,
      messageId: response.headers["x-message-id"] as string,
    }
  } catch (error: unknown) {
    logger.error(
      { err: error, leadId: execution.leadId, executionId: execution.executionId },
      "💥 [STEP-WORKER] Error sending sequence email",
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function processSequenceEmails() {
  try {
    logger.debug("🔍 [STEP-WORKER] Checking for pending step executions")

    // Get pending step executions
    const pendingExecutions = await sequenceService.getPendingStepExecutions(50)

    if (pendingExecutions.length === 0) {
      // Only log at trace level to reduce noise
      logger.trace("⏳ [STEP-WORKER] No pending emails to send")
      return
    }

    logger.info(
      {
        count: pendingExecutions.length,
        executions: pendingExecutions.map((e) => ({
          executionId: e.executionId,
          sequenceId: e.sequenceId,
          sequenceName: e.sequenceName,
          leadCompanyName: e.leadCompanyName,
          scheduledAt: e.scheduledAt,
          stepOrder: e.stepOrder,
        })),
      },
      "📬 [STEP-WORKER] Processing pending emails",
    )

    let successCount = 0
    let failureCount = 0

    // Process each execution
    for (const execution of pendingExecutions) {
      logger.info(
        {
          executionId: execution.executionId,
          enrollmentId: execution.enrollmentId,
          leadId: execution.leadId,
          leadCompanyName: execution.leadCompanyName,
          sequenceName: execution.sequenceName,
          stepOrder: execution.stepOrder,
          scheduledAt: execution.scheduledAt,
          emailSubject: execution.emailSubject,
        },
        "📧 [STEP-WORKER] Processing execution",
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

        successCount++
        logger.info(
          {
            executionId: execution.executionId,
            messageId: result.messageId,
            leadCompanyName: execution.leadCompanyName,
            stepOrder: execution.stepOrder,
          },
          "✅ [STEP-WORKER] Email sent successfully",
        )
      } else {
        // Update execution status to 'failed'
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "failed",
          result.error,
        )

        failureCount++
        logger.error(
          {
            executionId: execution.executionId,
            error: result.error,
            leadCompanyName: execution.leadCompanyName,
            stepOrder: execution.stepOrder,
          },
          "❌ [STEP-WORKER] Email send failed",
        )
      }
    }

    logger.info(
      {
        total: pendingExecutions.length,
        successCount,
        failureCount,
      },
      "🎯 [STEP-WORKER] Finished processing emails",
    )
  } catch (error) {
    logger.error({ err: error }, "💥 [STEP-WORKER] Error in processSequenceEmails")
  }
}

// Run worker every minute
export function startEmailSequenceWorker() {
  logger.debug("✅ Email sequence worker started")

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
