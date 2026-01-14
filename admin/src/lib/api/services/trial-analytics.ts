/**
 * Trial Analytics API Service
 * 체험판 관리 대시보드 API
 */

import { apiFetch } from "../client"

// ============================================================================
// Types
// ============================================================================

export type TrialSummary = {
  total: number
  trialing: number
  pastDue: number
  onboardingCompleted: number
  hasCampaign: number
  hasActiveCampaign: number
  hasSentEmail: number
  hasReply: number
}

export type SignupTrendItem = {
  date: string
  signups: number
  trialing: number
  pastDue: number
}

export type OnboardingFunnelItem = {
  step: string
  count: number
  rate: number
}

export type EmailDistributionItem = {
  range: string
  count: number
}

export type SourcePerformanceItem = {
  source: string
  workspaces: number
  onboardingRate: number
  emailsSent: number
  emailsOpened: number
  emailsReplied: number
}

export type ActivityDistributionItem = {
  period: string
  count: number
  [key: string]: string | number
}

export type CohortItem = {
  period: string // 표시용 (MM/DD 또는 MM/DD (요일))
  periodStart: string
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
}

export type CohortMode = "daily" | "weekly"

// 이메일 성과 요약
export type EmailPerformanceSummary = {
  totalSent: number
  totalOpened: number
  totalReplied: number
  avgOpenRate: number
  avgReplyRate: number
  workspacesWithEmails: number
}

// 워크스페이스별 이메일 성과
export type WorkspaceEmailPerformance = {
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
  funnelStatus: {
    survey: boolean
    companyInfo: boolean
    leadCreated: boolean
    emailConnected: boolean
    emailSent: boolean
  }
}

export type EmailPerformanceResponse = {
  summary: EmailPerformanceSummary
  workspaces: WorkspaceEmailPerformance[]
}

export type TrialAnalyticsResponse = {
  summary: TrialSummary
  signupTrend: SignupTrendItem[]
  onboardingFunnel: OnboardingFunnelItem[]
  emailDistribution: EmailDistributionItem[]
  sourcePerformance: SourcePerformanceItem[]
  activityDistribution: ActivityDistributionItem[]
  cohortData: CohortItem[]
  emailPerformance: EmailPerformanceResponse
}

export type TrialUserItem = {
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

export type TrialUsersResponse = {
  users: TrialUserItem[]
  pagination: {
    total: number
    page: number
    limit: number
  }
}

export type TrialAnalyticsParams = {
  days?: number
  cohortMode?: CohortMode
  excludeWorkspaceIds?: string[]
}

export type TrialUsersParams = {
  page?: number
  limit?: number
  sortBy?: "signupDate" | "lastLogin" | "emailsSent" | "openRate" | "companyName"
  sortOrder?: "asc" | "desc"
  status?: "active" | "at_risk" | "churned"
  onboardingStatus?: string
  authProvider?: "google" | "local"
}

export type ExtendTrialParams = {
  workspaceId: string
  days: number
}

export type BulkExtendTrialParams = {
  workspaceIds: string[]
  days: number
}

export type OnboardingStep =
  | "signup"
  | "onboarding"
  | "company_info"
  | "lead_created"
  | "email_connected"
  | "email_sent"

export type OnboardingStepWorkspace = {
  workspaceId: string
  companyName: string | null
  ownerEmail: string
  ownerName: string
  completedAt: string | null
  currentStep: number
  funnelStatus: {
    survey: boolean // 설문+로그인 완료 (survey_data IS NOT NULL)
    companyInfo: boolean
    leadCreated: boolean
    emailConnected: boolean
    emailSent: boolean
  }
}

// ============================================================================
// API Functions
// ============================================================================

export const trialAnalyticsApi = {
  /**
   * Get trial analytics dashboard data
   */
  async getAnalytics(params?: TrialAnalyticsParams): Promise<TrialAnalyticsResponse> {
    const searchParams = new URLSearchParams()
    if (params?.days) {
      searchParams.set("days", String(params.days))
    }
    if (params?.cohortMode) {
      searchParams.set("cohortMode", params.cohortMode)
    }
    if (params?.excludeWorkspaceIds?.length) {
      searchParams.set("excludeWorkspaceIds", params.excludeWorkspaceIds.join(","))
    }

    const query = searchParams.toString()
    const url = `/api/v1/admin/trial-analytics${query ? `?${query}` : ""}`

    return apiFetch<TrialAnalyticsResponse>(url)
  },

  /**
   * Get trial users list
   */
  async getUsers(params?: TrialUsersParams): Promise<TrialUsersResponse> {
    const searchParams = new URLSearchParams()
    if (params?.page) {
      searchParams.set("page", String(params.page))
    }
    if (params?.limit) {
      searchParams.set("limit", String(params.limit))
    }
    if (params?.sortBy) {
      searchParams.set("sortBy", params.sortBy)
    }
    if (params?.sortOrder) {
      searchParams.set("sortOrder", params.sortOrder)
    }
    if (params?.status) {
      searchParams.set("status", params.status)
    }
    if (params?.onboardingStatus) {
      searchParams.set("onboardingStatus", params.onboardingStatus)
    }
    if (params?.authProvider) {
      searchParams.set("authProvider", params.authProvider)
    }

    const query = searchParams.toString()
    const url = `/api/v1/admin/trial-analytics/users${query ? `?${query}` : ""}`

    return apiFetch<TrialUsersResponse>(url)
  },

  /**
   * Extend trial period for a workspace
   */
  async extendTrial(params: ExtendTrialParams): Promise<{ newExpiryDate: string | null }> {
    return apiFetch<{ newExpiryDate: string | null }>("/api/v1/admin/trial-analytics/extend", {
      method: "POST",
      body: JSON.stringify(params),
    })
  },

  /**
   * Bulk extend trial period
   */
  async bulkExtendTrial(
    params: BulkExtendTrialParams,
  ): Promise<{ successCount: number; failCount: number }> {
    return apiFetch<{ successCount: number; failCount: number }>(
      "/api/v1/admin/trial-analytics/bulk-extend",
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    )
  },

  /**
   * Get workspaces by onboarding step
   * 온보딩 단계별 워크스페이스 상세 조회
   */
  async getWorkspacesByStep(step: OnboardingStep): Promise<OnboardingStepWorkspace[]> {
    return apiFetch<OnboardingStepWorkspace[]>(`/api/v1/admin/trial-analytics/onboarding/${step}`)
  },
}
