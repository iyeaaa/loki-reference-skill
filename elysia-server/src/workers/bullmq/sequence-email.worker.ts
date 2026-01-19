/**
 * BullMQ Sequence Email Worker
 *
 * Event-driven email sending worker that replaces the 60-second interval polling.
 * Processes sequence step executions with:
 * - Hunter API email verification (rate limited to 10 req/sec)
 * - Automatic retry with exponential backoff
 * - Stall detection and recovery
 * - Full lifecycle logging to PostgreSQL
 *
 * @see https://help.hunter.io/en/articles/1970956-hunter-api (Rate limits)
 */

import { type Job, Worker } from "bullmq"
import { and, eq } from "drizzle-orm"
import { config } from "../../config"
import { db } from "../../db"
import { userEmailAccounts } from "../../db/schema/email-accounts"
import { emails } from "../../db/schema/emails"
import { leadContacts, leadIndustryTypes } from "../../db/schema/lead-details"
import { leads } from "../../db/schema/leads"
import { sequenceEnrollments, sequenceStepExecutions, sequences } from "../../db/schema/sequences"
import { recordJobCompleted, recordJobFailed } from "../../lib/health"
import { QUEUE_NAMES, type SequenceEmailJob, type SequenceEmailResult } from "../../lib/queue/types"
import { createRedisConnection } from "../../lib/redis/connection"
import { emailService } from "../../services/email.service"
import { searchDomainAllEmails } from "../../services/hunterio-domain-search.service"
import { verifyEmail } from "../../services/hunterio-email-verifier.service"
import * as jobLogService from "../../services/job-log.service"
import * as leadService from "../../services/lead.service"
import { extractWebsiteContent, summarizeCompanyInfo } from "../../services/lead-enrichment.service"
import * as sequenceService from "../../services/sequence.service"
import { checkAndNotifyStepCompletion } from "../../services/sequence-notification.service"
import * as workflowEmailService from "../../services/workflow-email.service"
import logger from "../../utils/logger"

// ============================================================================
// Configuration
// ============================================================================

/**
 * Worker concurrency
 * Based on Hunter.io Email Verifier API rate limit: 10 requests/second
 */
const WORKER_CONCURRENCY = 10

/**
 * Permanent errors that should NOT be retried
 * These errors indicate the email cannot be delivered regardless of retry attempts
 */
const PERMANENT_ERROR_PATTERNS = [
  "Bounced Address",
  "Unsubscribed Address",
  "Domain is not allowed",
  "Invalid",
  "Bad Request",
  "No Grant found",
  "Spam Pattern",
  "unable to get mx info",
  "Trial preview mode",
  "Enrollment not active",
  "Execution not found",
  "Lead contact not found",
  "Email account not found",
  "API Key가 설정되지 않았습니다",
] as const

/**
 * Check if an error is permanent (should not retry)
 */
function isPermanentError(errorMessage: string): boolean {
  return PERMANENT_ERROR_PATTERNS.some((pattern) =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase()),
  )
}

// ============================================================================
// Worker State
// ============================================================================

let sequenceEmailWorker: Worker<SequenceEmailJob, SequenceEmailResult> | null = null

/** Job별 시작 시간 추적 (duration 계산용) */
const jobStartTimes = new Map<string, number>()

/** Memory Leak 방지: 오래된 jobStartTimes 엔트리 정리 (1시간 이상) */
const JOB_START_TIME_TTL_MS = 60 * 60 * 1000

