import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroupMembers, customerGroups } from "../db/schema/customer-groups"
import { emailReplies, emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { sequenceEnrollments, sequenceSteps, sequences } from "../db/schema/sequences"

export interface DateRangeParams {
  startDate?: string // ISO 8601 date string
  endDate?: string // ISO 8601 date string
  workspaceId?: string
}

export interface DashboardStats {
  leads: {
    total: number
    periodCount: number
  }
  emails: {
    total: number
    periodCount: number
  }
  openRate: {
    rate: number // percentage
    totalSent: number
    totalOpened: number
    periodOpened: number // opened count in the selected period
  }
}

export interface TrendDataPoint {
  date: string // YYYY-MM-DD
  count: number
}

export interface LeadDiscoveryNotification {
  id: string
  customerGroupId: string
  customerGroupName: string
  leadCount: number
  addedAt: Date
}

export interface CampaignNotification {
  id: string
  name: string
  status: string
  type: "created" | "sent" | "scheduled"
  customerGroupId: string | null
  customerGroupName: string | null
  stepCount: number
  recipientCount: number
  sentCount: number
  openRate: number
  replyRate: number
  updatedAt: Date
}

export interface ReplyNotification {
  id: string
  fromEmail: string
  subject: string | null
  bodyText: string | null
  sentiment: string | null
  intent: string | null
  leadName: string | null
  createdAt: Date
}

/**
 * Get dashboard statistics for all 3 columns
 */
export async function getDashboardStats(params: DateRangeParams): Promise<DashboardStats> {
  const { startDate, endDate, workspaceId } = params

  // Build conditions
  const conditions = workspaceId ? [eq(leads.workspaceId, workspaceId)] : []
  const emailConditions = workspaceId ? [eq(emails.workspaceId, workspaceId)] : []

  // Leads stats
  const totalLeadsResult = await db
    .select({ count: count() })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  const periodLeadsConditions = [...conditions]
  if (startDate) {
    periodLeadsConditions.push(gte(leads.createdAt, new Date(startDate)))
  }
  if (endDate) {
    periodLeadsConditions.push(lte(leads.createdAt, new Date(endDate)))
  }

  const periodLeadsResult = await db
    .select({ count: count() })
    .from(leads)
    .where(periodLeadsConditions.length > 0 ? and(...periodLeadsConditions) : undefined)

  // Email stats
  const totalEmailsResult = await db
    .select({ count: count() })
    .from(emails)
    .where(
      emailConditions.length > 0
        ? and(...emailConditions, eq(emails.direction, "outbound"))
        : eq(emails.direction, "outbound"),
    )

  const periodEmailConditions = [...emailConditions, eq(emails.direction, "outbound")]
  if (startDate) {
    periodEmailConditions.push(gte(emails.sentAt, new Date(startDate)))
  }
  if (endDate) {
    periodEmailConditions.push(lte(emails.sentAt, new Date(endDate)))
  }

  const periodEmailsResult = await db
    .select({ count: count() })
    .from(emails)
    .where(and(...periodEmailConditions, isNotNull(emails.sentAt)))

  // Open rate stats (all time, for the workspace)
  const openRateStatsResult = await db
    .select({
      totalSent: sql<number>`COUNT(*)::int`,
      totalOpened: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
    })
    .from(emails)
    .where(
      emailConditions.length > 0
        ? and(...emailConditions, eq(emails.direction, "outbound"), isNotNull(emails.sentAt))
        : and(eq(emails.direction, "outbound"), isNotNull(emails.sentAt)),
    )

  const totalSent = openRateStatsResult[0]?.totalSent ?? 0
  const totalOpened = openRateStatsResult[0]?.totalOpened ?? 0
  const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0

  // Open rate stats for the selected period
  const periodOpenConditions = [
    ...emailConditions,
    eq(emails.direction, "outbound"),
    isNotNull(emails.sentAt),
  ]
  if (startDate) {
    periodOpenConditions.push(gte(emails.openedAt, new Date(startDate)))
  }
  if (endDate) {
    periodOpenConditions.push(lte(emails.openedAt, new Date(endDate)))
  }

  const periodOpenedResult = await db
    .select({
      count: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
    })
    .from(emails)
    .where(and(...periodOpenConditions, isNotNull(emails.openedAt)))

  const periodOpened = periodOpenedResult[0]?.count ?? 0

  return {
    leads: {
      total: totalLeadsResult[0]?.count ?? 0,
      periodCount: periodLeadsResult[0]?.count ?? 0,
    },
    emails: {
      total: totalEmailsResult[0]?.count ?? 0,
      periodCount: periodEmailsResult[0]?.count ?? 0,
    },
    openRate: {
      rate: Math.round(openRate * 10) / 10,
      totalSent,
      totalOpened,
      periodOpened,
    },
  }
}

/**
 * Get lead trends (daily counts)
 */
export async function getLeadTrends(params: DateRangeParams): Promise<TrendDataPoint[]> {
  const { startDate, endDate, workspaceId } = params

  const conditions = workspaceId ? [eq(leads.workspaceId, workspaceId)] : []
  if (startDate) {
    conditions.push(gte(leads.createdAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(leads.createdAt, new Date(endDate)))
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${leads.createdAt})`,
      count: count(),
    })
    .from(leads)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`DATE(${leads.createdAt})`)
    .orderBy(sql`DATE(${leads.createdAt})`)

  return result.map((row) => ({
    date: row.date,
    count: row.count,
  }))
}

/**
 * Get email trends (daily counts)
 */
export async function getEmailTrends(params: DateRangeParams): Promise<TrendDataPoint[]> {
  const { startDate, endDate, workspaceId } = params

  const conditions = [eq(emails.direction, "outbound"), isNotNull(emails.sentAt)]
  if (workspaceId) {
    conditions.push(eq(emails.workspaceId, workspaceId))
  }
  if (startDate) {
    conditions.push(gte(emails.sentAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(emails.sentAt, new Date(endDate)))
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${emails.sentAt})`,
      count: count(),
    })
    .from(emails)
    .where(and(...conditions))
    .groupBy(sql`DATE(${emails.sentAt})`)
    .orderBy(sql`DATE(${emails.sentAt})`)

  return result.map((row) => ({
    date: row.date,
    count: row.count,
  }))
}

