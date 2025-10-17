/**
 * Email Sequence Worker
 *
 * This worker runs periodically to process pending sequence step executions.
 * It fetches pending steps, sends emails via SendGrid, and updates execution status.
 */

import { and, eq } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { leadContacts, leadIndustryTypes } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import { emailService } from "../services/email.service"
import * as sequenceService from "../services/sequence.service"
import * as workflowEmailService from "../services/workflow-email.service"
import logger from "../utils/logger"

interface EmailSendResult {
  success: boolean
  messageId?: string
  emailRecordId?: string // UUID from emails table
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
  sequenceId: string
  stepId: string
  workspaceId: string
  userId: string | null
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

    // Get lead's primary email and contact name
    const [leadContact] =
      (await db
        .select({
          email: leadContacts.contactValue,
          contactName: leadContacts.contactName,
        })
        .from(leadContacts)
        .where(
          and(
            eq(leadContacts.leadId, execution.leadId),
            eq(leadContacts.contactType, "email"),
            eq(leadContacts.isPrimary, true),
          ),
        )
        .limit(1)) ||
      (await db // fallback to non-primary email
        .select({
          email: leadContacts.contactValue,
          contactName: leadContacts.contactName,
        })
        .from(leadContacts)
        .where(
          and(eq(leadContacts.leadId, execution.leadId), eq(leadContacts.contactType, "email")),
        )
        .limit(1))

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
        contactName: leadContact.contactName,
      },
      "✅ [STEP-WORKER] Found lead email and contact",
    )

    // Get full lead information for variable replacement
    const [lead] = await db
      .select({
        companyName: leads.companyName,
        websiteUrl: leads.websiteUrl,
        businessType: leads.businessType,
        description: leads.description,
        address: leads.address,
        country: leads.country,
        city: leads.city,
        state: leads.state,
        foundedYear: leads.foundedYear,
        employeeCount: leads.employeeCount,
        leadSource: leads.leadSource,
        leadStatus: leads.leadStatus,
        leadScore: leads.leadScore,
      })
      .from(leads)
      .where(eq(leads.id, execution.leadId))
      .limit(1)

    if (!lead) {
      logger.error(
        { executionId: execution.executionId, leadId: execution.leadId },
        "❌ [STEP-WORKER] Lead not found",
      )
      return {
        success: false,
        error: "Lead not found",
      }
    }

    // Get industry types for this lead (join with leadIndustryTypes)
    const industries = await db
      .select({
        industryName: leadIndustryTypes.industryName,
      })
      .from(leadIndustryTypes)
      .where(eq(leadIndustryTypes.leadId, execution.leadId))

    const industryString = industries.map((i) => i.industryName).join(", ")

    logger.debug(
      {
        executionId: execution.executionId,
        leadCompanyName: lead.companyName,
        industries: industryString,
      },
      "✅ [STEP-WORKER] Found lead info",
    )

    // Prepare lead context for variable replacement
    const leadContext = {
      companyName: lead.companyName || "",
      contactName: leadContact.contactName || "", // From leadContacts table
      contactEmail: leadContact.email || "", // From leadContacts table
      industry: industryString || "",
      businessType: lead.businessType || "", // Add businessType field
      website: lead.websiteUrl || "",
      description: lead.description || "",
      address: lead.address || "",
      country: lead.country || "",
      city: lead.city || "",
      state: lead.state || "",
      foundedYear: lead.foundedYear?.toString() || "",
      employeeCount: lead.employeeCount || "",
      leadSource: lead.leadSource || "",
      leadStatus: lead.leadStatus || "",
      leadScore: lead.leadScore?.toString() || "",
    }

    // Replace template variables with actual values
    const personalizedSubject = workflowEmailService.replaceTemplateVariables(
      execution.emailSubject,
      leadContext,
    )
    const personalizedBodyText = execution.emailBodyText
      ? workflowEmailService.replaceTemplateVariables(execution.emailBodyText, leadContext)
      : null
    const personalizedBodyHtml = execution.emailBodyHtml
      ? workflowEmailService.replaceTemplateVariables(execution.emailBodyHtml, leadContext)
      : null

    logger.debug(
      {
        executionId: execution.executionId,
        originalSubject: execution.emailSubject,
        personalizedSubject,
      },
      "🔄 [STEP-WORKER] Personalized email content",
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
        {
          executionId: execution.executionId,
          emailAccountId: execution.emailAccountId,
        },
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

    // Use account-specific API key
    const apiKey = emailAccount.apiKey
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

    logger.info(
      {
        executionId: execution.executionId,
        from: emailAccount.emailAddress,
        to: leadContact.email,
        subject: execution.emailSubject,
      },
      "📤 [STEP-WORKER] Sending email via EmailService",
    )

    // Send email using EmailService (includes automatic signature)
    const sendResult = await emailService.sendEmail({
      fromEmail: emailAccount.emailAddress,
      fromName: emailAccount.displayName || emailAccount.emailAddress,
      toEmail: leadContact.email,
      subject: personalizedSubject,
      bodyText: personalizedBodyText || undefined,
      bodyHtml: personalizedBodyHtml || undefined,
      includeSignature: false, // 시퀀스 이메일은 프론트엔드에서 이미 서명이 포함됨
      userId: execution.userId || undefined,
      workspaceId: execution.workspaceId,
      apiKey: apiKey,
    })

    if (!sendResult.success) {
      logger.error(
        {
          executionId: execution.executionId,
          error: sendResult.error,
        },
        "❌ [STEP-WORKER] Email send failed",
      )
      return {
        success: false,
        error: sendResult.error || "Failed to send email",
      }
    }

    const sendgridMessageId = sendResult.sendgridMessageId

    logger.info(
      {
        executionId: execution.executionId,
        messageId: sendgridMessageId,
      },
      "✅ [STEP-WORKER] Email sent successfully",
    )

    // Create email record in database with personalized content
    const [emailRecord] = await db
      .insert(emails)
      .values({
        workspaceId: execution.workspaceId,
        userEmailAccountId: execution.emailAccountId,
        leadId: execution.leadId,
        sequenceId: execution.sequenceId,
        stepId: execution.stepId,
        direction: "outbound",
        fromEmail: emailAccount.emailAddress,
        toEmail: leadContact.email,
        subject: personalizedSubject,
        bodyText: personalizedBodyText || undefined,
        bodyHtml: personalizedBodyHtml || undefined,
        status: "sent",
        sendgridMessageId,
        sentAt: new Date(),
        // Denormalized fields for performance
        leadName: lead.companyName || undefined,
        leadEmail: leadContact.email,
        sequenceName: execution.sequenceName,
      })
      .returning({
        id: emails.id,
        sendgridMessageId: emails.sendgridMessageId,
      })

    if (!emailRecord) {
      logger.error(
        { executionId: execution.executionId, sendgridMessageId },
        "❌ [STEP-WORKER] Failed to create email record in database",
      )
      return {
        success: false,
        error: "Failed to create email record in database",
      }
    }

    logger.info(
      {
        executionId: execution.executionId,
        emailId: emailRecord.id,
        sendgridMessageId,
        storedMessageId: emailRecord.sendgridMessageId,
      },
      "✅ [STEP-WORKER] Created email record in database",
    )

    return {
      success: true,
      messageId: sendgridMessageId,
      emailRecordId: emailRecord.id,
    }
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        leadId: execution.leadId,
        executionId: execution.executionId,
      },
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
        // Update execution status to 'sent' with email record UUID
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "sent",
          undefined,
          result.emailRecordId, // Pass UUID from emails table
        )

        // Update enrollment progress
        await sequenceService.updateEnrollmentProgress(execution.enrollmentId, execution.stepOrder)

        successCount++
        logger.info(
          {
            executionId: execution.executionId,
            emailId: result.emailRecordId,
            sendgridMessageId: result.messageId,
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
