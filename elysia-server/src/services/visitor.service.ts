/**
 * Visitor Tracking Service
 *
 * Tracks visitor IPs, enriches with ipapi.is data, and stores in database.
 * Used for landing page visitor analytics.
 *
 * B2B Intelligence Features:
 * - Visitor type classification (isp, hosting, business, education, government, residential)
 * - Lead scoring based on company/organization data
 * - Full ipapi.is field extraction
 */

import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"
import { config } from "../config"
import { db } from "../db/index"
import type { NewVisitorSession, VisitorSession, VisitorType } from "../db/schema/visitor-sessions"
import { visitorSessions } from "../db/schema/visitor-sessions"
import logger from "../utils/logger"
import type { IpapiData } from "./ipapi.service"
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
  // B2B Intelligence stats
  b2bLeads: number
  avgLeadScore: number
  visitorTypeDistribution: { type: VisitorType; count: number }[]
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
  sortBy?: "lastVisitAt" | "firstVisitAt" | "visitCount" | "country" | "companyName" | "leadScore"
  sortOrder?: "asc" | "desc"
  // B2B filters
  visitorTypes?: VisitorType[]
  isB2bLead?: boolean
  minLeadScore?: number
  // ISP filter (default: true = exclude ISP traffic from list/stats)
  excludeIsp?: boolean
}

// ============================================================================
// Constants
// ============================================================================

/**
 * ISP exclusion condition for queries
 * ISP traffic is saved but excluded from list/stats (Snitcher-style filtering)
 * Condition: visitorType != 'isp'
 */
const ISP_EXCLUSION_CONDITION = sql`(${visitorSessions.visitorType} IS NULL OR ${visitorSessions.visitorType} != 'isp')`

// ============================================================================
// B2B Intelligence Functions
// ============================================================================

/**
 * Classify visitor type based on ipapi.is data
 *
 * Priority:
 * 1. company.type (most specific)
 * 2. asn.type (fallback)
 * 3. datacenter detection
 *
 * Type mappings from ipapi.is:
 * - "isp" → isp (residential ISP like KT, SKT)
 * - "hosting" → hosting (cloud/hosting like AWS, NAVER Cloud)
 * - "business" → business (actual business)
 * - "education" → education
 * - "government" → government
 * - "residential" → residential
 */
function classifyVisitorType(data: IpapiData): VisitorType {
  // Check company type first (most specific)
  const companyType = data.company?.type?.toLowerCase()
  if (companyType) {
    if (companyType === "isp") return "isp"
    if (companyType === "hosting") return "hosting"
    if (companyType === "business") return "business"
    if (companyType === "education") return "education"
    if (companyType === "government") return "government"
  }

  // Check ASN type as fallback
  const asnType = data.asn?.type?.toLowerCase()
  if (asnType) {
    if (asnType === "isp") return "isp"
    if (asnType === "hosting") return "hosting"
    if (asnType === "business") return "business"
    if (asnType === "education") return "education"
    if (asnType === "government") return "government"
  }

  // Datacenter without company = hosting
  if (data.is_datacenter && !data.company?.name) {
    return "hosting"
  }

  // Has company name but no type = likely business
  if (data.company?.name && data.company?.domain) {
    return "business"
  }

  // Mobile network = residential
  if (data.is_mobile) {
    return "residential"
  }

  return "unknown"
}

/**
 * Determine if visitor is a B2B lead
 *
 * B2B Lead criteria:
 * - Has identified business organization
 * - NOT ISP or residential
 * - NOT VPN/Proxy/Tor
 * - Has company domain
 */
function isB2bLead(data: IpapiData, visitorType: VisitorType): boolean {
  // Exclude ISP and residential
  if (visitorType === "isp" || visitorType === "residential") {
    return false
  }

  // Exclude VPN/Proxy/Tor users (likely hiding identity)
  if (data.is_vpn || data.is_proxy || data.is_tor) {
    return false
  }

  // Must have company or organization info
  const hasCompany = !!(data.company?.name || data.asn?.org)
  const hasDomain = !!(data.company?.domain || data.asn?.domain)

  // Business or education/government with domain = potential lead
  if (visitorType === "business" && hasCompany) {
    return true
  }

  // Education/Government = potential institutional lead
  if ((visitorType === "education" || visitorType === "government") && hasCompany) {
    return true
  }

  // Hosting with company domain = could be B2B
  if (visitorType === "hosting" && hasCompany && hasDomain) {
    return true
  }

  return false
}

/**
 * Calculate lead score (0-100)
 *
 * Scoring factors:
 * - Visitor type: business=40, education/government=30, hosting=20
 * - Has company name: +15
 * - Has company domain: +15
 * - Has company type: +10
 * - Low abuser score: +10
 * - Multiple visits: +10 (capped)
 *
 * Negative factors:
 * - VPN/Proxy: -20
 * - Datacenter without company: -15
 * - High abuser score: -20
 * - Mobile: -5
 */
