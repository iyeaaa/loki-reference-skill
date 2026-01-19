/**
 * Visitor Tracking API Routes
 *
 * Public endpoints for landing page visitor analytics.
 * Integrates with ipapi.is for IP intelligence.
 *
 * Security:
 * - visitorFirewall plugin for bot/DDoS protection
 * - Rate limiting (30 req/min normal, 5 req/min for suspicious)
 * - Payload validation
 */

import { Elysia, t } from "elysia"
import { visitorFirewall } from "../plugins/visitor-firewall.plugin"
import {
  addExcludedCompany,
  bulkAddExcludedCompanies,
  bulkRemoveExcludedCompanies,
  deleteOldSessions,
  getCompaniesForExclusion,
  getExcludedCompanies,
  getVisitorCountries,
  getVisitorSession,
  getVisitorStats,
  listVisitorSessions,
  removeExcludedCompany,
  trackVisitor,
  type VisitorFilters,
} from "../services/visitor.service"
import { syncVisitorsToLeads } from "../services/visitor-to-lead-sync.service"
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
 * Architecture: rinda.ai → Cloudflare → AWS EC2 (Nginx + Docker)
 *
 * Priority (for Cloudflare environment):
 * 1. CF-Connecting-IP: Cloudflare sets this to the actual client IP
 * 2. X-Forwarded-For: First IP in the chain (client IP)
 * 3. X-Real-IP: Nginx sets this to $remote_addr (which is Cloudflare's IP when behind CF)
 */
function getClientIp(request: Request): IpExtractionResult {
  const headers = request.headers

  // 1. CF-Connecting-IP (Cloudflare - 실제 클라이언트 IP, 가장 신뢰할 수 있음)
  const cfIp = headers.get("cf-connecting-ip")
  if (cfIp) {
    return { ip: cfIp.trim(), source: "cf-connecting-ip" }
  }

  // 2. X-Forwarded-For (첫번째 IP = 원본 클라이언트 IP)
  const xForwardedFor = headers.get("x-forwarded-for")
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim()
    if (firstIp) {
      return { ip: firstIp, source: "x-forwarded-for" }
    }
  }

  // 3. X-Real-IP (Nginx - Cloudflare 뒤에서는 Cloudflare IP일 수 있음)
  const xRealIp = headers.get("x-real-ip")
  if (xRealIp) {
    return { ip: xRealIp.trim(), source: "x-real-ip" }
  }

  return { ip: null, source: null }
}

/**
 * Public visitor tracking routes (no auth required)
 * Designed for landing page integration
 *
 * Security: visitorFirewall applied for bot/DDoS protection
 */
