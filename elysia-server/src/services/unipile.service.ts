import { and, eq } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db"
import { emailEvents, emailReplies, emails } from "../db/schema/emails"
import logger from "../utils/logger"

// Unipile configuration
const UNIPILE_API_KEY = config.unipile.apiKey
const UNIPILE_API_URL = config.unipile.apiUrl
const UNIPILE_REDIRECT_URI = config.unipile.redirectUri

export interface UnipileAuthUrlResponse {
  url: string
  hostedAuthUrl: string
}

export interface UnipileAccountResponse {
  accountId: string
  email: string
  provider: string
}

export interface SendEmailOptions {
  accountId: string
  to: string
  subject: string
  body: string
  cc?: string[]
  bcc?: string[]
  replyTo?: string // Provider ID of email being replied to (for threading)
  attachments?: Array<{
    content: string // Base64
    filename: string
    contentType: string
  }>
}

export interface SendEmailResult {
  success: boolean
  messageId?: string
  providerId?: string
  trackingId?: string
  error?: string
}

/**
 * Get Unipile hosted authentication URL
 * Initialize hosted auth session and get redirect URL
 * @param provider - Email provider (GOOGLE, OUTLOOK, etc.)
 * @param state - Optional state parameter (workspaceId) to pass through OAuth flow
 */
export async function getUnipileAuthUrl(
  provider: string = "GOOGLE",
  state?: string,
): Promise<UnipileAuthUrlResponse> {
  if (!UNIPILE_API_KEY) {
    throw new Error("UNIPILE_API_KEY is not configured")
  }

  try {
    // Calculate expiration time (1 hour from now)
    const expiresOn = new Date()
    expiresOn.setHours(expiresOn.getHours() + 1)
    const expiresOnISO = expiresOn.toISOString()

    // Build redirect URLs with state parameter if provided
    // ⚠️ 중요: state는 workspaceId를 전달하는 데 사용됨
    const stateParam = state ? `state=${encodeURIComponent(state)}` : ""
    const successUrl = stateParam ? `${UNIPILE_REDIRECT_URI}?${stateParam}` : UNIPILE_REDIRECT_URI
    const failureUrl = stateParam
      ? `${UNIPILE_REDIRECT_URI}?error=true&${stateParam}`
      : `${UNIPILE_REDIRECT_URI}?error=true`

    // POST to initialize hosted auth session
    const requestBody = {
      type: "create",
      providers: [provider],
      api_url: UNIPILE_API_URL,
      expiresOn: expiresOnISO,
      success_redirect_url: successUrl,
      failure_redirect_url: failureUrl,
    }

    logger.info(
      {
        state,
        stateParam,
        successUrl,
        failureUrl,
        UNIPILE_REDIRECT_URI,
        requestBody,
        apiUrl: UNIPILE_API_URL,
      },
      "🔍 [Unipile] Requesting hosted auth URL with state parameter",
    )

    const response = await fetch(`${UNIPILE_API_URL}/api/v1/hosted/accounts/link`, {
      method: "POST",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        { status: response.status, statusText: response.statusText, errorText },
        "Unipile API error response",
      )
      let errorData: { message?: string; detail?: string } = { message: errorText }
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      throw new Error(
        errorData.message || errorData.detail || `Unipile API error: ${response.statusText}`,
      )
    }

    const data = (await response.json()) as { url: string }

    logger.info(
      { redirectUri: UNIPILE_REDIRECT_URI, hostedUrl: data.url },
      "Generated Unipile hosted auth URL",
    )

    return {
      url: data.url,
      hostedAuthUrl: data.url,
    }
  } catch (error) {
    logger.error({ err: error }, "Error generating Unipile hosted auth URL")
    throw error
  }
}

// Remove connectAccount - not needed as hosted auth returns account_id directly

/**
 * Get account info by account ID
 */
export async function getAccountInfo(accountId: string): Promise<UnipileAccountResponse | null> {
  try {
    const response = await fetch(`${UNIPILE_API_URL}/api/v1/accounts/${accountId}`, {
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        return null
      }
      throw new Error(`Unipile API error: ${response.statusText}`)
    }

    interface UnipileAccountData {
      id: string
      name?: string
      email?: string
      type?: string
      connection_params?: {
        mail?: {
          username?: string
          id?: string
        }
      }
    }
    const data = (await response.json()) as UnipileAccountData

    // Log full response to debug email field
    logger.info({ accountId, responseData: data }, "Unipile getAccountInfo response")

    // Extract email from various possible fields
    const email =
      data.name || // Unipile stores email in 'name' field
      data.connection_params?.mail?.username ||
      data.connection_params?.mail?.id ||
      data.email ||
      ""

    return {
      accountId: data.id,
      email: email,
      provider: data.type || "GMAIL", // Use 'type' field (e.g., "GOOGLE_OAUTH")
    }
  } catch (error) {
    logger.error({ err: error, accountId }, "Error getting Unipile account info")
    return null
  }
}

