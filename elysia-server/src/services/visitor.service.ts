/**
 * Visitor Tracking Service
 *
 * Tracks visitor IPs, enriches with ipapi.is data, and stores in database.
 * Used for landing page visitor analytics.
 */

import { and, desc, eq, gte, sql } from "drizzle-orm"
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
 * List visitor sessions for a workspace with pagination
 */
export async function listVisitorSessions(
  workspaceId: string,
  limit = 50,
  offset = 0,
): Promise<{ sessions: VisitorSession[]; total: number }> {
  const [sessions, countResult] = await Promise.all([
    db
      .select()
      .from(visitorSessions)
      .where(eq(visitorSessions.workspaceId, workspaceId))
      .orderBy(desc(visitorSessions.lastVisitAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(visitorSessions)
      .where(eq(visitorSessions.workspaceId, workspaceId)),
  ])

  return {
    sessions,
    total: countResult[0]?.count ?? 0,
  }
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
