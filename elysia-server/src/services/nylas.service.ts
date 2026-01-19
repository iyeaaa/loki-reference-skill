import { and, eq, sql } from "drizzle-orm"
import Nylas from "nylas"
import { config } from "../config"
import { db } from "../db"
import { emailEvents, emails } from "../db/schema/emails"
import {
  isAutomatedClick as isAutomatedClickUtil,
  isAutomatedOpen as isAutomatedOpenUtil,
} from "../utils/bot-detection"
import logger from "../utils/logger"

/**
 * Extract detailed error message from Nylas API errors
 * Nylas errors may contain nested error details
 */
function extractNylasError(error: unknown): string {
  if (error && typeof error === "object") {
    // Nylas SDK error format
    const nylasError = error as {
      message?: string
      statusCode?: number
      requestId?: string
      error?: { message?: string; type?: string }
    }

    // Try to get the most specific error message
    if (nylasError.error?.message) {
      const statusInfo = nylasError.statusCode ? ` (status: ${nylasError.statusCode})` : ""
      return `${nylasError.error.message}${statusInfo}`
    }

    if (nylasError.message) {
      const statusInfo = nylasError.statusCode ? ` (status: ${nylasError.statusCode})` : ""
      return `${nylasError.message}${statusInfo}`
    }

    // Try to stringify if it's an object with useful info
    try {
      const errorStr = JSON.stringify(error)
      if (errorStr !== "{}" && errorStr.length < 500) {
        return `Nylas API error: ${errorStr}`
      }
    } catch {
      // Ignore stringify errors
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return "Failed to send email via Nylas"
}

// Nylas configuration
const NYLAS_CLIENT_ID = config.nylas.clientId
const NYLAS_API_URI = config.nylas.apiUri
const NYLAS_API_KEY = config.nylas.apiKey
const NYLAS_REDIRECT_URI = config.nylas.redirectUri

// Initialize Nylas client
const nylas = new Nylas({
  apiKey: NYLAS_API_KEY,
  apiUri: NYLAS_API_URI,
})

export interface NylasAuthUrlResponse {
  url: string
}

export interface NylasGrantResponse {
  grantId: string
  email: string
  provider: string
}

// ============================================
// Webhook Types
// ============================================

export type NylasWebhookEventType =
  | "message.send_success"
  | "message.send_failed"
  | "message.bounce_detected"
  | "message.opened"
  | "message.link_clicked"
  | "thread.replied"

export interface NylasWebhookPayload {
  specversion: string
  type: NylasWebhookEventType
  source: string
  id: string
  time: number
  data: {
    application_id: string
    grant_id: string
    object:
      | NylasSendSuccessData
      | NylasSendFailedData
      | NylasBounceDetectedData
      | NylasOpenedData
      | NylasClickedData
      | NylasRepliedData
  }
}

export interface NylasSendSuccessData {
  message_id: string
  schedule_id?: string
  send_at?: number
}

export interface NylasSendFailedData {
  message_id: string
  error?: string
  schedule_id?: string
}

export interface NylasBounceDetectedData {
  bounce_reason: string
  bounce_date: number
  bounced_addresses: string
  type: string
  code: number
  origin: {
    to: string
    from: string
    subject: string
    mime_id: string
  }
}

export interface NylasOpenedData {
  message_id: string
  message_data: { count: number; timestamp: number }
  recents: Array<{
    opened_id: string
    ip: string
    timestamp: number
    user_agent: string
  }>
  label?: string
  sender_app_id?: string
  timestamp: number
}

export interface NylasClickedData {
  message_id: string
  link_data: Array<{ count: number; url: string }>
  recents: Array<{
    click_id: string
    ip: string
    link_index: string
    timestamp: number
    user_agent: string
  }>
  label?: string
  sender_app_id?: string
  timestamp: number
}

export interface NylasRepliedData {
  message_id: string
  root_message_id: string
  thread_id: string
  reply_data: { count: number }
  label?: string
  sender_app_id?: string
  timestamp: number
}

/**
 * Get Nylas OAuth authorization URL for Google
 * @param state - Optional state parameter to pass through OAuth flow (e.g., workspaceId)
 */
export function getNylasAuthUrl(state?: string): NylasAuthUrlResponse {
  if (!NYLAS_CLIENT_ID) {
    throw new Error("NYLAS_CLIENT_ID is not configured")
  }

  try {
    const authUrl = nylas.auth.urlForOAuth2({
      clientId: NYLAS_CLIENT_ID,
      provider: "google",
      redirectUri: NYLAS_REDIRECT_URI,
      state: state, // Pass workspaceId as state parameter, not loginHint
      accessType: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
    })

    logger.info({ redirectUri: NYLAS_REDIRECT_URI, state }, "Generated Nylas auth URL")

    return { url: authUrl }
  } catch (error) {
    logger.error({ err: error }, "Error generating Nylas auth URL")
    throw error
  }
}

/**
 * Exchange authorization code for Nylas grant
 */
export async function exchangeCodeForGrant(code: string): Promise<NylasGrantResponse> {
  if (!NYLAS_CLIENT_ID) {
    throw new Error("NYLAS_CLIENT_ID is not configured")
  }

  try {
    const response = await nylas.auth.exchangeCodeForToken({
      clientId: NYLAS_CLIENT_ID,
      code: code,
      redirectUri: NYLAS_REDIRECT_URI,
    })

    // logger.info(response , "Nylas grant created")

    return {
      grantId: response.grantId,
      email: response.email || "",
      provider: response.provider || "google",
    }
  } catch (error) {
    logger.error({ err: error }, "Error exchanging code for Nylas grant")
    throw error
  }
}

/**
 * Get grant information by grant ID
 */
export async function getGrantInfo(grantId: string): Promise<NylasGrantResponse | null> {
  try {
    const grant = await nylas.grants.find({ grantId })

    if (!grant.data) {
      return null
    }

    return {
      grantId: grant.data.id,
      email: grant.data.email || "",
      provider: grant.data.provider || "google",
    }
  } catch (error) {
    logger.error({ err: error, grantId }, "Error getting Nylas grant info")
    return null
  }
}

/**
 * Delete a Nylas grant (disconnect email account)
 */
export async function deleteGrant(grantId: string): Promise<boolean> {
  try {
    await nylas.grants.destroy({ grantId })
    logger.info({ grantId }, "Nylas grant deleted")
    return true
  } catch (error) {
    logger.error({ err: error, grantId }, "Error deleting Nylas grant")
    return false
  }
}

export interface SendEmailOptions {
  grantId: string
  to: { email: string; name?: string }[]
  subject: string
  body: string
  cc?: { email: string; name?: string }[]
  bcc?: { email: string; name?: string }[]
  replyToMessageId?: string
  attachments?: Array<{
    content: string // Base64 encoded
    filename: string
    contentType: string
    isInline?: boolean
    contentId?: string
    contentDisposition?: string
  }>
  trackingLabel?: string // Optional label for tracking context (e.g., "workspace:123:lead:456")
  disableTracking?: boolean // Set to true to disable tracking (required for trial accounts)
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  threadId?: string
  error?: string
}

/**
 * Send email using Nylas with tracking enabled
 * Supports CC, BCC, and attachments
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const {
    grantId,
    to,
    subject,
    body,
    cc,
    bcc,
    replyToMessageId,
    attachments,
    trackingLabel,
    disableTracking,
  } = options

  try {
    // Build request body
    const requestBody: Record<string, unknown> = {
      to: to.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
      })),
      subject,
      body,
      replyToMessageId,
    }

    // Add tracking options unless disabled (trial accounts don't support tracking)
    if (!disableTracking) {
      requestBody.trackingOptions = {
        opens: true,
        links: true,
        threadReplies: true,
        label: trackingLabel,
      }
    }

    // Add CC if provided
    if (cc && cc.length > 0) {
      requestBody.cc = cc.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
      }))
    }

    // Add BCC if provided
    if (bcc && bcc.length > 0) {
      requestBody.bcc = bcc.map((recipient) => ({
        email: recipient.email,
        name: recipient.name,
      }))
    }

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      requestBody.attachments = attachments.map((att) => ({
        content: att.content,
        filename: att.filename,
        contentType: att.contentType,
        ...(att.isInline !== undefined && { isInline: att.isInline }),
        ...(att.contentId && { contentId: att.contentId }),
        ...(att.contentDisposition && { contentDisposition: att.contentDisposition }),
      }))
    }

    const message = await nylas.messages.send({
      identifier: grantId,
      requestBody: requestBody as never,
    })

    logger.info(
      {
        grantId,
        messageId: message.data?.id,
        threadId: message.data?.threadId,
        trackingEnabled: !disableTracking,
      },
      `Email sent via Nylas${disableTracking ? "" : " with tracking"}`,
    )

    return {
      success: true,
      messageId: message.data?.id || "",
      threadId: message.data?.threadId || "",
    }
  } catch (error) {
    const detailedError = extractNylasError(error)
    logger.error({ err: error, grantId, detailedError }, "Error sending email via Nylas")
    return {
      success: false,
      error: detailedError,
    }
  }
}

/**
 * Create Google OAuth connector in Nylas (one-time setup)
 * This is needed to enable Google OAuth for your Nylas application
 */
export async function createGoogleConnector(): Promise<void> {
  const { clientId: GCP_CLIENT_ID, clientSecret: GCP_CLIENT_SECRET } = config.google.oauth

  if (!GCP_CLIENT_ID || !GCP_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required for connector setup")
  }

  try {
    await nylas.connectors.create({
      requestBody: {
        name: "Google",
        provider: "google",
        settings: {
          clientId: GCP_CLIENT_ID,
          clientSecret: GCP_CLIENT_SECRET,
        },
        scope: [
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
      },
    })

    logger.info("Google connector created successfully")
  } catch (error) {
    logger.error({ err: error }, "Error creating Google connector")
    throw error
  }
}

// ============================================
// Webhook Helper Functions
// ============================================

/**
 * Find email by message ID (stored in sendgridMessageId field)
 */
async function findEmailByMessageId(messageId: string) {
  logger.info(
    { messageId },
    "🔍 [NYLAS SERVICE] Looking up email by messageId in sendgridMessageId field",
  )

  const results = await db
    .select({
      id: emails.id,
      status: emails.status,
      sentAt: emails.sentAt,
      leadId: emails.leadId,
    })
    .from(emails)
    .where(eq(emails.sendgridMessageId, messageId))
    .limit(1)

  if (results[0]) {
    logger.info(
      {
        messageId,
        emailId: results[0].id,
        status: results[0].status,
        leadId: results[0].leadId,
      },
      "✅ [NYLAS SERVICE] Email found by messageId",
    )
  } else {
    logger.warn(
      { messageId },
      "⚠️ [NYLAS SERVICE] No email found with this messageId - webhook event cannot be matched to an email",
    )
  }

  return results[0] || null
}

/**
 * Detect automated open events (wrapper for shared utility)
 */
function isAutomatedOpen(recent?: { ip?: string; user_agent?: string }): boolean {
  if (!recent) return false
  return isAutomatedOpenUtil({
    ip: recent.ip,
    userAgent: recent.user_agent,
  })
}

/**
 * Detect security scanner clicks (wrapper for shared utility)
 */
function isSecurityScannerClick(recent?: { ip?: string; user_agent?: string }): boolean {
  if (!recent) return false
  return isAutomatedClickUtil({
    ip: recent.ip,
    userAgent: recent.user_agent,
  })
}

/**
 * Update sequence step execution status
 */
async function updateSequenceStepExecutionStatus(
  emailId: string,
  status: "delivered" | "failed",
  errorMessage?: string,
) {
  try {
    const { sequenceStepExecutions } = await import("../db/schema/sequences")

    const executionResults = await db
      .select({ id: sequenceStepExecutions.id })
      .from(sequenceStepExecutions)
      .where(eq(sequenceStepExecutions.emailId, emailId))
      .limit(1)

    if (executionResults.length > 0 && executionResults[0]) {
      const { updateStepExecutionStatus } = await import("./sequence.service")
      await updateStepExecutionStatus(executionResults[0].id, status, errorMessage)
      logger.info({ emailId, status }, "Sequence step execution status updated")
    }
  } catch (error) {
    logger.error({ error, emailId, status }, "Failed to update sequence step execution status")
  }
}

/**
 * Stop active sequence enrollments for a lead (when reply is received)
 */
async function stopActiveEnrollmentsForLead(leadId: string, webhookId: string) {
  try {
    const { sequenceEnrollments, sequenceStepExecutions } = await import("../db/schema/sequences")

    // Find all active enrollments
    const activeEnrollments = await db
      .select({ id: sequenceEnrollments.id, sequenceId: sequenceEnrollments.sequenceId })
      .from(sequenceEnrollments)
      .where(and(eq(sequenceEnrollments.leadId, leadId), eq(sequenceEnrollments.status, "active")))

    if (activeEnrollments.length === 0) return

    logger.info(
      { leadId, webhookId, count: activeEnrollments.length },
      "Stopping active enrollments due to reply",
    )

    // Stop all active enrollments
    await db
      .update(sequenceEnrollments)
      .set({
        status: "stopped",
        stoppedAt: new Date(),
      })
      .where(and(eq(sequenceEnrollments.leadId, leadId), eq(sequenceEnrollments.status, "active")))

    // Skip pending step executions
    for (const enrollment of activeEnrollments) {
      await db
        .update(sequenceStepExecutions)
        .set({
          status: "skipped",
          errorMessage: "Skipped due to reply received",
        })
        .where(
          and(
            eq(sequenceStepExecutions.enrollmentId, enrollment.id),
            eq(sequenceStepExecutions.status, "pending"),
          ),
        )
    }

    logger.info({ leadId, webhookId }, "Active enrollments stopped successfully")
  } catch (error) {
    logger.error({ error, leadId, webhookId }, "Failed to stop active enrollments")
  }
}

// ============================================
// Webhook Handlers
// ============================================

/**
 * Handle message.send_success webhook event
 */
async function handleMessageSendSuccess(
  data: NylasSendSuccessData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  const email = await findEmailByMessageId(data.message_id)
  if (!email) {
    logger.warn({ messageId: data.message_id, webhookId }, "Email not found for send_success")
    return
  }

  await db
    .update(emails)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(emails.id, email.id))

  await db.insert(emailEvents).values({
    emailId: email.id,
    eventType: "delivered",
    timestamp: new Date(),
    rawEventData: data as unknown as Record<string, unknown>,
  })

  await updateSequenceStepExecutionStatus(email.id, "delivered")

  logger.info({ emailId: email.id, webhookId }, "Nylas message.send_success processed")
}

/**
 * Handle message.send_failed webhook event
 */
async function handleMessageSendFailed(
  data: NylasSendFailedData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  const email = await findEmailByMessageId(data.message_id)
  if (!email) {
    logger.warn({ messageId: data.message_id, webhookId }, "Email not found for send_failed")
    return
  }

  const errorMessage = data.error || "Send failed"

  await db
    .update(emails)
    .set({
      status: "failed",
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(emails.id, email.id))

  await db.insert(emailEvents).values({
    emailId: email.id,
    eventType: "dropped",
    timestamp: new Date(),
    rawEventData: data as unknown as Record<string, unknown>,
  })

  await updateSequenceStepExecutionStatus(email.id, "failed", errorMessage)

  logger.info(
    { emailId: email.id, webhookId, error: errorMessage },
    "Nylas message.send_failed processed",
  )
}

/**
 * Handle message.bounce_detected webhook event
 */
async function handleMessageBounceDetected(
  data: NylasBounceDetectedData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  // Find email by origin.mime_id (the original message ID)
  const email = await findEmailByMessageId(data.origin?.mime_id || "")
  if (!email) {
    logger.warn({ mimeId: data.origin?.mime_id, webhookId }, "Email not found for bounce_detected")
    return
  }

  const isHardBounce = data.code >= 500 && data.code < 600

  await db
    .update(emails)
    .set({
      status: "bounced",
      bounceType: isHardBounce ? "hard" : "soft",
      bounceReason: data.bounce_reason,
      updatedAt: new Date(),
    })
    .where(eq(emails.id, email.id))

  await db.insert(emailEvents).values({
    emailId: email.id,
    eventType: "bounce",
    timestamp: new Date(data.bounce_date * 1000),
    bounceType: isHardBounce ? "hard" : "soft",
    bounceReason: data.bounce_reason,
    rawEventData: data as unknown as Record<string, unknown>,
  })

  await updateSequenceStepExecutionStatus(email.id, "failed", `Bounced: ${data.bounce_reason}`)

  logger.info(
    { emailId: email.id, webhookId, bounceType: isHardBounce ? "hard" : "soft" },
    "Nylas bounce processed",
  )
}

/**
 * Handle message.opened webhook event
 */
async function handleMessageOpened(
  data: NylasOpenedData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  const email = await findEmailByMessageId(data.message_id)
  if (!email) {
    logger.warn({ messageId: data.message_id, webhookId }, "Email not found for message.opened")
    return
  }

  const recentOpen = data.recents?.[0]
  const possiblyBot = isAutomatedOpen(recentOpen)

  // Always record the event
  await db.insert(emailEvents).values({
    emailId: email.id,
    eventType: "open",
    timestamp: new Date(data.message_data.timestamp * 1000),
    ipAddress: recentOpen?.ip,
    userAgent: recentOpen?.user_agent,
    rawEventData: data as unknown as Record<string, unknown>,
    possiblyBot,
  })

  // Update email status only if not bot
  if (!possiblyBot) {
    await db
      .update(emails)
      .set({
        status: "opened",
        openedAt: new Date(data.message_data.timestamp * 1000),
        openCount: sql`${emails.openCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, email.id))

    logger.info(
      { emailId: email.id, webhookId, openCount: data.message_data.count },
      "Nylas open processed",
    )
  } else {
    logger.info({ emailId: email.id, webhookId }, "Nylas open skipped (bot detected)")
  }
}

/**
 * Handle message.link_clicked webhook event
 */
async function handleLinkClicked(
  data: NylasClickedData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  const email = await findEmailByMessageId(data.message_id)
  if (!email) {
    logger.warn({ messageId: data.message_id, webhookId }, "Email not found for link_clicked")
    return
  }

  const recentClick = data.recents?.[0]
  const possiblyBot = isSecurityScannerClick(recentClick)

  // Record event for each link clicked
  for (const link of data.link_data || []) {
    await db.insert(emailEvents).values({
      emailId: email.id,
      eventType: "click",
      timestamp: new Date(data.timestamp * 1000),
      url: link.url,
      ipAddress: recentClick?.ip,
      userAgent: recentClick?.user_agent,
      rawEventData: data as unknown as Record<string, unknown>,
      possiblyBot,
    })
  }

  // Update email status only if not bot
  if (!possiblyBot) {
    await db
      .update(emails)
      .set({
        status: "clicked",
        clickedAt: new Date(data.timestamp * 1000),
        clickCount: sql`${emails.clickCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(emails.id, email.id))

    logger.info(
      { emailId: email.id, webhookId, urls: data.link_data?.map((l) => l.url) },
      "Nylas click processed",
    )
  } else {
    logger.info({ emailId: email.id, webhookId }, "Nylas click skipped (bot detected)")
  }
}

/**
 * Handle thread.replied webhook event
 */
async function handleThreadReplied(
  data: NylasRepliedData,
  _grantId: string,
  webhookId: string,
): Promise<void> {
  logger.info(
    {
      webhookId,
      rootMessageId: data.root_message_id,
      messageId: data.message_id,
      threadId: data.thread_id,
      replyCount: data.reply_data?.count,
      timestamp: data.timestamp,
      label: data.label,
      fullData: JSON.stringify(data, null, 2),
    },
    "💬 [NYLAS SERVICE] thread.replied - Processing inbound reply event",
  )

  const email = await findEmailByMessageId(data.root_message_id)
  if (!email) {
    logger.warn(
      {
        rootMessageId: data.root_message_id,
        messageId: data.message_id,
        threadId: data.thread_id,
        webhookId,
      },
      "⚠️ [NYLAS SERVICE] thread.replied - Original email not found for reply. The root_message_id doesn't match any email in our database.",
    )
    return
  }

  logger.info(
    {
      emailId: email.id,
      leadId: email.leadId,
      threadId: data.thread_id,
      webhookId,
    },
    "💬 [NYLAS SERVICE] thread.replied - Found original email, updating repliedAt",
  )

  // Update email repliedAt
  await db
    .update(emails)
    .set({
      repliedAt: new Date(data.timestamp * 1000),
      updatedAt: new Date(),
    })
    .where(eq(emails.id, email.id))

  logger.info(
    {
      emailId: email.id,
      webhookId,
      threadId: data.thread_id,
      repliedAt: new Date(data.timestamp * 1000).toISOString(),
    },
    "✅ [NYLAS SERVICE] thread.replied - Email repliedAt updated successfully",
  )

  // CRITICAL: Stop active sequence enrollments for this lead
  if (email.leadId) {
    logger.info(
      { leadId: email.leadId, emailId: email.id, webhookId },
      "🛑 [NYLAS SERVICE] thread.replied - Stopping active sequence enrollments for lead",
    )
    await stopActiveEnrollmentsForLead(email.leadId, webhookId)
  } else {
    logger.warn(
      { emailId: email.id, webhookId },
      "⚠️ [NYLAS SERVICE] thread.replied - No leadId associated with this email, skipping enrollment stop",
    )
  }
}

/**
 * Process incoming Nylas webhook event
 * Routes to appropriate handler based on event type
 */
export async function processNylasWebhook(
  payload: NylasWebhookPayload,
): Promise<{ success: boolean }> {
  const { type, id: webhookId, data } = payload
  const { grant_id: grantId, object } = data

  logger.info(
    {
      webhookId,
      eventType: type,
      grantId,
      applicationId: data.application_id,
      objectKeys: object ? Object.keys(object) : [],
      fullObject: JSON.stringify(object, null, 2),
    },
    "🔄 [NYLAS SERVICE] Starting to process Nylas webhook event",
  )

  try {
    switch (type) {
      case "message.send_success":
        logger.info(
          { webhookId, eventType: type, object },
          "📤 [NYLAS SERVICE] Handling message.send_success",
        )
        await handleMessageSendSuccess(object as NylasSendSuccessData, grantId, webhookId)
        break

      case "message.send_failed":
        logger.info(
          { webhookId, eventType: type, object },
          "❌ [NYLAS SERVICE] Handling message.send_failed",
        )
        await handleMessageSendFailed(object as NylasSendFailedData, grantId, webhookId)
        break

      case "message.bounce_detected":
        logger.info(
          { webhookId, eventType: type, object },
          "⚠️ [NYLAS SERVICE] Handling message.bounce_detected",
        )
        await handleMessageBounceDetected(object as NylasBounceDetectedData, grantId, webhookId)
        break

      case "message.opened":
        logger.info(
          { webhookId, eventType: type, object },
          "👁️ [NYLAS SERVICE] Handling message.opened",
        )
        await handleMessageOpened(object as NylasOpenedData, grantId, webhookId)
        break

      case "message.link_clicked":
        logger.info(
          { webhookId, eventType: type, object },
          "🔗 [NYLAS SERVICE] Handling message.link_clicked",
        )
        await handleLinkClicked(object as NylasClickedData, grantId, webhookId)
        break

      case "thread.replied":
        logger.info(
          { webhookId, eventType: type, object },
          "💬 [NYLAS SERVICE] Handling thread.replied - INBOUND REPLY DETECTED",
        )
        await handleThreadReplied(object as NylasRepliedData, grantId, webhookId)
        break

      default:
        logger.warn(
          {
            eventType: type,
            webhookId,
            fullPayload: JSON.stringify(payload, null, 2),
          },
          "⚠️ [NYLAS SERVICE] Unknown Nylas webhook event type - this might be an inbound event we're not handling",
        )
    }

    logger.info(
      { webhookId, eventType: type },
      "✅ [NYLAS SERVICE] Webhook event processed successfully",
    )
    return { success: true }
  } catch (error) {
    logger.error(
      {
        err: error,
        webhookId,
        eventType: type,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
      },
      "❌ [NYLAS SERVICE] Error processing Nylas webhook event",
    )
    return { success: false }
  }
}

export default {
  getNylasAuthUrl,
  exchangeCodeForGrant,
  getGrantInfo,
  deleteGrant,
  sendEmail,
  createGoogleConnector,
  processNylasWebhook,
}
