/**
 * Visitor to Lead Sync Service
 *
 * Syncs filtered visitors from visitor_sessions to customer_groups as leads.
 * Applies noise filtering (ISP, hosting, datacenter, suspicious) and excluded companies.
 */

import { and, desc, eq, gte, notInArray, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroupMembers, customerGroups } from "../db/schema/customer-groups"
import { leads } from "../db/schema/leads"
import { visitorExcludedCompanies } from "../db/schema/visitor-excluded-companies"
import { visitorSessions } from "../db/schema/visitor-sessions"
import { workspaces } from "../db/schema/workspaces"
import logger from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

export interface SyncVisitorsToLeadsInput {
  workspaceId: string
  userId: string
  /** Number of days to look back for visitors (default: 30) */
  days?: number
}

export interface SyncVisitorsToLeadsResult {
  success: boolean
  groupId: string
  groupName: string
  /** Number of new leads created */
  leadsCreated: number
  /** Number of leads added to group (includes existing leads) */
  leadsAddedToGroup: number
  /** Number of visitors skipped (already exists as lead) */
  skipped: number
  /** Total filtered visitors found */
  totalFilteredVisitors: number
  error?: string
}

// ============================================================================
// Constants - Noise Filter Conditions (same as visitor.service.ts)
// ============================================================================

const ISP_EXCLUSION_CONDITION = sql`(${visitorSessions.visitorType} IS NULL OR ${visitorSessions.visitorType} != 'isp')`
const HOSTING_EXCLUSION_CONDITION = sql`(${visitorSessions.visitorType} IS NULL OR ${visitorSessions.visitorType} != 'hosting')`
const DATACENTER_EXCLUSION_CONDITION = sql`(${visitorSessions.isDatacenter} IS NULL OR ${visitorSessions.isDatacenter} = false)`
const SUSPICIOUS_EXCLUSION_CONDITION = sql`(
  (${visitorSessions.isProxy} IS NULL OR ${visitorSessions.isProxy} = false)
  AND (${visitorSessions.isAbuser} IS NULL OR ${visitorSessions.isAbuser} = false)
  AND (${visitorSessions.isTor} IS NULL OR ${visitorSessions.isTor} = false)
)`

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate optimized group name for visitor sync
 * Format: 웹사이트방문자_{WorkspaceName}
 * One group per workspace (no date suffix)
 */
function generateVisitorGroupName(workspaceName: string): string {
  // Sanitize workspace name (remove special characters, limit length)
  const sanitizedName = workspaceName.replace(/[^a-zA-Z0-9가-힣]/g, "").substring(0, 20)
  return `웹사이트방문자_${sanitizedName}`
}

/**
 * Get or create the visitor sync group for a workspace
 */
async function getOrCreateVisitorGroup(
  workspaceId: string,
  workspaceName: string,
  userId: string,
): Promise<{ id: string; name: string; isNew: boolean }> {
  const groupName = generateVisitorGroupName(workspaceName)

  // Check if group already exists for today
  const existingGroup = await db
    .select({ id: customerGroups.id, name: customerGroups.name })
    .from(customerGroups)
    .where(and(eq(customerGroups.workspaceId, workspaceId), eq(customerGroups.name, groupName)))
    .limit(1)

  if (existingGroup[0]) {
    return { id: existingGroup[0].id, name: existingGroup[0].name, isNew: false }
  }

  // Create new group
  const newGroupResult = await db
    .insert(customerGroups)
    .values({
      workspaceId,
      name: groupName,
      description: `웹사이트 방문자 자동 동기화 (${new Date().toLocaleDateString("ko-KR")})`,
      isDynamic: false,
      createdBy: userId,
    })
    .returning({ id: customerGroups.id, name: customerGroups.name })

  const newGroup = newGroupResult[0]
  if (!newGroup) {
    throw new Error("Failed to create visitor group")
  }

  logger.info(
    { workspaceId, groupId: newGroup.id, groupName },
    "[VisitorSync] Created new visitor group",
  )

  return { id: newGroup.id, name: newGroup.name, isNew: true }
}

/**
 * Get excluded company domains for a workspace
 */
async function getExcludedDomains(workspaceId: string): Promise<string[]> {
  const result = await db
    .select({ domain: visitorExcludedCompanies.companyDomain })
    .from(visitorExcludedCompanies)
    .where(eq(visitorExcludedCompanies.workspaceId, workspaceId))

  return result.map((r) => r.domain)
}

/**
 * Map visitor type to lead source
 */
