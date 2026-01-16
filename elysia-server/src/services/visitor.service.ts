/**
 * Visitor Tracking Service
 *
 * Tracks visitor IPs, enriches with ipapi.is data, and stores in database.
 * Used for landing page visitor analytics.
 */

import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import type { NewVisitorSession, VisitorSession } from "../db/schema/visitor-sessions"
import { visitorSessions } from "../db/schema/visitor-sessions"
import logger from "../utils/logger"
import { lookupIp } from "./ipapi.service"

// ============================================================================
// Types
// ============================================================================

export interface TrackVisitorInput {
  workspaceId: string
  ipAddress: string
  userAgent?: string
  referrer?: string
  landingPage?: string
}

export interface TrackVisitorResult {
  success: boolean
  isNewVisitor: boolean
  visitor?: VisitorSession
  error?: string
  /** ISP traffic is skipped and not stored (Snitcher-style filtering) */
  skipped?: boolean
  skipReason?: string
}

export interface VisitorStats {
  totalVisitors: number
  uniqueCountries: number
  companyVisitors: number
  vpnVisitors: number
  topCountries: { country: string; count: number }[]
  topCompanies: { company: string; count: number }[]
  recentVisitors: VisitorSession[]
}

export interface VisitorFilters {
  search?: string // IP, company name, domain search
  countries?: string[] // Filter by country codes
  hasCompany?: boolean // Only visitors with company identified
  securityFlags?: ("vpn" | "proxy" | "tor" | "datacenter" | "mobile" | "crawler" | "abuser")[]
  dateFrom?: string // ISO date string
  dateTo?: string // ISO date string
  sortBy?: "lastVisitAt" | "firstVisitAt" | "visitCount" | "country" | "companyName"
  sortOrder?: "asc" | "desc"
}

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Track a visitor by IP address
 * - If IP exists for workspace within 24h, updates visit count
 * - Otherwise creates new session with ipapi.is enrichment
 */
