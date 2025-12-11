import Nylas from "nylas"
import logger from "../utils/logger"

// Nylas configuration
const NYLAS_CLIENT_ID = process.env.NYLAS_CLIENT_ID || ""
const NYLAS_API_URI = process.env.NYLAS_API_URI || "https://api.us.nylas.com"
const NYLAS_API_KEY = process.env.NYLAS_API_KEY || ""
const NYLAS_REDIRECT_URI = process.env.NYLAS_REDIRECT_URI || "http://localhost:5173/app?step=2"

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

export type NylasWebhookEventType = "message.opened" | "message.link_clicked" | "thread.replied"

export interface NylasWebhookPayload {
  specversion: string
  type: NylasWebhookEventType
  source: string
  id: string
  time: number
  data: {
    application_id: string
    grant_id: string
    object: NylasOpenedData | NylasClickedData | NylasRepliedData
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
 */
export function getNylasAuthUrl(loginHint?: string): NylasAuthUrlResponse {
  if (!NYLAS_CLIENT_ID) {
    throw new Error("NYLAS_CLIENT_ID is not configured")
  }

  try {
    const authUrl = nylas.auth.urlForOAuth2({
      clientId: NYLAS_CLIENT_ID,
      provider: "google",
      redirectUri: NYLAS_REDIRECT_URI,
      loginHint: loginHint,
      accessType: "offline",
      scope: [
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
      ],
    })

    logger.info({ redirectUri: NYLAS_REDIRECT_URI }, "Generated Nylas auth URL")

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
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send email using Nylas with tracking enabled
 * Supports CC, BCC, and attachments
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { grantId, to, subject, body, cc, bcc, replyToMessageId, attachments, trackingLabel } =
    options

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
      trackingOptions: {
        opens: true,
        links: true,
        threadReplies: true,
        label: trackingLabel,
      },
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
      { grantId, messageId: message.data?.id, trackingEnabled: true },
      "Email sent via Nylas with tracking",
    )

    return {
      success: true,
      messageId: message.data?.id || "",
    }
  } catch (error) {
    logger.error({ err: error, grantId }, "Error sending email via Nylas")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email via Nylas",
    }
  }
}

/**
 * Create Google OAuth connector in Nylas (one-time setup)
 * This is needed to enable Google OAuth for your Nylas application
 */
