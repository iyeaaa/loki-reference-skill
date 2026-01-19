import { eq, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { config } from "../config"
import { db } from "../db/index"
import { emailEvents, emailReplies, emails } from "../db/schema/emails"
import {
  createEmailAccount,
  deleteEmailAccount,
  getEmailAccountByWorkspaceAndUserAny,
} from "../services/email-account.service"
import * as unipileService from "../services/unipile.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import { isAutomatedClick, isAutomatedOpen } from "../utils/bot-detection"
import logger from "../utils/logger"

// Safe limits mode - when true, uses conservative sending limits
const SAFE_LIMITS = true

// Email sending limits based on account type and safe mode
const EMAIL_LIMITS = {
  safe: {
    personal: { dailyLimit: 60, monthlyLimit: 1800 },
    workspace: { dailyLimit: 500, monthlyLimit: 15000 },
  },
  aggressive: {
    personal: { dailyLimit: 500, monthlyLimit: 15000 },
    workspace: { dailyLimit: 2000, monthlyLimit: 60000 },
  },
}

// Schema for auth URL request
const authUrlQuerySchema = t.Object({
  state: t.Optional(t.String()),
})

// Schema for callback request
const callbackQuerySchema = t.Object({
  account_id: t.String(),
  workspaceId: t.Optional(t.String()),
  state: t.Optional(t.String()),
})

export const unipileRoutes = new Elysia({ prefix: "/api/v1/unipile" })
  /**
   * GET /api/v1/unipile/auth
   * Get Unipile hosted authentication URL
   */
  .get(
    "/auth",
    async ({ query, set }) => {
      try {
        // Get state parameter (workspaceId) from query
        const { state } = query

        logger.info({ state, query }, "🔍 [Unipile Auth] Received auth request with state")

        // Initialize Unipile hosted auth session (use GOOGLE for Gmail)
        // Pass state to include in redirect URL
        const result = await unipileService.getUnipileAuthUrl("GOOGLE", state)

        logger.info(
          { state, hostedAuthUrl: result.hostedAuthUrl },
          "✅ [Unipile Auth] Generated auth URL",
        )

        return successResponse(result, "Unipile auth URL generated successfully")
      } catch (error) {
        logger.error({ err: error }, "Failed to generate Unipile auth URL")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to generate auth URL",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      query: authUrlQuerySchema,
      detail: {
        tags: ["Unipile"],
        summary: "Get Unipile Auth URL",
        description:
          "Generate Unipile hosted authentication URL for email integration (supports Gmail, Outlook, etc.)",
      },
    },
  )

  /**
   * GET /api/v1/unipile/callback
   * OAuth redirect handler - process Unipile account connection
   */
  .get(
    "/callback",
    async ({ query, headers, set }) => {
      let userId: string | null = null
      let workspaceId: string | undefined

      try {
        const { account_id: accountId, state } = query
        // workspaceId fallback: query param > state param (for Safari/incognito mode)
        workspaceId = query.workspaceId || state

        // Get user from authorization header
        userId = await getUserIdFromToken(headers.authorization)
        logger.info({ state, userId, workspaceId, accountId }, "Processing Unipile callback")

        if (!userId) {
          set.status = 401
          return errorResponse("Authentication required", ResponseCode.UNAUTHORIZED)
        }

        if (!workspaceId) {
          set.status = 400
          return errorResponse("Workspace ID is required", ResponseCode.BAD_REQUEST)
        }

        // List all accounts from Unipile to check for duplicates
        const accountsResult = await unipileService.listAccounts()

        if (!accountsResult.success || !accountsResult.accounts) {
          set.status = 500
          return errorResponse(
            accountsResult.error || "Failed to list Unipile accounts",
            ResponseCode.INTERNAL_ERROR,
          )
        }

        // Find the current account from the list
        const currentAccount = accountsResult.accounts.find((acc) => acc.id === accountId)

        if (!currentAccount) {
          set.status = 404
          return errorResponse("Unipile account not found", ResponseCode.NOT_FOUND)
        }

        const accountEmail = currentAccount.email || currentAccount.name

        logger.info(
          {
            userId,
            workspaceId,
            accountId,
            email: accountEmail,
            type: currentAccount.type,
            totalAccounts: accountsResult.accounts.length,
          },
          "Unipile account info retrieved successfully",
        )

        // Find duplicate accounts with the same email (excluding current account)
        const duplicateAccounts = accountsResult.accounts.filter(
          (acc) =>
            acc.id !== accountId && (acc.email === accountEmail || acc.name === accountEmail),
        )

        // Delete duplicate accounts from Unipile
        if (duplicateAccounts.length > 0) {
          logger.info(
            {
              duplicateCount: duplicateAccounts.length,
              duplicateIds: duplicateAccounts.map((a) => a.id),
            },
            "Found duplicate Unipile accounts with same email - deleting",
          )

          for (const duplicate of duplicateAccounts) {
            try {
              const deleted = await unipileService.deleteAccount(duplicate.id)
              if (deleted) {
                logger.info(
                  { duplicateId: duplicate.id, email: duplicate.email },
                  "Deleted duplicate Unipile account",
                )
              } else {
                logger.warn(
                  { duplicateId: duplicate.id },
                  "Failed to delete duplicate Unipile account",
                )
              }
            } catch (deleteError) {
              logger.error(
                { err: deleteError, duplicateId: duplicate.id },
                "Error deleting duplicate Unipile account",
              )
            }
          }
        }

        // Use accountEmail for the rest of the flow
        const accountInfo = {
          accountId,
          email: accountEmail,
          provider: currentAccount.type || "GOOGLE_OAUTH",
        }

        // Check for existing email account (might be TRIAL_PREVIEW)
        const existingAccount = await getEmailAccountByWorkspaceAndUserAny(workspaceId, userId)

        let trialPreviewAccountId: string | null = null

        if (existingAccount) {
          if (existingAccount.apiKey === "TRIAL_PREVIEW") {
            trialPreviewAccountId = existingAccount.id
            logger.info(
              { existingAccountId: existingAccount.id },
              "Found TRIAL_PREVIEW account - will migrate",
            )
          } else {
            set.status = 409
            return errorResponse(
              "Email account already exists for this workspace",
              ResponseCode.CONFLICT,
            )
          }
        }

        // Determine account limits
        const limits = SAFE_LIMITS ? EMAIL_LIMITS.safe : EMAIL_LIMITS.aggressive
        const accountLimits = limits.personal // Default to personal limits

        // Create new email account with Unipile accountId
        const newAccount = await createEmailAccount({
          userId,
          workspaceId,
          provider: "unipile",
          emailAddress: accountInfo.email,
          displayName: accountInfo.email.split("@")[0] || accountInfo.email,
          apiKey: accountId, // Store Unipile account_id
          isVerified: true,
          isDefault: true,
          status: "active",
          dailyLimit: accountLimits.dailyLimit,
          monthlyLimit: accountLimits.monthlyLimit,
        })

        if (!newAccount) {
          set.status = 500
          return errorResponse("Failed to create email account", ResponseCode.INTERNAL_ERROR)
        }

        logger.info(
          { accountId: newAccount.id, unipileAccountId: accountId },
          "Unipile email account created successfully",
        )

        // Register webhooks for all accounts (only once, not per account)
        // Two webhooks needed:
        // 1. "email" source webhook for mail_received (reply detection)
        // 2. "email_tracking" source webhook for mail_opened, mail_link_clicked (open/click tracking)
        try {
          const webhooksResult = await unipileService.listWebhooks()
          const mailReceivedWebhookUrl = `${config.appUrl}/api/v1/unipile/webhook`
          const trackingWebhookUrl = `${config.appUrl}/api/v1/unipile/webhooks`

          // 1. Register mail_received webhook (for reply detection)
          const existingMailWebhook = webhooksResult.webhooks?.find(
            (wh) =>
              wh.request_url === mailReceivedWebhookUrl && wh.events?.includes("mail_received"),
          )

          if (!existingMailWebhook) {
            const webhookResult = await unipileService.registerEmailWebhook(mailReceivedWebhookUrl)

            if (webhookResult.success) {
              logger.info(
                { webhookId: webhookResult.webhookId, webhookUrl: mailReceivedWebhookUrl },
                "✅ Unipile mail_received webhook registered successfully",
              )
            } else {
              logger.warn(
                { error: webhookResult.error, webhookUrl: mailReceivedWebhookUrl },
                "⚠️ Failed to register Unipile mail_received webhook (non-critical)",
              )
            }
          } else {
            logger.info(
              { webhookId: existingMailWebhook.id },
              "✅ Unipile mail_received webhook already exists",
            )
          }

          // 2. Register email_tracking webhook (for open/click tracking)
          const existingTrackingWebhook = webhooksResult.webhooks?.find(
            (wh) =>
              wh.request_url === trackingWebhookUrl &&
              (wh.events?.includes("mail_opened") || wh.events?.includes("mail_link_clicked")),
          )

          if (!existingTrackingWebhook) {
            const trackingResult =
              await unipileService.registerEmailTrackingWebhook(trackingWebhookUrl)

            if (trackingResult.success) {
              logger.info(
                { webhookId: trackingResult.webhookId, webhookUrl: trackingWebhookUrl },
                "✅ Unipile email_tracking webhook registered successfully (opens/clicks)",
              )
            } else {
              logger.warn(
                { error: trackingResult.error, webhookUrl: trackingWebhookUrl },
                "⚠️ Failed to register Unipile email_tracking webhook (non-critical)",
              )
            }
          } else {
            logger.info(
              { webhookId: existingTrackingWebhook.id },
              "✅ Unipile email_tracking webhook already exists",
            )
          }
        } catch (webhookError) {
          logger.warn(
            { err: webhookError },
            "⚠️ Error checking/registering Unipile webhooks (non-critical)",
          )
        }

        // Delete TRIAL_PREVIEW account if exists
        if (trialPreviewAccountId) {
          try {
            await deleteEmailAccount(trialPreviewAccountId)
            logger.info(
              { trialPreviewAccountId },
              "Deleted TRIAL_PREVIEW account after Unipile connection",
            )
          } catch (deleteError) {
            logger.warn(
              { err: deleteError, trialPreviewAccountId },
              "Failed to delete TRIAL_PREVIEW account (non-critical)",
            )
          }
        }

        return successResponse(
          {
            account: {
              id: newAccount.id,
              emailAddress: newAccount.emailAddress,
              displayName: newAccount.displayName,
              provider: "unipile",
              status: newAccount.status,
              isDefault: newAccount.isDefault,
              dailyLimit: accountLimits.dailyLimit,
              monthlyLimit: accountLimits.monthlyLimit,
            },
            unipileAccountId: accountId,
          },
          "Unipile email account connected successfully",
        )
      } catch (error) {
        logger.error(
          {
            err: error,
            userId,
            workspaceId,
            errorMessage: error instanceof Error ? error.message : String(error),
          },
          "Unipile callback error",
        )

        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to process Unipile callback",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      query: callbackQuerySchema,
      detail: {
        tags: ["Unipile"],
        summary: "Unipile OAuth Callback",
        description: "Process Unipile account connection after hosted authentication",
      },
    },
  )

  /**
   * DELETE /api/v1/unipile/account/:accountId
   * Delete Unipile account
   */
  .delete(
    "/account/:accountId",
    async ({ params, set }) => {
      const { accountId } = params

      try {
        // Get email account from DB
        const [emailAccount] = await db.query.userEmailAccounts.findMany({
          where: (accounts, { eq }) => eq(accounts.id, accountId),
          limit: 1,
        })

        if (!emailAccount) {
          set.status = 404
          return errorResponse("Email account not found", ResponseCode.NOT_FOUND)
        }

        if (emailAccount.provider !== "unipile") {
          set.status = 400
          return errorResponse("Account is not a Unipile account", ResponseCode.BAD_REQUEST)
        }

        // Delete email account (includes Unipile API deletion + webhook cleanup)
        // Note: All cleanup logic is handled in deleteEmailAccount service
        await deleteEmailAccount(accountId)

        logger.info(
          { accountId, unipileAccountId: emailAccount.apiKey },
          "Unipile email account deleted successfully",
        )

        return successResponse({ message: "Unipile account deleted successfully" })
      } catch (error) {
        logger.error({ err: error, accountId }, "Failed to delete Unipile account")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to delete account",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Delete Unipile Account",
        description:
          "Delete Unipile email account (includes Unipile API cleanup and webhook management)",
      },
    },
  )

  /**
   * POST /api/v1/unipile/webhooks
   * Receive Unipile webhook events (email_tracking: opens, clicks)
   * Uses same parsing logic as /webhook endpoint
   */
  .post(
    "/webhooks",
    async ({ body, request }) => {
      try {
        // Try to get raw body if Elysia's parsing failed
        let rawBodyText: string | null = null
        try {
          rawBodyText = await request.clone().text()
        } catch {
          // Ignore if we can't read raw body
        }

        logger.info(
          {
            bodyType: typeof body,
            bodyKeys: body && typeof body === "object" ? Object.keys(body).length : 0,
            rawBodyLength: rawBodyText?.length,
            rawBodyPreview: rawBodyText?.substring(0, 200),
          },
          "📨 [UNIPILE WEBHOOKS] Received webhook request",
        )

        // Parse webhook body using same logic as /webhook
        let parsedBody: Record<string, unknown> | null = null

        // Strategy 1: Raw body text
        if (rawBodyText?.trim().startsWith("{")) {
          try {
            parsedBody = JSON.parse(rawBodyText) as Record<string, unknown>
            logger.info("[UNIPILE WEBHOOKS] ✅ Parsed from raw body text")
          } catch {
            // Continue to fallback
          }
        }

        // Strategy 2: Body is a string
        if (!parsedBody && typeof body === "string") {
          try {
            parsedBody = JSON.parse(body) as Record<string, unknown>
            logger.info("[UNIPILE WEBHOOKS] ✅ Parsed from string body")
          } catch {
            // Continue to fallback
          }
        }

        // Strategy 3: Body is already an object
        if (!parsedBody && body && typeof body === "object") {
          parsedBody = body as Record<string, unknown>
          logger.info("[UNIPILE WEBHOOKS] ✅ Using body as object")
        }

        if (!parsedBody) {
          logger.error("[UNIPILE WEBHOOKS] ❌ Could not parse webhook body")
          return { success: false }
        }

        const result = await unipileService.processUnipileWebhook(parsedBody)

        if (result.success) {
          logger.info("✅ [UNIPILE WEBHOOKS] Webhook processed successfully")
        } else {
          logger.warn("⚠️ [UNIPILE WEBHOOKS] Webhook processing failed")
        }

        return { success: result.success }
      } catch (error) {
        logger.error({ err: error }, "❌ [UNIPILE WEBHOOKS] Error handling webhook")
        // Return 200 to prevent Unipile from retrying
        return { success: false }
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Unipile Webhook (email_tracking)",
        description: "Receive and process Unipile email_tracking webhook events (opens, clicks)",
      },
    },
  )

  /**
   * GET /api/v1/unipile/account/:accountId/info
   * Get Unipile account info
   */
  .get(
    "/account/:accountId/info",
    async ({ params, set }) => {
      const { accountId } = params

      try {
        const accountInfo = await unipileService.getAccountInfo(accountId)

        if (!accountInfo) {
          set.status = 404
          return errorResponse("Unipile account not found", ResponseCode.NOT_FOUND)
        }

        return successResponse(accountInfo, "Account info retrieved successfully")
      } catch (error) {
        logger.error({ err: error, accountId }, "Failed to get Unipile account info")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to get account info",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Get Unipile Account Info",
        description: "Retrieve account information from Unipile",
      },
    },
  )

  /**
   * POST /api/v1/unipile/account/:accountId/sync
   * Manually sync account emails (for replied-emails feature)
   */
  .post(
    "/account/:accountId/sync",
    async ({ params, set }) => {
      const { accountId } = params

      try {
        // Get email account from DB
        const [emailAccount] = await db.query.userEmailAccounts.findMany({
          where: (accounts, { eq }) => eq(accounts.id, accountId),
          limit: 1,
        })

        if (!emailAccount) {
          set.status = 404
          return errorResponse("Email account not found", ResponseCode.NOT_FOUND)
        }

        if (emailAccount.provider !== "unipile") {
          set.status = 400
          return errorResponse("Account is not a Unipile account", ResponseCode.BAD_REQUEST)
        }

        const unipileAccountId = emailAccount.apiKey
        const lastSyncedAt = emailAccount.lastSyncAt?.toISOString()

        const result = await unipileService.syncAccountEmails(unipileAccountId, lastSyncedAt)

        return successResponse(
          {
            emailCount: result.newEmails,
            repliesDetected: result.repliesDetected,
            success: result.success,
          },
          `Synced ${result.newEmails} emails successfully`,
        )
      } catch (error) {
        logger.error({ err: error, accountId }, "Failed to sync Unipile emails")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to sync emails",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Sync Unipile Account Emails",
        description: "Manually trigger email synchronization for replied-emails feature",
      },
    },
  )

  /**
   * POST /api/v1/unipile/webhook
   * Receive webhook events from Unipile (mail_received)
   * Note: Unipile sends JSON but may use different Content-Type headers
   */
  .post(
    "/webhook",
    async ({ body, request }) => {
      try {
        // Try to get raw body if Elysia's parsing failed
        let rawBodyText: string | null = null
        try {
          // Clone request to read body (request body can only be read once)
          rawBodyText = await request.clone().text()
        } catch {
          // Ignore if we can't read raw body
        }

        logger.info(
          {
            bodyType: typeof body,
            bodyKeys: body && typeof body === "object" ? Object.keys(body).length : 0,
            rawBodyLength: rawBodyText?.length,
            rawBodyPreview: rawBodyText?.substring(0, 200),
          },
          "[Unipile Webhook] Received event",
        )

        // Unipile sends webhook data with custom field names
        // Default fields: account_id, email_id, date, from_attendee, subject, body, etc.
        interface UnipileWebhookBody {
          event?: string
          account_id?: string
          email_id?: string
          from_attendee?: { identifier?: string; display_name?: string }
          to_attendees?: Array<{ identifier?: string }>
          subject?: string
          body?: string
          body_plain?: string
          date?: string
          in_reply_to?: { message_id?: string; id?: string }
          message_id?: string // RFC 822 Message-ID of the inbound email
          tracking_id?: string // Unipile tracking ID (if this was sent via Unipile)
          role?: string
          origin?: string
          // Tracking event fields (for open/click events)
          ip?: string // Recipient's IP address
          user_agent?: string // Recipient's browser user agent
          url?: string // Clicked URL (for click events)
        }

        // Handle case where body might be incorrectly parsed
        // Unipile sends JSON but Elysia may parse it incorrectly depending on Content-Type
        // Priority: 1) Raw body text (most reliable), 2) String body, 3) Parsed object
        let webhookBody: UnipileWebhookBody | null = null

        // Strategy 1: Try raw body text first (most reliable)
        if (rawBodyText?.trim().startsWith("{")) {
          try {
            webhookBody = JSON.parse(rawBodyText) as UnipileWebhookBody
            logger.info("[Unipile Webhook] ✅ Parsed from raw body text")
          } catch (rawParseError) {
            logger.warn(
              { error: rawParseError instanceof Error ? rawParseError.message : rawParseError },
              "[Unipile Webhook] Failed to parse raw body, trying fallback methods",
            )
          }
        }

        // Strategy 2: Body is already a string
        if (!webhookBody && typeof body === "string") {
          try {
            webhookBody = JSON.parse(body) as UnipileWebhookBody
            logger.info("[Unipile Webhook] ✅ Parsed from string body")
          } catch (parseError) {
            logger.warn(
              { error: parseError instanceof Error ? parseError.message : parseError },
              "[Unipile Webhook] Failed to parse body string",
            )
          }
        }

        // Strategy 3: Body is object with JSON as key (form-urlencoded parsing issue)
        // Form-urlencoded splits JSON on & and = characters, creating multiple key-value pairs
        if (!webhookBody && body && typeof body === "object") {
          const keys = Object.keys(body)
          const bodyRecord = body as Record<string, string>

          logger.info(
            { keyCount: keys.length, firstKeyStart: keys[0]?.substring(0, 50) },
            "[Unipile Webhook] Attempting to reconstruct from object",
          )

          // Try to reconstruct original JSON from form-urlencoded parsed data
          // The original JSON was split on & and = characters
          if (keys.length >= 1) {
            try {
              // Reconstruct: key1=value1&key2=value2&... -> original string
              const parts: string[] = []
              for (const key of keys) {
                const value = bodyRecord[key]
                if (value !== undefined && value !== "") {
                  parts.push(`${key}=${value}`)
                } else {
                  parts.push(key)
                }
              }
              const reconstructed = parts.join("&")

              // Try to parse as JSON directly (if it's a complete JSON)
              if (reconstructed.startsWith("{")) {
                try {
                  webhookBody = JSON.parse(reconstructed) as UnipileWebhookBody
                  logger.info("[Unipile Webhook] ✅ Parsed from reconstructed string")
                } catch {
                  // If direct parse fails, the JSON might have been split on = or &
                  // These characters appear in JSON as part of URLs or encoded values
                  logger.info("[Unipile Webhook] Direct parse failed, trying decode")
                }
              }

              // If still no result, try URL decoding and parsing
              if (!webhookBody) {
                try {
                  const decoded = decodeURIComponent(reconstructed.replace(/\+/g, " "))
                  if (decoded.startsWith("{")) {
                    webhookBody = JSON.parse(decoded) as UnipileWebhookBody
                    logger.info("[Unipile Webhook] ✅ Parsed from decoded string")
                  }
                } catch {
                  logger.warn("[Unipile Webhook] URL decode parse failed")
                }
              }
            } catch (reconstructError) {
              logger.warn(
                {
                  error:
                    reconstructError instanceof Error ? reconstructError.message : reconstructError,
                },
                "[Unipile Webhook] Reconstruction failed",
              )
            }
          }

          // Check if body is already correctly parsed
          if (!webhookBody) {
            const bodyAsWebhook = body as UnipileWebhookBody
            if (bodyAsWebhook.event || bodyAsWebhook.email_id || bodyAsWebhook.role) {
              webhookBody = bodyAsWebhook
              logger.info("[Unipile Webhook] ✅ Body already correctly parsed")
            }
          }
        }

        // Final check
        if (!webhookBody) {
          logger.error(
            { bodyType: typeof body, rawBodyLength: rawBodyText?.length },
            "[Unipile Webhook] ❌ Could not parse webhook body",
          )
          return successResponse({ message: "Event received (parse error)" })
        }

        const eventType = webhookBody.event
        const trackingId = webhookBody.tracking_id
        const emailId = webhookBody.email_id

        logger.info(
          {
            event: eventType,
            trackingId,
            role: webhookBody.role,
            origin: webhookBody.origin,
            emailId,
            from: webhookBody.from_attendee?.identifier,
            subject: webhookBody.subject,
            inReplyTo: webhookBody.in_reply_to,
          },
          "[Unipile Webhook] Parsed webhook body",
        )

        // Handle open/click tracking events
        if (eventType === "mail_opened" || eventType === "email_opened") {
          // Find email by tracking_id (stored in sendgridMessageId as deprecated_id)
          const email = await db.query.emails.findFirst({
            where: (emails, { or, eq }) =>
              or(
                eq(emails.sendgridMessageId, trackingId || ""),
                eq(emails.sendgridMessageId, emailId || ""),
              ),
            columns: { id: true, status: true, openCount: true },
          })

          if (email) {
            const openedAt = new Date()
            const ip = webhookBody.ip as string | undefined
            const userAgent = webhookBody.user_agent as string | undefined

            // 봇 감지
            const possiblyBot = isAutomatedOpen({ ip, userAgent })

            // 이벤트 기록 (항상, 봇 여부와 관계없이)
            await db.insert(emailEvents).values({
              emailId: email.id,
              eventType: "open",
              timestamp: openedAt,
              ipAddress: ip,
              userAgent: userAgent,
              rawEventData: webhookBody as unknown as Record<string, unknown>,
              possiblyBot,
            })

            // 봇이 아닌 경우에만 상태/카운트 업데이트
            if (!possiblyBot) {
              await db
                .update(emails)
                .set({
                  status: "opened",
                  openedAt,
                  openCount: sql`${emails.openCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(emails.id, email.id))

              logger.info(
                { emailId: email.id, trackingId },
                "[Unipile Webhook] ✅ Email opened event processed",
              )
            } else {
              logger.info(
                { emailId: email.id, trackingId, ip, userAgent },
                "[Unipile Webhook] Email opened event skipped (bot detected)",
              )
            }
          } else {
            logger.warn({ trackingId, emailId }, "[Unipile Webhook] Email not found for open event")
          }

          return successResponse({ message: "Open event processed" })
        }

        if (eventType === "mail_link_clicked" || eventType === "email_clicked") {
          // Find email by tracking_id
          const email = await db.query.emails.findFirst({
            where: (emails, { or, eq }) =>
              or(
                eq(emails.sendgridMessageId, trackingId || ""),
                eq(emails.sendgridMessageId, emailId || ""),
              ),
            columns: { id: true, status: true, clickCount: true },
          })

          if (email) {
            const clickedAt = new Date()
            const ip = webhookBody.ip as string | undefined
            const userAgent = webhookBody.user_agent as string | undefined
            const clickedUrl = webhookBody.url as string | undefined

            // 봇 감지
            const possiblyBot = isAutomatedClick({ ip, userAgent })

            // 이벤트 기록 (항상, 봇 여부와 관계없이)
            await db.insert(emailEvents).values({
              emailId: email.id,
              eventType: "click",
              timestamp: clickedAt,
              url: clickedUrl || "",
              ipAddress: ip,
              userAgent: userAgent,
              rawEventData: webhookBody as unknown as Record<string, unknown>,
              possiblyBot,
            })

            // 봇이 아닌 경우에만 상태/카운트 업데이트
            if (!possiblyBot) {
              await db
                .update(emails)
                .set({
                  status: "clicked",
                  clickedAt,
                  clickCount: sql`${emails.clickCount} + 1`,
                  updatedAt: new Date(),
                })
                .where(eq(emails.id, email.id))

              logger.info(
                { emailId: email.id, trackingId },
                "[Unipile Webhook] ✅ Email clicked event processed",
              )
            } else {
              logger.info(
                { emailId: email.id, trackingId, ip, userAgent },
                "[Unipile Webhook] Email clicked event skipped (bot detected)",
              )
            }
          } else {
            logger.warn(
              { trackingId, emailId },
              "[Unipile Webhook] Email not found for click event",
            )
          }

          return successResponse({ message: "Click event processed" })
        }

        // For mail_received events, continue with reply detection logic
        const accountId = webhookBody.account_id
        const fromAttendee = webhookBody.from_attendee
        const subject = webhookBody.subject || ""
        const bodyContent = webhookBody.body || webhookBody.body_plain || ""
        const dateStr = webhookBody.date
        const inReplyTo = webhookBody.in_reply_to
        const role = webhookBody.role
        const origin = webhookBody.origin

        // Only process inbox emails from external sources (for mail_received)
        if (role !== "inbox" || origin !== "external") {
          logger.info(
            { role, origin, emailId, event: eventType },
            "[Unipile Webhook] Skipping non-inbox or internal email",
          )
          return successResponse({ message: "Event received (skipped non-inbox)" })
        }

        const from = fromAttendee?.identifier || ""
        const receivedAt = dateStr ? new Date(dateStr) : new Date()

        // Extract both message_id (RFC 822) and id (Unipile ID) from in_reply_to
        const inReplyToMessageId = inReplyTo?.message_id
        const inReplyToUnipileId = inReplyTo?.id

        logger.info(
          {
            accountId,
            emailId,
            from,
            subject,
            inReplyToMessageId,
            inReplyToUnipileId,
          },
          "[Unipile Webhook] Processing mail_received event",
        )

        // Check if this is a reply to one of our sent emails
        // Primary matching: RFC 822 Message-ID (in_reply_to.message_id → emails.messageId)
        // Fallback: Unipile ID (in_reply_to.id → emails.sendgridMessageId, may not work since we store tracking_id now)
        let originalEmail = null

        if (inReplyToMessageId) {
          // First try: Match by RFC 822 Message-ID (stored in emails.messageId field)
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
            logger.info(
              { originalEmailId: originalEmail.id, matchedBy: "messageId", inReplyToMessageId },
              "[Unipile Webhook] Found original email by RFC 822 Message-ID",
            )
          }
        }

        // Second try: Match by Unipile ID (tracking_id stored in sendgridMessageId)
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
            logger.info(
              { originalEmailId: originalEmail.id, matchedBy: "unipileId", inReplyToUnipileId },
              "[Unipile Webhook] Found original email by Unipile tracking ID",
            )
          }
        }

        if (originalEmail) {
          // Determine the best inReplyTo value to store
          const inReplyToValue = inReplyToMessageId || inReplyToUnipileId || emailId

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
              toEmail: originalEmail.fromEmail, // Reply is sent to original sender
              subject: subject,
              bodyText: bodyContent,
              status: "delivered",
              sentAt: receivedAt,
              deliveredAt: receivedAt,
              messageId: webhookBody.message_id || emailId, // RFC 822 Message-ID or Unipile email ID
              sendgridMessageId: emailId, // Store Unipile email ID for future reference
              inReplyTo: inReplyToValue,
              threadId: originalEmail.threadId || inReplyToValue,
              leadName: originalEmail.leadName,
              sequenceName: originalEmail.sequenceName,
            })
            .returning({ id: emails.id })

          if (!inboundEmail) {
            logger.error("[Unipile Webhook] Failed to save inbound email")
            return errorResponse("Failed to save inbound email", ResponseCode.INTERNAL_ERROR)
          }

          // 2. Update original email repliedAt
          await db
            .update(emails)
            .set({
              repliedAt: receivedAt,
              status: "replied",
              updatedAt: new Date(),
            })
            .where(eq(emails.id, originalEmail.id))

          // 3. Create email_reply record linking original and reply
          const [emailReply] = await db
            .insert(emailReplies)
            .values({
              workspaceId: originalEmail.workspaceId,
              originalEmailId: originalEmail.id,
              replyEmailId: inboundEmail.id, // Reference to emails table
              sentiment: null,
              isRead: false,
            })
            .returning()

          logger.info(
            {
              emailReplyId: emailReply?.id,
              originalEmailId: originalEmail.id,
              replyEmailId: inboundEmail.id,
              from,
              subject,
            },
            "[Unipile Webhook] Reply saved as inbound email",
          )

          // 4. 답장 알림 생성 (비동기)
          if (emailReply) {
            import("../services/email-reply-notification.service")
              .then(({ notifyEmailReply }) => {
                notifyEmailReply({
                  emailReplyId: emailReply.id,
                  originalEmailId: originalEmail.id,
                  replyEmailId: inboundEmail.id,
                  workspaceId: originalEmail.workspaceId,
                  isNewReply: true,
                }).catch((err) => {
                  logger.warn(
                    { err, emailReplyId: emailReply.id },
                    "[Unipile Webhook] Reply notification failed",
                  )
                })
              })
              .catch((err) => {
                logger.warn(
                  { err },
                  "[Unipile Webhook] Failed to import email-reply-notification.service",
                )
              })
          }

          // 5. AI classification (async, non-blocking)
          const classificationEnabled = process.env.AI_CLASSIFICATION_ENABLED !== "false"
          if (emailReply && classificationEnabled) {
            try {
              const { reclassifyEmailReply } = await import("../services/email-replies.service")
              reclassifyEmailReply(emailReply.id).catch((error) => {
                logger.warn(
                  { err: error, emailReplyId: emailReply.id },
                  "⚠️ [Unipile Webhook] AI classification failed",
                )
              })
              logger.debug(
                { emailReplyId: emailReply.id },
                "[Unipile Webhook] AI classification triggered",
              )
            } catch {
              // AI classification is optional
            }
          }

          return successResponse({
            message: "Reply processed successfully",
            replyDetected: true,
            inboundEmailId: inboundEmail.id,
          })
        }

        // Not a reply to our emails, just log it
        logger.info(
          { emailId, from, subject },
          "[Unipile Webhook] Inbox email received (not a reply to our emails)",
        )

        return successResponse({ message: "Event received", replyDetected: false })
      } catch (error) {
        logger.error({ err: error, body }, "[Unipile Webhook] Error processing webhook event")

        // Return 200 to prevent Unipile from retrying
        // (we don't want to block their webhook delivery)
        return successResponse({
          message: "Event received with errors",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Unipile Webhook Endpoint",
        description:
          "Receives real-time webhook events from Unipile for mail_received events (replied-emails feature)",
      },
    },
  )