interface UnipileAccountItem {
  object?: string
  id: string
  name: string
  email: string
  type: string
  status?: string
  created_at?: string
  connection_params?: {
    mail?: {
      id: string
      username?: string
    }
    calendar?: {
      id: string
      username?: string
    }
  }
}

/**
 * List all accounts from Unipile
 */
export async function listAccounts(): Promise<{
  success: boolean
  accounts?: Array<UnipileAccountItem>
  error?: string
}> {
  try {
    const response = await fetch(`${UNIPILE_API_URL}/api/v1/accounts`, {
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, error: errorText }, "Failed to list Unipile accounts")
      return {
        success: false,
        error: `Failed to list accounts: ${response.statusText}`,
      }
    }

    const data = (await response.json()) as { items?: UnipileAccountItem[] }
    const accounts = (data.items || []).map((account) => ({
      id: account.id,
      name: account.name || "",
      email: account.name || account.connection_params?.mail?.username || account.email || "",
      type: account.type || "unknown",
      status: account.status,
      connection_param: account.connection_params,
    }))

    logger.info({ count: accounts.length }, "Listed Unipile accounts")

    return {
      success: true,
      accounts,
    }
  } catch (error) {
    logger.error({ err: error }, "Error listing Unipile accounts")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Delete account from Unipile
 */
export async function deleteAccount(accountId: string): Promise<boolean> {
  try {
    const response = await fetch(`${UNIPILE_API_URL}/api/v1/accounts/${accountId}`, {
      method: "DELETE",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    logger.info({ accountId, success: response.ok }, "Unipile account deletion attempted")
    return response.ok
  } catch (error) {
    logger.error({ err: error, accountId }, "Error deleting Unipile account")
    return false
  }
}

/**
 * Register webhook for email events
 * Creates or updates webhook for receiving mail_received events in real-time
 */
export async function registerEmailWebhook(
  webhookUrl: string,
  accountIds?: string[],
): Promise<{ success: boolean; webhookId?: string; error?: string }> {
  try {
    const requestBody = {
      request_url: webhookUrl,
      name: "Rinda Email Webhook",
      source: "email",
      format: "json",
      enabled: true,
      events: ["mail_received"], // Real-time notification for new emails
      account_ids: accountIds, // Optional: specific accounts, or omit for all accounts
    }

    logger.info(
      { webhookUrl, accountIds: accountIds?.length || "all" },
      "Registering Unipile email webhook",
    )

    const response = await fetch(`${UNIPILE_API_URL}/api/v1/webhooks`, {
      method: "POST",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(
        { status: response.status, error: errorText },
        "Failed to register Unipile webhook",
      )
      return {
        success: false,
        error: `Failed to register webhook: ${response.statusText}`,
      }
    }

    const data = (await response.json()) as { webhook_id?: string }
    logger.info({ webhookId: data.webhook_id }, "Unipile email webhook registered successfully")

    return {
      success: true,
      webhookId: data.webhook_id,
    }
  } catch (error) {
    logger.error({ error }, "Error registering Unipile email webhook")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get all registered webhooks
 */
export async function listWebhooks(): Promise<{
  success: boolean
  webhooks?: Array<{
    id: string
    name: string
    request_url: string
    enabled: boolean
    events: string[]
  }>
  error?: string
}> {
  try {
    const response = await fetch(`${UNIPILE_API_URL}/api/v1/webhooks`, {
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ status: response.status, error: errorText }, "Failed to list webhooks")
      return {
        success: false,
        error: `Failed to list webhooks: ${response.statusText}`,
      }
    }

    interface WebhookItem {
      id: string
      name: string
      request_url: string
      enabled: boolean
      events: string[]
    }
    const data = (await response.json()) as { items?: WebhookItem[] }
    return {
      success: true,
      webhooks: data.items || [],
    }
  } catch (error) {
    logger.error({ error }, "Error listing Unipile webhooks")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Delete webhook
 */
export async function deleteWebhook(webhookId: string): Promise<boolean> {
  try {
    const response = await fetch(`${UNIPILE_API_URL}/api/v1/webhooks/${webhookId}`, {
      method: "DELETE",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    logger.info({ webhookId, success: response.ok }, "Unipile webhook deletion attempted")
    return response.ok
  } catch (error) {
    logger.error({ error, webhookId }, "Error deleting Unipile webhook")
    return false
  }
}

/**
 * Email details response from Unipile API
 */
export interface UnipileEmailDetails {
  id?: string
  deprecatedId?: string // Legacy ID format used in webhooks (in_reply_to.id)
  messageId?: string
  providerId?: string
  trackingId?: string
  threadId?: string
}

/**
 * Get email details from Unipile
 * Used to retrieve actual RFC 822 Message-ID after sending email
 * @param providerId - Gmail provider ID (from send response)
 * @param accountId - Unipile account ID (required for provider_id lookup)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelayMs - Delay between retries in ms (default: 1000)
 */
export async function getEmailDetails(
  providerId: string,
  accountId: string,
  maxRetries: number = 3,
  retryDelayMs: number = 1000,
): Promise<UnipileEmailDetails | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Use provider_id + account_id to query (tracking_id doesn't work for lookup)
      const url = `${UNIPILE_API_URL}/api/v1/emails/${providerId}?account_id=${accountId}`
      const response = await fetch(url, {
        headers: {
          "X-API-KEY": UNIPILE_API_KEY,
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          // Email might not be ready yet, retry if attempts remaining
          if (attempt < maxRetries) {
            logger.info(
              { providerId, accountId, attempt, maxRetries },
              "Email not found yet, retrying after delay",
            )
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
            continue
          }
          return null
        }
        throw new Error(`Unipile API error: ${response.statusText}`)
      }

      interface UnipileEmailResponse {
        id?: string
        deprecated_id?: string
        message_id?: string
        provider_id?: string
        tracking_id?: string
        thread_id?: string
      }
      const data = (await response.json()) as UnipileEmailResponse

      logger.info(
        {
          providerId,
          id: data.id,
          deprecatedId: data.deprecated_id,
          messageId: data.message_id,
          trackingId: data.tracking_id,
          threadId: data.thread_id,
        },
        "Retrieved email details from Unipile",
      )

      return {
        id: data.id,
        deprecatedId: data.deprecated_id,
        messageId: data.message_id,
        providerId: data.provider_id,
        trackingId: data.tracking_id,
        threadId: data.thread_id,
      }
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn(
          { err: error, providerId, accountId, attempt, maxRetries },
          "Error getting email details, retrying",
        )
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
        continue
      }
      logger.error(
        { err: error, providerId, accountId },
        "Error getting Unipile email details after all retries",
      )
      return null
    }
  }

  return null
}

/**
 * Convert base64 string to Blob
 */
function base64ToBlob(base64: string, contentType: string): Blob {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

/**
 * Send email via Unipile
 * Uses multipart/form-data when attachments are present, JSON otherwise
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  const { accountId, to, subject, body, cc, bcc, replyTo, attachments } = options

  try {
    // If attachments exist, use multipart/form-data (required by Unipile API)
    if (attachments && attachments.length > 0) {
      const formData = new FormData()

      // Required fields
      formData.append("account_id", accountId)
      formData.append("to", JSON.stringify([{ identifier: to }]))
      formData.append("subject", subject)
      formData.append("body", body)

      // Optional CC/BCC
      if (cc && cc.length > 0) {
        formData.append("cc", JSON.stringify(cc.map((email) => ({ identifier: email }))))
      }
      if (bcc && bcc.length > 0) {
        formData.append("bcc", JSON.stringify(bcc.map((email) => ({ identifier: email }))))
      }

      // Attachments as binary files
      for (const att of attachments) {
        const blob = base64ToBlob(att.content, att.contentType)
        formData.append("attachments", blob, att.filename)
      }

      logger.info(
        {
          accountId,
          endpoint: `${UNIPILE_API_URL}/api/v1/emails`,
          attachmentCount: attachments.length,
          attachmentNames: attachments.map((a) => a.filename),
        },
        "Sending email to Unipile API with attachments (multipart/form-data)",
      )

      const response = await fetch(`${UNIPILE_API_URL}/api/v1/emails`, {
        method: "POST",
        headers: {
          "X-API-KEY": UNIPILE_API_KEY,
          // Note: Don't set Content-Type for FormData, browser/runtime will set it with boundary
        },
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorData: { message?: string; detail?: string } = { message: errorText }
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { message: errorText }
        }

        logger.error(
          {
            accountId,
            status: response.status,
            statusText: response.statusText,
            errorData,
          },
          "Unipile API error response (with attachments)",
        )

        throw new Error(
          errorData.message || errorData.detail || `Unipile API error: ${response.statusText}`,
        )
      }

      interface EmailSentResponse {
        object?: string
        tracking_id?: string
        provider_id?: string
        id?: string
      }
      const data = (await response.json()) as EmailSentResponse

      logger.info(
        { accountId, trackingId: data.tracking_id, providerId: data.provider_id },
        "Email sent via Unipile successfully (with attachments)",
      )

      return {
        success: true,
        messageId: data.tracking_id,
        providerId: data.provider_id,
        trackingId: data.tracking_id,
      }
    }

    // No attachments - use JSON (simpler)
    const requestBody: Record<string, unknown> = {
      account_id: accountId,
      to: [{ identifier: to }],
      subject,
      body,
    }

    // Threading support: reply_to is the Provider ID of the email being replied to
    if (replyTo) {
      requestBody.reply_to = replyTo
    }

    if (cc && cc.length > 0) {
      requestBody.cc = cc.map((email) => ({ identifier: email }))
    }

    if (bcc && bcc.length > 0) {
      requestBody.bcc = bcc.map((email) => ({ identifier: email }))
    }

    logger.info(
      {
        accountId,
        endpoint: `${UNIPILE_API_URL}/api/v1/emails`,
      },
      "Sending email to Unipile API (JSON)",
    )

    const response = await fetch(`${UNIPILE_API_URL}/api/v1/emails`, {
      method: "POST",
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorData: { message?: string; detail?: string } = { message: errorText }
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }

      logger.error(
        {
          accountId,
          status: response.status,
          statusText: response.statusText,
          errorData,
        },
        "Unipile API error response",
      )

      throw new Error(
        errorData.message || errorData.detail || `Unipile API error: ${response.statusText}`,
      )
    }

    interface EmailSentResponse {
      object?: string
      tracking_id?: string
      provider_id?: string
      id?: string
    }
    const data = (await response.json()) as EmailSentResponse

    logger.info(
      { accountId, trackingId: data.tracking_id, providerId: data.provider_id },
      "Email sent via Unipile successfully",
    )

    return {
      success: true,
      messageId: data.tracking_id,
      providerId: data.provider_id,
      trackingId: data.tracking_id,
    }
  } catch (error) {
    logger.error({ err: error, accountId }, "Error sending email via Unipile")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send email via Unipile",
    }
  }
}

/**
 * Sync account emails (fetch inbox for new messages)
 * Used for replied-emails feature
 * - Fetches new inbound emails from Unipile
 * - Detects replies by matching message IDs
 * - Updates original email repliedAt timestamp
 * - Saves reply to email_replies table
 */
export async function syncAccountEmails(
  accountId: string,
  lastSyncedAt?: string,
): Promise<{ success: boolean; newEmails: number; repliesDetected: number }> {
  try {
    // Build query parameters according to Unipile API spec
    const params = new URLSearchParams({
      account_id: accountId,
      limit: "100", // Max 250, using 100 for reasonable batch size
      include_headers: "true", // Include headers to get in_reply_to and references
    })

    if (lastSyncedAt) {
      // lastSyncedAt should be ISO 8601 format: YYYY-MM-DDTHH:MM:SS.sssZ
      params.append("after", lastSyncedAt)
    }

    const response = await fetch(`${UNIPILE_API_URL}/api/v1/emails?${params.toString()}`, {
      headers: {
        "X-API-KEY": UNIPILE_API_KEY,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error({ accountId, status: response.status, error: errorText }, "Unipile API error")
      throw new Error(`Unipile API error: ${response.statusText}`)
    }

    // Unipile email response type
    interface UnipileEmail {
      role?: string
      origin?: string
      message_id?: string // RFC 822 Message-ID
      id?: string // Unipile email ID
      tracking_id?: string // Unipile tracking ID (if sent via Unipile)
      in_reply_to?: { message_id?: string; id?: string } // Both RFC 822 and Unipile ID
      headers?: Array<{ name?: string; value?: string }>
      from_attendee?: { identifier?: string }
      subject?: string
      body?: string
      body_plain?: string
      date?: string
    }

    const data = (await response.json()) as { items?: UnipileEmail[] }
    const allEmails = data.items || []

    // Filter to get only inbox emails from external sources
    // (role and origin are properties of the response, not query parameters)
    const inboxEmails = allEmails.filter(
      (email: UnipileEmail) => email.role === "inbox" && email.origin === "external",
    )

    logger.info(
      { accountId, total: allEmails.length, filtered: inboxEmails.length },
      `Synced ${inboxEmails.length} inbox emails from Unipile (${allEmails.length} total)`,
    )

    let newEmails = 0
    let repliesDetected = 0

    // Process each inbox email
    for (const inboxEmail of inboxEmails) {
      try {
        // in_reply_to is an object with message_id (RFC 822) and id (Unipile ID) fields
        const inReplyToMessageId = inboxEmail.in_reply_to?.message_id
        const inReplyToUnipileId = inboxEmail.in_reply_to?.id

        // Extract References header from headers array
        const referencesHeader = inboxEmail.headers?.find(
          (h: { name?: string; value?: string }) => h.name?.toLowerCase() === "references",
        )
        const references = referencesHeader?.value
          ? referencesHeader.value.split(/\s+/).filter((ref: string) => ref.trim())
          : []

        // from_attendee.identifier contains the email address
        const from = inboxEmail.from_attendee?.identifier || ""
        const subject = inboxEmail.subject || ""
        const body = inboxEmail.body || inboxEmail.body_plain || ""
        const receivedAt = inboxEmail.date ? new Date(inboxEmail.date) : new Date()

        // Check if this is a reply to one of our sent emails
        let originalEmail = null
        let matchedBy = ""

        // Strategy 1: Try to find original email by RFC 822 Message-ID
        if (inReplyToMessageId) {
          originalEmail = await db.query.emails.findFirst({
            where: (emails, { or, like, eq }) =>
              or(
                eq(emails.messageId, inReplyToMessageId),
                like(emails.messageId, `%${inReplyToMessageId}%`),
                like(emails.sendgridMessageId, `%${inReplyToMessageId}%`),
              ),
            columns: {
              id: true,
              workspaceId: true,
              userEmailAccountId: true,
              leadId: true,
              sequenceId: true,
              leadName: true,
              sequenceName: true,
              threadId: true,
              fromEmail: true,
            },
          })

          if (originalEmail) {
            matchedBy = "messageId"
            logger.info(
              { originalEmailId: originalEmail.id, matchedBy, inReplyToMessageId },
              "[syncAccountEmails] Found original email by RFC 822 Message-ID",
            )
          }
        }

        // Strategy 2: Try to find original email by Unipile ID (tracking_id stored in sendgridMessageId)
        if (!originalEmail && inReplyToUnipileId) {
          originalEmail = await db.query.emails.findFirst({
            where: (emails, { eq }) => eq(emails.sendgridMessageId, inReplyToUnipileId),
            columns: {
              id: true,
              workspaceId: true,
              userEmailAccountId: true,
              leadId: true,
              sequenceId: true,
              leadName: true,
              sequenceName: true,
              threadId: true,
              fromEmail: true,
            },
          })

          if (originalEmail) {
            matchedBy = "unipileId"
            logger.info(
              { originalEmailId: originalEmail.id, matchedBy, inReplyToUnipileId },
              "[syncAccountEmails] Found original email by Unipile tracking ID",
            )
          }
        }

        if (originalEmail) {
          const originalEmailId = originalEmail.id
          const inReplyToValue = inReplyToMessageId || inReplyToUnipileId || inboxEmail.id

          // 1. Store reply as inbound email in emails table
          const [inboundEmail] = await db
            .insert(emails)
            .values({
              workspaceId: originalEmail.workspaceId,
              userEmailAccountId: originalEmail.userEmailAccountId,
              leadId: originalEmail.leadId,
              sequenceId: originalEmail.sequenceId,
              direction: "inbound",
              fromEmail: from,
              toEmail: originalEmail.fromEmail,
              subject: subject,
              bodyText: body,
              status: "delivered",
              sentAt: receivedAt,
              deliveredAt: receivedAt,
              messageId: inboxEmail.message_id || inboxEmail.id, // RFC 822 Message-ID or Unipile ID
              sendgridMessageId: inboxEmail.id, // Store Unipile email ID
              inReplyTo: inReplyToValue,
              threadId: originalEmail.threadId || inReplyToValue,
              leadName: originalEmail.leadName,
              sequenceName: originalEmail.sequenceName,
            })
            .returning({ id: emails.id })

          if (!inboundEmail) {
            logger.error({ accountId }, "Failed to save inbound email")
            continue
          }

          // 2. Update original email repliedAt
          await db
            .update(emails)
            .set({
              repliedAt: receivedAt,
              status: "replied",
              updatedAt: new Date(),
            })
            .where(eq(emails.id, originalEmailId))

          // 3. Create email_reply record
          await db.insert(emailReplies).values({
            workspaceId: originalEmail.workspaceId,
            originalEmailId,
            replyEmailId: inboundEmail.id,
            sentiment: null,
            isRead: false,
          })

          repliesDetected++
          newEmails++

          logger.info(
            { accountId, originalEmailId, from, subject, matchedBy },
            "Reply detected and saved",
          )
        }

        // If not a reply via In-Reply-To, check References header for thread matching
        if (!originalEmail && references.length > 0) {
          for (const refId of references) {
            const refOriginalEmail = await db.query.emails.findFirst({
              where: (emails, { or, like, eq }) =>
                or(
                  eq(emails.messageId, refId),
                  like(emails.messageId, `%${refId}%`),
                  like(emails.sendgridMessageId, `%${refId}%`),
                ),
              columns: {
                id: true,
                workspaceId: true,
                userEmailAccountId: true,
                leadId: true,
                sequenceId: true,
                leadName: true,
                sequenceName: true,
                threadId: true,
                fromEmail: true,
              },
            })

            if (refOriginalEmail) {
              originalEmail = refOriginalEmail
              matchedBy = "references"

              // 1. Store reply as inbound email
              const [inboundEmail] = await db
                .insert(emails)
                .values({
                  workspaceId: refOriginalEmail.workspaceId,
                  userEmailAccountId: refOriginalEmail.userEmailAccountId,
                  leadId: refOriginalEmail.leadId,
                  sequenceId: refOriginalEmail.sequenceId,
                  direction: "inbound",
                  fromEmail: from,
                  toEmail: refOriginalEmail.fromEmail,
                  subject: subject,
                  bodyText: body,
                  status: "delivered",
                  sentAt: receivedAt,
                  deliveredAt: receivedAt,
                  messageId: inboxEmail.message_id || inboxEmail.id,
                  sendgridMessageId: inboxEmail.id,
                  inReplyTo: refId,
                  threadId: refOriginalEmail.threadId || refId,
                  leadName: refOriginalEmail.leadName,
                  sequenceName: refOriginalEmail.sequenceName,
                })
                .returning({ id: emails.id })

              if (!inboundEmail) {
                logger.error({ accountId }, "Failed to save inbound email via References")
                break
              }

              // 2. Update original email
              await db
                .update(emails)
                .set({
                  repliedAt: receivedAt,
                  status: "replied",
                  updatedAt: new Date(),
                })
                .where(eq(emails.id, refOriginalEmail.id))

              // 3. Create email_reply record
              await db.insert(emailReplies).values({
                workspaceId: refOriginalEmail.workspaceId,
                originalEmailId: refOriginalEmail.id,
                replyEmailId: inboundEmail.id,
                sentiment: null,
                isRead: false,
              })

              repliesDetected++
              newEmails++

              logger.info(
                {
                  accountId,
                  originalEmailId: refOriginalEmail.id,
                  from,
                  subject,
                  refId,
                  matchedBy,
                },
                "Reply detected and saved via References header",
              )

              break // Found match, no need to check other references
            }
          }
        }

        // Count as new email only if it's not already counted as a reply
        if (!originalEmail) {
          newEmails++
        }
      } catch (emailError) {
        logger.error(
          { accountId, error: emailError, email: inboxEmail },
          "Error processing inbox email",
        )
      }
    }

    logger.info({ accountId, newEmails, repliesDetected }, "Inbox sync completed")

    return {
      success: true,
      newEmails,
      repliesDetected,
    }
  } catch (error) {
    logger.error({ err: error, accountId }, "Error syncing Unipile emails")
    return {
      success: false,
      newEmails: 0,
      repliesDetected: 0,
    }
  }
}

/**
 * Process Unipile webhook events
 * Similar to Nylas webhook handling
 */
export async function processUnipileWebhook(payload: unknown): Promise<{ success: boolean }> {
  try {
    const event = payload as Record<string, unknown>

    logger.info(
      {
        eventType: event.type,
        accountId: event.account_id,
      },
      "Processing Unipile webhook event",
    )

    // TODO: Implement webhook handlers based on event type
    // Unipile webhook events:
    // - email.sent
    // - email.delivered
    // - email.opened
    // - email.clicked
    // - email.bounced
    // - email.replied

    switch (event.type) {
      case "email.sent":
        // Handle email sent
        break
      case "email.delivered":
        // Handle email delivered
        break
      case "email.opened":
        // Handle email opened
        await handleEmailOpened(event)
        break
      case "email.clicked":
        // Handle email clicked
        await handleEmailClicked(event)
        break
      case "email.bounced":
        // Handle email bounced
        break
      case "email.replied":
        // Handle email replied
        await handleEmailReplied(event)
        break
      default:
        logger.warn({ eventType: event.type }, "Unknown Unipile webhook event type")
    }

    return { success: true }
  } catch (error) {
    logger.error({ err: error }, "Error processing Unipile webhook")
    return { success: false }
  }
}

/**
 * Handle email opened webhook
 */
async function handleEmailOpened(event: Record<string, unknown>): Promise<void> {
  const messageId = event.message_id as string

  if (!messageId) {
    logger.warn("Email opened event missing message_id")
    return
  }

  try {
    // Find email by Unipile message ID
    const [email] = await db
      .select({ id: emails.id, status: emails.status })
      .from(emails)
      .where(eq(emails.sendgridMessageId, messageId))
      .limit(1)

    if (!email) {
      logger.warn({ messageId }, "Email not found for opened event")
      return
    }

    // Update email status
    await db
      .update(emails)
      .set({
        status: "opened",
        openedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emails.id, email.id))

    // Record event
    await db.insert(emailEvents).values({
      emailId: email.id,
      eventType: "open",
      timestamp: new Date(),
      rawEventData: event as Record<string, unknown>,
    })

    logger.info({ emailId: email.id, messageId }, "Email opened event processed")
  } catch (error) {
    logger.error({ err: error, messageId }, "Error handling email opened event")
  }
}

/**
 * Handle email clicked webhook
 */
async function handleEmailClicked(event: Record<string, unknown>): Promise<void> {
  const messageId = event.message_id as string

  if (!messageId) {
    logger.warn("Email clicked event missing message_id")
    return
  }

  try {
    const [email] = await db
      .select({ id: emails.id })
      .from(emails)
      .where(eq(emails.sendgridMessageId, messageId))
      .limit(1)

    if (!email) {
      logger.warn({ messageId }, "Email not found for clicked event")
      return
    }

    await db
      .update(emails)
      .set({
        status: "clicked",
        clickedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emails.id, email.id))

    await db.insert(emailEvents).values({
      emailId: email.id,
      eventType: "click",
      timestamp: new Date(),
      url: (event.url as string) || "",
      rawEventData: event as Record<string, unknown>,
    })

    logger.info({ emailId: email.id, messageId }, "Email clicked event processed")
  } catch (error) {
    logger.error({ err: error, messageId }, "Error handling email clicked event")
  }
}

/**
 * Handle email replied webhook
 * Stores inbound reply email and creates email_replies record
 * Similar to SendGrid webhook processing
 */
async function handleEmailReplied(event: Record<string, unknown>): Promise<void> {
  const originalMessageId = event.original_message_id as string
  const replyMessageId = (event.reply_message_id || event.message_id) as string
  const accountId = event.account_id as string

  logger.info(
    {
      eventType: event.type,
      originalMessageId,
      replyMessageId,
      accountId,
      fullEvent: JSON.stringify(event, null, 2),
    },
    "💬 [UNIPILE] email.replied - Processing reply webhook",
  )

  if (!originalMessageId) {
    logger.warn({ event }, "Email replied event missing original_message_id")
    return
  }

  try {
    // 1. Find original email by sendgridMessageId (Unipile tracking_id) or messageId
    const originalEmail = await db.query.emails.findFirst({
      where: (emails, { or, eq, like }) =>
        or(
          eq(emails.sendgridMessageId, originalMessageId),
          eq(emails.messageId, originalMessageId),
          like(emails.messageId, `%${originalMessageId}%`),
        ),
      columns: {
        id: true,
        workspaceId: true,
        userEmailAccountId: true,
        leadId: true,
        sequenceId: true,
        leadName: true,
        sequenceName: true,
        threadId: true,
        fromEmail: true,
        messageId: true,
      },
    })

    if (!originalEmail) {
      logger.warn(
        { originalMessageId, replyMessageId },
        "⚠️ [UNIPILE] email.replied - Original email not found",
      )
      return
    }

    logger.info(
      {
        originalEmailId: originalEmail.id,
        leadId: originalEmail.leadId,
        threadId: originalEmail.threadId,
      },
      "💬 [UNIPILE] email.replied - Found original email",
    )

    // 2. Fetch reply email details from Unipile API (if replyMessageId exists)
    let replyFrom = ""
    let replySubject = ""
    let replyBody = ""
    let replyReceivedAt = new Date()
    let replyRfcMessageId = replyMessageId

    if (replyMessageId) {
      try {
        const response = await fetch(`${UNIPILE_API_URL}/api/v1/emails/${replyMessageId}`, {
          headers: {
            "X-API-KEY": UNIPILE_API_KEY,
          },
        })

        if (response.ok) {
          const replyData = (await response.json()) as {
            from_attendee?: { identifier?: string }
            subject?: string
            body?: string
            body_plain?: string
            date?: string
            message_id?: string
          }

          replyFrom = replyData.from_attendee?.identifier || ""
          replySubject = replyData.subject || ""
          replyBody = replyData.body || replyData.body_plain || ""
          replyReceivedAt = replyData.date ? new Date(replyData.date) : new Date()
          replyRfcMessageId = replyData.message_id || replyMessageId

          logger.info(
            { replyFrom, replySubject, replyReceivedAt },
            "💬 [UNIPILE] email.replied - Fetched reply details",
          )
        } else {
          logger.warn(
            { replyMessageId, status: response.status },
            "⚠️ [UNIPILE] email.replied - Could not fetch reply details",
          )
        }
      } catch (fetchError) {
        logger.warn(
          { err: fetchError, replyMessageId },
          "⚠️ [UNIPILE] email.replied - Error fetching reply details",
        )
      }
    }

    // 3. Store reply as inbound email in emails table
    const [inboundEmail] = await db
      .insert(emails)
      .values({
        workspaceId: originalEmail.workspaceId,
        userEmailAccountId: originalEmail.userEmailAccountId,
        leadId: originalEmail.leadId,
        sequenceId: originalEmail.sequenceId,
        direction: "inbound",
        fromEmail: replyFrom || "unknown",
        toEmail: originalEmail.fromEmail,
        subject: replySubject || `Re: ${originalEmail.sequenceName || ""}`,
        bodyText: replyBody,
        status: "delivered",
        sentAt: replyReceivedAt,
        deliveredAt: replyReceivedAt,
        messageId: replyRfcMessageId,
        sendgridMessageId: replyMessageId,
        inReplyTo: originalEmail.messageId || originalMessageId,
        threadId: originalEmail.threadId || originalMessageId,
        leadName: originalEmail.leadName,
        sequenceName: originalEmail.sequenceName,
      })
      .returning({ id: emails.id })

    if (!inboundEmail) {
      logger.error(
        { originalMessageId },
        "❌ [UNIPILE] email.replied - Failed to save inbound email",
      )
      return
    }

    logger.info(
      { inboundEmailId: inboundEmail.id, originalEmailId: originalEmail.id },
      "✅ [UNIPILE] email.replied - Inbound email saved",
    )

    // 4. Update original email repliedAt
    await db
      .update(emails)
      .set({
        repliedAt: replyReceivedAt,
        status: "replied",
        updatedAt: new Date(),
      })
      .where(eq(emails.id, originalEmail.id))

    logger.info(
      { originalEmailId: originalEmail.id },
      "✅ [UNIPILE] email.replied - Original email repliedAt updated",
    )

    // 5. Create or update email_replies record
    const existingReplyResults = await db
      .select({ id: emailReplies.id })
      .from(emailReplies)
      .where(eq(emailReplies.originalEmailId, originalEmail.id))
      .limit(1)

    const existingReply = existingReplyResults[0]
    let emailReply: { id: string } | undefined

    if (existingReply) {
      // Update existing reply with the LATEST reply email
      const [updated] = await db
        .update(emailReplies)
        .set({
          replyEmailId: inboundEmail.id,
          intent: null,
          sentiment: null,
        })
        .where(eq(emailReplies.id, existingReply.id))
        .returning({ id: emailReplies.id })

      emailReply = updated
      logger.info(
        { emailReplyId: emailReply?.id, originalEmailId: originalEmail.id },
        "✅ [UNIPILE] email.replied - email_replies record UPDATED",
      )
    } else {
      // Create new email_replies record
      const [inserted] = await db
        .insert(emailReplies)
        .values({
          workspaceId: originalEmail.workspaceId,
          originalEmailId: originalEmail.id,
          replyEmailId: inboundEmail.id,
          isRead: false,
        })
        .returning({ id: emailReplies.id })

      emailReply = inserted
      logger.info(
        { emailReplyId: emailReply?.id, originalEmailId: originalEmail.id },
        "✅ [UNIPILE] email.replied - email_replies record CREATED",
      )
    }

    // 6. AI classification (async, non-blocking)
    const classificationEnabled = process.env.AI_CLASSIFICATION_ENABLED !== "false"
    if (emailReply && classificationEnabled) {
      try {
        const { reclassifyEmailReply } = await import("./email-replies.service")
        reclassifyEmailReply(emailReply.id).catch((error) => {
          logger.warn(
            { err: error, emailReplyId: emailReply.id },
            "⚠️ [UNIPILE] email.replied - AI classification failed",
          )
        })
      } catch {
        // AI classification is optional
      }
    }

    // 7. Stop active sequence enrollments for this lead
    if (originalEmail.leadId) {
      try {
        const { sequenceEnrollments, sequenceStepExecutions } = await import("../db/schema")

        // Find active enrollments for this lead
        const activeEnrollments = await db
          .select({
            id: sequenceEnrollments.id,
            sequenceId: sequenceEnrollments.sequenceId,
          })
          .from(sequenceEnrollments)
          .where(
            and(
              eq(sequenceEnrollments.leadId, originalEmail.leadId),
              eq(sequenceEnrollments.status, "active"),
            ),
          )

        if (activeEnrollments.length > 0) {
          logger.info(
            {
              leadId: originalEmail.leadId,
              activeEnrollmentsCount: activeEnrollments.length,
            },
            "🛑 [UNIPILE] email.replied - Stopping active enrollments for lead",
          )

          // Stop all active enrollments
          await db
            .update(sequenceEnrollments)
            .set({
              status: "stopped",
              stoppedAt: new Date(),
            })
            .where(
              and(
                eq(sequenceEnrollments.leadId, originalEmail.leadId),
                eq(sequenceEnrollments.status, "active"),
              ),
            )

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

          logger.info(
            { leadId: originalEmail.leadId, stoppedCount: activeEnrollments.length },
            "✅ [UNIPILE] email.replied - Active enrollments stopped",
          )
        }
      } catch (enrollmentError) {
        logger.error(
          { err: enrollmentError, leadId: originalEmail.leadId },
          "❌ [UNIPILE] email.replied - Error stopping enrollments",
        )
      }
    }

    logger.info(
      { originalEmailId: originalEmail.id, inboundEmailId: inboundEmail.id },
      "✅ [UNIPILE] email.replied - Reply processed successfully",
    )
  } catch (error) {
    logger.error({ err: error, originalMessageId }, "❌ [UNIPILE] email.replied - Error processing")
  }
}

export default {
  getUnipileAuthUrl,
  getAccountInfo,
  listAccounts,
  deleteAccount,
  sendEmail,
  syncAccountEmails,
  processUnipileWebhook,
}