function calculateLeadScore(
  data: IpapiData,
  visitorType: VisitorType,
  visitCount: number = 1,
): number {
  let score = 0

  // Base score by visitor type
  switch (visitorType) {
    case "business":
      score += 40
      break
    case "education":
    case "government":
      score += 30
      break
    case "hosting":
      score += 20
      break
    case "residential":
    case "isp":
      score += 5
      break
    default:
      score += 10
  }

  // Company info bonus
  if (data.company?.name) score += 15
  if (data.company?.domain) score += 15
  if (data.company?.type) score += 10

  // ASN organization bonus
  if (data.asn?.org && !data.company?.name) score += 10
  if (data.asn?.domain && !data.company?.domain) score += 5

  // Low abuser score bonus
  const companyAbuserScore = data.company?.abuser_score
    ? Number.parseFloat(data.company.abuser_score)
    : null
  const asnAbuserScore = data.asn?.abuser_score ? Number.parseFloat(data.asn.abuser_score) : null
  const abuserScore = companyAbuserScore ?? asnAbuserScore ?? 0.5

  if (abuserScore < 0.3) score += 10
  else if (abuserScore > 0.7) score -= 20

  // Visit count bonus (engagement signal)
  if (visitCount > 1) score += Math.min(visitCount * 2, 10)

  // Negative factors
  if (data.is_vpn || data.is_proxy) score -= 20
  if (data.is_tor) score -= 30
  if (data.is_datacenter && !data.company?.name) score -= 15
  if (data.is_mobile) score -= 5
  if (data.is_abuser) score -= 25

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score))
}

/**
 * Extract all ipapi.is fields into session data
 */
