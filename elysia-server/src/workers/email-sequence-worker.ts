/**
 * Email Sequence Worker (ORIGINAL IMPLEMENTATION)
 *
 * ⚠️ DEPRECATED: This file contains the original implementation that generates
 * email content on-the-fly during sending.
 *
 * 🆕 NEW IMPLEMENTATION: See email-sequence-worker-with-drafts.ts
 * The new version uses pre-generated email drafts for better performance.
 *
 * This file is kept for reference and fallback purposes.
 * To switch back to this implementation, uncomment the code below and
 * update the worker registration in your main server file.
 */

/* ============================================================================
   COMMENTED OUT - Original implementation below
   ============================================================================

/**
 * Email Sequence Worker (ORIGINAL)
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
import { sequenceEnrollments } from "../db/schema/sequences"
import { emailService } from "../services/email.service"
import * as leadService from "../services/lead.service"
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
  stepOrder: number
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
  attachments?: Array<{ filename: string; type: string; content: string }> | null
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

    // ====================================
    // CHECK FOR PRE-GENERATED DRAFT
    // ====================================
    // For AI-generated campaigns, check if a draft already exists in workflow_generated_emails
    // nodeId = stepId (we use stepId as nodeId for step-based sequences)
    const { workflowGeneratedEmails } = await import("../db/schema/workflow-emails")
    const [preDraft] = await db
      .select({
        id: workflowGeneratedEmails.id,
        subject: workflowGeneratedEmails.subject,
        bodyText: workflowGeneratedEmails.bodyText,
        bodyHtml: workflowGeneratedEmails.bodyHtml,
        status: workflowGeneratedEmails.status,
        generationMode: workflowGeneratedEmails.generationMode,
      })
      .from(workflowGeneratedEmails)
      .where(
        and(
          eq(workflowGeneratedEmails.sequenceId, execution.sequenceId),
          eq(workflowGeneratedEmails.nodeId, execution.stepId), // nodeId = stepId for step-based sequences
          eq(workflowGeneratedEmails.leadId, execution.leadId),
        ),
      )
      .limit(1)

    let personalizedSubject: string
    let personalizedBodyText: string | null
    let personalizedBodyHtml: string | null

    if (preDraft && (preDraft.status === "generated" || preDraft.status === "edited")) {
      // Use pre-generated draft from AI or user edits
      personalizedSubject = preDraft.subject
      personalizedBodyText = preDraft.bodyText
      personalizedBodyHtml = preDraft.bodyHtml

      logger.info(
        {
          executionId: execution.executionId,
          draftId: preDraft.id,
          generationMode: preDraft.generationMode,
          status: preDraft.status,
        },
        "📝 [STEP-WORKER] Using pre-generated draft from workflow_generated_emails",
      )
    } else {
      // No pre-generated draft found, generate on-the-fly (backwards compatible with old sequences)
      logger.debug(
        { executionId: execution.executionId },
        "🔄 [STEP-WORKER] No pre-generated draft found, generating on-the-fly from template",
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
      personalizedSubject = workflowEmailService.replaceTemplateVariables(
        execution.emailSubject,
        leadContext,
      )
      personalizedBodyText = execution.emailBodyText
        ? workflowEmailService.replaceTemplateVariables(execution.emailBodyText, leadContext)
        : null
      personalizedBodyHtml = execution.emailBodyHtml
        ? workflowEmailService.replaceTemplateVariables(execution.emailBodyHtml, leadContext)
        : null

      logger.debug(
        {
          executionId: execution.executionId,
          originalSubject: execution.emailSubject,
          personalizedSubject,
        },
        "🔄 [STEP-WORKER] Personalized email content from template",
      )
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

    // Get enrollment to check for firstThreadId (for email threading)
    const [enrollment] = await db
      .select({
        firstThreadId: sequenceEnrollments.firstThreadId,
      })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, execution.enrollmentId))
      .limit(1)

    if (!enrollment) {
      logger.error(
        { executionId: execution.executionId, enrollmentId: execution.enrollmentId },
        "❌ [STEP-WORKER] Enrollment not found",
      )
      return {
        success: false,
        error: "Enrollment not found",
      }
    }

    // Determine if this is the first email in the sequence
    const isFirstEmail = execution.stepOrder === 1
    let inReplyTo: string | undefined
    let references: string[] | undefined

    if (isFirstEmail) {
      // First email: no In-Reply-To or References
      logger.info(
        {
          executionId: execution.executionId,
          stepOrder: execution.stepOrder,
        },
        "📧 [STEP-WORKER] First email in sequence - no threading headers",
      )
    } else {
      // Follow-up email: use firstThreadId for threading
      if (enrollment.firstThreadId) {
        inReplyTo = enrollment.firstThreadId
        references = [enrollment.firstThreadId]
        logger.info(
          {
            executionId: execution.executionId,
            stepOrder: execution.stepOrder,
            firstThreadId: enrollment.firstThreadId,
          },
          "🧵 [STEP-WORKER] Follow-up email - using thread headers",
        )
      } else {
        logger.warn(
          {
            executionId: execution.executionId,
            stepOrder: execution.stepOrder,
          },
          "⚠️ [STEP-WORKER] Follow-up email but no firstThreadId found",
        )
      }
    }

    logger.info(
      {
        executionId: execution.executionId,
        from: emailAccount.emailAddress,
        to: leadContact.email,
        subject: execution.emailSubject,
        stepOrder: execution.stepOrder,
        isFirstEmail,
        hasThreading: !!inReplyTo,
      },
      "📤 [STEP-WORKER] Sending email via EmailService",
    )

    // Prepare attachments for SendGrid (convert from stored format)
    let sendGridAttachments:
      | Array<{
          content: string
          filename: string
          type: string
          disposition: "attachment"
        }>
      | undefined
    if (execution.attachments && execution.attachments.length > 0) {
      sendGridAttachments = execution.attachments.map((att) => ({
        content: att.content, // Base64 encoded content
        filename: att.filename,
        type: att.type,
        disposition: "attachment" as const,
      }))

      logger.info(
        {
          executionId: execution.executionId,
          attachmentCount: sendGridAttachments.length,
        },
        "📎 [STEP-WORKER] Including attachments in email",
      )
    }

    // Send email using EmailService (includes automatic signature)
    const sendResult = await emailService.sendEmail({
      fromEmail: emailAccount.emailAddress,
      fromName: emailAccount.displayName || emailAccount.emailAddress,
      toEmail: leadContact.email,
      subject: personalizedSubject,
      bodyText: personalizedBodyText || undefined,
      bodyHtml: personalizedBodyHtml || undefined,
      inReplyTo,
      references,
      attachments: sendGridAttachments,
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
    const messageId = sendResult.messageId // RFC 2822 Message-ID

    logger.info(
      {
        executionId: execution.executionId,
        messageId,
        sendgridMessageId,
      },
      "✅ [STEP-WORKER] Email sent successfully",
    )

    // If this is the first email, save the Message-ID as firstThreadId
    if (isFirstEmail && messageId) {
      await db
        .update(sequenceEnrollments)
        .set({ firstThreadId: messageId })
        .where(eq(sequenceEnrollments.id, execution.enrollmentId))

      logger.info(
        {
          executionId: execution.executionId,
          enrollmentId: execution.enrollmentId,
          firstThreadId: messageId,
        },
        "🧵 [STEP-WORKER] Saved firstThreadId for enrollment",
      )
    }

    // Determine threadId for this email record
    // - First email: messageId becomes threadId
    // - Follow-up emails: use firstThreadId from enrollment
    const threadId = isFirstEmail ? messageId : enrollment.firstThreadId

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
        messageId, // RFC 2822 Message-ID
        threadId, // Thread ID for grouping
        inReplyTo: inReplyTo || undefined,
        sentAt: new Date(),
        // Denormalized fields for performance
        leadName: lead.companyName || undefined,
        leadEmail: leadContact.email,
        sequenceName: execution.sequenceName,
      })
      .returning({
        id: emails.id,
        sendgridMessageId: emails.sendgridMessageId,
        threadId: emails.threadId,
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
        threadId: emailRecord.threadId,
        isFirstEmail,
      },
      "✅ [STEP-WORKER] Created email record in database with thread info",
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

async function _processSequenceEmails() {
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

        // Update lead status to 'contacted' and lastContactedAt
        try {
          await leadService.updateLead(execution.leadId, {
            leadStatus: "contacted",
            lastContactedAt: new Date(),
          })
          logger.info(
            {
              leadId: execution.leadId,
              leadCompanyName: execution.leadCompanyName,
            },
            "✅ [STEP-WORKER] Lead status updated to contacted",
          )
        } catch (leadUpdateError) {
          logger.error(
            {
              leadId: execution.leadId,
              error: leadUpdateError,
            },
            "❌ [STEP-WORKER] Failed to update lead status",
          )
        }

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
  _processSequenceEmails()

  // Then run every minute
  const intervalId = setInterval(_processSequenceEmails, 60 * 1000) // 60 seconds

  // Return function to stop worker
  return () => {
    logger.info("Stopping email sequence worker")
    clearInterval(intervalId)
  }
}

export const processSequenceEmails = _processSequenceEmails

// ============================================================================
// END OF COMMENTED OUT CODE - Original implementation above
// ============================================================================ */

// Current implementation already supports pre-generated drafts
// The worker checks for drafts in workflow_generated_emails before generating on-the-fly