export async function trackVisitor(input: TrackVisitorInput): Promise<TrackVisitorResult> {
  const { workspaceId, ipAddress, userAgent, referrer, landingPage } = input

  try {
    // Check for existing session within last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const existingSession = await db
      .select()
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.workspaceId, workspaceId),
          eq(visitorSessions.ipAddress, ipAddress),
          gte(visitorSessions.lastVisitAt, twentyFourHoursAgo),
        ),
      )
      .limit(1)

    const existingRecord = existingSession[0]
    if (existingRecord) {
      // Update existing session
      const [updated] = await db
        .update(visitorSessions)
        .set({
          visitCount: sql`${visitorSessions.visitCount} + 1`,
          lastVisitAt: new Date(),
          userAgent: userAgent || existingRecord.userAgent,
          updatedAt: new Date(),
        })
        .where(eq(visitorSessions.id, existingRecord.id))
        .returning()

      if (updated) {
        logger.info(
          { workspaceId, ipAddress, visitCount: updated.visitCount },
          "[Visitor] Updated existing session",
        )

        return {
          success: true,
          isNewVisitor: false,
          visitor: updated,
        }
      }
    }

    // New visitor - enrich with ipapi.is
    const apiKey = config.ipapi.apiKey || undefined
    const ipapiResult = await lookupIp(ipAddress, apiKey)

    // Skip ISP traffic (Snitcher-style filtering)
    // ISP traffic cannot be attributed to specific companies
    if (ipapiResult.success && ipapiResult.data) {
      const data = ipapiResult.data
      const isIsp = data.asn?.type === "isp" || data.company?.type === "isp"

      if (isIsp) {
        const ispName = data.company?.name || data.asn?.org || "Unknown ISP"
        logger.info(
          { workspaceId, ipAddress, ispName, asnType: data.asn?.type },
          "[Visitor] Skipped ISP traffic (cannot identify company)",
        )

        return {
          success: true,
          isNewVisitor: false,
          skipped: true,
          skipReason: `ISP traffic from ${ispName} - cannot identify specific company`,
        }
      }
    }

    // Prepare session data
    const sessionData: NewVisitorSession = {
      workspaceId,
      ipAddress,
      userAgent,
      referrer,
      landingPage,
    }

    // Extract data from ipapi.is response
    if (ipapiResult.success && ipapiResult.data) {
      const data = ipapiResult.data
      sessionData.ipapiData = data as unknown as Record<string, unknown>

      // Location
      if (data.location) {
        sessionData.country = data.location.country
        sessionData.countryCode = data.location.country_code
        sessionData.city = data.location.city
        sessionData.region = data.location.state
        sessionData.latitude = data.location.latitude
        sessionData.longitude = data.location.longitude
        sessionData.timezone = data.location.timezone
        sessionData.continent = data.location.continent
      }

      // Company
      if (data.company) {
        sessionData.companyName = data.company.name
        sessionData.companyDomain = data.company.domain
        sessionData.companyType = data.company.type
      }

      // ASN
      if (data.asn) {
        sessionData.asnNumber = data.asn.asn
        sessionData.asnOrg = data.asn.org
        sessionData.asnType = data.asn.type
      }

      // Security flags
      sessionData.isVpn = data.is_vpn
      sessionData.isProxy = data.is_proxy
      sessionData.isTor = data.is_tor
      sessionData.isDatacenter = data.is_datacenter
      sessionData.isCrawler = data.is_crawler
      sessionData.isMobile = data.is_mobile
      sessionData.isAbuser = data.is_abuser
    }

    // Insert new session
    const [newSession] = await db.insert(visitorSessions).values(sessionData).returning()

    logger.info(
      {
        workspaceId,
        ipAddress,
        country: sessionData.country,
        company: sessionData.companyName,
      },
      "[Visitor] Created new session",
    )

    return {
      success: true,
      isNewVisitor: true,
      visitor: newSession,
    }
  } catch (error) {
    logger.error({ workspaceId, ipAddress, error }, "[Visitor] Failed to track visitor")
    return {
      success: false,
      isNewVisitor: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get visitor session by ID
 */
export async function getVisitorSession(id: string): Promise<VisitorSession | null> {
  const result = await db.select().from(visitorSessions).where(eq(visitorSessions.id, id)).limit(1)

  return result[0] || null
}

/**
 * List visitor sessions for a workspace with pagination and filters
 */
export async function listVisitorSessions(
  workspaceId: string,
  limit = 50,
  offset = 0,
  filters?: VisitorFilters,
): Promise<{ sessions: VisitorSession[]; total: number }> {
  // Build where conditions
  const conditions = [eq(visitorSessions.workspaceId, workspaceId)]

  if (filters) {
    // Search filter (IP, company name, domain)
    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      const searchCondition = or(
        ilike(visitorSessions.ipAddress, searchPattern),
        ilike(visitorSessions.companyName, searchPattern),
        ilike(visitorSessions.companyDomain, searchPattern),
        ilike(visitorSessions.city, searchPattern),
      )
      if (searchCondition) {
        conditions.push(searchCondition)
      }
    }

    // Country filter
    if (filters.countries && filters.countries.length > 0) {
      conditions.push(inArray(visitorSessions.countryCode, filters.countries))
    }

    // Has company filter
    if (filters.hasCompany === true) {
      conditions.push(sql`${visitorSessions.companyName} IS NOT NULL`)
    } else if (filters.hasCompany === false) {
      conditions.push(sql`${visitorSessions.companyName} IS NULL`)
    }

    // Security flags filter
    if (filters.securityFlags && filters.securityFlags.length > 0) {
      const flagConditions = filters.securityFlags.map((flag) => {
        switch (flag) {
          case "vpn":
            return eq(visitorSessions.isVpn, true)
          case "proxy":
            return eq(visitorSessions.isProxy, true)
          case "tor":
            return eq(visitorSessions.isTor, true)
          case "datacenter":
            return eq(visitorSessions.isDatacenter, true)
          case "mobile":
            return eq(visitorSessions.isMobile, true)
          case "crawler":
            return eq(visitorSessions.isCrawler, true)
          case "abuser":
            return eq(visitorSessions.isAbuser, true)
          default:
            return eq(visitorSessions.isVpn, true) // fallback, should never reach
        }
      })
      const flagCondition = or(...flagConditions)
      if (flagCondition) {
        conditions.push(flagCondition)
      }
    }

    // Date range filter
    if (filters.dateFrom) {
      conditions.push(gte(visitorSessions.firstVisitAt, new Date(filters.dateFrom)))
    }
    if (filters.dateTo) {
      conditions.push(lte(visitorSessions.firstVisitAt, new Date(filters.dateTo)))
    }
  }

  // Build order by
  const sortBy = filters?.sortBy || "lastVisitAt"
  const sortOrder = filters?.sortOrder || "desc"
  const orderByColumn = {
    lastVisitAt: visitorSessions.lastVisitAt,
    firstVisitAt: visitorSessions.firstVisitAt,
    visitCount: visitorSessions.visitCount,
    country: visitorSessions.country,
    companyName: visitorSessions.companyName,
  }[sortBy]
  const orderByDirection = sortOrder === "asc" ? asc : desc

  const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0]

  const [sessions, countResult] = await Promise.all([
    db
      .select()
      .from(visitorSessions)
      .where(whereClause)
      .orderBy(orderByDirection(orderByColumn))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(visitorSessions).where(whereClause),
  ])

  return {
    sessions,
    total: countResult[0]?.count ?? 0,
  }
}