function mapVisitorTypeToLeadSource(visitorType: string | null): string {
  const typeMap: Record<string, string> = {
    business: "Website Visitor - Business",
    education: "Website Visitor - Education",
    government: "Website Visitor - Government",
    hosting: "Website Visitor - Hosting",
    isp: "Website Visitor - ISP",
    residential: "Website Visitor - Residential",
    unknown: "Website Visitor",
  }
  return typeMap[visitorType || "unknown"] || "Website Visitor"
}

// ============================================================================
// Single Visitor Auto-Sync Function
// ============================================================================

export interface AutoSyncVisitorInput {
  workspaceId: string
  workspaceName: string
  /** Visitor data to sync */
  visitor: {
    companyDomain: string | null
    companyName: string | null
    country: string | null
    city: string | null
    region: string | null
    visitorType: string | null
    leadScore: number | null
    visitCount: number
    firstVisitAt: Date
    lastVisitAt: Date
  }
}

/**
 * Check if visitor should be auto-synced
 * Returns true if visitor passes all noise filters
 */
export function shouldAutoSyncVisitor(visitor: {
  visitorType: string | null
  isDatacenter: boolean
  isProxy: boolean
  isAbuser: boolean
  isTor: boolean
  companyDomain: string | null
}): boolean {
  // Must have company domain
  if (!visitor.companyDomain) {
    return false
  }

  // Exclude ISP traffic
  if (visitor.visitorType === "isp") {
    return false
  }

  // Exclude hosting traffic
  if (visitor.visitorType === "hosting") {
    return false
  }

  // Exclude datacenter
  if (visitor.isDatacenter) {
    return false
  }

  // Exclude suspicious traffic
  if (visitor.isProxy || visitor.isAbuser || visitor.isTor) {
    return false
  }

  return true
}

/**
 * Auto-sync a single visitor to customer group
 * Called automatically when a visitor is tracked
 */
