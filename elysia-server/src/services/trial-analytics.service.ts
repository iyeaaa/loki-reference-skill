/**
 * Trial Analytics Service
 *
 * 체험판 워크스페이스 분석 및 통계 서비스
 * - 가입 추이
 * - 온보딩 퍼널
 * - 성과 분석
 * - 코호트 분석
 */

import { eq, sql } from "drizzle-orm"
import { db } from "../db"
import { trialStatExclusions, workspaces } from "../db/schema"
import logger from "../utils/logger"

// ============================================================================
// Types
// ============================================================================

export interface TrialSummary {
  total: number
  trialing: number
  pastDue: number
  onboardingCompleted: number
  hasCampaign: number
  hasActiveCampaign: number
  hasSentEmail: number
  hasReply: number
}

export interface SignupTrendItem {
  date: string
  signups: number
  trialing: number
  pastDue: number
}

export interface OnboardingFunnelItem {
  step: string
  count: number
  rate: number
}

export interface EmailDistributionItem {
  range: string
  count: number
}

export interface SourcePerformanceItem {
  source: string
  workspaces: number
  onboardingRate: number
  emailsSent: number
  emailsOpened: number
  emailsReplied: number
}

export interface ActivityDistributionItem {
  period: string
  count: number
}

// 워크스페이스 미리보기 (코호트 셀에 표시)
export interface CohortWorkspacePreview {
  workspaceId: string
  companyName: string | null
  ownerName: string
  ownerEmail: string
}

export interface CohortItem {
  period: string // 표시용 (MM/DD 또는 MM/DD (요일))
  periodStart: string // ISO date for sorting
  total: number
  // 퍼널 단계별 수치
  surveyLogin: number // 설문+로그인
  surveyLoginRate: number
  companyInfo: number // 회사정보 입력
  companyInfoRate: number
  leadCreated: number // 리드 생성
  leadCreatedRate: number
  emailConnected: number // 이메일 연동
  emailConnectedRate: number
  emailSent: number // 이메일 발송
  emailSentRate: number
  // 워크스페이스 미리보기 (각 단계별 최대 3개)
  workspaces: {
    all: CohortWorkspacePreview[] // 전체 가입자
    surveyLogin: CohortWorkspacePreview[]
    companyInfo: CohortWorkspacePreview[]
    leadCreated: CohortWorkspacePreview[]
    emailConnected: CohortWorkspacePreview[]
    emailSent: CohortWorkspacePreview[]
  }
}

export type CohortMode = "daily" | "weekly"

// 이메일 성과 요약
export interface EmailPerformanceSummary {
  totalSent: number
  totalOpened: number
  totalReplied: number
  avgOpenRate: number
  avgReplyRate: number
  workspacesWithEmails: number
}

// 워크스페이스별 이메일 성과
export interface WorkspaceEmailPerformance {
  workspaceId: string
  companyName: string | null
  ownerEmail: string
  ownerName: string
  signupDate: string
  lastLogin: string | null
  emailsSent: number
  emailsOpened: number
  emailsReplied: number
  openRate: number
  replyRate: number
  performanceLevel: "high" | "medium" | "low" | "none"
  // 퍼널 상태
  funnelStatus: {
    survey: boolean
    companyInfo: boolean
    leadCreated: boolean
    emailConnected: boolean
    emailSent: boolean
  }
  // 사용자 입력 데이터
  surveyData: {
    industry?: string
    target?: string
    country?: string
    experience?: string
    lang?: string
  } | null
  companyDescription: string | null
}

export interface EmailPerformanceResponse {
  summary: EmailPerformanceSummary
  workspaces: WorkspaceEmailPerformance[]
}

export interface TrialUserItem {
  workspaceId: string
  companyName: string | null
  ownerEmail: string
  ownerName: string
  signupDate: string
  expiryDate: string | null
  daysRemaining: number | null
  onboardingStep: number
  onboardingStatus: string
  lastLogin: string | null
  emailsSent: number
  emailsOpened: number
  emailsReplied: number
  openRate: number
  replyRate: number
  authProvider: string
  status: "active" | "at_risk" | "churned"
}

export interface TrialAnalyticsResponse {
  summary: TrialSummary
  signupTrend: SignupTrendItem[]
  onboardingFunnel: OnboardingFunnelItem[]
  emailDistribution: EmailDistributionItem[]
  sourcePerformance: SourcePerformanceItem[]
  activityDistribution: ActivityDistributionItem[]
  cohortData: CohortItem[]
  emailPerformance: EmailPerformanceResponse
}

export interface TrialUsersResponse {
  users: TrialUserItem[]
  pagination: {
    total: number
    page: number
    limit: number
  }
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Build SQL exclusion clause for workspace IDs
 * Returns empty string if no exclusions, otherwise returns "AND w.id NOT IN (...)"
 */
function buildExclusionClause(excludeIds?: string[]): string {
  if (!excludeIds || excludeIds.length === 0) return ""
  // Escape single quotes and wrap in quotes
  const escaped = excludeIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(", ")
  return `AND w.id NOT IN (${escaped})`
}

/**
 * Get trial analytics summary and charts data
 * DB에서 제외 목록을 자동으로 가져와서 적용
 */
export async function getTrialAnalytics(
  days: number = 30,
  cohortMode: CohortMode = "weekly",
): Promise<TrialAnalyticsResponse> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get exclusions from DB
  const excludeWorkspaceIds = await getExcludedWorkspaceIds()