/**
 * Get unique countries for filter dropdown
 */
export async function getVisitorCountries(
  workspaceId: string,
): Promise<{ countryCode: string; country: string; count: number }[]> {
  const result = await db
    .select({
      countryCode: visitorSessions.countryCode,
      country: visitorSessions.country,
      count: sql<number>`count(*)::int`,
    })
    .from(visitorSessions)
    .where(
      and(
        eq(visitorSessions.workspaceId, workspaceId),
        sql`${visitorSessions.countryCode} IS NOT NULL`,
      ),
    )
    .groupBy(visitorSessions.countryCode, visitorSessions.country)
    .orderBy(sql`count(*) desc`)

  return result.map((r) => ({
    countryCode: r.countryCode || "",
    country: r.country || "Unknown",
    count: r.count,
  }))
}

/**
 * Get visitor statistics for a workspace
 * Optimized: 4 count queries → 1 query using FILTER
 */
export async function getVisitorStats(workspaceId: string, days = 30): Promise<VisitorStats> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Run optimized queries in parallel (7 → 4 queries)
  const [aggregatedStats, topCountriesResult, topCompaniesResult, recentVisitors] =
    await Promise.all([
      // Single query for all counts using FILTER (PostgreSQL)
      db
        .select({
          totalVisitors: sql<number>`count(*)::int`,
          uniqueCountries: sql<number>`count(distinct ${visitorSessions.country})::int`,
          companyVisitors: sql<number>`count(*) FILTER (WHERE ${visitorSessions.companyName} IS NOT NULL)::int`,
          vpnVisitors: sql<number>`count(*) FILTER (WHERE ${visitorSessions.isVpn} = true)::int`,
        })
        .from(visitorSessions)
        .where(
          and(
            eq(visitorSessions.workspaceId, workspaceId),
            gte(visitorSessions.firstVisitAt, startDate),
          ),
        ),

      // Top countries
      db
        .select({
          country: visitorSessions.country,
          count: sql<number>`count(*)::int`,
        })
        .from(visitorSessions)
        .where(
          and(
            eq(visitorSessions.workspaceId, workspaceId),
            gte(visitorSessions.firstVisitAt, startDate),
            sql`${visitorSessions.country} is not null`,
          ),
        )
        .groupBy(visitorSessions.country)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      // Top companies
      db
        .select({
          company: visitorSessions.companyName,
          count: sql<number>`count(*)::int`,
        })
        .from(visitorSessions)
        .where(
          and(
            eq(visitorSessions.workspaceId, workspaceId),
            gte(visitorSessions.firstVisitAt, startDate),
            sql`${visitorSessions.companyName} is not null`,
          ),
        )
        .groupBy(visitorSessions.companyName)
        .orderBy(sql`count(*) desc`)
        .limit(10),

      // Recent visitors
      db
        .select()
        .from(visitorSessions)
        .where(eq(visitorSessions.workspaceId, workspaceId))
        .orderBy(desc(visitorSessions.lastVisitAt))
        .limit(10),
    ])

  const stats = aggregatedStats[0]

  return {
    totalVisitors: stats?.totalVisitors ?? 0,
    uniqueCountries: stats?.uniqueCountries ?? 0,
    companyVisitors: stats?.companyVisitors ?? 0,
    vpnVisitors: stats?.vpnVisitors ?? 0,
    topCountries: topCountriesResult.map((r) => ({
      country: r.country || "Unknown",
      count: r.count,
    })),
    topCompanies: topCompaniesResult.map((r) => ({
      company: r.company || "Unknown",
      count: r.count,
    })),
    recentVisitors,
  }
}

/**
 * Delete old visitor sessions (for cleanup/GDPR)
 */
export async function deleteOldSessions(workspaceId: string, daysOld = 90): Promise<number> {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000)

  const result = await db
    .delete(visitorSessions)
    .where(
      and(
        eq(visitorSessions.workspaceId, workspaceId),
        sql`${visitorSessions.lastVisitAt} < ${cutoffDate}`,
      ),
    )
    .returning({ id: visitorSessions.id })

  logger.info(
    { workspaceId, deletedCount: result.length, daysOld },
    "[Visitor] Deleted old sessions",
  )

  return result.length
}
