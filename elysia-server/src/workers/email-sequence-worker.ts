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
    console.error("Error sending sequence email:", error instanceof Error ? error.message : error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function processSequenceEmails() {
  console.log("[Email Sequence Worker] Starting email processing...")

  try {
    // Get pending step executions
    const pendingExecutions = await sequenceService.getPendingStepExecutions(50)

    if (pendingExecutions.length === 0) {
      console.log("[Email Sequence Worker] No pending emails to send")
      return
    }

    console.log(`[Email Sequence Worker] Found ${pendingExecutions.length} pending emails`)

    // Process each execution
    for (const execution of pendingExecutions) {
      console.log(
        `[Email Sequence Worker] Processing execution ${execution.executionId} for lead ${execution.leadCompanyName || execution.leadId}`,
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

        console.log(`[Email Sequence Worker] ✓ Email sent successfully: ${result.messageId}`)
      } else {
        // Update execution status to 'failed'
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "failed",
          result.error,
        )

        console.error(`[Email Sequence Worker] ✗ Email failed: ${result.error}`)
      }
    }

    console.log("[Email Sequence Worker] Finished processing emails")
  } catch (error) {
    console.error("[Email Sequence Worker] Error in processSequenceEmails:", error)
  }
}

// Run worker every minute
export function startEmailSequenceWorker() {
  console.log("[Email Sequence Worker] Starting worker...")

  // Run immediately
  processSequenceEmails()

  // Then run every minute
  const intervalId = setInterval(processSequenceEmails, 60 * 1000) // 60 seconds

  // Return function to stop worker
  return () => {
    console.log("[Email Sequence Worker] Stopping worker...")
    clearInterval(intervalId)
  }
}

// Export for manual testing
export { processSequenceEmails }