  // Execute all queries in parallel for performance
  const [
    summary,
    signupTrend,
    onboardingFunnel,
    emailDistribution,
    sourcePerformance,
    activityDistribution,
    cohortData,
    emailPerformance,
  ] = await Promise.all([
    getTrialSummary(excludeWorkspaceIds),
    getSignupTrend(days, excludeWorkspaceIds),
    getOnboardingFunnel(excludeWorkspaceIds),
    getEmailDistribution(excludeWorkspaceIds),
    getSourcePerformance(excludeWorkspaceIds),
    getActivityDistribution(excludeWorkspaceIds),
    getCohortData(cohortMode, excludeWorkspaceIds),
    getEmailPerformance(excludeWorkspaceIds),
  ])

  return {
    summary,
    signupTrend,
    onboardingFunnel,
    emailDistribution,
    sourcePerformance,
    activityDistribution,
    cohortData,
    emailPerformance,
  }
}

/**
 * Get trial summary statistics
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getTrialSummary(excludeIds?: string[]): Promise<TrialSummary> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    total: number
    trialing: number
    past_due: number
    onboarding_completed: number
    has_campaign: number
    has_active_campaign: number
    has_sent_email: number
    has_reply: number
  }>(sql`
    SELECT
      COUNT(*)::int as total,
      COUNT(CASE WHEN subscription_status = 'trialing' THEN 1 END)::int as trialing,
      COUNT(CASE WHEN subscription_status = 'past_due' THEN 1 END)::int as past_due,
      COUNT(CASE WHEN op.completed_at IS NOT NULL THEN 1 END)::int as onboarding_completed,
      COUNT(CASE WHEN seq_count > 0 THEN 1 END)::int as has_campaign,
      COUNT(CASE WHEN active_count > 0 THEN 1 END)::int as has_active_campaign,
      COUNT(CASE WHEN sent_count > 0 THEN 1 END)::int as has_sent_email,
      COUNT(CASE WHEN reply_count > 0 THEN 1 END)::int as has_reply
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, COUNT(*) as seq_count
      FROM sequences
      GROUP BY workspace_id
    ) s ON s.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, COUNT(*) as active_count
      FROM sequences WHERE status = 'active'
      GROUP BY workspace_id
    ) sa ON sa.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, COUNT(*) as sent_count
      FROM emails WHERE direction = 'outbound' AND sent_at IS NOT NULL
      GROUP BY workspace_id
    ) e ON e.workspace_id = w.id
    LEFT JOIN (
      SELECT workspace_id, COUNT(*) as reply_count
      FROM emails WHERE replied_at IS NOT NULL
      GROUP BY workspace_id
    ) r ON r.workspace_id = w.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
  `)

  const row = result.rows[0]
  return {
    total: row?.total ?? 0,
    trialing: row?.trialing ?? 0,
    pastDue: row?.past_due ?? 0,
    onboardingCompleted: row?.onboarding_completed ?? 0,
    hasCampaign: row?.has_campaign ?? 0,
    hasActiveCampaign: row?.has_active_campaign ?? 0,
    hasSentEmail: row?.has_sent_email ?? 0,
    hasReply: row?.has_reply ?? 0,
  }
}

/**
 * Get daily signup trend
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getSignupTrend(days: number, excludeIds?: string[]): Promise<SignupTrendItem[]> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    date: string
    signups: number
    trialing: number
    past_due: number
  }>(sql`
    SELECT
      TO_CHAR(w.created_at, 'YYYY-MM-DD') as date,
      COUNT(*)::int as signups,
      COUNT(CASE WHEN w.subscription_status = 'trialing' THEN 1 END)::int as trialing,
      COUNT(CASE WHEN w.subscription_status = 'past_due' THEN 1 END)::int as past_due
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
      AND w.created_at >= NOW() - INTERVAL '${sql.raw(String(days))} days'
    GROUP BY TO_CHAR(w.created_at, 'YYYY-MM-DD')
    ORDER BY date
  `)

  return result.rows.map((row) => ({
    date: row.date,
    signups: row.signups,
    trialing: row.trialing,
    pastDue: row.past_due,
  }))
}

/**
 * Get onboarding funnel data
 * 실제 사용자 여정 기반의 의미있는 퍼널 (누적 방식):
 * 각 단계는 이전 단계를 완료한 사람 중에서 카운트
 * 1. 가입완료 - 전체 trial 워크스페이스
 * 2. 온보딩 시작 - 온보딩 진행 시작
 * 3. 회사정보 입력 - 온보딩 시작 + 회사 정보 완료
 * 4. 리드 생성 - 회사정보 입력 + 리드 검색/생성 완료
 * 5. 이메일 연동 - 리드 생성 + 이메일 계정 연결됨
 * 6. 이메일 발송 - 이메일 연동 + 실제 이메일 발송함
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getOnboardingFunnel(excludeIds?: string[]): Promise<OnboardingFunnelItem[]> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    total_workspaces: number
    onboarding_started: number
    company_info_done: number
    lead_created: number
    email_connected: number
    email_sent: number
  }>(sql`
    WITH funnel AS (
      SELECT
        w.id as workspace_id,
        -- 각 단계 완료 여부 (survey_data가 있으면 설문완료 = 구글로그인 완료)
        CASE WHEN op.survey_data IS NOT NULL THEN true ELSE false END as survey_done,
        CASE WHEN op.company_info_completed_at IS NOT NULL THEN true ELSE false END as company_info,
        CASE WHEN op.lead_search_completed_at IS NOT NULL THEN true ELSE false END as lead_search,
        CASE WHEN uea.workspace_id IS NOT NULL THEN true ELSE false END as email_connected,
        CASE WHEN sent.workspace_id IS NOT NULL THEN true ELSE false END as has_sent_email
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN onboarding_progress op ON w.id = op.workspace_id
      LEFT JOIN (
        SELECT DISTINCT workspace_id FROM user_email_accounts
      ) uea ON w.id = uea.workspace_id
      LEFT JOIN (
        SELECT DISTINCT workspace_id
        FROM emails
        WHERE direction = 'outbound' AND sent_at IS NOT NULL
      ) sent ON w.id = sent.workspace_id
      WHERE w.subscription_tier = 'trial'
        AND u.user_role != 'admin'
        ${sql.raw(exclusion)}
    )
    SELECT
      COUNT(*)::int as total_workspaces,
      -- 누적 카운트: 각 단계는 이전 단계 완료 조건 포함
      COUNT(*) FILTER (WHERE survey_done)::int as onboarding_started,
      COUNT(*) FILTER (WHERE survey_done AND company_info)::int as company_info_done,
      COUNT(*) FILTER (WHERE survey_done AND company_info AND lead_search)::int as lead_created,
      COUNT(*) FILTER (WHERE survey_done AND company_info AND lead_search AND email_connected)::int as email_connected,
      COUNT(*) FILTER (WHERE survey_done AND company_info AND lead_search AND email_connected AND has_sent_email)::int as email_sent
    FROM funnel
  `)

  const row = result.rows[0]
  if (!row) {
    return []
  }

  const total = row.total_workspaces || 1

  return [
    { step: "가입완료", count: row.total_workspaces, rate: 100 },
    {
      step: "설문+로그인",
      count: row.onboarding_started,
      rate: Math.round((row.onboarding_started / total) * 1000) / 10,
    },
    {
      step: "회사정보 입력",
      count: row.company_info_done,
      rate: Math.round((row.company_info_done / total) * 1000) / 10,
    },
    {
      step: "리드 생성",
      count: row.lead_created,
      rate: Math.round((row.lead_created / total) * 1000) / 10,
    },
    {
      step: "이메일 연동",
      count: row.email_connected,
      rate: Math.round((row.email_connected / total) * 1000) / 10,
    },
    {
      step: "이메일 발송",
      count: row.email_sent,
      rate: Math.round((row.email_sent / total) * 1000) / 10,
    },
  ]
}

/**
 * Get email sending distribution
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getEmailDistribution(excludeIds?: string[]): Promise<EmailDistributionItem[]> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    range: string
    count: number
  }>(sql`
    WITH email_counts AS (
      SELECT
        w.id,
        COALESCE(e.sent_count, 0) as sent_count
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN (
        SELECT workspace_id, COUNT(*) as sent_count
        FROM emails
        WHERE direction = 'outbound' AND sent_at IS NOT NULL
        GROUP BY workspace_id
      ) e ON e.workspace_id = w.id
      WHERE w.subscription_tier = 'trial'
        AND u.user_role != 'admin'
        ${sql.raw(exclusion)}
    )
    SELECT
      CASE
        WHEN sent_count = 0 THEN '0건'
        WHEN sent_count BETWEEN 1 AND 10 THEN '1-10건'
        WHEN sent_count BETWEEN 11 AND 50 THEN '11-50건'
        WHEN sent_count BETWEEN 51 AND 100 THEN '51-100건'
        WHEN sent_count BETWEEN 101 AND 500 THEN '101-500건'
        ELSE '500건+'
      END as range,
      COUNT(*)::int as count
    FROM email_counts
    GROUP BY 1
    ORDER BY MIN(sent_count)
  `)

  return result.rows
}

/**
 * Get performance by signup source
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getSourcePerformance(excludeIds?: string[]): Promise<SourcePerformanceItem[]> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    source: string
    workspaces: number
    onboarding_rate: number
    emails_sent: number
    emails_opened: number
    emails_replied: number
  }>(sql`
    SELECT
      u.auth_provider as source,
      COUNT(DISTINCT w.id)::int as workspaces,
      ROUND(
        COUNT(DISTINCT CASE WHEN op.completed_at IS NOT NULL THEN w.id END)::numeric /
        NULLIF(COUNT(DISTINCT w.id), 0) * 100, 1
      )::float as onboarding_rate,
      COALESCE(SUM(e.sent_count), 0)::int as emails_sent,
      COALESCE(SUM(e.opened_count), 0)::int as emails_opened,
      COALESCE(SUM(e.replied_count), 0)::int as emails_replied
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
    LEFT JOIN (
      SELECT
        workspace_id,
        COUNT(*) as sent_count,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
        COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied_count
      FROM emails
      WHERE direction = 'outbound' AND sent_at IS NOT NULL
      GROUP BY workspace_id
    ) e ON e.workspace_id = w.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
    GROUP BY u.auth_provider
  `)

  return result.rows.map((row) => ({
    source: row.source === "google" ? "Google" : "Local",
    workspaces: row.workspaces,
    onboardingRate: row.onboarding_rate ?? 0,
    emailsSent: row.emails_sent,
    emailsOpened: row.emails_opened,
    emailsReplied: row.emails_replied,
  }))
}

/**
 * Get activity distribution (last login)
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getActivityDistribution(excludeIds?: string[]): Promise<ActivityDistributionItem[]> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    period: string
    count: number
  }>(sql`
    SELECT
      CASE
        WHEN last_login_at >= NOW() - INTERVAL '1 day' THEN '오늘'
        WHEN last_login_at >= NOW() - INTERVAL '3 days' THEN '1-3일'
        WHEN last_login_at >= NOW() - INTERVAL '7 days' THEN '4-7일'
        WHEN last_login_at >= NOW() - INTERVAL '14 days' THEN '8-14일'
        WHEN last_login_at >= NOW() - INTERVAL '30 days' THEN '15-30일'
        ELSE '30일+'
      END as period,
      COUNT(DISTINCT w.id)::int as count
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
    GROUP BY 1
    ORDER BY MIN(COALESCE(last_login_at, '1970-01-01'::timestamp)) DESC
  `)

  return result.rows
}

/**
 * Get cohort data with funnel metrics
 * 일별/주별 퍼널 단계 전환율 분석
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getCohortData(
  mode: CohortMode = "weekly",
  excludeIds?: string[],
): Promise<CohortItem[]> {
  const isDaily = mode === "daily"
  const exclusion = buildExclusionClause(excludeIds)
  const dateTrunc = isDaily ? "day" : "week"
  const limit = isDaily ? 14 : 8

  // 집계 쿼리
  const aggregateResult = await db.execute<{
    period_label: string
    period_start: string
    total: number
    survey_login: number
    company_info: number
    lead_created: number
    email_connected: number
    email_sent: number
  }>(sql`
    WITH cohorts AS (
      SELECT
        DATE_TRUNC(${dateTrunc}, w.created_at) as cohort_period,
        w.id as workspace_id,
        CASE WHEN op.survey_data IS NOT NULL THEN 1 ELSE 0 END as has_survey,
        CASE WHEN op.company_info_completed_at IS NOT NULL THEN 1 ELSE 0 END as has_company_info,
        CASE WHEN op.lead_search_completed_at IS NOT NULL THEN 1 ELSE 0 END as has_lead,
        CASE WHEN uea.workspace_id IS NOT NULL THEN 1 ELSE 0 END as has_email_connected,
        CASE WHEN sent.workspace_id IS NOT NULL THEN 1 ELSE 0 END as has_email_sent
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
      LEFT JOIN (SELECT DISTINCT workspace_id FROM user_email_accounts) uea ON uea.workspace_id = w.id
      LEFT JOIN (SELECT DISTINCT workspace_id FROM emails WHERE direction = 'outbound' AND sent_at IS NOT NULL) sent ON sent.workspace_id = w.id
      WHERE w.subscription_tier = 'trial'
        AND u.user_role != 'admin'
        ${sql.raw(exclusion)}
    )
    SELECT
      TO_CHAR(cohort_period, 'MM/DD') || ' (' ||
      CASE EXTRACT(DOW FROM cohort_period)
        WHEN 0 THEN '일'
        WHEN 1 THEN '월'
        WHEN 2 THEN '화'
        WHEN 3 THEN '수'
        WHEN 4 THEN '목'
        WHEN 5 THEN '금'
        WHEN 6 THEN '토'
      END || ')' as period_label,
      TO_CHAR(cohort_period, 'YYYY-MM-DD') as period_start,
      COUNT(*)::int as total,
      SUM(has_survey)::int as survey_login,
      SUM(has_company_info)::int as company_info,
      SUM(has_lead)::int as lead_created,
      SUM(has_email_connected)::int as email_connected,
      SUM(has_email_sent)::int as email_sent
    FROM cohorts
    GROUP BY cohort_period
    ORDER BY cohort_period DESC
    LIMIT ${limit}
  `)

  // 워크스페이스 상세 쿼리
  const detailResult = await db.execute<{
    period_start: string
    workspace_id: string
    company_name: string | null
    owner_name: string
    owner_email: string
    has_survey: boolean
    has_company_info: boolean
    has_lead: boolean
    has_email_connected: boolean
    has_email_sent: boolean
  }>(sql`
    SELECT
      TO_CHAR(DATE_TRUNC(${dateTrunc}, w.created_at), 'YYYY-MM-DD') as period_start,
      w.id as workspace_id,
      w.company_name,
      u.username as owner_name,
      u.email as owner_email,
      (op.survey_data IS NOT NULL) as has_survey,
      (op.company_info_completed_at IS NOT NULL) as has_company_info,
      (op.lead_search_completed_at IS NOT NULL) as has_lead,
      (uea.workspace_id IS NOT NULL) as has_email_connected,
      (sent.workspace_id IS NOT NULL) as has_email_sent
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
    LEFT JOIN (SELECT DISTINCT workspace_id FROM user_email_accounts) uea ON uea.workspace_id = w.id
    LEFT JOIN (SELECT DISTINCT workspace_id FROM emails WHERE direction = 'outbound' AND sent_at IS NOT NULL) sent ON sent.workspace_id = w.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
    ORDER BY w.created_at DESC
  `)

  // 기간별로 워크스페이스 그룹화
  const workspacesByPeriod = new Map<
    string,
    {
      all: CohortWorkspacePreview[]
      surveyLogin: CohortWorkspacePreview[]
      companyInfo: CohortWorkspacePreview[]
      leadCreated: CohortWorkspacePreview[]
      emailConnected: CohortWorkspacePreview[]
      emailSent: CohortWorkspacePreview[]
    }
  >()

  for (const row of detailResult.rows) {
    const preview: CohortWorkspacePreview = {
      workspaceId: row.workspace_id,
      companyName: row.company_name,
      ownerName: row.owner_name,
      ownerEmail: row.owner_email,
    }

    if (!workspacesByPeriod.has(row.period_start)) {
      workspacesByPeriod.set(row.period_start, {
        all: [],
        surveyLogin: [],
        companyInfo: [],
        leadCreated: [],
        emailConnected: [],
        emailSent: [],
      })
    }

    const periodData = workspacesByPeriod.get(row.period_start)
    if (!periodData) continue
    periodData.all.push(preview)
    if (row.has_survey) {
      periodData.surveyLogin.push(preview)
    }
    if (row.has_company_info) {
      periodData.companyInfo.push(preview)
    }
    if (row.has_lead) {
      periodData.leadCreated.push(preview)
    }
    if (row.has_email_connected) {
      periodData.emailConnected.push(preview)
    }
    if (row.has_email_sent) {
      periodData.emailSent.push(preview)
    }
  }

  return aggregateResult.rows.map((row) => {
    const total = row.total || 1
    const periodWorkspaces = workspacesByPeriod.get(row.period_start) || {
      all: [],
      surveyLogin: [],
      companyInfo: [],
      leadCreated: [],
      emailConnected: [],
      emailSent: [],
    }

    return {
      period: row.period_label,
      periodStart: row.period_start,
      total: row.total,
      surveyLogin: row.survey_login,
      surveyLoginRate: Math.round((row.survey_login / total) * 100),
      companyInfo: row.company_info,
      companyInfoRate: Math.round((row.company_info / total) * 100),
      leadCreated: row.lead_created,
      leadCreatedRate: Math.round((row.lead_created / total) * 100),
      emailConnected: row.email_connected,
      emailConnectedRate: Math.round((row.email_connected / total) * 100),
      emailSent: row.email_sent,
      emailSentRate: Math.round((row.email_sent / total) * 100),
      workspaces: periodWorkspaces,
    }
  })
}

/**
 * Get email performance summary and per-workspace breakdown
 * 이메일 성과 요약 및 워크스페이스별 상세
 * 단일 쿼리로 모든 데이터 조회 (성능 최적화)
 * 어드민 사용자 소유 워크스페이스 제외
 */
