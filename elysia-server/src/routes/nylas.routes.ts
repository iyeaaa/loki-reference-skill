import { Elysia, t } from "elysia"
import { createEmailAccount } from "../services/email-account.service"
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
    personal: { dailyLimit: 100, monthlyLimit: 3000 },
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
      try {
        const { code, workspaceId, state } = query

        // Get user from authorization header
        const userId = await getUserIdFromToken(headers.authorization)
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

        // Get user to get displayName (username)
        const user = await getUser(userId)
        const displayName = user?.username || grant.email.split("@")[0]

        // Determine account type and limits based on email domain
        const emailDomain = grant.email.split("@")[1]?.toLowerCase()
        const isPersonalAccount = emailDomain === "gmail.com"
        const limitsMode = SAFE_LIMITS ? "safe" : "aggressive"
        const accountType = isPersonalAccount ? "personal" : "workspace"
        const limits = EMAIL_LIMITS[limitsMode][accountType]

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
        logger.error({ err: error }, "Failed to process Nylas callback")
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
   * DELETE /api/v1/nylas/grant/:grantId
   * Delete/disconnect a grant
   */
  .delete(
    "/grant/:grantId",
    async ({ params, set }) => {
      try {
        const { grantId } = params
        const success = await deleteGrant(grantId)

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
      params: grantParamsSchema,
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

  /**
   * POST /api/v1/nylas/webhook
   * Receive Nylas webhook events (opens, clicks, replies)
   */
  .post(
    "/webhook",
    async ({ body, set }) => {
      try {
        const payload = body as NylasWebhookPayload

        logger.info(
          {
            webhookId: payload.id,
            eventType: payload.type,
            time: payload.time,
          },
          "Received Nylas webhook",
        )

        const result = processNylasWebhook(payload)

        if (!result.success) {
          set.status = 500
          return { success: false, message: "Failed to process webhook" }
        }

        // Always return 200 to acknowledge receipt
        return { success: true }
      } catch (error) {
        logger.error({ err: error }, "Error handling Nylas webhook")
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