function cleanupStaleJobStartTimes(): void {
  const now = Date.now()
  for (const [jobId, startTime] of jobStartTimes.entries()) {
    if (now - startTime > JOB_START_TIME_TTL_MS) {
      jobStartTimes.delete(jobId)
      logger.debug({ jobId }, "[SequenceEmailWorker] Cleaned up stale job start time entry")
    }
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract domain from URL
 */
function extractDomain(url: string | null): string | null {
  if (!url) return null
  try {
    const urlWithProtocol = url.startsWith("http") ? url : `https://${url}`
    const parsed = new URL(urlWithProtocol)
    return parsed.hostname.replace(/^www\./, "")
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .split("/")[0] || null
    )
  }
}

// ============================================================================
// Job Processor
// ============================================================================

/**
 * Process sequence email job
 *
 * Steps:
 * 1. Get lead contact and lead info
 * 2. Verify email with Hunter API
 * 3. Handle undeliverable emails (find replacement)
 * 4. Check for existing draft or generate from template
 * 5. Send email via SendGrid/Nylas/Unipile
 * 6. Update execution status and enrollment progress
 */
async function processSequenceEmailJob(
  job: Job<SequenceEmailJob, SequenceEmailResult>,
): Promise<SequenceEmailResult> {
  const startTime = Date.now()
  const jobId = job.id || "unknown"
  const { executionId, enrollmentId, stepId, stepOrder, leadId, sequenceId, workspaceId } = job.data

  jobStartTimes.set(jobId, startTime)

  logger.info(
    {
      jobId,
      executionId,
      stepOrder,
      leadId,
      leadCompanyName: job.data.leadCompanyName,
      attempt: job.attemptsMade + 1,
    },
    "[SequenceEmailWorker] Processing email job",
  )

  // DB에 Job 시작 기록
  try {
    await jobLogService.logJobStarted(job, "sequence-email-worker")
  } catch (logError) {
    logger.warn({ jobId, error: logError }, "[SequenceEmailWorker] Failed to log job start")
  }

  try {
    // ========================================
    // Step 0: Verify sequence, enrollment, and lead status (Critical safety checks)
    // ========================================

    // Check sequence status (must be 'active')
    const [sequence] = await db
      .select({ status: sequences.status })
      .from(sequences)
      .where(eq(sequences.id, sequenceId))
      .limit(1)

    if (!sequence || sequence.status !== "active") {
      logger.info(
        { jobId, sequenceId, status: sequence?.status },
        "[SequenceEmailWorker] Sequence not active, skipping job",
      )
      await sequenceService.updateStepExecutionStatus(
        executionId,
        "skipped",
        `Sequence status: ${sequence?.status || "not found"}`,
      )
      return {
        success: false,
        error: `Sequence not active (status: ${sequence?.status || "not found"})`,
        durationMs: Date.now() - startTime,
      }
    }

    // Check enrollment status (must be 'active')
    const [enrollment] = await db
      .select({
        status: sequenceEnrollments.status,
        firstThreadId: sequenceEnrollments.firstThreadId,
      })
      .from(sequenceEnrollments)
      .where(eq(sequenceEnrollments.id, enrollmentId))
      .limit(1)

    if (!enrollment || enrollment.status !== "active") {
      logger.info(
        { jobId, enrollmentId, status: enrollment?.status },
        "[SequenceEmailWorker] Enrollment not active, skipping job",
      )
      await sequenceService.updateStepExecutionStatus(
        executionId,
        "skipped",
        `Enrollment status: ${enrollment?.status || "not found"}`,
      )
      return {
        success: false,
        error: `Enrollment not active (status: ${enrollment?.status || "not found"})`,
        durationMs: Date.now() - startTime,
      }
    }

    // Check step execution status (prevent duplicate processing)
    const [execution] = await db
      .select({ status: sequenceStepExecutions.status })
      .from(sequenceStepExecutions)
      .where(eq(sequenceStepExecutions.id, executionId))
      .limit(1)

    if (!execution) {
      logger.warn({ jobId, executionId }, "[SequenceEmailWorker] Execution not found")
      return {
        success: false,
        error: "Execution not found",
        durationMs: Date.now() - startTime,
      }
    }

    if (execution.status !== "pending" && execution.status !== "processing") {
      logger.info(
        { jobId, executionId, status: execution.status },
        "[SequenceEmailWorker] Execution already processed, skipping",
      )
      return {
        success: false,
        error: `Execution already processed (status: ${execution.status})`,
        durationMs: Date.now() - startTime,
      }
    }

    // Mark execution as processing (claim it)
    await db
      .update(sequenceStepExecutions)
      .set({ status: "processing" })
      .where(
        and(
          eq(sequenceStepExecutions.id, executionId),
          eq(sequenceStepExecutions.status, "pending"),
        ),
      )

    // ========================================
    // Step 1: Get lead contact and lead info
    // ========================================
    const [leadContact] =
      (await db
        .select({
          id: leadContacts.id,
          email: leadContacts.contactValue,
          contactName: leadContacts.contactName,
        })
        .from(leadContacts)
        .where(
          and(
            eq(leadContacts.leadId, leadId),
            eq(leadContacts.contactType, "email"),
            eq(leadContacts.isPrimary, true),
          ),
        )
        .limit(1)) ||
      (await db
        .select({
          id: leadContacts.id,
          email: leadContacts.contactValue,
          contactName: leadContacts.contactName,
        })
        .from(leadContacts)
        .where(and(eq(leadContacts.leadId, leadId), eq(leadContacts.contactType, "email")))
        .limit(1))

    if (!leadContact) {
      throw new Error(`Lead email not found for leadId: ${leadId}`)
    }

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
      .where(eq(leads.id, leadId))
      .limit(1)

    if (!lead) {
      throw new Error(`Lead not found for leadId: ${leadId}`)
    }

    // Check lead status (must not be unsubscribed)
    if (lead.leadStatus === "unsubscribed") {
      logger.info(
        { jobId, leadId, leadStatus: lead.leadStatus },
        "[SequenceEmailWorker] Lead is unsubscribed, skipping job",
      )
      await sequenceService.updateStepExecutionStatus(
        executionId,
        "skipped",
        `Lead status: ${lead.leadStatus}`,
      )
      return {
        success: false,
        error: `Lead status: ${lead.leadStatus}`,
        durationMs: Date.now() - startTime,
      }
    }

    // ========================================
    // Step 2: Verify email with Hunter API
    // ========================================
    const verificationResult = await verifyEmail(leadContact.email)
    let toEmail = leadContact.email

    if (verificationResult?.result === "undeliverable") {
      logger.warn(
        { jobId, leadId, email: leadContact.email },
        "[SequenceEmailWorker] Email is undeliverable, trying to find replacement...",
      )

      let newEmail: string | null = null
      const domain = extractDomain(lead.websiteUrl)
      let geminiEnrichmentData: {
        description: string
        industry?: string
        products?: string
        attachedEmailValue?: string
        attachedEmailType?: string
      } | null = null

      // Try Gemini enrichment first
      if (lead.websiteUrl) {
        try {
          const websiteContent = await extractWebsiteContent(lead.websiteUrl)
          if (websiteContent.content) {
            geminiEnrichmentData = await summarizeCompanyInfo(
              websiteContent.content,
              lead.companyName || domain || "",
              config.gemini.apiKey,
            )
            if (
              geminiEnrichmentData.attachedEmailValue &&
              geminiEnrichmentData.attachedEmailValue !== "example@example.com"
            ) {
              const geminiVerification = await verifyEmail(geminiEnrichmentData.attachedEmailValue)
              if (geminiVerification?.result !== "undeliverable") {
                newEmail = geminiEnrichmentData.attachedEmailValue
                logger.info(
                  { jobId, email: newEmail },
                  "[SequenceEmailWorker] Found valid email via Gemini",
                )
              }
            }
          }
        } catch (error) {
          logger.debug({ jobId, error }, "[SequenceEmailWorker] Gemini enrichment failed")
        }
      }

      // Fallback to Hunter.io domain search
      if (!newEmail && domain) {
        try {
          const hunterResult = await searchDomainAllEmails(domain, 5)
          for (const hunterEmail of hunterResult.emails) {
            const hunterVerification = await verifyEmail(hunterEmail.value)
            if (hunterVerification?.result !== "undeliverable") {
              newEmail = hunterEmail.value
              logger.info(
                { jobId, email: newEmail },
                "[SequenceEmailWorker] Found valid email via Hunter.io",
              )
              break
            }
          }
        } catch (error) {
          logger.debug({ jobId, error }, "[SequenceEmailWorker] Hunter.io domain search failed")
        }
      }

      if (newEmail) {
        // Update lead contact with new email
        await db
          .update(leadContacts)
          .set({ contactValue: newEmail, isVerified: true })
          .where(eq(leadContacts.id, leadContact.id))

        // Update lead table with enrichment data from Gemini
        if (geminiEnrichmentData) {
          const leadUpdates: Record<string, unknown> = {}
          if (geminiEnrichmentData.description && !lead.description) {
            leadUpdates.description = geminiEnrichmentData.description
          }
          if (geminiEnrichmentData.industry && !lead.businessType) {
            leadUpdates.businessType = geminiEnrichmentData.industry
          }
          if (Object.keys(leadUpdates).length > 0) {
            await db.update(leads).set(leadUpdates).where(eq(leads.id, leadId))
          }
        }

        toEmail = newEmail
      } else {
        // No valid email found - mark as failed and clean up
        await sequenceService.updateStepExecutionStatus(
          executionId,
          "failed",
          "No valid email found after verification",
        )

        // Complete enrollment if this was the last step
        await sequenceService.checkAndCompleteEnrollmentIfLastStep(enrollmentId, stepOrder)

        return {
          success: false,
          error: "No valid email found after verification",
          durationMs: Date.now() - startTime,
        }
      }
    }

    // ========================================
    // Step 3: Get email content (draft or template)
    // ========================================
    let emailSubject = job.data.emailSubject
    let emailBodyHtml = job.data.emailBodyHtml
    let emailBodyText = job.data.emailBodyText

    // Check for existing draft
    const [existingDraft] = await db
      .select({
        id: emails.id,
        subject: emails.subject,
        bodyText: emails.bodyText,
        bodyHtml: emails.bodyHtml,
      })
      .from(emails)
      .where(and(eq(emails.leadId, leadId), eq(emails.stepId, stepId), eq(emails.status, "draft")))
      .limit(1)

    if (existingDraft) {
      emailSubject = existingDraft.subject || emailSubject
      emailBodyHtml = existingDraft.bodyHtml
      emailBodyText = existingDraft.bodyText
      logger.debug(
        { jobId, draftId: existingDraft.id },
        "[SequenceEmailWorker] Using existing draft",
      )
    }

    // Get additional data for template variables
    const [industryData] = await db
      .select({ industryName: leadIndustryTypes.industryName })
      .from(leadIndustryTypes)
      .where(eq(leadIndustryTypes.leadId, leadId))
      .limit(1)

    // Get email account info
    const [emailAccount] = await db
      .select({
        id: userEmailAccounts.id,
        emailAddress: userEmailAccounts.emailAddress,
        displayName: userEmailAccounts.displayName,
        apiKey: userEmailAccounts.apiKey,
        provider: userEmailAccounts.provider,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.id, job.data.emailAccountId))
      .limit(1)

    if (!emailAccount) {
      throw new Error(`Email account not found: ${job.data.emailAccountId}`)
    }

    if (!emailAccount.apiKey) {
      throw new Error("Email account API key/token not configured")
    }

    // Note: enrollment was already fetched in Step 0 with firstThreadId

    // Replace template variables
    const templateData = {
      firstName: leadContact.contactName?.split(" ")[0] || "",
      lastName: leadContact.contactName?.split(" ").slice(1).join(" ") || "",
      fullName: leadContact.contactName || "",
      companyName: lead.companyName || "",
      industry: industryData?.industryName || lead.businessType || "",
      senderName: emailAccount.displayName || "",
      senderEmail: emailAccount.emailAddress || "",
    }

    emailSubject = workflowEmailService.replaceTemplateVariables(emailSubject, templateData)
    if (emailBodyHtml) {
      emailBodyHtml = workflowEmailService.replaceTemplateVariables(emailBodyHtml, templateData)
    }
    if (emailBodyText) {
      emailBodyText = workflowEmailService.replaceTemplateVariables(emailBodyText, templateData)
    }

    // ========================================
    // Step 4: Send email
    // ========================================

    // Determine if this is the first email in the sequence (for threading)
    const isFirstEmail = stepOrder === 1
    let inReplyTo: string | undefined
    let references: string[] | undefined

    if (!isFirstEmail && enrollment?.firstThreadId) {
      inReplyTo = enrollment.firstThreadId
      references = [enrollment.firstThreadId]
    }

    // Prepare attachments for email
    let emailAttachments:
      | Array<{
          content: string
          filename: string
          type: string
          disposition: "attachment"
        }>
      | undefined

    if (job.data.attachments && job.data.attachments.length > 0) {
      emailAttachments = job.data.attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        type: att.type,
        disposition: "attachment" as const,
      }))
    }

    // Send email using EmailService (provider determines routing: sendgrid/nylas/unipile)
    const sendResult = await emailService.sendEmail({
      fromEmail: emailAccount.emailAddress,
      fromName: emailAccount.displayName || emailAccount.emailAddress,
      toEmail: toEmail,
      subject: emailSubject,
      bodyText: emailBodyText || undefined,
      bodyHtml: emailBodyHtml || undefined,
      inReplyTo,
      references,
      attachments: emailAttachments,
      includeSignature: false,
      userId: job.data.userId || undefined,
      workspaceId,
      apiKey: emailAccount.apiKey,
      provider: emailAccount.provider,
    })

    if (!sendResult.success) {
      throw new Error(sendResult.error || "Failed to send email")
    }

    const sendgridMessageId = sendResult.sendgridMessageId || sendResult.nylasMessageId
    const messageId = sendResult.messageId || sendResult.nylasMessageId
    const nylasThreadId = sendResult.nylasThreadId

    // Determine the thread ID
    const threadId = nylasThreadId || (isFirstEmail ? messageId : enrollment?.firstThreadId)

    // If first email, save thread ID for follow-up emails
    if (isFirstEmail && threadId) {
      await db
        .update(sequenceEnrollments)
        .set({ firstThreadId: threadId })
        .where(eq(sequenceEnrollments.id, enrollmentId))
    }

    // Create or update email record
    let emailRecordId: string | undefined

    if (existingDraft) {
      // Update existing draft to sent status
      const [updatedEmail] = await db
        .update(emails)
        .set({
          status: "sent",
          sendgridMessageId,
          messageId,
          threadId,
          inReplyTo: inReplyTo || null,
          sentAt: new Date(),
          updatedAt: new Date(),
          leadName: lead.companyName || null,
          leadEmail: toEmail,
          sequenceName: job.data.sequenceName,
          subject: emailSubject,
          bodyText: emailBodyText,
          bodyHtml: emailBodyHtml,
        })
        .where(eq(emails.id, existingDraft.id))
        .returning({ id: emails.id })
      emailRecordId = updatedEmail?.id
    } else {
      // Create new email record
      const [newEmail] = await db
        .insert(emails)
        .values({
          workspaceId,
          userEmailAccountId: job.data.emailAccountId,
          leadId,
          sequenceId,
          stepId,
          direction: "outbound",
          fromEmail: emailAccount.emailAddress,
          toEmail: toEmail,
          subject: emailSubject,
          bodyText: emailBodyText,
          bodyHtml: emailBodyHtml,
          status: "sent",
          sendgridMessageId,
          messageId,
          threadId,
          inReplyTo: inReplyTo || null,
          sentAt: new Date(),
          leadName: lead.companyName || null,
          leadEmail: toEmail,
          sequenceName: job.data.sequenceName,
        })
        .returning({ id: emails.id })
      emailRecordId = newEmail?.id
    }

    // ========================================
    // Step 5: Update execution status
    // ========================================
    await sequenceService.updateStepExecutionStatus(executionId, "sent", undefined, emailRecordId)

    // Update enrollment progress
    await sequenceService.updateEnrollmentProgress(enrollmentId, stepOrder)

    // Update lead status
    try {
      await leadService.updateLead(leadId, {
        leadStatus: "contacted",
        lastContactedAt: new Date(),
      })
    } catch (error) {
      logger.debug({ jobId, leadId, error }, "[SequenceEmailWorker] Failed to update lead status")
    }

    const durationMs = Date.now() - startTime

    logger.info(
      {
        jobId,
        executionId,
        stepOrder,
        leadCompanyName: job.data.leadCompanyName,
        messageId: sendgridMessageId,
        durationMs,
      },
      "[SequenceEmailWorker] Email sent successfully",
    )

    return {
      success: true,
      messageId: sendgridMessageId,
      emailRecordId,
      durationMs,
    }
  } catch (error) {
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    const isPermanent = isPermanentError(errorMessage)
    const maxAttempts = (job.opts.attempts as number) || 3
    const isLastAttempt = job.attemptsMade + 1 >= maxAttempts

    logger.error(
      {
        jobId,
        executionId,
        stepOrder,
        leadId,
        error: errorMessage,
        durationMs,
        isPermanentError: isPermanent,
        attempt: job.attemptsMade + 1,
        maxAttempts,
        isLastAttempt,
      },
      "[SequenceEmailWorker] Failed to send email",
    )

    // Permanent errors: Mark as failed immediately, no retry needed
    if (isPermanent) {
      logger.info(
        { jobId, executionId, errorMessage },
        "[SequenceEmailWorker] Permanent error - marking as failed without retry",
      )
      await sequenceService.updateStepExecutionStatus(executionId, "failed", errorMessage)
      await sequenceService.checkAndCompleteEnrollmentIfLastStep(enrollmentId, stepOrder)

      // Return failure instead of throwing - prevents retry for permanent errors
      return {
        success: false,
        error: errorMessage,
        durationMs,
      }
    }

    // Transient errors: Only mark as failed on last attempt
    if (isLastAttempt) {
      logger.info(
        { jobId, executionId, attempt: job.attemptsMade + 1 },
        "[SequenceEmailWorker] Last attempt failed - marking as failed",
      )
      await sequenceService.updateStepExecutionStatus(executionId, "failed", errorMessage)
      await sequenceService.checkAndCompleteEnrollmentIfLastStep(enrollmentId, stepOrder)
    } else {
      // Keep status as 'processing' for retry (don't update to failed)
      logger.info(
        { jobId, executionId, attempt: job.attemptsMade + 1, maxAttempts },
        "[SequenceEmailWorker] Transient error - will retry (keeping processing status)",
      )
      // Don't update status - it stays as 'processing' which allows retry
    }

    throw error // Re-throw to trigger BullMQ retry
  }
}