/**
 * Get open rate trends (daily open rates)
 */
export async function getOpenRateTrends(params: DateRangeParams): Promise<TrendDataPoint[]> {
  const { startDate, endDate, workspaceId } = params

  const conditions = [eq(emails.direction, "outbound"), isNotNull(emails.sentAt)]
  if (workspaceId) {
    conditions.push(eq(emails.workspaceId, workspaceId))
  }
  if (startDate) {
    conditions.push(gte(emails.sentAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(emails.sentAt, new Date(endDate)))
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${emails.sentAt})`,
      totalSent: sql<number>`COUNT(*)::int`,
      totalOpened: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
    })
    .from(emails)
    .where(and(...conditions))
    .groupBy(sql`DATE(${emails.sentAt})`)
    .orderBy(sql`DATE(${emails.sentAt})`)

  return result.map((row) => {
    const openRate = row.totalSent > 0 ? (row.totalOpened / row.totalSent) * 100 : 0
    return {
      date: row.date,
      count: Math.round(openRate * 10) / 10,
    }
  })
}

/**
 * Get lead discovery notifications (customer groups with recently added leads)
 */
export async function getLeadDiscoveryNotifications(
  params: DateRangeParams & { limit?: number },
): Promise<LeadDiscoveryNotification[]> {
  const { startDate, endDate, workspaceId, limit = 10 } = params

  // Build conditions for customer_group_members.addedAt
  const memberConditions = []
  if (startDate) {
    memberConditions.push(gte(customerGroupMembers.addedAt, new Date(startDate)))
  }
  if (endDate) {
    memberConditions.push(lte(customerGroupMembers.addedAt, new Date(endDate)))
  }

  // Build conditions for customer_groups
  const groupConditions = workspaceId ? [eq(customerGroups.workspaceId, workspaceId)] : []

  // Query customer groups with lead counts in the date range
  const result = await db
    .select({
      groupId: customerGroups.id,
      groupName: customerGroups.name,
      leadCount: count(customerGroupMembers.leadId),
      latestAddedAt: sql<Date>`MAX(${customerGroupMembers.addedAt})`,
    })
    .from(customerGroups)
    .innerJoin(customerGroupMembers, eq(customerGroups.id, customerGroupMembers.groupId))
    .where(
      and(
        ...(groupConditions.length > 0 ? groupConditions : []),
        ...(memberConditions.length > 0 ? [and(...memberConditions)] : []),
      ),
    )
    .groupBy(customerGroups.id, customerGroups.name)
    .orderBy(desc(sql`MAX(${customerGroupMembers.addedAt})`))
    .limit(limit)

  return result.map((row) => ({
    id: row.groupId,
    customerGroupId: row.groupId,
    customerGroupName: row.groupName,
    leadCount: row.leadCount,
    addedAt: row.latestAddedAt,
  }))
}

/**
 * Get campaign notifications (sequences with detailed metrics)
 */
export async function getCampaignNotifications(
  params: DateRangeParams & { limit?: number },
): Promise<CampaignNotification[]> {
  const { startDate, endDate, workspaceId, limit = 10 } = params

  // Query sequences with customer group info
  const conditions = workspaceId ? [eq(sequences.workspaceId, workspaceId)] : []
  if (startDate) {
    conditions.push(gte(sequences.updatedAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(sequences.updatedAt, new Date(endDate)))
  }

  const result = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      customerGroupId: sequences.customerGroupId,
      updatedAt: sequences.updatedAt,
    })
    .from(sequences)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sequences.updatedAt))
    .limit(limit)

  // For each sequence, get detailed metrics
  const sequencesWithMetrics = await Promise.all(
    result.map(async (seq) => {
      // Get customer group name
      let customerGroupName: string | null = null
      if (seq.customerGroupId) {
        const groupResult = await db
          .select({ name: customerGroups.name })
          .from(customerGroups)
          .where(eq(customerGroups.id, seq.customerGroupId))
          .limit(1)
        customerGroupName = groupResult[0]?.name ?? null
      }

      // Count steps
      const stepCountResult = await db
        .select({ count: count() })
        .from(sequenceSteps)
        .where(eq(sequenceSteps.sequenceId, seq.id))
      const stepCount = stepCountResult[0]?.count ?? 0

      // Count enrollments (recipients)
      const enrollmentCountResult = await db
        .select({ count: count() })
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, seq.id))
      const recipientCount = enrollmentCountResult[0]?.count ?? 0

      // Build email conditions for the selected period
      const emailConditions = [
        eq(emails.sequenceId, seq.id),
        eq(emails.direction, "outbound"),
        isNotNull(emails.sentAt),
      ]
      if (startDate) {
        emailConditions.push(gte(emails.sentAt, new Date(startDate)))
      }
      if (endDate) {
        emailConditions.push(lte(emails.sentAt, new Date(endDate)))
      }

      // Get email metrics in the selected period
      const emailMetricsResult = await db
        .select({
          totalSent: sql<number>`COUNT(*)::int`,
          totalDelivered: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.deliveredAt} IS NOT NULL THEN ${emails.id} END)::int`,
          totalOpened: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
        })
        .from(emails)
        .where(and(...emailConditions))

      const totalSent = emailMetricsResult[0]?.totalSent ?? 0
      const totalDelivered = emailMetricsResult[0]?.totalDelivered ?? 0
      const totalOpened = emailMetricsResult[0]?.totalOpened ?? 0
      const openRate = totalSent > 0 ? (totalOpened / totalSent) * 100 : 0

      // Get reply rate in the selected period (replies to delivered emails)
      const replyCountResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${emailReplies.id})::int` })
        .from(emailReplies)
        .innerJoin(emails, eq(emailReplies.originalEmailId, emails.id))
        .where(
          and(
            eq(emails.sequenceId, seq.id),
            eq(emails.direction, "outbound"),
            isNotNull(emails.sentAt),
            isNotNull(emails.deliveredAt),
            ...(startDate ? [gte(emails.sentAt, new Date(startDate))] : []),
            ...(endDate ? [lte(emails.sentAt, new Date(endDate))] : []),
          ),
        )

      const replyCount = replyCountResult[0]?.count ?? 0
      const replyRate = totalDelivered > 0 ? (replyCount / totalDelivered) * 100 : 0

      // Determine type based on status and sent count
      let type: "created" | "sent" | "scheduled" = "created"
      if (seq.status === "active" && totalSent > 0) {
        type = "sent"
      } else if (seq.status === "active") {
        type = "scheduled"
      }

      return {
        id: seq.id,
        name: seq.name,
        status: seq.status,
        type,
        customerGroupId: seq.customerGroupId,
        customerGroupName,
        stepCount,
        recipientCount,
        sentCount: totalSent,
        openRate: Math.round(openRate * 10) / 10,
        replyRate: Math.round(replyRate * 10) / 10,
        updatedAt: seq.updatedAt,
      }
    }),
  )

  return sequencesWithMetrics
}

/**
 * Get reply notifications (inbox preview)
 */
export async function getReplyNotifications(
  params: DateRangeParams & { limit?: number },
): Promise<ReplyNotification[]> {
  const { startDate, endDate, workspaceId, limit = 10 } = params

  const conditions = [eq(emails.direction, "inbound")]
  if (workspaceId) {
    conditions.push(eq(emails.workspaceId, workspaceId))
  }
  if (startDate) {
    conditions.push(gte(emails.createdAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(emails.createdAt, new Date(endDate)))
  }

  const result = await db
    .select({
      id: emails.id,
      fromEmail: emails.fromEmail,
      subject: emails.subject,
      bodyText: emails.bodyText,
      leadName: emails.leadName,
      createdAt: emails.createdAt,
    })
    .from(emails)
    .where(and(...conditions))
    .orderBy(desc(emails.createdAt))
    .limit(limit)

  // For each email, try to get sentiment and intent from email_replies
  const emailsWithSentiment = await Promise.all(
    result.map(async (email) => {
      // Query email_replies to get sentiment and intent
      const replyData = await db.query.emailReplies.findFirst({
        where: (emailReplies, { eq }) => eq(emailReplies.replyEmailId, email.id),
        columns: {
          sentiment: true,
          intent: true,
        },
      })

      return {
        id: email.id,
        fromEmail: email.fromEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        sentiment: replyData?.sentiment ?? null,
        intent: replyData?.intent ?? null,
        leadName: email.leadName,
        createdAt: email.createdAt,
      }
    }),
  )

  return emailsWithSentiment
}