export async function autoSyncVisitorToLead(
  input: AutoSyncVisitorInput,
): Promise<{ success: boolean; leadId?: string; error?: string }> {
  const { workspaceId, workspaceName, visitor } = input

  try {
    // Must have company domain
    if (!visitor.companyDomain) {
      return { success: false, error: "No company domain" }
    }

    // Check if company is excluded
    const excludedDomains = await getExcludedDomains(workspaceId)
    if (excludedDomains.includes(visitor.companyDomain.toLowerCase())) {
      return { success: false, error: "Company is excluded" }
    }

    // Get or create the visitor group (using system user for auto-sync)
    const group = await getOrCreateVisitorGroup(workspaceId, workspaceName, workspaceId)

    // Check if lead already exists by domain
    const normalizedDomain = visitor.companyDomain.toLowerCase()
    const existingLead = await db
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.workspaceId, workspaceId),
          sql`LOWER(${leads.websiteUrl}) LIKE ${`%${normalizedDomain}%`}`,
        ),
      )
      .limit(1)

    let leadId: string

    if (existingLead[0]) {
      leadId = existingLead[0].id
    } else {
      // Create new lead
      const newLeadResult = await db
        .insert(leads)
        .values({
          workspaceId,
          companyName: visitor.companyName || visitor.companyDomain,
          websiteUrl: visitor.companyDomain.startsWith("http")
            ? visitor.companyDomain
            : `https://${visitor.companyDomain}`,
          country: visitor.country || null,
          city: visitor.city || null,
          state: visitor.region || null,
          leadSource: mapVisitorTypeToLeadSource(visitor.visitorType),
          leadStatus: "new",
          leadScore: visitor.leadScore || null,
          notes: `웹사이트 방문자 자동 동기화\n방문 횟수: ${visitor.visitCount || 1}\n첫 방문: ${visitor.firstVisitAt ? new Date(visitor.firstVisitAt).toLocaleDateString("ko-KR") : "-"}\n마지막 방문: ${visitor.lastVisitAt ? new Date(visitor.lastVisitAt).toLocaleDateString("ko-KR") : "-"}`,
        })
        .returning({ id: leads.id })

      const newLead = newLeadResult[0]
      if (!newLead) {
        return { success: false, error: "Failed to create lead" }
      }

      leadId = newLead.id

      logger.info(
        { workspaceId, leadId, companyDomain: visitor.companyDomain },
        "[VisitorAutoSync] Created new lead from visitor",
      )
    }

    // Check if lead is already in group
    const existingMember = await db
      .select({ id: customerGroupMembers.id })
      .from(customerGroupMembers)
      .where(
        and(eq(customerGroupMembers.groupId, group.id), eq(customerGroupMembers.leadId, leadId)),
      )
      .limit(1)

    if (!existingMember[0]) {
      // Add lead to group
      await db.insert(customerGroupMembers).values({
        groupId: group.id,
        leadId,
      })

      logger.info(
        { workspaceId, groupId: group.id, leadId, companyDomain: visitor.companyDomain },
        "[VisitorAutoSync] Added lead to group",
      )
    }

    return { success: true, leadId }
  } catch (error) {
    logger.error({ workspaceId, error }, "[VisitorAutoSync] Failed to auto-sync visitor")
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

// ============================================================================
// Batch Sync Function (for manual trigger)
// ============================================================================

/**
 * Sync filtered visitors to customer group as leads
 *
 * This function:
 * 1. Gets filtered visitors (noise filtered + excluded companies filtered)
 * 2. Creates or gets the visitor sync group
 * 3. Creates leads from visitors (skips duplicates by companyDomain)
 * 4. Adds leads to the group
 */
export async function syncVisitorsToLeads(
  input: SyncVisitorsToLeadsInput,
): Promise<SyncVisitorsToLeadsResult> {
  const { workspaceId, userId, days = 30 } = input

  try {
    // Get workspace info
    const [workspace] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1)

    if (!workspace) {
      return {
        success: false,
        groupId: "",
        groupName: "",
        leadsCreated: 0,
        leadsAddedToGroup: 0,
        skipped: 0,
        totalFilteredVisitors: 0,
        error: "Workspace not found",
      }
    }

    // Get excluded company domains
    const excludedDomains = await getExcludedDomains(workspaceId)

    // Build query conditions with all noise filters
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const conditions = [
      eq(visitorSessions.workspaceId, workspaceId),
      gte(visitorSessions.firstVisitAt, startDate),
      // Must have company domain to create a lead
      sql`${visitorSessions.companyDomain} IS NOT NULL`,
      sql`${visitorSessions.companyDomain} != ''`,
      // Noise filters
      ISP_EXCLUSION_CONDITION,
      HOSTING_EXCLUSION_CONDITION,
      DATACENTER_EXCLUSION_CONDITION,
      SUSPICIOUS_EXCLUSION_CONDITION,
    ]

    // Apply excluded companies filter
    if (excludedDomains.length > 0) {
      conditions.push(notInArray(visitorSessions.companyDomain, excludedDomains))
    }

    // Get filtered visitors (grouped by companyDomain to avoid duplicates)
    const filteredVisitors = await db
      .select({
        companyDomain: visitorSessions.companyDomain,
        companyName: sql<string>`MAX(${visitorSessions.companyName})`.as("companyName"),
        country: sql<string>`MAX(${visitorSessions.country})`.as("country"),
        city: sql<string>`MAX(${visitorSessions.city})`.as("city"),
        state: sql<string>`MAX(${visitorSessions.region})`.as("state"),
        visitorType: sql<string>`MAX(${visitorSessions.visitorType})`.as("visitorType"),
        leadScore: sql<number>`MAX(${visitorSessions.leadScore})`.as("leadScore"),
        visitCount: sql<number>`SUM(${visitorSessions.visitCount})::int`.as("visitCount"),
        firstVisitAt: sql<Date>`MIN(${visitorSessions.firstVisitAt})`.as("firstVisitAt"),
        lastVisitAt: sql<Date>`MAX(${visitorSessions.lastVisitAt})`.as("lastVisitAt"),
      })
      .from(visitorSessions)
      .where(and(...conditions))
      .groupBy(visitorSessions.companyDomain)
      .orderBy(desc(sql`MAX(${visitorSessions.lastVisitAt})`))

    const totalFilteredVisitors = filteredVisitors.length

    if (totalFilteredVisitors === 0) {
      return {
        success: true,
        groupId: "",
        groupName: "",
        leadsCreated: 0,
        leadsAddedToGroup: 0,
        skipped: 0,
        totalFilteredVisitors: 0,
      }
    }

    // Get or create the visitor group
    const group = await getOrCreateVisitorGroup(workspaceId, workspace.name, userId)

    // Get existing leads by companyDomain (websiteUrl) in this workspace
    const visitorDomains = filteredVisitors
      .map((v) => v.companyDomain)
      .filter((d): d is string => d !== null)

    const existingLeads =
      visitorDomains.length > 0
        ? await db
            .select({
              id: leads.id,
              websiteUrl: leads.websiteUrl,
            })
            .from(leads)
            .where(
              and(
                eq(leads.workspaceId, workspaceId),
                or(
                  ...visitorDomains.map(
                    (domain) => sql`${leads.websiteUrl} ILIKE ${`%${domain}%`}`,
                  ),
                ),
              ),
            )
        : []

    // Create a map of existing domains to lead IDs
    const existingDomainToLeadId = new Map<string, string>()
    for (const lead of existingLeads) {
      if (lead.websiteUrl) {
        // Extract domain from URL
        const domainPart = lead.websiteUrl
          .replace(/^https?:\/\//, "")
          .replace(/^www\./, "")
          .split("/")[0]
        if (domainPart) {
          existingDomainToLeadId.set(domainPart.toLowerCase(), lead.id)
        }
      }
    }

    // Get existing group members
    const existingMembers = await db
      .select({ leadId: customerGroupMembers.leadId })
      .from(customerGroupMembers)
      .where(eq(customerGroupMembers.groupId, group.id))

    const existingMemberIds = new Set(existingMembers.map((m) => m.leadId))

    // Process visitors
    let leadsCreated = 0
    let leadsAddedToGroup = 0
    let skipped = 0
    const leadsToAddToGroup: string[] = []

    for (const visitor of filteredVisitors) {
      if (!visitor.companyDomain) continue

      const normalizedDomain = visitor.companyDomain.toLowerCase()
      let leadId = existingDomainToLeadId.get(normalizedDomain)

      if (!leadId) {
        // Create new lead
        const newLeadResult = await db
          .insert(leads)
          .values({
            workspaceId,
            companyName: visitor.companyName || visitor.companyDomain,
            websiteUrl: visitor.companyDomain.startsWith("http")
              ? visitor.companyDomain
              : `https://${visitor.companyDomain}`,
            country: visitor.country || null,
            city: visitor.city || null,
            state: visitor.state || null,
            leadSource: mapVisitorTypeToLeadSource(visitor.visitorType),
            leadStatus: "new",
            leadScore: visitor.leadScore || null,
            notes: `웹사이트 방문자 자동 동기화\n방문 횟수: ${visitor.visitCount || 1}\n첫 방문: ${visitor.firstVisitAt ? new Date(visitor.firstVisitAt).toLocaleDateString("ko-KR") : "-"}\n마지막 방문: ${visitor.lastVisitAt ? new Date(visitor.lastVisitAt).toLocaleDateString("ko-KR") : "-"}`,
            createdBy: userId,
          })
          .returning({ id: leads.id })

        const newLead = newLeadResult[0]
        if (!newLead) {
          continue // Skip this visitor if lead creation failed
        }

        leadId = newLead.id
        leadsCreated++
        existingDomainToLeadId.set(normalizedDomain, leadId)

        logger.info(
          { workspaceId, leadId, companyDomain: visitor.companyDomain },
          "[VisitorSync] Created new lead from visitor",
        )
      } else {
        skipped++
      }

      // Check if lead is already in group
      if (!existingMemberIds.has(leadId)) {
        leadsToAddToGroup.push(leadId)
        existingMemberIds.add(leadId)
      }
    }

    // Bulk add leads to group
    if (leadsToAddToGroup.length > 0) {
      await db.insert(customerGroupMembers).values(
        leadsToAddToGroup.map((leadId) => ({
          groupId: group.id,
          leadId,
          addedBy: userId,
        })),
      )
      leadsAddedToGroup = leadsToAddToGroup.length

      logger.info(
        { workspaceId, groupId: group.id, leadsAdded: leadsAddedToGroup },
        "[VisitorSync] Added leads to group",
      )
    }

    logger.info(
      {
        workspaceId,
        groupId: group.id,
        groupName: group.name,
        totalFilteredVisitors,
        leadsCreated,
        leadsAddedToGroup,
        skipped,
      },
      "[VisitorSync] Sync completed",
    )

    return {
      success: true,
      groupId: group.id,
      groupName: group.name,
      leadsCreated,
      leadsAddedToGroup,
      skipped,
      totalFilteredVisitors,
    }
  } catch (error) {
    logger.error({ workspaceId, error }, "[VisitorSync] Failed to sync visitors to leads")
    return {
      success: false,
      groupId: "",
      groupName: "",
      leadsCreated: 0,
      leadsAddedToGroup: 0,
      skipped: 0,
      totalFilteredVisitors: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}
