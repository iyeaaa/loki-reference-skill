import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroupMembers, customerGroups } from "../db/schema/customer-groups"
import { emailReplies, emails } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
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

// ============================================================================
// Trial Dashboard Stats (체험판 대시보드 통합 API)
// ============================================================================

export interface TrialDashboardParams {
  workspaceId: string
  sequenceId?: string
  startDate?: string // ISO 8601 date string (e.g., "2024-01-01")
  endDate?: string // ISO 8601 date string (e.g., "2024-01-31")
}

export interface TrialFunnelData {
  sent: number
  opened: number
  clicked: number
  replied: number
  openRate: number
  clickRate: number
  replyRate: number
}

export interface TrialHotLead {
  id: string
  companyName: string
  email: string
  country: string | null
  openCount: number
  clickCount: number
  score: number
}

export interface TrialRecentActivity {
  id: string
  type: "sent" | "opened" | "clicked" | "replied"
  leadName: string | null
  companyName: string | null
  email: string
  stepOrder: number | null
  timestamp: Date
  openCount?: number
}

export interface TrialSubscriptionInfo {
  status: string
  trialStart: Date | null
  trialEnd: Date | null
  daysRemaining: number
  trialDays: number
}

export interface TrialDailyStats {
  date: string // YYYY-MM-DD
  sent: number
  opened: number
  clicked: number
}

export interface TrialCountryStats {
  country: string
  count: number
  percentage: number
}

export interface TrialDashboardStats {
  subscription: TrialSubscriptionInfo
  funnel: TrialFunnelData
  hotLeads: TrialHotLead[]
  recentActivity: TrialRecentActivity[]
  dailyStats: TrialDailyStats[]
  countryStats: TrialCountryStats[]
  sequence: {
    id: string
    name: string
    status: string
    leadCount: number
    stepCount: number
  } | null
  industryBenchmark: {
    openRate: number
    clickRate: number
    replyRate: number
  }
}

/**
 * Get all trial dashboard stats in one API call (optimized for performance)
 */
export async function getTrialDashboardStats(
  params: TrialDashboardParams,
): Promise<TrialDashboardStats> {
  const { workspaceId, sequenceId, startDate, endDate } = params

  // Parse date strings to Date objects
  const startDateObj = startDate ? new Date(startDate) : undefined
  const endDateObj = endDate ? new Date(endDate) : undefined

  // 1. Get subscription info
  const subscriptionInfo = await getTrialSubscriptionInfo(workspaceId)

  // 2. Get sequence info (only if sequenceId is provided)
  // sequenceId가 없으면(undefined) 워크스페이스의 전체 이메일을 조회
  const sequenceInfo = sequenceId ? await getTrialSequenceInfo(workspaceId, sequenceId) : null

  // 시퀀스 필터링에 사용할 ID (없으면 undefined로 전체 조회)
  const filterSequenceId = sequenceInfo?.id

  // 3. Get funnel data (with date filtering)
  const funnel = await getTrialFunnelData(workspaceId, filterSequenceId, startDateObj, endDateObj)

  // 4. Get hot leads (2+ opens, with date filtering)
  const hotLeads = await getTrialHotLeads(
    workspaceId,
    filterSequenceId,
    5,
    startDateObj,
    endDateObj,
  )

  // 5. Get recent activity (with date filtering)
  const recentActivity = await getTrialRecentActivity(
    workspaceId,
    filterSequenceId,
    10,
    startDateObj,
    endDateObj,
  )

  // 6. Get daily stats (with date filtering)
  const dailyStats = await getTrialDailyStats(
    workspaceId,
    filterSequenceId,
    startDateObj,
    endDateObj,
  )

  // 7. Get country stats (with date filtering)
  const countryStats = await getTrialCountryStats(
    workspaceId,
    filterSequenceId,
    startDateObj,
    endDateObj,
  )

  // 8. Industry benchmark (hardcoded for now, can be dynamic later)
  const industryBenchmark = {
    openRate: 21, // B2B cold email average
    clickRate: 2.5,
    replyRate: 1,
  }

  return {
    subscription: subscriptionInfo,
    funnel,
    hotLeads,
    recentActivity,
    dailyStats,
    countryStats,
    sequence: sequenceInfo,
    industryBenchmark,
  }
}

