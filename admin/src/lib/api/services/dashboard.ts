import { apiFetch } from "../client"

export type DateRangeParams = {
  startDate?: string
  endDate?: string
  workspaceId?: string
}

export type DashboardStats = {
  leads: {
    total: number
    periodCount: number
  }
  emails: {
    total: number
    periodCount: number
  }
  openRate: {
    rate: number
    totalSent: number
    totalOpened: number
    periodOpened: number
  }
}

export type TrendDataPoint = {
  date: string
  count: number
}

export type LeadDiscoveryNotification = {
  id: string
  customerGroupId: string
  customerGroupName: string
  leadCount: number
  addedAt: string
}

export type CampaignNotification = {
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
  updatedAt: string
}

export type ReplyNotification = {
  id: string
  fromEmail: string
  subject: string | null
  bodyText: string | null
  sentiment: string | null
  intent: string | null
  leadName: string | null
  createdAt: string
}

// Unified Dashboard Types (통합 대시보드)
export type UnifiedDashboardParams = {
  workspaceId?: string // Optional: 없으면 전체 워크스페이스 데이터 조회
  sequenceId?: string
  startDate?: string // ISO 8601 date string (e.g., "2024-01-01")
  endDate?: string // ISO 8601 date string (e.g., "2024-01-31")
}

export type UnifiedFunnelData = {
  scheduled: number // 발송 예정
  sent: number
  opened: number
  clicked: number
  replied: number
  openRate: number
  clickRate: number
  replyRate: number
}

export type UnifiedHotLead = {
  id: string
  companyName: string
  email: string
  country: string
  openCount: number
  clickCount: number
  score: number
}

export type UnifiedRecentActivity = {
  id: string
  type: "sent" | "opened" | "clicked" | "replied"
  leadName: string | null
  companyName: string | null
  email: string
  stepOrder: number | null
  timestamp: string
  openCount?: number
}

export type UnifiedSubscriptionInfo = {
  status: string
  trialStart: string | null
  trialEnd: string | null
  daysRemaining: number
  trialDays: number
}

export type UnifiedDailyStats = {
  date: string
  sent: number
  opened: number
  clicked: number
}

export type UnifiedCountryStats = {
  country: string
  count: number
  percentage: number
}

export type UnifiedDashboardStats = {
  subscription: UnifiedSubscriptionInfo
  funnel: UnifiedFunnelData
  hotLeads: UnifiedHotLead[]
  recentActivity: UnifiedRecentActivity[]
  dailyStats: UnifiedDailyStats[]
  countryStats: UnifiedCountryStats[]
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

export const dashboardApi = {
  getStats: async (params?: DateRangeParams): Promise<DashboardStats> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const query = searchParams.toString()
    return apiFetch<DashboardStats>(`/api/v1/dashboard/stats${query ? `?${query}` : ""}`)
  },

  getLeadTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/leads${query ? `?${query}` : ""}`)
  },

  getEmailTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/emails${query ? `?${query}` : ""}`)
  },

  getOpenRateTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/opens${query ? `?${query}` : ""}`)
  },

  getLeadDiscoveryNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<LeadDiscoveryNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString())
    }

    const query = searchParams.toString()
    return apiFetch<LeadDiscoveryNotification[]>(
      `/api/v1/dashboard/notifications/lead-discovery${query ? `?${query}` : ""}`,
    )
  },

  getCampaignNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<CampaignNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString())
    }

    const query = searchParams.toString()
    return apiFetch<CampaignNotification[]>(
      `/api/v1/dashboard/notifications/campaigns${query ? `?${query}` : ""}`,
    )
  },

  getReplyNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<ReplyNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString())
    }

    const query = searchParams.toString()
    return apiFetch<ReplyNotification[]>(
      `/api/v1/dashboard/notifications/replies${query ? `?${query}` : ""}`,
    )
  },

  // Unified Dashboard - Single optimized API call (통합 대시보드)
  // workspaceId가 없으면 전체 워크스페이스 데이터 조회
  getUnifiedDashboardStats: async (
    params: UnifiedDashboardParams,
  ): Promise<UnifiedDashboardStats> => {
    const searchParams = new URLSearchParams()
    if (params.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params.sequenceId) {
      searchParams.append("sequenceId", params.sequenceId)
    }
    if (params.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params.endDate) {
      searchParams.append("endDate", params.endDate)
    }

    const query = searchParams.toString()
    return apiFetch<UnifiedDashboardStats>(`/api/v1/dashboard/unified${query ? `?${query}` : ""}`)
  },
}
