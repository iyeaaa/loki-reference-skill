/**
 * Email Sequence Worker V2
 *
 * This worker processes pending sequence step executions.
 * It checks for pre-generated drafts in the emails table (status="draft"),
 * and falls back to template variable replacement if no draft exists.
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
      "🔍 [STEP-WORKER-V2] Processing email",
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
        "❌ [STEP-WORKER-V2] Lead email not found",
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
      "✅ [STEP-WORKER-V2] Found lead email and contact",
    )

    // Get full lead information
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
        "❌ [STEP-WORKER-V2] Lead not found",
      )
      return {
        success: false,
        error: "Lead not found",
      }
    }

    // Get industry types for this lead
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
      "✅ [STEP-WORKER-V2] Found lead info",
    )

    // ====================================
    // CHECK FOR EXISTING DRAFT IN EMAILS TABLE
    // ====================================
    let personalizedSubject: string
    let personalizedBodyText: string | null
    let personalizedBodyHtml: string | null
    let existingDraftId: string | null = null

    // Step 1: Check for existing draft in emails table
    const [existingDraft] = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
      })
      .from(emails)
      .where(
        and(
          eq(emails.sequenceId, execution.sequenceId),
          eq(emails.stepId, execution.stepId),
          eq(emails.leadId, execution.leadId),
          eq(emails.status, "draft"),
        ),
      )
      .limit(1)

    if (existingDraft) {
      // Use pre-generated draft from emails table
      personalizedSubject = existingDraft.subject || execution.emailSubject
      personalizedBodyText = existingDraft.bodyText
      personalizedBodyHtml = existingDraft.bodyHtml
      existingDraftId = existingDraft.id

      logger.info(
        {
          executionId: execution.executionId,
          draftId: existingDraft.id,
          sequenceId: execution.sequenceId,
          stepId: execution.stepId,
          leadId: execution.leadId,
        },
        "📝 [STEP-WORKER-V2] Using existing draft from emails table",
      )
    } else {
      // No draft found - fall back to template variable replacement
      logger.info(
        {
          executionId: execution.executionId,
          sequenceId: execution.sequenceId,
          stepId: execution.stepId,
          leadId: execution.leadId,
        },
        "🔄 [STEP-WORKER-V2] No draft found, using template with variable replacement",
      )

      // Prepare lead context for variable replacement
      const leadContext = {
        companyName: lead.companyName || "",
        contactName: leadContact.contactName || "",
        contactEmail: leadContact.email || "",
        industry: industryString || "",
        businessType: lead.businessType || "",
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
        "✅ [STEP-WORKER-V2] Personalized email content from template",
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
        "❌ [STEP-WORKER-V2] Email account not found",
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
      "✅ [STEP-WORKER-V2] Found email account",
    )

    // Use account-specific API key
    const apiKey = emailAccount.apiKey
    if (!apiKey) {
      logger.error(
        { executionId: execution.executionId },
        "❌ [STEP-WORKER-V2] SendGrid API key not configured",
      )
      return {
        success: false,
        error: "SendGrid API key not configured",
      }
    }

    // Get enrollment for threading
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
        "❌ [STEP-WORKER-V2] Enrollment not found",
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
      logger.info(
        {
          executionId: execution.executionId,
          stepOrder: execution.stepOrder,
        },
        "📧 [STEP-WORKER-V2] First email in sequence - no threading headers",
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
          "🧵 [STEP-WORKER-V2] Follow-up email - using thread headers",
        )
      } else {
        logger.warn(
          {
            executionId: execution.executionId,
            stepOrder: execution.stepOrder,
          },
          "⚠️ [STEP-WORKER-V2] Follow-up email but no firstThreadId found",
        )
      }
    }

    logger.info(
      {
        executionId: execution.executionId,
        from: emailAccount.emailAddress,
        to: leadContact.email,
        subject: personalizedSubject,
        stepOrder: execution.stepOrder,
        isFirstEmail,
        hasThreading: !!inReplyTo,
        usedDraft: !!existingDraftId,
      },
      "📤 [STEP-WORKER-V2] Sending email via EmailService",
    )

    // Prepare attachments for SendGrid
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
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: "attachment" as const,
      }))

      logger.info(
        {
          executionId: execution.executionId,
          attachmentCount: sendGridAttachments.length,
        },
        "📎 [STEP-WORKER-V2] Including attachments in email",
      )
    }

    // Send email using EmailService
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
      includeSignature: false,
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
        "❌ [STEP-WORKER-V2] Email send failed",
      )
      return {
        success: false,
        error: sendResult.error || "Failed to send email",
      }
    }

    const sendgridMessageId = sendResult.sendgridMessageId || sendResult.nylasMessageId
    const messageId = sendResult.messageId || sendResult.nylasMessageId // RFC 2822 Message-ID
    const nylasThreadId = sendResult.nylasThreadId // Nylas thread ID (if sent via Nylas)

    logger.info(
      {
        executionId: execution.executionId,
        messageId,
        sendgridMessageId,
        nylasThreadId,
      },
      "✅ [STEP-WORKER-V2] Email sent successfully",
    )

    // Determine the thread ID to use:
    // - For Nylas: use nylasThreadId from send result
    // - For SendGrid first email: messageId becomes threadId
    // - For SendGrid follow-up: use firstThreadId from enrollment
    const threadId = nylasThreadId || (isFirstEmail ? messageId : enrollment.firstThreadId)

    // If this is the first email, save the thread ID as firstThreadId for follow-up emails
    if (isFirstEmail && threadId) {
      await db
        .update(sequenceEnrollments)
        .set({ firstThreadId: threadId })
        .where(eq(sequenceEnrollments.id, execution.enrollmentId))

      logger.info(
        {
          executionId: execution.executionId,
          enrollmentId: execution.enrollmentId,
          firstThreadId: threadId,
          isNylasThread: !!nylasThreadId,
        },
        "🧵 [STEP-WORKER-V2] Saved firstThreadId for enrollment",
      )
    }

    let emailRecordId: string

    if (existingDraftId) {
      // Update existing draft to sent status
      const updatedEmails = await db
        .update(emails)
        .set({
          status: "sent",
          sendgridMessageId,
          messageId,
          threadId,
          inReplyTo: inReplyTo || undefined,
          sentAt: new Date(),
          updatedAt: new Date(),
          // Update denormalized fields
          leadName: lead.companyName || undefined,
          leadEmail: leadContact.email,
          sequenceName: execution.sequenceName,
        })
        .where(eq(emails.id, existingDraftId))
        .returning({ id: emails.id })

      const updatedEmail = updatedEmails[0]
      if (!updatedEmail) {
        logger.error(
          { executionId: execution.executionId, draftId: existingDraftId },
          "❌ [STEP-WORKER-V2] Failed to update draft in database",
        )
        return {
          success: false,
          error: "Failed to update draft in database",
        }
      }

      emailRecordId = updatedEmail.id

      logger.info(
        {
          executionId: execution.executionId,
          emailId: emailRecordId,
          sendgridMessageId,
          threadId,
          isFirstEmail,
        },
        "✅ [STEP-WORKER-V2] Updated draft to sent in database",
      )
    } else {
      // Create new email record in database
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
          messageId,
          threadId,
          inReplyTo: inReplyTo || undefined,
          sentAt: new Date(),
          // Denormalized fields for performance
          leadName: lead.companyName || undefined,
          leadEmail: leadContact.email,
          sequenceName: execution.sequenceName,
        })
        .returning({ id: emails.id })

      if (!emailRecord) {
        logger.error(
          { executionId: execution.executionId, sendgridMessageId },
          "❌ [STEP-WORKER-V2] Failed to create email record in database",
        )
        return {
          success: false,
          error: "Failed to create email record in database",
        }
      }

      emailRecordId = emailRecord.id

      logger.info(
        {
          executionId: execution.executionId,
          emailId: emailRecordId,
          sendgridMessageId,
          threadId,
          isFirstEmail,
        },
        "✅ [STEP-WORKER-V2] Created email record in database",
      )
    }

    return {
      success: true,
      messageId: sendgridMessageId,
      emailRecordId,
    }
  } catch (error: unknown) {
    logger.error(
      {
        err: error,
        leadId: execution.leadId,
        executionId: execution.executionId,
      },
      "💥 [STEP-WORKER-V2] Error sending sequence email",
    )
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

async function _processSequenceEmails() {
  try {
    logger.debug("🔍 [STEP-WORKER-V2] Checking for pending step executions")

    // Get pending step executions
    const pendingExecutions = await sequenceService.getPendingStepExecutions(50)

    if (pendingExecutions.length === 0) {
      logger.trace("⏳ [STEP-WORKER-V2] No pending emails to send")
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
      "📬 [STEP-WORKER-V2] Processing pending emails",
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
        "📧 [STEP-WORKER-V2] Processing execution",
      )

      // Send email (checks for draft first, falls back to template)
      const result = await sendSequenceEmail(execution)

      if (result.success) {
        // Update execution status to 'sent' with email record UUID
        await sequenceService.updateStepExecutionStatus(
          execution.executionId,
          "sent",
          undefined,
          result.emailRecordId,
        )

        // Update enrollment progress
        await sequenceService.updateEnrollmentProgress(execution.enrollmentId, execution.stepOrder)

        // Update lead status to 'contacted'
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
            "✅ [STEP-WORKER-V2] Lead status updated to contacted",
          )
        } catch (leadUpdateError) {
          logger.error(
            {
              leadId: execution.leadId,
              error: leadUpdateError,
            },
            "❌ [STEP-WORKER-V2] Failed to update lead status",
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
          "✅ [STEP-WORKER-V2] Email sent successfully",
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
          "❌ [STEP-WORKER-V2] Email send failed",
        )
      }
    }

    logger.info(
      {
        total: pendingExecutions.length,
        successCount,
        failureCount,
      },
      "🎯 [STEP-WORKER-V2] Finished processing emails",
    )
  } catch (error) {
    logger.error({ err: error }, "💥 [STEP-WORKER-V2] Error in processSequenceEmails")
  }
}

// Run worker every minute
export function startEmailSequenceWorker() {
  logger.info("✅ [STEP-WORKER-V2] Email sequence worker V2 started")

  // Run immediately
  _processSequenceEmails()

  // Then run every minute
  const intervalId = setInterval(_processSequenceEmails, 60 * 1000) // 60 seconds

  // Return function to stop worker
  return () => {
    logger.info("Stopping email sequence worker V2")
    clearInterval(intervalId)
  }
}

export const processSequenceEmails = _processSequenceEmails
