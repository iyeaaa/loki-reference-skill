import { and, asc, eq, lt } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { emails } from "../db/schema/emails"
import {
  createEmailAccount,
  deleteEmailAccount,
  getEmailAccount,
  getEmailAccountByWorkspaceAndUserAny,
} from "../services/email-account.service"
import {
  createGoogleConnector,
  deleteGrant,
  exchangeCodeForGrant,
  getGrantInfo,
  getNylasAuthUrl,
  type NylasWebhookPayload,
  processNylasWebhook,
} from "../services/nylas.service"
import { getUser } from "../services/user.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import logger from "../utils/logger"

// Safe limits mode - when true, uses conservative sending limits
const SAFE_LIMITS = true

// Email sending limits based on account type and safe mode
const EMAIL_LIMITS = {
  safe: {
    // personal: { dailyLimit: 100, monthlyLimit: 3000 },
    personal: { dailyLimit: 60, monthlyLimit: 1800 }, // early stages limits
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

// Schema for callback request (GET query params from OAuth redirect)
const callbackQuerySchema = t.Object({
  code: t.String(),
  workspaceId: t.Optional(t.String()),
  state: t.Optional(t.String()),
})

// Schema for grant operations
const grantParamsSchema = t.Object({
  grantId: t.String(),
})
// Schema for db email account
const emailAccountSchema = t.Object({
  accountId: t.String(),
})

export const nylasRoutes = new Elysia({ prefix: "/api/v1/nylas" })
  /**
   * GET /api/v1/nylas/auth
   * Get Nylas OAuth authorization URL for Google
   */
  .get(
    "/auth",
    async ({ query, set }) => {
      try {
        const { state } = query
        const result = await getNylasAuthUrl(state)

        return successResponse(result, "Auth URL generated successfully")
      } catch (error) {
        logger.error({ err: error }, "Failed to generate Nylas auth URL")
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
        tags: ["Nylas"],
        summary: "Get Nylas OAuth URL",
        description: "Generate OAuth authorization URL for Google email integration via Nylas",
      },
    },
  )

  /**
   * GET /api/v1/nylas/callback
   * OAuth redirect handler - exchange authorization code for Nylas grant
   */
  .get(
    "/callback",
    async ({ query, headers, set }) => {
      // Declare variables outside try block for error handler access
      let userId: string | null = null
      let workspaceId: string | undefined

      try {
        const { code, state } = query
        workspaceId = query.workspaceId

        // Get user from authorization header
        userId = await getUserIdFromToken(headers.authorization)
        logger.info({ state, userId, workspaceId }, "Processing Nylas OAuth callback")

        // Validate userId is not null
        if (!userId) {
          set.status = 401
          return errorResponse("Authentication required", ResponseCode.UNAUTHORIZED)
        }

        // Validate workspaceId is provided
        if (!workspaceId) {
          set.status = 400
          return errorResponse("Workspace ID is required", ResponseCode.BAD_REQUEST)
        }

        const grant = await exchangeCodeForGrant(code)

        logger.info(
          {
            userId,
            workspaceId,
            grantId: grant.grantId,
            email: grant.email,
            provider: grant.provider,
          },
          "Nylas grant received successfully",
        )

        // Check for existing email account (might be TRIAL_PREVIEW from onboarding)
        const existingAccount = await getEmailAccountByWorkspaceAndUserAny(workspaceId, userId)

        // Store existing TRIAL_PREVIEW account info for later update/deletion
        let trialPreviewAccountId: string | null = null

        if (existingAccount) {
          if (existingAccount.apiKey === "TRIAL_PREVIEW") {
            // Mark for update after creating new account (to handle FK constraints)
            trialPreviewAccountId = existingAccount.id
            logger.info(
              { existingAccountId: existingAccount.id },
              "Found TRIAL_PREVIEW account - will migrate after creating real account",
            )
          } else {
            // User already has a real email account connected
            // Just log and add the new one (supports multiple accounts)
            logger.info(
              { existingAccountId: existingAccount.id },
              "User already has a real email account, adding new one",
            )
          }
        }

        // Get user to get displayName (username)
        const user = await getUser(userId)
        const displayName = user?.username || grant.email.split("@")[0]

        // Determine account type and limits based on email domain
        const emailDomain = grant.email.split("@")[1]?.toLowerCase()
        const isPersonalAccount = emailDomain === "gmail.com"
        const limitsMode = SAFE_LIMITS ? "safe" : "aggressive"
        const accountType = isPersonalAccount ? "personal" : "workspace"
        // const limits = EMAIL_LIMITS[limitsMode][accountType]
        // Keep it low limits at early stages
        const limits = EMAIL_LIMITS[limitsMode].personal

        logger.info(
          {
            emailDomain,
            isPersonalAccount,
            limitsMode,
            accountType,
            limits,
          },
          "Determined email account limits",
        )

        // Create email account with Nylas grantId as apiKey
        const emailAccount = await createEmailAccount({
          userId,
          workspaceId,
          emailAddress: grant.email,
          displayName,
          apiKey: grant.grantId, // Store Nylas grantId in apiKey field
          isVerified: true,
          isDefault: true,
          status: "active",
          dailyLimit: limits.dailyLimit,
          monthlyLimit: limits.monthlyLimit,
        })

        if (!emailAccount) {
          set.status = 500
          return errorResponse("Failed to create email account", ResponseCode.INTERNAL_ERROR)
        }

        logger.info(
          {
            emailAccountId: emailAccount.id,
            emailAddress: emailAccount.emailAddress,
          },
          "Email account created successfully",
        )

        // If there was a TRIAL_PREVIEW account, update all related emails and delete it
        if (trialPreviewAccountId) {
          try {
            // Update all emails to use the new account
            await db
              .update(emails)
              .set({ userEmailAccountId: emailAccount.id })
              .where(eq(emails.userEmailAccountId, trialPreviewAccountId))

            // Now safe to delete the TRIAL_PREVIEW account
            await deleteEmailAccount(trialPreviewAccountId)

            logger.info(
              { oldAccountId: trialPreviewAccountId, newAccountId: emailAccount.id },
              "Migrated emails from TRIAL_PREVIEW and deleted old account",
            )
          } catch (migrationError) {
            logger.error(
              { err: migrationError, trialPreviewAccountId },
              "Failed to migrate/delete TRIAL_PREVIEW account (non-fatal)",
            )
            // Non-fatal - the new account is created successfully
          }
        }

        // Reschedule any emails that were scheduled in the past
        // This happens when trial users connect their email account after preview emails were generated
        try {
          const now = new Date()

          // Get emails with past scheduledAt for this workspace
          const pastEmails = await db
            .select({
              id: emails.id,
              scheduledAt: emails.scheduledAt,
            })
            .from(emails)
            .where(
              and(
                eq(emails.workspaceId, workspaceId),
                eq(emails.status, "draft"),
                lt(emails.scheduledAt, now),
              ),
            )
            .orderBy(asc(emails.scheduledAt))

          if (pastEmails.length > 0) {
            logger.info(
              { count: pastEmails.length, workspaceId },
              "Rescheduling emails with past scheduledAt",
            )

            // Reschedule each email 1 minute apart, starting from now + 1 minute
            const baseTime = new Date(now.getTime() + 60 * 1000) // now + 1 minute

            for (let i = 0; i < pastEmails.length; i++) {
              const email = pastEmails[i]
              if (!email) continue
              const newScheduledAt = new Date(baseTime.getTime() + i * 60 * 1000) // +1 minute per email

              await db
                .update(emails)
                .set({
                  scheduledAt: newScheduledAt,
                  userEmailAccountId: emailAccount.id, // Update to use new real account
                })
                .where(eq(emails.id, email.id))
            }

            logger.info(
              { count: pastEmails.length, firstScheduledAt: baseTime },
              "Successfully rescheduled emails",
            )
          }
        } catch (reschedulingError) {
          logger.error({ err: reschedulingError }, "Failed to reschedule emails (non-fatal)")
          // Non-fatal - continue with success response
        }

        return successResponse(
          {
            grantId: grant.grantId,
            email: grant.email,
            provider: grant.provider,
            emailAccountId: emailAccount.id,
          },
          "Email account connected successfully",
        )
      } catch (error) {
        logger.error(
          {
            err: error,
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            userId,
            workspaceId,
          },
          "Failed to process Nylas callback",
        )
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to connect email account",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      query: callbackQuerySchema,
      detail: {
        tags: ["Nylas"],
        summary: "Nylas OAuth Callback",
        description: "OAuth redirect handler - exchange authorization code for Nylas grant",
      },
    },
  )

  /**
   * GET /api/v1/nylas/grant/:grantId
   * Get grant information
   */
  .get(
    "/grant/:grantId",
    async ({ params, set }) => {
      try {
        const { grantId } = params
        const grant = await getGrantInfo(grantId)

        if (!grant) {
          set.status = 404
          return errorResponse("Grant not found", ResponseCode.NOT_FOUND)
        }

        return successResponse(grant, "Grant info retrieved successfully")
      } catch (error) {
        logger.error({ err: error }, "Failed to get grant info")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to get grant info",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      params: grantParamsSchema,
      detail: {
        tags: ["Nylas"],
        summary: "Get Grant Info",
        description: "Get information about a connected email account",
      },
    },
  )

  /**
   * DELETE /api/v1/nylas/grant/:accountId
   * Delete/disconnect a grant
   */
  .delete(
    "/grant/:accountId",
    async ({ params, set }) => {
      try {
        const { accountId } = params

        const emailAccount = await getEmailAccount(accountId)

        if (!emailAccount || !emailAccount.apiKey) {
          set.status = 404
          return errorResponse("Grant not found", ResponseCode.NOT_FOUND)
        }
        const success = await deleteGrant(emailAccount.apiKey)

        if (!success) {
          set.status = 500
          return errorResponse("Failed to disconnect email account", ResponseCode.INTERNAL_ERROR)
        }

        return successResponse({ deleted: true }, "Email account disconnected successfully")
      } catch (error) {
        logger.error({ err: error }, "Failed to delete grant")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to disconnect email account",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      params: emailAccountSchema,
      detail: {
        tags: ["Nylas"],
        summary: "Disconnect Email Account",
        description: "Disconnect/delete a connected email account",
      },
    },
  )

  /**
   * POST /api/v1/nylas/setup-connector
   * One-time setup to create Google connector (admin only)
   */
  .post(
    "/setup-connector",
    async ({ set }) => {
      try {
        await createGoogleConnector()
        return successResponse({ created: true }, "Google connector created successfully")
      } catch (error) {
        logger.error({ err: error }, "Failed to create Google connector")
        set.status = 500
        return errorResponse(
          error instanceof Error ? error.message : "Failed to create connector",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      detail: {
        tags: ["Nylas"],
        summary: "Setup Google Connector",
        description: "One-time setup to create Google OAuth connector in Nylas",
      },
    },
  )

  // GET: Webhook verification (Nylas sends this first)
  // Route: /api/v1/nylas/webhooks (prefix + /webhooks)
  .get("/webhooks", ({ query, request }) => {
    const requestInfo = {
      challenge: query.challenge,
      queryParams: query,
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      timestamp: new Date().toISOString(),
    }

    logger.info(requestInfo, "🔔 [NYLAS WEBHOOK] GET request received (challenge verification)")

    if (query.challenge) {
      logger.info(
        {
          challenge: query.challenge,
          challengeLength: query.challenge.length,
          url: request.url,
        },
        "✅ [NYLAS WEBHOOK] Challenge received, returning challenge string",
      )
      // Return ONLY the challenge string, nothing else
      return new Response(query.challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      })
    }

    logger.warn(
      {
        url: request.url,
        queryParams: query,
        headers: Object.fromEntries(request.headers.entries()),
      },
      "⚠️ [NYLAS WEBHOOK] GET request without challenge parameter",
    )
    return "No challenge provided"
  })

  /**
   * POST /api/v1/nylas/webhooks
   * Receive Nylas webhook events (opens, clicks, replies)
   */
  .post(
    "/webhooks",
    async ({ body, set, request }) => {
      // Log raw request details first
      logger.info(
        {
          url: request.url,
          method: request.method,
          headers: Object.fromEntries(request.headers.entries()),
          contentType: request.headers.get("content-type"),
        },
        "📨 [NYLAS WEBHOOK] POST request received - raw request info",
      )

      // Log raw body for debugging
      logger.info(
        {
          bodyType: typeof body,
          bodyKeys: body && typeof body === "object" ? Object.keys(body) : [],
          rawBody: JSON.stringify(body, null, 2),
        },
        "📨 [NYLAS WEBHOOK] Raw body received",
      )

      try {
        const payload = body as NylasWebhookPayload

        logger.info(
          {
            webhookId: payload.id,
            eventType: payload.type,
            time: payload.time,
            specversion: payload.specversion,
            source: payload.source,
            applicationId: payload.data?.application_id,
            grantId: payload.data?.grant_id,
            objectData: payload.data?.object,
          },
          "📨 [NYLAS WEBHOOK] Parsed webhook payload - FULL DETAILS",
        )

        // Check for inbound-related events
        const inboundEventTypes = [
          "message.created",
          "message.received",
          "thread.replied",
          "message.send_success",
          "message.send_failed",
          "message.opened",
          "message.link_clicked",
          "message.bounce_detected",
        ]

        if (inboundEventTypes.includes(payload.type)) {
          logger.info(
            {
              eventType: payload.type,
              webhookId: payload.id,
              grantId: payload.data?.grant_id,
              objectData: JSON.stringify(payload.data?.object, null, 2),
            },
            `🔔 [NYLAS WEBHOOK] IMPORTANT EVENT: ${payload.type}`,
          )
        }

        const result = await processNylasWebhook(payload)

        logger.info(
          {
            webhookId: payload.id,
            eventType: payload.type,
            processResult: result,
          },
          result.success
            ? "✅ [NYLAS WEBHOOK] Webhook processed successfully"
            : "❌ [NYLAS WEBHOOK] Webhook processing failed",
        )

        if (!result.success) {
          set.status = 500
          return { success: false, message: "Failed to process webhook" }
        }

        // Always return 200 to acknowledge receipt
        return { success: true }
      } catch (error) {
        logger.error(
          {
            err: error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            rawBody: JSON.stringify(body, null, 2),
          },
          "❌ [NYLAS WEBHOOK] Error handling Nylas webhook",
        )
        // Still return 200 to prevent Nylas from retrying
        return { success: false, error: "Internal error" }
      }
    },
    {
      detail: {
        tags: ["Nylas"],
        summary: "Nylas Webhook",
        description: "Receive webhook events for email tracking (opens, clicks, thread replies)",
      },
    },
  )