export async function createGoogleConnector(): Promise<void> {
  const GCP_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
  const GCP_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET

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
          "https://www.googleapis.com/auth/gmail.modify",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/userinfo.email",
          "https://www.googleapis.com/auth/userinfo.profile",
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
// Webhook Handlers
// ============================================

/**
 * Handle message.opened webhook event
 */
function handleMessageOpened(data: NylasOpenedData, grantId: string, webhookId: string): void {
  const latestOpen = data.recents[0]

  logger.info(
    {
      webhookId,
      grantId,
      messageId: data.message_id,
      openCount: data.message_data.count,
      timestamp: new Date(data.message_data.timestamp * 1000).toISOString(),
      recentOpensCount: data.recents.length,
      latestOpenIp: latestOpen?.ip,
      latestOpenUserAgent: latestOpen?.user_agent,
      label: data.label,
    },
    "Nylas webhook: Email opened",
  )

  // TODO: Implement DB operations when integrating with main system
  // const email = await db.query.emails.findFirst({
  //   where: eq(emails.nylasMessageId, data.message_id)
  // })
  // if (email) {
  //   await db.update(emails)
  //     .set({
  //       openCount: data.message_data.count,
  //       openedAt: new Date(data.message_data.timestamp * 1000),
  //       status: "opened"
  //     })
  //     .where(eq(emails.id, email.id))
  //
  //   // Store individual open events
  //   await db.insert(emailEvents).values({
  //     emailId: email.id,
  //     eventType: "open",
  //     timestamp: new Date(data.message_data.timestamp * 1000),
  //     ipAddress: latestOpen?.ip,
  //     userAgent: latestOpen?.user_agent,
  //     rawEventData: data,
  //   })
  // }
}

/**
 * Handle message.link_clicked webhook event
 */
function handleLinkClicked(data: NylasClickedData, grantId: string, webhookId: string): void {
  const latestClick = data.recents[0]
  const totalClicks = data.link_data.reduce((sum, link) => sum + link.count, 0)

  logger.info(
    {
      webhookId,
      grantId,
      messageId: data.message_id,
      totalClicks,
      linksClicked: data.link_data.map((l) => ({ url: l.url, count: l.count })),
      recentClicksCount: data.recents.length,
      latestClickIp: latestClick?.ip,
      latestClickUserAgent: latestClick?.user_agent,
      latestClickUrl: data.link_data[Number(latestClick?.link_index)]?.url,
      label: data.label,
    },
    "Nylas webhook: Link clicked",
  )

  // TODO: Implement DB operations when integrating with main system
  // const email = await db.query.emails.findFirst({
  //   where: eq(emails.nylasMessageId, data.message_id)
  // })
  // if (email) {
  //   await db.update(emails)
  //     .set({
  //       clickCount: sql`click_count + 1`,
  //       clickedAt: coalesce(emails.clickedAt, new Date(latestClick.timestamp * 1000)),
  //       status: "clicked"
  //     })
  //     .where(eq(emails.id, email.id))
  //
  //   // Store click event
  //   await db.insert(emailEvents).values({
  //     emailId: email.id,
  //     eventType: "click",
  //     timestamp: new Date(latestClick.timestamp * 1000),
  //     ipAddress: latestClick?.ip,
  //     userAgent: latestClick?.user_agent,
  //     url: data.link_data[Number(latestClick?.link_index)]?.url,
  //     rawEventData: data,
  //   })
  // }
}

/**
 * Handle thread.replied webhook event
 */
function handleThreadReplied(data: NylasRepliedData, grantId: string, webhookId: string): void {
  logger.info(
    {
      webhookId,
      grantId,
      messageId: data.message_id,
      rootMessageId: data.root_message_id,
      threadId: data.thread_id,
      replyCount: data.reply_data.count,
      timestamp: new Date(data.timestamp * 1000).toISOString(),
      label: data.label,
    },
    "Nylas webhook: Thread replied",
  )

  // TODO: Implement DB operations when integrating with main system
  // const originalEmail = await db.query.emails.findFirst({
  //   where: eq(emails.nylasMessageId, data.root_message_id)
  // })
  // if (originalEmail) {
  //   await db.update(emails)
  //     .set({
  //       repliedAt: new Date(data.timestamp * 1000),
  //       status: "replied"
  //     })
  //     .where(eq(emails.id, originalEmail.id))
  //
  //   // Create email_replies record
  //   await db.insert(emailReplies).values({
  //     workspaceId: originalEmail.workspaceId,
  //     originalEmailId: originalEmail.id,
  //     // replyEmailId will be set when we fetch the actual reply message
  //   })
  //
  //   // Stop any active sequences for this lead
  //   // await sequenceService.stopEnrollmentOnReply(originalEmail.leadId, originalEmail.sequenceId)
  // }
}

/**
 * Process incoming Nylas webhook event
 * Routes to appropriate handler based on event type
 */
export function processNylasWebhook(payload: NylasWebhookPayload): { success: boolean } {
  const { type, id: webhookId, data } = payload
  const { grant_id: grantId, object } = data

  logger.info(
    {
      webhookId,
      eventType: type,
      grantId,
      applicationId: data.application_id,
    },
    "Processing Nylas webhook event",
  )

  try {
    switch (type) {
      case "message.opened":
        handleMessageOpened(object as NylasOpenedData, grantId, webhookId)
        break

      case "message.link_clicked":
        handleLinkClicked(object as NylasClickedData, grantId, webhookId)
        break

      case "thread.replied":
        handleThreadReplied(object as NylasRepliedData, grantId, webhookId)
        break

      default:
        logger.warn({ eventType: type, webhookId }, "Unknown Nylas webhook event type")
    }

    return { success: true }
  } catch (error) {
    logger.error({ err: error, webhookId, eventType: type }, "Error processing Nylas webhook event")
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
