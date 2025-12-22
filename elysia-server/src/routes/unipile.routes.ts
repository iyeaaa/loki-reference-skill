import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { config } from "../config"
import { db } from "../db/index"
import { emails } from "../db/schema/emails"
import {
  createEmailAccount,
  deleteEmailAccount,
  getEmailAccountByWorkspaceAndUserAny,
} from "../services/email-account.service"
import * as unipileService from "../services/unipile.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
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
    async ({ set }) => {
      try {
        // Initialize Unipile hosted auth session (use GOOGLE for Gmail)
        const result = await unipileService.getUnipileAuthUrl("GOOGLE")

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
        workspaceId = query.workspaceId

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

        // Get account info from Unipile
        const accountInfo = await unipileService.getAccountInfo(accountId)

        if (!accountInfo) {
          set.status = 404
          return errorResponse("Unipile account not found", ResponseCode.NOT_FOUND)
        }

        logger.info(
          {
            userId,
            workspaceId,
            accountId,
            email: accountInfo.email,
            provider: accountInfo.provider,
          },
          "Unipile account info retrieved successfully",
        )

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

        // Register webhook for all accounts (only once, not per account)
        // Check if webhook already exists to avoid duplicates
        try {
          const webhooksResult = await unipileService.listWebhooks()
          const webhookUrl = `${config.appUrl}/api/v1/unipile/webhook`

          const existingWebhook = webhooksResult.webhooks?.find(
            (wh) => wh.request_url === webhookUrl && wh.events?.includes("mail_received"),
          )

          if (!existingWebhook) {
            // Register webhook for ALL accounts (account_ids omitted)
            const webhookResult = await unipileService.registerEmailWebhook(webhookUrl)

            if (webhookResult.success) {
              logger.info(
                { webhookId: webhookResult.webhookId, webhookUrl },
                "✅ Unipile webhook registered successfully for all accounts",
              )
            } else {
              logger.warn(
                { error: webhookResult.error, webhookUrl },
                "⚠️ Failed to register Unipile webhook (non-critical)",
              )
            }
          } else {
            logger.info(
              { webhookId: existingWebhook.id, webhookUrl },
              "✅ Unipile webhook already exists, skipping registration",
            )
          }
        } catch (webhookError) {
          logger.warn(
            { err: webhookError },
            "⚠️ Error checking/registering Unipile webhook (non-critical)",
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
   * Receive Unipile webhook events
   */
  .post(
    "/webhooks",
    async ({ body, request }) => {
      try {
        logger.info(
          {
            headers: Object.fromEntries(request.headers),
            bodyPreview: JSON.stringify(body).substring(0, 200),
          },
          "📨 [UNIPILE WEBHOOK] Received webhook request",
        )

        const result = await unipileService.processUnipileWebhook(body)

        if (result.success) {
          logger.info("✅ [UNIPILE WEBHOOK] Webhook processed successfully")
        } else {
          logger.warn("⚠️ [UNIPILE WEBHOOK] Webhook processing failed")
        }

        return { success: result.success }
      } catch (error) {
        logger.error({ err: error }, "❌ [UNIPILE WEBHOOK] Error handling webhook")
        // Return 200 to prevent Unipile from retrying
        return { success: false }
      }
    },
    {
      detail: {
        tags: ["Unipile"],
        summary: "Unipile Webhook",
        description: "Receive and process Unipile webhook events (opens, clicks, replies, etc.)",
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
   */
  .post(
    "/webhook",
    async ({ body }) => {
      try {
        logger.info({ event: body }, "[Unipile Webhook] Received event")

        // Unipile sends webhook data with custom field names
        // Default fields: account_id, email_id, date, from_attendee, subject, body, etc.
        interface UnipileWebhookBody {
          account_id?: string
          email_id?: string
          from_attendee?: { identifier?: string }
          subject?: string
          body?: string
          body_plain?: string
          date?: string
          in_reply_to?: { message_id?: string }
          role?: string
          origin?: string
        }
        const webhookBody = body as UnipileWebhookBody
        const accountId = webhookBody.account_id
        const emailId = webhookBody.email_id
        const fromAttendee = webhookBody.from_attendee
        const subject = webhookBody.subject || ""
        const dateStr = webhookBody.date
        const inReplyTo = webhookBody.in_reply_to
        const role = webhookBody.role
        const origin = webhookBody.origin

        // Only process inbox emails from external sources
        if (role !== "inbox" || origin !== "external") {
          logger.info(
            { role, origin, emailId },
            "[Unipile Webhook] Skipping non-inbox or internal email",
          )
          return successResponse({ message: "Event received (skipped non-inbox)" })
        }

        const from = fromAttendee?.identifier || ""
        const receivedAt = dateStr ? new Date(dateStr) : new Date()

        logger.info(
          {
            accountId,
            emailId,
            from,
            subject,
            inReplyTo: inReplyTo?.message_id,
          },
          "[Unipile Webhook] Processing mail_received event",
        )

        // Check if this is a reply to one of our sent emails
        const inReplyToMessageId = inReplyTo?.message_id

        if (inReplyToMessageId) {
          // Find original email by message ID (using sendgridMessageId and messageId fields)
          const originalEmail = await db.query.emails.findFirst({
            where: (emails, { or, like }) =>
              or(
                like(emails.sendgridMessageId, `%${inReplyToMessageId}%`),
                like(emails.messageId, `%${inReplyToMessageId}%`),
              ),
            columns: { id: true, workspaceId: true },
          })

          if (originalEmail) {
            // Update original email repliedAt
            await db
              .update(emails)
              .set({
                repliedAt: receivedAt,
                status: "replied",
                updatedAt: new Date(),
              })
              .where(eq(emails.id, originalEmail.id))

            logger.info(
              {
                originalEmailId: originalEmail.id,
                from,
                subject,
              },
              "[Unipile Webhook] Reply detected and email status updated",
            )

            return successResponse({
              message: "Reply processed successfully",
              replyDetected: true,
            })
          }
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