async function getEmailPerformance(excludeIds?: string[]): Promise<EmailPerformanceResponse> {
  const exclusion = buildExclusionClause(excludeIds)
  const result = await db.execute<{
    workspace_id: string
    company_name: string | null
    company_description: string | null
    owner_email: string
    owner_name: string
    signup_date: string
    last_login: string | null
    emails_sent: number
    emails_opened: number
    emails_replied: number
    open_rate: number
    reply_rate: number
    has_survey: boolean
    has_company_info: boolean
    has_lead_search: boolean
    has_email_connected: boolean
    has_email_sent: boolean
    survey_data: {
      industry?: string
      target?: string
      country?: string
      experience?: string
      lang?: string
    } | null
  }>(sql`
    SELECT
      w.id as workspace_id,
      w.company_name,
      w.company_description,
      u.email as owner_email,
      u.username as owner_name,
      w.created_at as signup_date,
      u.last_login_at as last_login,
      COALESCE(e.sent_count, 0)::int as emails_sent,
      COALESCE(e.opened_count, 0)::int as emails_opened,
      COALESCE(e.replied_count, 0)::int as emails_replied,
      ROUND(COALESCE(e.opened_count, 0)::numeric / NULLIF(COALESCE(e.sent_count, 0), 0) * 100, 1)::float as open_rate,
      ROUND(COALESCE(e.replied_count, 0)::numeric / NULLIF(COALESCE(e.sent_count, 0), 0) * 100, 1)::float as reply_rate,
      -- 퍼널 상태
      (op.survey_data IS NOT NULL) as has_survey,
      (op.company_info_completed_at IS NOT NULL) as has_company_info,
      (op.lead_search_completed_at IS NOT NULL) as has_lead_search,
      (uea.workspace_id IS NOT NULL) as has_email_connected,
      (e.sent_count > 0) as has_email_sent,
      -- 사용자 입력 데이터
      op.survey_data
    FROM workspaces w
    JOIN users u ON w.owner_id = u.id
    LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
    LEFT JOIN (
      SELECT DISTINCT workspace_id FROM user_email_accounts
    ) uea ON uea.workspace_id = w.id
    LEFT JOIN (
      SELECT
        workspace_id,
        COUNT(*) as sent_count,
        COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
        COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied_count
      FROM emails
      WHERE direction = 'outbound' AND sent_at IS NOT NULL
      GROUP BY workspace_id
    ) e ON e.workspace_id = w.id
    WHERE w.subscription_tier = 'trial'
      AND u.user_role != 'admin'
      ${sql.raw(exclusion)}
    ORDER BY COALESCE(e.sent_count, 0) DESC, w.created_at DESC
  `)

  // Map to response format
  const workspaces: WorkspaceEmailPerformance[] = result.rows.map((row) => {
    // Determine performance level based on open rate
    let performanceLevel: "high" | "medium" | "low" | "none" = "none"
    if (row.emails_sent > 0) {
      if (row.open_rate >= 30) {
        performanceLevel = "high"
      } else if (row.open_rate >= 15) {
        performanceLevel = "medium"
      } else {
        performanceLevel = "low"
      }
    }

    return {
      workspaceId: row.workspace_id,
      companyName: row.company_name,
      ownerEmail: row.owner_email,
      ownerName: row.owner_name,
      signupDate: row.signup_date,
      lastLogin: row.last_login,
      emailsSent: row.emails_sent,
      emailsOpened: row.emails_opened,
      emailsReplied: row.emails_replied,
      openRate: row.open_rate ?? 0,
      replyRate: row.reply_rate ?? 0,
      performanceLevel,
      funnelStatus: {
        survey: row.has_survey ?? false,
        companyInfo: row.has_company_info ?? false,
        leadCreated: row.has_lead_search ?? false,
        emailConnected: row.has_email_connected ?? false,
        emailSent: row.has_email_sent ?? false,
      },
      surveyData: row.survey_data ?? null,
      companyDescription: row.company_description ?? null,
    }
  })

  // Calculate totals using reduce once
  let totalSent = 0
  let totalOpened = 0
  let totalReplied = 0
  let sumOpenRate = 0
  let sumReplyRate = 0
  let workspacesWithEmails = 0

  for (const w of workspaces) {
    totalSent += w.emailsSent
    totalOpened += w.emailsOpened
    totalReplied += w.emailsReplied
    if (w.emailsSent > 0) {
      workspacesWithEmails++
      sumOpenRate += w.openRate
      sumReplyRate += w.replyRate
    }
  }

  const avgOpenRate =
    workspacesWithEmails > 0 ? Math.round((sumOpenRate / workspacesWithEmails) * 10) / 10 : 0
  const avgReplyRate =
    workspacesWithEmails > 0 ? Math.round((sumReplyRate / workspacesWithEmails) * 10) / 10 : 0

  return {
    summary: {
      totalSent,
      totalOpened,
      totalReplied,
      avgOpenRate,
      avgReplyRate,
      workspacesWithEmails,
    },
    workspaces,
  }
}