async function getTrialSubscriptionInfo(workspaceId: string): Promise<TrialSubscriptionInfo> {
  const { subscriptions } = await import("../db/schema/billing")

  const result = await db
    .select({
      status: subscriptions.status,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
    })
    .from(subscriptions)
    .where(and(eq(subscriptions.workspaceId, workspaceId), eq(subscriptions.isPrimary, true)))
    .limit(1)

  const subscription = result[0]
  const now = new Date()

  if (!subscription) {
    return {
      status: "trialing",
      trialStart: null,
      trialEnd: null,
      daysRemaining: 7,
      trialDays: 7,
    }
  }

  let daysRemaining = 7
  if (subscription.trialEnd) {
    const diffMs = subscription.trialEnd.getTime() - now.getTime()
    daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  }

  const trialDays =
    subscription.trialStart && subscription.trialEnd
      ? Math.ceil(
          (subscription.trialEnd.getTime() - subscription.trialStart.getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 7

  return {
    status: subscription.status,
    trialStart: subscription.trialStart,
    trialEnd: subscription.trialEnd,
    daysRemaining,
    trialDays,
  }
}

async function getTrialSequenceInfo(
  workspaceId: string,
  sequenceId?: string,
): Promise<{
  id: string
  name: string
  status: string
  leadCount: number
  stepCount: number
} | null> {
  // Get sequence
  const sequenceConditions = [eq(sequences.workspaceId, workspaceId)]
  if (sequenceId) {
    sequenceConditions.push(eq(sequences.id, sequenceId))
  }

  const sequenceResult = await db
    .select({
      id: sequences.id,
      name: sequences.name,
      status: sequences.status,
      selectedLeadIds: sequences.selectedLeadIds,
    })
    .from(sequences)
    .where(and(...sequenceConditions))
    .orderBy(desc(sequences.createdAt))
    .limit(1)

  const sequence = sequenceResult[0]
  if (!sequence) return null

  // Count steps
  const stepCountResult = await db
    .select({ count: count() })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequence.id))

  // Count leads
  let leadCount = 0
  if (sequence.selectedLeadIds) {
    try {
      const leadIds = JSON.parse(sequence.selectedLeadIds) as string[]
      leadCount = leadIds.length
    } catch {
      leadCount = 0
    }
  }

  return {
    id: sequence.id,
    name: sequence.name,
    status: sequence.status,
    leadCount,
    stepCount: stepCountResult[0]?.count ?? 0,
  }
}

