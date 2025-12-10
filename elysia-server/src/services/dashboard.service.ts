import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm"
import { db } from "../db/index"
import { emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { sequenceEnrollments, sequences } from "../db/schema/sequences"
import { websets } from "../db/schema/websets"

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
  }
}

export interface TrendDataPoint {
  date: string // YYYY-MM-DD
  count: number
}

export interface LeadDiscoveryNotification {
  id: string
  title: string | null
  query: string
  status: string
  discoveredLeads: number
  createdAt: Date
}

export interface CampaignNotification {
  id: string
  name: string
  status: string
  type: "created" | "sent" | "scheduled"
  recipientCount: number
  sentCount: number
  createdAt: Date
}

export interface ReplyNotification {
  id: string
  fromEmail: string
  subject: string | null
  bodyText: string | null
  sentiment: string | null
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
 * Get lead discovery notifications (websets)
 */
export async function getLeadDiscoveryNotifications(
  params: DateRangeParams & { limit?: number },
): Promise<LeadDiscoveryNotification[]> {
  const { startDate, endDate, workspaceId, limit = 10 } = params

  const conditions = workspaceId ? [eq(websets.workspaceId, workspaceId)] : []
  if (startDate) {
    conditions.push(gte(websets.createdAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(websets.createdAt, new Date(endDate)))
  }

  const result = await db
    .select({
      id: websets.id,
      title: websets.title,
      query: websets.query,
      targetValidatedRows: websets.targetValidatedRows,
      createdAt: websets.createdAt,
    })
    .from(websets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(websets.createdAt))
    .limit(limit)

  return result.map((row) => ({
    id: row.id,
    title: row.title,
    query: row.query,
    status: "completed",
    discoveredLeads: row.targetValidatedRows ?? 0,
    createdAt: row.createdAt,
  }))
}

/**
 * Get campaign notifications (sequences)
 */
export async function getCampaignNotifications(
  params: DateRangeParams & { limit?: number },
): Promise<CampaignNotification[]> {
  const { startDate, endDate, workspaceId, limit = 10 } = params

  const conditions = workspaceId ? [eq(sequences.workspaceId, workspaceId)] : []
  if (startDate) {
    conditions.push(gte(sequences.createdAt, new Date(startDate)))
  }
  if (endDate) {
    conditions.push(lte(sequences.createdAt, new Date(endDate)))
  }

  const result = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      createdAt: sequences.createdAt,
    })
    .from(sequences)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(sequences.createdAt))
    .limit(limit)

  // For each sequence, count sent emails and enrollments
  const sequencesWithCounts = await Promise.all(
    result.map(async (seq) => {
      // Count sent emails
      const emailCountResult = await db
        .select({ count: count() })
        .from(emails)
        .where(
          and(
            eq(emails.sequenceId, seq.id),
            eq(emails.direction, "outbound"),
            isNotNull(emails.sentAt),
          ),
        )

      const sentCount = emailCountResult[0]?.count ?? 0

      // Count enrollments (recipients)
      const enrollmentCountResult = await db
        .select({ count: count() })
        .from(sequenceEnrollments)
        .where(eq(sequenceEnrollments.sequenceId, seq.id))

      const recipientCount = enrollmentCountResult[0]?.count ?? 0

      // Determine type based on status and sent count
      let type: "created" | "sent" | "scheduled" = "created"
      if (seq.status === "active" && sentCount > 0) {
        type = "sent"
      } else if (seq.status === "active") {
        type = "scheduled"
      }

      return {
        id: seq.id,
        name: seq.name,
        status: seq.status,
        type,
        recipientCount,
        sentCount,
        createdAt: seq.createdAt,
      }
    }),
  )

  return sequencesWithCounts
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

  // For each email, try to get sentiment from email_replies
  const emailsWithSentiment = await Promise.all(
    result.map(async (email) => {
      // Query email_replies to get sentiment
      const sentimentResult = await db.query.emailReplies.findFirst({
        where: (emailReplies, { eq }) => eq(emailReplies.replyEmailId, email.id),
        columns: {
          sentiment: true,
        },
      })

      return {
        id: email.id,
        fromEmail: email.fromEmail,
        subject: email.subject,
        bodyText: email.bodyText,
        sentiment: sentimentResult?.sentiment ?? null,
        leadName: email.leadName,
        createdAt: email.createdAt,
      }
    }),
  )

  return emailsWithSentiment
}