function extractIpapiFields(data: IpapiData): Partial<NewVisitorSession> {
  const sessionData: Partial<NewVisitorSession> = {
    ipapiData: data as unknown as Record<string, unknown>,
  }

  // Location fields
  if (data.location) {
    sessionData.country = data.location.country
    sessionData.countryCode = data.location.country_code
    sessionData.city = data.location.city
    sessionData.region = data.location.state
    sessionData.latitude = data.location.latitude
    sessionData.longitude = data.location.longitude
    sessionData.timezone = data.location.timezone
    sessionData.continent = data.location.continent
    sessionData.zip = data.location.zip
    sessionData.isEuMember = data.location.is_eu_member
    sessionData.callingCode = data.location.calling_code
    sessionData.currencyCode = data.location.currency_code
  }

  // Company fields
  if (data.company) {
    sessionData.companyName = data.company.name
    sessionData.companyDomain = data.company.domain
    sessionData.companyType = data.company.type
    sessionData.companyNetwork = data.company.network
    sessionData.companyAbuserScore = data.company.abuser_score
  }

  // ASN fields
  if (data.asn) {
    sessionData.asnNumber = data.asn.asn
    sessionData.asnOrg = data.asn.org
    sessionData.asnType = data.asn.type
    sessionData.asnRoute = data.asn.route
    sessionData.asnDescr = data.asn.descr
    sessionData.asnDomain = data.asn.domain
    sessionData.asnCountry = data.asn.country
    sessionData.asnAbuseEmail = data.asn.abuse
    sessionData.asnAbuserScore = data.asn.abuser_score
  }

  // Datacenter fields
  if (data.datacenter) {
    sessionData.datacenterName = data.datacenter.datacenter
    sessionData.datacenterDomain = data.datacenter.domain
    sessionData.datacenterNetwork = data.datacenter.network
  }

  // Security flags
  sessionData.isVpn = data.is_vpn ?? false
  sessionData.isProxy = data.is_proxy ?? false
  sessionData.isTor = data.is_tor ?? false
  sessionData.isDatacenter = data.is_datacenter ?? false
  sessionData.isCrawler = data.is_crawler ?? false
  sessionData.isMobile = data.is_mobile ?? false
  sessionData.isAbuser = data.is_abuser ?? false
  sessionData.isBogon = data.is_bogon ?? false
  sessionData.isSatellite = data.is_satellite ?? false

  return sessionData
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

    // Extract data from ipapi.is response and classify
    if (ipapiResult.success && ipapiResult.data) {
      const data = ipapiResult.data

      // Extract all ipapi.is fields
      Object.assign(sessionData, extractIpapiFields(data))

      // B2B Intelligence classification
      const visitorType = classifyVisitorType(data)
      const b2bLead = isB2bLead(data, visitorType)
      const leadScore = calculateLeadScore(data, visitorType, 1)

      sessionData.visitorType = visitorType
      sessionData.isB2bLead = b2bLead
      sessionData.leadScore = leadScore

      logger.info(
        {
          workspaceId,
          ipAddress,
          visitorType,
          isB2bLead: b2bLead,
          leadScore,
          companyName: sessionData.companyName,
          asnOrg: sessionData.asnOrg,
        },
        "[Visitor] B2B classification",
      )
    }

    // Insert new session
    const [newSession] = await db.insert(visitorSessions).values(sessionData).returning()

    logger.info(
      {
        workspaceId,
        ipAddress,
        country: sessionData.country,
        company: sessionData.companyName,
        visitorType: sessionData.visitorType,
        leadScore: sessionData.leadScore,
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

  // ISP traffic exclusion (default: true = exclude ISP)
  // Only apply ISP_EXCLUSION_CONDITION if excludeIsp is true or undefined (default behavior)
  const excludeIsp = filters?.excludeIsp !== false
  if (excludeIsp) {
    conditions.push(ISP_EXCLUSION_CONDITION)
  }

  if (filters) {
    // Search filter (IP, company name, domain, ASN org)
    if (filters.search) {
      const searchPattern = `%${filters.search}%`
      const searchCondition = or(
        ilike(visitorSessions.ipAddress, searchPattern),
        ilike(visitorSessions.companyName, searchPattern),
        ilike(visitorSessions.companyDomain, searchPattern),
        ilike(visitorSessions.city, searchPattern),
        ilike(visitorSessions.asnOrg, searchPattern),
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

    // B2B filters
    if (filters.visitorTypes && filters.visitorTypes.length > 0) {
      conditions.push(inArray(visitorSessions.visitorType, filters.visitorTypes))
    }
    if (filters.isB2bLead === true) {
      conditions.push(eq(visitorSessions.isB2bLead, true))
    } else if (filters.isB2bLead === false) {
      conditions.push(eq(visitorSessions.isB2bLead, false))
    }
    if (filters.minLeadScore !== undefined) {
      conditions.push(gte(visitorSessions.leadScore, filters.minLeadScore))
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
    leadScore: visitorSessions.leadScore,
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
        ISP_EXCLUSION_CONDITION,
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
 * Includes B2B Intelligence stats
 */
export async function getVisitorStats(workspaceId: string, days = 30): Promise<VisitorStats> {
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Run optimized queries in parallel
  // ISP traffic is excluded from all stats (Snitcher-style filtering)
  const [
    aggregatedStats,
    topCountriesResult,
    topCompaniesResult,
    visitorTypeDistributionResult,
    recentVisitors,
  ] = await Promise.all([
    // Single query for all counts using FILTER (PostgreSQL)
    db
      .select({
        totalVisitors: sql<number>`count(*)::int`,
        uniqueCountries: sql<number>`count(distinct ${visitorSessions.country})::int`,
        companyVisitors: sql<number>`count(*) FILTER (WHERE ${visitorSessions.companyName} IS NOT NULL)::int`,
        vpnVisitors: sql<number>`count(*) FILTER (WHERE ${visitorSessions.isVpn} = true)::int`,
        b2bLeads: sql<number>`count(*) FILTER (WHERE ${visitorSessions.isB2bLead} = true)::int`,
        avgLeadScore: sql<number>`coalesce(avg(${visitorSessions.leadScore}) FILTER (WHERE ${visitorSessions.leadScore} > 0), 0)::int`,
      })
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.workspaceId, workspaceId),
          gte(visitorSessions.firstVisitAt, startDate),
          ISP_EXCLUSION_CONDITION,
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
          ISP_EXCLUSION_CONDITION,
        ),
      )
      .groupBy(visitorSessions.country)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    // Top companies (include asnOrg as fallback)
    db
      .select({
        company: sql<string>`coalesce(${visitorSessions.companyName}, ${visitorSessions.asnOrg})`,
        count: sql<number>`count(*)::int`,
      })
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.workspaceId, workspaceId),
          gte(visitorSessions.firstVisitAt, startDate),
          sql`(${visitorSessions.companyName} is not null OR ${visitorSessions.asnOrg} is not null)`,
          ISP_EXCLUSION_CONDITION,
        ),
      )
      .groupBy(sql`coalesce(${visitorSessions.companyName}, ${visitorSessions.asnOrg})`)
      .orderBy(sql`count(*) desc`)
      .limit(10),

    // Visitor type distribution
    db
      .select({
        type: visitorSessions.visitorType,
        count: sql<number>`count(*)::int`,
      })
      .from(visitorSessions)
      .where(
        and(
          eq(visitorSessions.workspaceId, workspaceId),
          gte(visitorSessions.firstVisitAt, startDate),
          ISP_EXCLUSION_CONDITION,
        ),
      )
      .groupBy(visitorSessions.visitorType)
      .orderBy(sql`count(*) desc`),

    // Recent visitors (also exclude ISP)
    db
      .select()
      .from(visitorSessions)
      .where(and(eq(visitorSessions.workspaceId, workspaceId), ISP_EXCLUSION_CONDITION))
      .orderBy(desc(visitorSessions.lastVisitAt))
      .limit(10),
  ])

  const stats = aggregatedStats[0]

  return {
    totalVisitors: stats?.totalVisitors ?? 0,
    uniqueCountries: stats?.uniqueCountries ?? 0,
    companyVisitors: stats?.companyVisitors ?? 0,
    vpnVisitors: stats?.vpnVisitors ?? 0,
    b2bLeads: stats?.b2bLeads ?? 0,
    avgLeadScore: stats?.avgLeadScore ?? 0,
    visitorTypeDistribution: visitorTypeDistributionResult.map((r) => ({
      type: (r.type as VisitorType) || "unknown",
      count: r.count,
    })),
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