/**
 * Get trial users list with pagination
 * 어드민 사용자 소유 워크스페이스 제외
 */
export async function getTrialUsers(
  page: number = 1,
  limit: number = 20,
  sortBy: string = "signupDate",
  sortOrder: "asc" | "desc" = "desc",
  // TODO: filter 기능 구현 예정
  _filter?: {
    status?: "active" | "at_risk" | "churned"
    onboardingStatus?: string
    authProvider?: string
  },
): Promise<TrialUsersResponse> {
  const offset = (page - 1) * limit

  // Build sort clause - CTE 내부 컬럼명 사용
  const sortColumn =
    {
      signupDate: "signup_date",
      lastLogin: "last_login",
      emailsSent: "emails_sent",
      openRate: "open_rate",
      companyName: "company_name",
    }[sortBy] || "signup_date"

  const result = await db.execute<{
    workspace_id: string
    company_name: string | null
    owner_email: string
    owner_name: string
    signup_date: string
    expiry_date: string | null
    onboarding_step: number
    onboarding_status: string
    last_login: string | null
    emails_sent: number
    emails_opened: number
    emails_replied: number
    open_rate: number
    reply_rate: number
    auth_provider: string
    total_count: number
  }>(sql`
    WITH trial_data AS (
      SELECT
        w.id as workspace_id,
        w.company_name,
        u.email as owner_email,
        u.username as owner_name,
        w.created_at as signup_date,
        w.subscription_valid_until as expiry_date,
        COALESCE(op.current_step, 0) as onboarding_step,
        COALESCE(op.status, 'not_started') as onboarding_status,
        u.last_login_at as last_login,
        COALESCE(e.sent_count, 0)::int as emails_sent,
        COALESCE(e.opened_count, 0)::int as emails_opened,
        COALESCE(e.replied_count, 0)::int as emails_replied,
        ROUND(COALESCE(e.opened_count, 0)::numeric / NULLIF(COALESCE(e.sent_count, 0), 0) * 100, 1)::float as open_rate,
        ROUND(COALESCE(e.replied_count, 0)::numeric / NULLIF(COALESCE(e.sent_count, 0), 0) * 100, 1)::float as reply_rate,
        u.auth_provider,
        COUNT(*) OVER() as total_count
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
      LEFT JOIN (
        SELECT
          workspace_id,
          COUNT(*) as sent_count,
          COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened_count,
          COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as replied_count
        FROM emails
        WHERE direction = 'outbound' AND sent_at IS NOT NULL
        GROUP BY workspace_id
      ) e ON e.workspace_id = w.id
      WHERE w.subscription_tier = 'trial'
        AND u.user_role != 'admin'
    )
    SELECT * FROM trial_data
    ORDER BY ${sql.raw(sortColumn)} ${sql.raw(sortOrder.toUpperCase())} NULLS LAST
    LIMIT ${limit} OFFSET ${offset}
  `)

  const totalCount = result.rows[0]?.total_count ?? 0

  const users: TrialUserItem[] = result.rows.map((row) => {
    // Calculate status based on activity
    let status: "active" | "at_risk" | "churned" = "active"
    if (row.last_login) {
      const lastLoginDate = new Date(row.last_login)
      const daysSinceLogin = Math.floor(
        (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24),
      )
      if (daysSinceLogin > 14) {
        status = "churned"
      } else if (daysSinceLogin > 7) {
        status = "at_risk"
      }
    }

    // Calculate days remaining
    let daysRemaining: number | null = null
    if (row.expiry_date) {
      const expiryDate = new Date(row.expiry_date)
      daysRemaining = Math.floor((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    }

    return {
      workspaceId: row.workspace_id,
      companyName: row.company_name,
      ownerEmail: row.owner_email,
      ownerName: row.owner_name,
      signupDate: row.signup_date,
      expiryDate: row.expiry_date,
      daysRemaining,
      onboardingStep: row.onboarding_step,
      onboardingStatus: row.onboarding_status,
      lastLogin: row.last_login,
      emailsSent: row.emails_sent,
      emailsOpened: row.emails_opened,
      emailsReplied: row.emails_replied,
      openRate: row.open_rate ?? 0,
      replyRate: row.reply_rate ?? 0,
      authProvider: row.auth_provider,
      status,
    }
  })

  return {
    users,
    pagination: {
      total: totalCount,
      page,
      limit,
    },
  }
}

/**
 * Get workspaces by onboarding step
 * 온보딩 단계별 워크스페이스 상세 조회
 * 새 퍼널 단계: signup, onboarding, company_info, lead_created, email_connected, email_sent
 */
export interface OnboardingStepWorkspace {
  workspaceId: string
  companyName: string | null
  ownerEmail: string
  ownerName: string
  completedAt: string | null
  currentStep: number
  // 퍼널 진행 상태 (실제 데이터 기반)
  funnelStatus: {
    survey: boolean // 로그인+설문완료 (survey_data IS NOT NULL)
    companyInfo: boolean
    leadCreated: boolean
    emailConnected: boolean
    emailSent: boolean
  }
}

export type OnboardingStepType =
  | "signup"
  | "onboarding"
  | "company_info"
  | "lead_created"
  | "email_connected"
  | "email_sent"

export async function getWorkspacesByOnboardingStep(
  step: OnboardingStepType,
): Promise<OnboardingStepWorkspace[]> {
  // Get exclusions from DB
  const excludeIds = await getExcludedWorkspaceIds()
  const exclusion = buildExclusionClause(excludeIds)

  // 공통 쿼리: 모든 퍼널 상태를 함께 조회
  // 어드민 사용자 소유 워크스페이스 및 제외 목록 적용
  const stepConditions: Record<OnboardingStepType, string> = {
    signup: "true", // 전체
    onboarding: "has_survey", // 로그인+설문완료 (survey_data가 있으면)
    company_info: "has_survey AND has_company_info", // 누적: 회사정보 완료
    lead_created: "has_survey AND has_company_info AND has_lead_search", // 누적: 리드 생성
    email_connected: "has_survey AND has_company_info AND has_lead_search AND has_email_connected", // 누적
    email_sent:
      "has_survey AND has_company_info AND has_lead_search AND has_email_connected AND has_email_sent", // 누적
  }

  const completedAtColumn: Record<OnboardingStepType, string> = {
    signup: "created_at",
    onboarding: "op_created_at",
    company_info: "company_info_completed_at",
    lead_created: "lead_search_completed_at",
    email_connected: "uea_time",
    email_sent: "sent_time",
  }

  const condition = stepConditions[step]
  const completedCol = completedAtColumn[step]

  const result = await db.execute<{
    workspace_id: string
    company_name: string | null
    owner_email: string
    owner_name: string
    completed_at: string | null
    current_step: number
    has_survey: boolean
    has_company_info: boolean
    has_lead_search: boolean
    has_email_connected: boolean
    has_email_sent: boolean
  }>(sql`
    WITH workspace_funnel AS (
      SELECT
        w.id as workspace_id,
        w.company_name,
        w.created_at,
        u.email as owner_email,
        u.username as owner_name,
        COALESCE(op.current_step, 0)::int as current_step,
        -- 퍼널 상태 (survey_data 있으면 로그인+설문 완료)
        (op.survey_data IS NOT NULL) as has_survey,
        (op.company_info_completed_at IS NOT NULL) as has_company_info,
        (op.lead_search_completed_at IS NOT NULL) as has_lead_search,
        (uea.workspace_id IS NOT NULL) as has_email_connected,
        (sent.workspace_id IS NOT NULL) as has_email_sent,
        -- 완료 시점
        op.created_at as op_created_at,
        op.company_info_completed_at,
        op.lead_search_completed_at,
        uea.uea_time,
        sent.sent_time
      FROM workspaces w
      JOIN users u ON w.owner_id = u.id
      LEFT JOIN onboarding_progress op ON op.workspace_id = w.id
      LEFT JOIN (
        SELECT workspace_id, MIN(created_at) as uea_time
        FROM user_email_accounts
        GROUP BY workspace_id
      ) uea ON uea.workspace_id = w.id
      LEFT JOIN (
        SELECT workspace_id, MIN(sent_at) as sent_time
        FROM emails
        WHERE direction = 'outbound' AND sent_at IS NOT NULL
        GROUP BY workspace_id
      ) sent ON sent.workspace_id = w.id
      WHERE w.subscription_tier = 'trial'
        AND u.user_role != 'admin'
        ${sql.raw(exclusion)}
    )
    SELECT
      workspace_id,
      company_name,
      owner_email,
      owner_name,
      ${sql.raw(completedCol)} as completed_at,
      current_step,
      has_survey,
      has_company_info,
      has_lead_search,
      has_email_connected,
      has_email_sent
    FROM workspace_funnel
    WHERE ${sql.raw(condition)}
    ORDER BY ${sql.raw(completedCol)} DESC NULLS LAST
    LIMIT 100
  `)

  return result.rows.map((row) => ({
    workspaceId: row.workspace_id,
    companyName: row.company_name,
    ownerEmail: row.owner_email,
    ownerName: row.owner_name,
    completedAt: row.completed_at,
    currentStep: row.current_step,
    funnelStatus: {
      survey: row.has_survey,
      companyInfo: row.has_company_info,
      leadCreated: row.has_lead_search,
      emailConnected: row.has_email_connected,
      emailSent: row.has_email_sent,
    },
  }))
}

/**
 * Extend trial period for a workspace
 */
export async function extendTrialPeriod(
  workspaceId: string,
  days: number,
): Promise<{ success: boolean; newExpiryDate: Date | null }> {
  try {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
    })

    if (!workspace) {
      return { success: false, newExpiryDate: null }
    }

    // Calculate new expiry date
    const baseDate = workspace.subscriptionValidUntil || new Date()
    const newExpiryDate = new Date(baseDate)
    newExpiryDate.setDate(newExpiryDate.getDate() + days)

    await db
      .update(workspaces)
      .set({
        subscriptionValidUntil: newExpiryDate,
        subscriptionStatus: "trialing",
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, workspaceId))

    logger.info({ workspaceId, days, newExpiryDate }, "[TrialAnalytics] Trial period extended")

    return { success: true, newExpiryDate }
  } catch (error) {
    logger.error({ error, workspaceId }, "[TrialAnalytics] Failed to extend trial")
    return { success: false, newExpiryDate: null }
  }
}

