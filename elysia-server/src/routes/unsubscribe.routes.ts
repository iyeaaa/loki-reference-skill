import { eq } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db"
import { leads } from "../db/schema/leads"
import { sequenceEnrollments, sequenceStepExecutions } from "../db/schema/sequences"
import { decodeUnsubscribeToken } from "../utils/gmail-compliance.util"
import logger from "../utils/logger"

/**
 * Unsubscribe Routes
 *
 * Public endpoints for email unsubscribe functionality (Gmail RFC 8058 compliance)
 * These endpoints do NOT require authentication as they are accessed via email links
 */
export const unsubscribeRoutes = new Elysia({ prefix: "/api/v1/unsubscribe" })
  /**
   * One-click unsubscribe (RFC 8058)
   * POST request with List-Unsubscribe=One-Click in body
   *
   * This endpoint is called by email clients when user clicks unsubscribe
   */
  .post(
    "",
    async ({ body, query }) => {
      const token = query.token || (body as Record<string, string>)?.token

      if (!token) {
        logger.warn({}, "[UNSUBSCRIBE] Missing token in request")
        return {
          success: false,
          message: "Missing unsubscribe token",
        }
      }

      const decoded = decodeUnsubscribeToken(token)

      if (!decoded) {
        logger.warn({ token }, "[UNSUBSCRIBE] Invalid or expired token")
        return {
          success: false,
          message: "Invalid or expired unsubscribe token",
        }
      }

      logger.info(
        {
          workspaceId: decoded.workspaceId,
          leadId: decoded.leadId,
          sequenceId: decoded.sequenceId,
        },
        "[UNSUBSCRIBE] Processing one-click unsubscribe",
      )

      try {
        // Stop all active sequence enrollments for this lead
        if (decoded.leadId) {
          await db
            .update(sequenceEnrollments)
            .set({
              status: "unsubscribed",
              stoppedAt: new Date(),
            })
            .where(eq(sequenceEnrollments.leadId, decoded.leadId))

          // Skip pending step executions
          const enrollments = await db
            .select({ id: sequenceEnrollments.id })
            .from(sequenceEnrollments)
            .where(eq(sequenceEnrollments.leadId, decoded.leadId))

          for (const enrollment of enrollments) {
            await db
              .update(sequenceStepExecutions)
              .set({
                status: "skipped",
                errorMessage: "User unsubscribed from emails",
              })
              .where(eq(sequenceStepExecutions.enrollmentId, enrollment.id))
          }

          // Update lead status to mark as unsubscribed
          await db
            .update(leads)
            .set({
              status: "unsubscribed",
              updatedAt: new Date(),
            })
            .where(eq(leads.id, decoded.leadId))

          logger.info(
            { leadId: decoded.leadId, workspaceId: decoded.workspaceId },
            "[UNSUBSCRIBE] Lead unsubscribed successfully",
          )
        }

        return {
          success: true,
          message: "You have been successfully unsubscribed from our email list.",
        }
      } catch (error) {
        logger.error({ error, decoded }, "[UNSUBSCRIBE] Failed to process unsubscribe")
        return {
          success: false,
          message: "Failed to process unsubscribe request",
        }
      }
    },
    {
      query: t.Object({
        token: t.Optional(t.String()),
      }),
      body: t.Optional(
        t.Object({
          token: t.Optional(t.String()),
          "List-Unsubscribe": t.Optional(t.String()),
        }),
      ),
      detail: {
        tags: ["unsubscribe"],
        summary: "One-click unsubscribe (RFC 8058)",
        description:
          "Handles one-click unsubscribe requests from email clients. This endpoint is compliant with RFC 8058 for Gmail bulk sender requirements.",
      },
    },
  )

  /**
   * GET request for browser-based unsubscribe
   * Shows unsubscribe confirmation page
   */
  .get(
    "",
    async ({ query, set }) => {
      const { token } = query

      if (!token) {
        set.status = 400
        return generateUnsubscribePage({
          success: false,
          title: "Invalid Link",
          message: "The unsubscribe link is invalid. Please contact support if you need assistance.",
        })
      }

      const decoded = decodeUnsubscribeToken(token)

      if (!decoded) {
        set.status = 400
        return generateUnsubscribePage({
          success: false,
          title: "Link Expired",
          message:
            "This unsubscribe link has expired. Please use a more recent email to unsubscribe, or contact support.",
        })
      }

      logger.info(
        {
          workspaceId: decoded.workspaceId,
          leadId: decoded.leadId,
        },
        "[UNSUBSCRIBE] Processing browser unsubscribe",
      )

      try {
        // Process unsubscribe
        if (decoded.leadId) {
          await db
            .update(sequenceEnrollments)
            .set({
              status: "unsubscribed",
              stoppedAt: new Date(),
            })
            .where(eq(sequenceEnrollments.leadId, decoded.leadId))

          const enrollments = await db
            .select({ id: sequenceEnrollments.id })
            .from(sequenceEnrollments)
            .where(eq(sequenceEnrollments.leadId, decoded.leadId))

          for (const enrollment of enrollments) {
            await db
              .update(sequenceStepExecutions)
              .set({
                status: "skipped",
                errorMessage: "User unsubscribed from emails",
              })
              .where(eq(sequenceStepExecutions.enrollmentId, enrollment.id))
          }

          await db
            .update(leads)
            .set({
              status: "unsubscribed",
              updatedAt: new Date(),
            })
            .where(eq(leads.id, decoded.leadId))
        }

        set.headers["Content-Type"] = "text/html; charset=utf-8"
        return generateUnsubscribePage({
          success: true,
          title: "Unsubscribed Successfully",
          message:
            "You have been successfully removed from our email list. You will no longer receive marketing emails from us.",
        })
      } catch (error) {
        logger.error({ error, decoded }, "[UNSUBSCRIBE] Failed to process browser unsubscribe")
        set.status = 500
        return generateUnsubscribePage({
          success: false,
          title: "Error",
          message: "An error occurred while processing your unsubscribe request. Please try again later.",
        })
      }
    },
    {
      query: t.Object({
        token: t.String(),
      }),
      detail: {
        tags: ["unsubscribe"],
        summary: "Browser unsubscribe page",
        description:
          "Shows an unsubscribe confirmation page when user clicks the unsubscribe link in an email.",
      },
    },
  )

/**
 * Generate HTML page for unsubscribe response
 */
function generateUnsubscribePage(params: {
  success: boolean
  title: string
  message: string
}): string {
  const { success, title, message } = params
  const iconColor = success ? "#4CAF50" : "#f44336"
  const iconPath = success
    ? "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" // checkmark
    : "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" // X

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Grinda AI</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: ${iconColor}15;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px;
    }
    .icon svg {
      width: 48px;
      height: 48px;
      fill: ${iconColor};
    }
    h1 {
      color: #1a1a1a;
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 16px;
    }
    p {
      color: #666;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 32px;
    }
    .footer {
      color: #999;
      font-size: 14px;
    }
    .footer a {
      color: #667eea;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 24 24">
        <path d="${iconPath}"/>
      </svg>
    </div>
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} <a href="https://grinda.ai" target="_blank">Grinda AI</a>. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`
}
