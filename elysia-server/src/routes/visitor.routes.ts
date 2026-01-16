/**
 * Visitor Tracking API Routes
 *
 * Public endpoints for landing page visitor analytics.
 * Integrates with ipapi.is for IP intelligence.
 */

import { Elysia, t } from "elysia"
import {
  deleteOldSessions,
  getVisitorSession,
  getVisitorStats,
  listVisitorSessions,
  trackVisitor,
} from "../services/visitor.service"
import { errorResponse, ResponseCode, successResponse } from "../types/response.types"
import logger from "../utils/logger"

/**
 * IP extraction result with source information
 */
type IpExtractionResult = {
  ip: string | null
  source: "x-real-ip" | "x-forwarded-for" | "cf-connecting-ip" | "body" | null
}

/**
 * Extract client IP from request headers
 *
 * Architecture: rinda.ai (Vercel) → app.rinda.ai (AWS EC2 + Nginx + Docker)
 * Nginx sets X-Real-IP from $remote_addr (actual visitor IP)
 *
 * Priority: X-Real-IP > X-Forwarded-For > CF-Connecting-IP
 */
function getClientIp(request: Request): IpExtractionResult {
  const headers = request.headers

  // 1. X-Real-IP (Nginx - 최적, $remote_addr에서 직접 설정됨)
  const xRealIp = headers.get("x-real-ip")
  if (xRealIp) {
    return { ip: xRealIp.trim(), source: "x-real-ip" }
  }

  // 2. X-Forwarded-For (fallback, 첫번째 IP 사용)
  const xForwardedFor = headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim()
    if (firstIp) {
      return { ip: firstIp, source: "x-forwarded-for" }
    }
  }

  // 3. CF-Connecting-IP (Cloudflare 사용시)
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp) {
    return { ip: cfIp.trim(), source: "cf-connecting-ip" }
  }

  return { ip: null, source: null }
}

/**
 * Public visitor tracking routes (no auth required)
 * Designed for landing page integration
 */
export const visitorPublicRoutes = new Elysia({ prefix: "/api/v1/visitors" })
  /**
   * Track a visitor
   * POST /api/v1/visitors/track
   *
   * Lightweight endpoint for landing pages.
   * - Enriches IP with ipapi.is
   * - Stores/updates visitor session
   */
  .post(
    "/track",
    async ({ body, set, request }) => {
      const { workspaceId, userAgent, referrer, landingPage } = body

      // Extract IP: body > headers > null
      let ipAddress: string | null = null
      let ipSource: IpExtractionResult["source"] = null

      if (body.ipAddress) {
        ipAddress = body.ipAddress
        ipSource = "body"
      } else {
        const extracted = getClientIp(request)
        ipAddress = extracted.ip
        ipSource = extracted.source
      }

      // Validate workspaceId format (UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(workspaceId)) {
        set.status = 400
        return errorResponse("Invalid workspace ID format", ResponseCode.BAD_REQUEST)
      }

      // Check if IP was resolved
      if (!ipAddress) {
        set.status = 400
        return errorResponse(
          "Could not determine client IP. Provide ipAddress in body or ensure proxy headers are set.",
          ResponseCode.BAD_REQUEST,
        )
      }

      // Validate IP format (IPv4 and IPv6)
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?!$)|$)){4}$/
      const ipv6Regex = /^([a-fA-F0-9:]+)$/
      if (!ipv4Regex.test(ipAddress) && !ipv6Regex.test(ipAddress)) {
        set.status = 400
        return errorResponse("Invalid IP address format", ResponseCode.BAD_REQUEST)
      }

      logger.info({ workspaceId, ipAddress, ipSource }, "[Visitor] Track request")

      const result = await trackVisitor({
        workspaceId,
        ipAddress,
        userAgent: userAgent || request.headers.get("user-agent") || undefined,
        referrer: referrer || request.headers.get("referer") || undefined,
        landingPage,
      })

      if (!result.success) {
        set.status = 500
        return errorResponse(result.error || "Failed to track visitor", ResponseCode.INTERNAL_ERROR)
      }

      // Return response with visitor details
      return successResponse(
        {
          tracked: true,
          isNewVisitor: result.isNewVisitor,
          visitorId: result.visitor?.id,
          ipSource, // 어느 헤더에서 IP를 추출했는지
          // Visitor details (for test page and analytics)
          visitor: result.visitor
            ? {
                ipAddress: result.visitor.ipAddress,
                country: result.visitor.country,
                countryCode: result.visitor.countryCode,
                city: result.visitor.city,
                region: result.visitor.region,
                companyName: result.visitor.companyName,
                companyDomain: result.visitor.companyDomain,
                companyType: result.visitor.companyType,
                asnOrg: result.visitor.asnOrg,
                asnType: result.visitor.asnType,
                isVpn: result.visitor.isVpn,
                isProxy: result.visitor.isProxy,
                isTor: result.visitor.isTor,
                isDatacenter: result.visitor.isDatacenter,
                isMobile: result.visitor.isMobile,
                visitCount: result.visitor.visitCount,
                firstVisitAt: result.visitor.firstVisitAt,
                lastVisitAt: result.visitor.lastVisitAt,
              }
            : null,
        },
        result.isNewVisitor ? "New visitor tracked" : "Visit recorded",
      )
    },
    {
      body: t.Object({
        workspaceId: t.String({ description: "Workspace UUID" }),
        ipAddress: t.Optional(
          t.String({
            description:
              "Visitor IP address (optional - auto-extracted from CF-Connecting-IP, X-Forwarded-For, or X-Real-IP headers)",
          }),
        ),
        userAgent: t.Optional(t.String({ description: "Browser user agent" })),
        referrer: t.Optional(t.String({ description: "Referrer URL" })),
        landingPage: t.Optional(t.String({ description: "Landing page URL" })),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Track a visitor",
        description:
          "Track a visitor by IP address. IP is auto-extracted from request headers (CF-Connecting-IP > X-Forwarded-For > X-Real-IP) if not provided. Enriches with ipapi.is data and stores in database. Designed for landing page integration.",
      },
    },
  )