async function getTrialFunnelData(
  workspaceId: string,
  sequenceId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<TrialFunnelData> {
  const conditions = [eq(emails.workspaceId, workspaceId), eq(emails.direction, "outbound")]
  if (sequenceId) {
    conditions.push(eq(emails.sequenceId, sequenceId))
  }
  if (startDate) {
    conditions.push(gte(emails.sentAt, startDate))
  }
  if (endDate) {
    conditions.push(lte(emails.sentAt, endDate))
  }

  const result = await db
    .select({
      sent: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.sentAt} IS NOT NULL THEN ${emails.id} END)::int`,
      opened: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
      clicked: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.clickedAt} IS NOT NULL THEN ${emails.id} END)::int`,
      replied: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.repliedAt} IS NOT NULL THEN ${emails.id} END)::int`,
    })
    .from(emails)
    .where(and(...conditions))

  const data = result[0] ?? { sent: 0, opened: 0, clicked: 0, replied: 0 }

  return {
    sent: data.sent,
    opened: data.opened,
    clicked: data.clicked,
    replied: data.replied,
    openRate: data.sent > 0 ? Math.round((data.opened / data.sent) * 1000) / 10 : 0,
    clickRate: data.sent > 0 ? Math.round((data.clicked / data.sent) * 1000) / 10 : 0,
    replyRate: data.sent > 0 ? Math.round((data.replied / data.sent) * 1000) / 10 : 0,
  }
}

async function getTrialHotLeads(
  workspaceId: string,
  sequenceId?: string,
  limit = 5,
  startDate?: Date,
  endDate?: Date,
): Promise<TrialHotLead[]> {
  const conditions = [
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    isNotNull(emails.leadId),
  ]
  if (sequenceId) {
    conditions.push(eq(emails.sequenceId, sequenceId))
  }
  if (startDate) {
    conditions.push(gte(emails.sentAt, startDate))
  }
  if (endDate) {
    conditions.push(lte(emails.sentAt, endDate))
  }

  // Get leads with high open counts (2+)
  const result = await db
    .select({
      leadId: emails.leadId,
      companyName: leads.companyName,
      email: emails.toEmail,
      country: leads.country,
      openCount: sql<number>`SUM(${emails.openCount})::int`,
      clickCount: sql<number>`SUM(${emails.clickCount})::int`,
    })
    .from(emails)
    .innerJoin(leads, eq(emails.leadId, leads.id))
    .where(and(...conditions))
    .groupBy(emails.leadId, leads.companyName, emails.toEmail, leads.country)
    .having(sql`SUM(${emails.openCount}) >= 2`)
    .orderBy(desc(sql`SUM(${emails.openCount})`))
    .limit(limit)

  return result.map((row) => ({
    id: row.leadId || "",
    companyName: row.companyName || "Unknown",
    email: row.email,
    country: row.country,
    openCount: row.openCount,
    clickCount: row.clickCount,
    score: Math.min(100, row.openCount * 15 + row.clickCount * 25),
  }))
}

async function getTrialRecentActivity(
  workspaceId: string,
  sequenceId?: string,
  limit = 10,
  startDate?: Date,
  endDate?: Date,
): Promise<TrialRecentActivity[]> {
  const { emailEvents } = await import("../db/schema/emails")

  const conditions = [eq(emails.workspaceId, workspaceId)]
  if (sequenceId) {
    conditions.push(eq(emails.sequenceId, sequenceId))
  }

  // Build event conditions with date filtering
  const eventConditions: ReturnType<typeof eq>[] = []
  if (startDate) {
    eventConditions.push(gte(emailEvents.timestamp, startDate))
  }
  if (endDate) {
    eventConditions.push(lte(emailEvents.timestamp, endDate))
  }

  // Get recent email events
  const result = await db
    .select({
      id: emailEvents.id,
      eventType: emailEvents.eventType,
      timestamp: emailEvents.timestamp,
      emailId: emailEvents.emailId,
      leadName: emails.leadName,
      leadEmail: emails.leadEmail,
      toEmail: emails.toEmail,
      stepId: emails.stepId,
      openCount: emails.openCount,
    })
    .from(emailEvents)
    .innerJoin(emails, eq(emailEvents.emailId, emails.id))
    .where(and(...conditions, ...eventConditions))
    .orderBy(desc(emailEvents.timestamp))
    .limit(limit)

  // Get step orders for each step
  const stepIds = [
    ...new Set(
      result
        .filter((r): r is typeof r & { stepId: string } => r.stepId !== null)
        .map((r) => r.stepId),
    ),
  ]
  const stepOrders: Record<string, number> = {}

  if (stepIds.length > 0) {
    const stepsResult = await db
      .select({
        id: sequenceSteps.id,
        stepOrder: sequenceSteps.stepOrder,
      })
      .from(sequenceSteps)
      .where(sql`${sequenceSteps.id} IN ${stepIds}`)

    for (const step of stepsResult) {
      stepOrders[step.id] = step.stepOrder
    }
  }

  // Get company names from leads via leadContacts
  const leadEmails = [...new Set(result.map((r) => r.toEmail))]
  const companyNames: Record<string, string> = {}

  if (leadEmails.length > 0) {
    const leadsResult = await db
      .select({
        email: leadContacts.contactValue,
        companyName: leads.companyName,
      })
      .from(leadContacts)
      .innerJoin(leads, eq(leadContacts.leadId, leads.id))
      .where(
        and(
          eq(leadContacts.contactType, "email"),
          sql`${leadContacts.contactValue} IN ${leadEmails}`,
        ),
      )

    for (const lead of leadsResult) {
      if (lead.email && lead.companyName) {
        companyNames[lead.email] = lead.companyName
      }
    }
  }

  return result.map((row) => {
    let type: "sent" | "opened" | "clicked" | "replied" = "sent"
    if (row.eventType === "open") type = "opened"
    else if (row.eventType === "click") type = "clicked"
    else if (row.eventType === "delivered") type = "sent"

    return {
      id: row.id,
      type,
      leadName: row.leadName,
      companyName: companyNames[row.toEmail] || null,
      email: row.toEmail,
      stepOrder: row.stepId ? stepOrders[row.stepId] || null : null,
      timestamp: row.timestamp,
      openCount: row.openCount,
    }
  })
}

/**
 * Get daily email stats for the specified date range
 */
async function getTrialDailyStats(
  workspaceId: string,
  sequenceId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<TrialDailyStats[]> {
  // Default to last 90 days if no date range specified
  const effectiveStartDate =
    startDate ||
    (() => {
      const d = new Date()
      d.setDate(d.getDate() - 90)
      return d
    })()

  const conditions = [
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    gte(emails.createdAt, effectiveStartDate),
  ]
  if (sequenceId) {
    conditions.push(eq(emails.sequenceId, sequenceId))
  }
  if (endDate) {
    conditions.push(lte(emails.createdAt, endDate))
  }

  const result = await db
    .select({
      date: sql<string>`DATE(${emails.sentAt})`,
      sent: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.sentAt} IS NOT NULL THEN ${emails.id} END)::int`,
      opened: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
      clicked: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.clickedAt} IS NOT NULL THEN ${emails.id} END)::int`,
    })
    .from(emails)
    .where(and(...conditions))
    .groupBy(sql`DATE(${emails.sentAt})`)
    .orderBy(sql`DATE(${emails.sentAt})`)

  return result
    .filter((row) => row.date !== null)
    .map((row) => ({
      date: row.date,
      sent: row.sent,
      opened: row.opened,
      clicked: row.clicked,
    }))
}

/**
 * Get lead distribution by country
 */
async function getTrialCountryStats(
  workspaceId: string,
  sequenceId?: string,
  startDate?: Date,
  endDate?: Date,
): Promise<TrialCountryStats[]> {
  const conditions = [
    eq(emails.workspaceId, workspaceId),
    eq(emails.direction, "outbound"),
    isNotNull(emails.leadId),
  ]
  if (sequenceId) {
    conditions.push(eq(emails.sequenceId, sequenceId))
  }
  if (startDate) {
    conditions.push(gte(emails.sentAt, startDate))
  }
  if (endDate) {
    conditions.push(lte(emails.sentAt, endDate))
  }

  const result = await db
    .select({
      country: leads.country,
      count: sql<number>`COUNT(DISTINCT ${leads.id})::int`,
    })
    .from(emails)
    .innerJoin(leads, eq(emails.leadId, leads.id))
    .where(and(...conditions))
    .groupBy(leads.country)
    .orderBy(desc(sql`COUNT(DISTINCT ${leads.id})`))
    .limit(10)

  const total = result.reduce((sum, row) => sum + row.count, 0)

  return result.map((row) => ({
    country: row.country || "Unknown",
    count: row.count,
    percentage: total > 0 ? Math.round((row.count / total) * 1000) / 10 : 0,
  }))
}