// ============================================================================
// Exclusion Management (통계 제외 관리)
// ============================================================================

export interface ExclusionInfo {
  id: string
  workspaceId: string
  companyName: string | null
  ownerName: string
  ownerEmail: string
  excludedBy: string
  excludedByName: string
  excludedAt: string
  reason: string | null
}

/**
 * Get all excluded workspace IDs from database
 * DB에서 제외된 워크스페이스 ID 목록 조회
 */
export async function getExcludedWorkspaceIds(): Promise<string[]> {
  const result = await db.execute<{ workspace_id: string }>(sql`
    SELECT workspace_id FROM trial_stat_exclusions
  `)
  return result.rows.map((r) => r.workspace_id)
}

/**
 * Get all exclusions with details
 * 제외 목록 상세 조회 (워크스페이스 정보 포함)
 */
export async function getExclusions(): Promise<ExclusionInfo[]> {
  const result = await db.execute<{
    id: string
    workspace_id: string
    company_name: string | null
    owner_name: string
    owner_email: string
    excluded_by: string
    excluded_by_name: string
    excluded_at: string
    reason: string | null
  }>(sql`
    SELECT
      tse.id,
      tse.workspace_id,
      w.company_name,
      u.username as owner_name,
      u.email as owner_email,
      tse.excluded_by,
      eu.username as excluded_by_name,
      tse.excluded_at,
      tse.reason
    FROM trial_stat_exclusions tse
    JOIN workspaces w ON w.id = tse.workspace_id
    JOIN users u ON u.id = w.owner_id
    JOIN users eu ON eu.id = tse.excluded_by
    ORDER BY tse.excluded_at DESC
  `)

  return result.rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspace_id,
    companyName: r.company_name,
    ownerName: r.owner_name,
    ownerEmail: r.owner_email,
    excludedBy: r.excluded_by,
    excludedByName: r.excluded_by_name,
    excludedAt: r.excluded_at,
    reason: r.reason,
  }))
}