export const visitorPublicRoutes = new Elysia({ prefix: "/api/v1/visitors" })
  // Apply firewall protection (bot detection, rate limiting, payload validation)
  .use(visitorFirewall)
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
        landingPage: landingPage || undefined,
      })

      if (!result.success) {
        set.status = 500
        return errorResponse(result.error || "Failed to track visitor", ResponseCode.INTERNAL_ERROR)
      }

      // ISP traffic was skipped (Snitcher-style filtering)
      if (result.skipped) {
        return successResponse(
          {
            tracked: false,
            skipped: true,
            skipReason: result.skipReason,
            ipSource,
          },
          result.skipReason || "ISP traffic skipped",
        )
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
          t.Nullable(
            t.String({
              description:
                "Visitor IP address (optional - auto-extracted from CF-Connecting-IP, X-Forwarded-For, or X-Real-IP headers)",
            }),
          ),
        ),
        userAgent: t.Optional(t.Nullable(t.String({ description: "Browser user agent" }))),
        referrer: t.Optional(t.Nullable(t.String({ description: "Referrer URL" }))),
        landingPage: t.Optional(t.Nullable(t.String({ description: "Landing page URL" }))),
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

      // Parse filters from query params
      const filters: VisitorFilters = {}
      if (query.search) filters.search = query.search
      if (query.countries) filters.countries = query.countries.split(",")
      if (query.hasCompany !== undefined) filters.hasCompany = query.hasCompany === "true"
      if (query.securityFlags) {
        filters.securityFlags = query.securityFlags.split(",") as VisitorFilters["securityFlags"]
      }
      if (query.dateFrom) filters.dateFrom = query.dateFrom
      if (query.dateTo) filters.dateTo = query.dateTo
      if (query.sortBy) filters.sortBy = query.sortBy as VisitorFilters["sortBy"]
      if (query.sortOrder) filters.sortOrder = query.sortOrder as VisitorFilters["sortOrder"]
      // Noise exclusion filters (default: true = exclude on backend if not provided)
      if (query.excludeIsp !== undefined) {
        filters.excludeIsp = query.excludeIsp === "true"
      }
      if (query.excludeHosting !== undefined) {
        filters.excludeHosting = query.excludeHosting === "true"
      }
      if (query.excludeDatacenter !== undefined) {
        filters.excludeDatacenter = query.excludeDatacenter === "true"
      }
      if (query.excludeSuspicious !== undefined) {
        filters.excludeSuspicious = query.excludeSuspicious === "true"
      }

      const result = await listVisitorSessions(workspaceId, limit, offset, filters)

      return successResponse(
        {
          sessions: result.sessions,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          limit,
          offset,
          page: Math.floor(offset / limit) + 1,
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
        search: t.Optional(t.String({ description: "Search by IP, company name, domain, city" })),
        countries: t.Optional(t.String({ description: "Comma-separated country codes" })),
        hasCompany: t.Optional(
          t.String({ description: "Filter by company identified (true/false)" }),
        ),
        securityFlags: t.Optional(
          t.String({
            description: "Comma-separated: vpn,proxy,tor,datacenter,mobile,crawler,abuser",
          }),
        ),
        dateFrom: t.Optional(t.String({ description: "ISO date string for start date" })),
        dateTo: t.Optional(t.String({ description: "ISO date string for end date" })),
        sortBy: t.Optional(
          t.String({
            description: "Sort by: lastVisitAt, firstVisitAt, visitCount, country, companyName",
          }),
        ),
        sortOrder: t.Optional(t.String({ description: "Sort order: asc, desc" })),
        excludeIsp: t.Optional(
          t.String({
            description: "Exclude ISP traffic (true/false, default: true)",
          }),
        ),
        excludeHosting: t.Optional(
          t.String({
            description: "Exclude hosting/cloud providers (true/false, default: true)",
          }),
        ),
        excludeDatacenter: t.Optional(
          t.String({
            description: "Exclude datacenter IPs (true/false, default: true)",
          }),
        ),
        excludeSuspicious: t.Optional(
          t.String({
            description: "Exclude proxy/abuser/tor traffic (true/false, default: true)",
          }),
        ),
      }),
      detail: {
        tags: ["visitors"],
        summary: "List visitor sessions",
        description:
          "List all visitor sessions for a workspace with pagination, search, and filters.",
      },
    },
  )

  /**
   * Get unique countries for filter dropdown
   * GET /api/v1/workspaces/:id/visitors/countries
   */
  .get(
    "/countries",
    async ({ params }) => {
      const { id: workspaceId } = params
      const countries = await getVisitorCountries(workspaceId)
      return successResponse(countries, "Countries retrieved")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Get visitor countries",
        description: "Get list of unique countries from visitor sessions for filter dropdown.",
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

  // ============================================================================
  // Excluded Companies Management
  // ============================================================================

  /**
   * Get excluded companies list
   * GET /api/v1/workspaces/:id/visitors/excluded-companies
   */
  .get(
    "/excluded-companies",
    async ({ params }) => {
      const { id: workspaceId } = params
      const excludedCompanies = await getExcludedCompanies(workspaceId)
      return successResponse(excludedCompanies, "Excluded companies retrieved")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Get excluded companies",
        description: "Get list of companies excluded from visitor analytics for this workspace.",
      },
    },
  )

  /**
   * Add company to exclusion list
   * POST /api/v1/workspaces/:id/visitors/excluded-companies
   */
  .post(
    "/excluded-companies",
    async ({ params, body, set }) => {
      const { id: workspaceId } = params
      const { companyDomain, companyName, reason, excludedBy } = body

      try {
        const excludedCompany = await addExcludedCompany({
          workspaceId,
          companyDomain,
          companyName,
          reason,
          excludedBy,
        })

        return successResponse(excludedCompany, "Company added to exclusion list")
      } catch (error) {
        // Handle unique constraint violation
        if (
          error instanceof Error &&
          error.message.includes("visitor_excluded_companies_workspace_domain_unique")
        ) {
          set.status = 409
          return errorResponse("Company domain already excluded", ResponseCode.CONFLICT)
        }
        throw error
      }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        companyDomain: t.String({ description: "Company domain to exclude" }),
        companyName: t.Optional(t.String({ description: "Company name for display" })),
        reason: t.Optional(t.String({ description: "Reason for exclusion" })),
        excludedBy: t.String({ format: "uuid", description: "User ID who excluded this company" }),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Add company to exclusion list",
        description: "Add a company domain to the exclusion list for visitor analytics.",
      },
    },
  )

  /**
   * Remove company from exclusion list
   * DELETE /api/v1/workspaces/:id/visitors/excluded-companies/:excludedId
   */
  .delete(
    "/excluded-companies/:excludedId",
    async ({ params, set }) => {
      const { id: workspaceId, excludedId } = params

      const removed = await removeExcludedCompany(workspaceId, excludedId)

      if (!removed) {
        set.status = 404
        return errorResponse("Excluded company not found", ResponseCode.NOT_FOUND)
      }

      return successResponse({ id: excludedId }, "Company removed from exclusion list")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        excludedId: t.String({ format: "uuid" }),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Remove company from exclusion list",
        description: "Remove a company from the exclusion list for visitor analytics.",
      },
    },
  )

  /**
   * Get companies available for exclusion (for dropdown selection)
   * GET /api/v1/workspaces/:id/visitors/companies-for-exclusion
   */
  .get(
    "/companies-for-exclusion",
    async ({ params, query }) => {
      const { id: workspaceId } = params
      const search = query.search || undefined
      const limit = query.limit ? Math.min(parseInt(query.limit, 10), 200) : 100

      const companies = await getCompaniesForExclusion(workspaceId, { search, limit })
      return successResponse(companies, "Companies for exclusion retrieved")
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      query: t.Object({
        search: t.Optional(t.String({ description: "Search by company name or domain" })),
        limit: t.Optional(t.String({ description: "Max results (default: 100, max: 200)" })),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Get companies available for exclusion",
        description:
          "Get list of companies from visitor data for exclusion dropdown. Returns companies with visitor count and current exclusion status.",
      },
    },
  )

  /**
   * Bulk update excluded companies (add and remove in one request)
   * POST /api/v1/workspaces/:id/visitors/excluded-companies/bulk
   */
  .post(
    "/excluded-companies/bulk",
    async ({ params, body }) => {
      const { id: workspaceId } = params
      const { toAdd, toRemove, excludedBy, reason } = body

      let added: { domain: string; name?: string }[] = []
      let removedCount = 0

      // Add new exclusions
      if (toAdd && toAdd.length > 0) {
        const addedResults = await bulkAddExcludedCompanies({
          workspaceId,
          excludedBy,
          companyDomains: toAdd,
          reason,
        })
        added = addedResults.map((r) => ({
          domain: r.companyDomain,
          name: r.companyName || undefined,
        }))
      }

      // Remove exclusions
      if (toRemove && toRemove.length > 0) {
        removedCount = await bulkRemoveExcludedCompanies(workspaceId, toRemove)
      }

      return successResponse(
        {
          added: added.length,
          removed: removedCount,
          addedDomains: added.map((a) => a.domain),
          removedDomains: toRemove || [],
        },
        `Updated exclusion list: ${added.length} added, ${removedCount} removed`,
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        toAdd: t.Optional(
          t.Array(
            t.Object({
              domain: t.String({ description: "Company domain to exclude" }),
              name: t.Optional(t.String({ description: "Company name for display" })),
            }),
            { description: "Companies to add to exclusion list" },
          ),
        ),
        toRemove: t.Optional(
          t.Array(t.String(), { description: "Company domains to remove from exclusion list" }),
        ),
        excludedBy: t.String({ format: "uuid", description: "User ID performing the action" }),
        reason: t.Optional(t.String({ description: "Reason for exclusion" })),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Bulk update excluded companies",
        description:
          "Add and/or remove multiple companies from exclusion list in one request. Useful for the exclusion settings modal.",
      },
    },
  )

  // ============================================================================
  // Visitor to Customer Group Sync
  // ============================================================================

  /**
   * Sync filtered visitors to customer group as leads
   * POST /api/v1/workspaces/:id/visitors/sync-to-leads
   *
   * Creates leads from filtered visitors and adds them to a customer group.
   * Applies all noise filters (ISP, hosting, datacenter, suspicious) and excluded companies.
   */
  .post(
    "/sync-to-leads",
    async ({ params, body, set }) => {
      const { id: workspaceId } = params
      const { userId, days } = body

      logger.info({ workspaceId, userId, days }, "[VisitorSync] Sync request received")

      const result = await syncVisitorsToLeads({
        workspaceId,
        userId,
        days,
      })

      if (!result.success) {
        set.status = 500
        return errorResponse(result.error || "Failed to sync visitors", ResponseCode.INTERNAL_ERROR)
      }

      return successResponse(
        {
          groupId: result.groupId,
          groupName: result.groupName,
          leadsCreated: result.leadsCreated,
          leadsAddedToGroup: result.leadsAddedToGroup,
          skipped: result.skipped,
          totalFilteredVisitors: result.totalFilteredVisitors,
        },
        result.totalFilteredVisitors === 0
          ? "No filtered visitors found to sync"
          : `Synced ${result.leadsAddedToGroup} visitors to customer group "${result.groupName}"`,
      )
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        userId: t.String({ format: "uuid", description: "User ID performing the sync" }),
        days: t.Optional(
          t.Number({
            description: "Number of days to look back for visitors (default: 30)",
            minimum: 1,
            maximum: 365,
          }),
        ),
      }),
      detail: {
        tags: ["visitors"],
        summary: "Sync filtered visitors to customer group",
        description:
          "Creates leads from filtered visitors (noise filtered + excluded companies) and adds them to a customer group. Group is auto-created if it doesn't exist.",
      },
    },
  )