/**
 * Protected visitor management routes (requires workspace access)
 * For admin dashboard use
 * Note: Uses :id instead of :workspaceId to match existing workspace routes pattern
 */
export const visitorProtectedRoutes = new Elysia({
  prefix: "/api/v1/workspaces/:id/visitors",
})
  /**
   * Get visitor session details
   * GET /api/v1/workspaces/:id/visitors/:visitorId
   */
  .get(
    "/:visitorId",
    async ({ params, set }) => {
      const { id: workspaceId, visitorId } = params

      const visitor = await getVisitorSession(visitorId)

      if (!visitor) {
        set.status = 404
        return errorResponse("Visitor session not found", ResponseCode.NOT_FOUND)
      }

      // Verify workspace ownership
      if (visitor.workspaceId !== workspaceId) {
        set.status = 403
        return errorResponse("Access denied", ResponseCode.FORBIDDEN)
      }

      return successResponse(visitor, "Visitor session retrieved")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        visitorId: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Get visitor session details",
        description: "Get detailed information about a specific visitor session.",
      },
    },
  )

  /**
   * List visitor sessions
   * GET /api/v1/workspaces/:id/visitors
   */
  .get(
    "/",
    async ({ params, query }) => {
      const { id: workspaceId } = params
      const limit = Math.min(parseInt(query.limit || "50", 10), 100)
      const offset = parseInt(query.offset || "0", 10)

      const result = await listVisitorSessions(workspaceId, limit, offset)

      return successResponse(
        {
          sessions: result.sessions,
          total: result.total,
          limit,
          offset,
        },
        "Visitor sessions retrieved",
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      detail: {
        tags: ["visitors"],
        summary: "List visitor sessions",
        description: "List all visitor sessions for a workspace with pagination.",
      },
    },
  )

  /**
   * Get visitor statistics
   * GET /api/v1/workspaces/:id/visitors/stats
   */
  .get(
    "/stats",
    async ({ params, query }) => {
      const { id: workspaceId } = params
      const days = Math.min(parseInt(query.days || "30", 10), 365)

      const stats = await getVisitorStats(workspaceId, days)

      return successResponse(stats, "Visitor statistics retrieved")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        days: t.Optional(
          t.String({ description: "Number of days to analyze (default: 30, max: 365)" }),
        ),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Get visitor statistics",
        description:
          "Get aggregated visitor statistics including country distribution, company detection, and security flags.",
      },
    },
  )

  /**
   * Delete old visitor sessions (GDPR cleanup)
   * DELETE /api/v1/workspaces/:id/visitors/cleanup
   */
  .delete(
    "/cleanup",
    async ({ params, query }) => {
      const { id: workspaceId } = params
      const daysOld = Math.max(parseInt(query.daysOld || "90", 10), 30) // Minimum 30 days

      const deletedCount = await deleteOldSessions(workspaceId, daysOld)

      return successResponse(
        { deletedCount, daysOld },
        `Deleted ${deletedCount} sessions older than ${daysOld} days`,
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        daysOld: t.Optional(
          t.String({ description: "Delete sessions older than N days (default: 90, min: 30)" }),
        ),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Delete old visitor sessions",
        description: "Delete visitor sessions older than specified days for GDPR compliance.",
      },
    },
  )