/**
 * Add workspace to exclusion list
 * 워크스페이스를 통계 제외 목록에 추가
 */
export async function addExclusion(
  workspaceId: string,
  excludedBy: string,
  reason?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await db.insert(trialStatExclusions).values({
      workspaceId,
      excludedBy,
      reason: reason || null,
    })

    logger.info(
      { workspaceId, excludedBy, reason },
      "[TrialAnalytics] Workspace excluded from stats",
    )
    return { success: true }
  } catch (error) {
    // Check for unique constraint violation
    if ((error as { code?: string }).code === "23505") {
      return { success: false, error: "이미 제외된 워크스페이스입니다" }
    }
    logger.error({ error, workspaceId }, "[TrialAnalytics] Failed to add exclusion")
    return { success: false, error: "제외 추가 실패" }
  }
}

/**
 * Bulk add workspaces to exclusion list
 * 여러 워크스페이스를 통계 제외 목록에 일괄 추가
 */
export async function bulkAddExclusions(
  workspaceIds: string[],
  excludedBy: string,
  reason?: string,
): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0
  let failCount = 0

  for (const workspaceId of workspaceIds) {
    const result = await addExclusion(workspaceId, excludedBy, reason)
    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }

  return { successCount, failCount }
}

/**
 * Remove workspace from exclusion list
 * 워크스페이스를 통계 제외 목록에서 제거
 */