// ============================================================================
// Worker Management
// ============================================================================

let cleanupInterval: ReturnType<typeof setInterval> | null = null

/**
 * Log with retry helper
 */
async function logWithRetry<T>(
  operation: () => Promise<T>,
  context: { jobId?: string; operation: string },
  maxAttempts: number = 3,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (attempt === maxAttempts) {
        logger.error(
          { ...context, error, attempt },
          `[SequenceEmailWorker] ${context.operation} failed after all retries`,
        )
        return null
      }
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt))
    }
  }
  return null
}

/**
 * Start Sequence Email Worker
 */
export function startSequenceEmailWorker(): Worker<SequenceEmailJob, SequenceEmailResult> {
  if (sequenceEmailWorker) {
    logger.warn("[SequenceEmailWorker] Worker already running")
    return sequenceEmailWorker
  }

  sequenceEmailWorker = new Worker<SequenceEmailJob, SequenceEmailResult>(
    QUEUE_NAMES.SEQUENCE_EMAIL,
    processSequenceEmailJob,
    {
      connection: createRedisConnection(),
      concurrency: WORKER_CONCURRENCY, // 10 concurrent jobs (matches Hunter API rate limit)
      lockDuration: 120000, // 2 minutes lock (email sending can take time)
      stalledInterval: 30000, // Check for stalled jobs every 30s
      maxStalledCount: 2, // Allow job to be stalled twice before failing
      removeOnComplete: {
        age: 24 * 3600, // Keep completed jobs for 24 hours
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failed jobs for 7 days
      },
    },
  )

  // Memory cleanup interval (5 minutes)
  cleanupInterval = setInterval(cleanupStaleJobStartTimes, 5 * 60 * 1000)

  // ========================================
  // Event Handlers
  // ========================================

  sequenceEmailWorker.on("completed", async (job, result) => {
    const jobId = job.id || "unknown"
    const startTime = jobStartTimes.get(jobId) || Date.now()

    recordJobCompleted()

    await logWithRetry(() => jobLogService.logJobCompleted(job, result, startTime), {
      jobId,
      operation: "logJobCompleted",
    })

    jobStartTimes.delete(jobId)

    logger.debug(
      {
        jobId,
        executionId: job.data.executionId,
        stepOrder: job.data.stepOrder,
        success: result.success,
      },
      "[SequenceEmailWorker] Job completed",
    )

    // 스텝 완료 체크 및 알림 생성 (비동기, 메인 플로우에 영향 없음)
    if (result.success) {
      checkAndNotifyStepCompletion({
        sequenceId: job.data.sequenceId,
        stepOrder: job.data.stepOrder,
        workspaceId: job.data.workspaceId,
        userId: job.data.userId ?? undefined,
      }).catch((err) => {
        logger.warn(
          { jobId, error: err },
          "[SequenceEmailWorker] Step completion notification check failed",
        )
      })
    }
  })

  sequenceEmailWorker.on("failed", async (job, err) => {
    const jobId = job?.id
    const startTime = jobId ? jobStartTimes.get(jobId) : undefined

    recordJobFailed()

    await logWithRetry(() => jobLogService.logJobFailed(job, err, startTime), {
      jobId,
      operation: "logJobFailed",
    })

    if (jobId) jobStartTimes.delete(jobId)

    logger.error(
      {
        jobId,
        executionId: job?.data.executionId,
        error: err.message,
        attempts: job?.attemptsMade,
      },
      "[SequenceEmailWorker] Job failed",
    )
  })

  sequenceEmailWorker.on("stalled", async (jobId) => {
    await logWithRetry(() => jobLogService.logJobStalled(jobId, QUEUE_NAMES.SEQUENCE_EMAIL), {
      jobId,
      operation: "logJobStalled",
    })

    logger.warn({ jobId }, "[SequenceEmailWorker] Job stalled")
  })

  sequenceEmailWorker.on("progress", (job, progress) => {
    logger.debug({ jobId: job.id, progress }, "[SequenceEmailWorker] Job progress updated")
  })

  sequenceEmailWorker.on("error", (err) => {
    logger.error({ error: err.message, stack: err.stack }, "[SequenceEmailWorker] Worker error")
  })

  sequenceEmailWorker.on("ready", () => {
    logger.info("[SequenceEmailWorker] Worker is ready to process jobs")
  })

  sequenceEmailWorker.on("closed", () => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval)
      cleanupInterval = null
    }
    logger.info("[SequenceEmailWorker] Worker has been closed")
  })

  logger.info(
    {
      concurrency: WORKER_CONCURRENCY,
      queueName: QUEUE_NAMES.SEQUENCE_EMAIL,
    },
    "[SequenceEmailWorker] Started successfully with DB logging enabled",
  )

  return sequenceEmailWorker
}

/**
 * Stop Sequence Email Worker
 */
export async function stopSequenceEmailWorker(): Promise<void> {
  if (sequenceEmailWorker) {
    await sequenceEmailWorker.close()
    sequenceEmailWorker = null
    jobStartTimes.clear()
    logger.info("[SequenceEmailWorker] Stopped")
  }
}

/**
 * Get Sequence Email Worker Status
 */
export function getSequenceEmailWorkerStatus(): {
  running: boolean
  concurrency: number
  activeJobs: number
} {
  return {
    running: sequenceEmailWorker !== null && !sequenceEmailWorker.closing,
    concurrency: sequenceEmailWorker?.opts.concurrency || 0,
    activeJobs: jobStartTimes.size,
  }
}

export { sequenceEmailWorker }