export async function removeExclusion(
  workspaceId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await db
      .delete(trialStatExclusions)
      .where(eq(trialStatExclusions.workspaceId, workspaceId))
      .returning()

    if (result.length === 0) {
      return { success: false, error: "제외 목록에 없는 워크스페이스입니다" }
    }

    logger.info({ workspaceId }, "[TrialAnalytics] Workspace removed from exclusion")
    return { success: true }
  } catch (error) {
    logger.error({ error, workspaceId }, "[TrialAnalytics] Failed to remove exclusion")
    return { success: false, error: "제외 해제 실패" }
  }
}

/**
 * Bulk remove workspaces from exclusion list
 * 여러 워크스페이스를 통계 제외 목록에서 일괄 제거
 */
export async function bulkRemoveExclusions(
  workspaceIds: string[],
): Promise<{ successCount: number; failCount: number }> {
  let successCount = 0
  let failCount = 0

  for (const workspaceId of workspaceIds) {
    const result = await removeExclusion(workspaceId)
    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }

  return { successCount, failCount }
}

/**
 * Clear all exclusions
 * 모든 제외 설정 초기화
 */
export async function clearAllExclusions(): Promise<{ success: boolean; count: number }> {
  try {
    const result = await db.delete(trialStatExclusions).returning()
    logger.info({ count: result.length }, "[TrialAnalytics] All exclusions cleared")
    return { success: true, count: result.length }
  } catch (error) {
    logger.error({ error }, "[TrialAnalytics] Failed to clear exclusions")
    return { success: false, count: 0 }
  }
}
