import { apiFetch } from "../client"

export interface DateRangeParams {
  startDate?: string
  endDate?: string
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
    rate: number
    totalSent: number
    totalOpened: number
    periodOpened: number
  }
}

export interface TrendDataPoint {
  date: string
  count: number
}

export interface LeadDiscoveryNotification {
  id: string
  customerGroupId: string
  customerGroupName: string
  leadCount: number
  addedAt: string
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
  updatedAt: string
}

export interface ReplyNotification {
  id: string
  fromEmail: string
  subject: string | null
  bodyText: string | null
  sentiment: string | null
  intent: string | null
  leadName: string | null
  createdAt: string
}

export const dashboardApi = {
  getStats: async (params?: DateRangeParams): Promise<DashboardStats> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)

    const query = searchParams.toString()
    return apiFetch<DashboardStats>(`/api/v1/dashboard/stats${query ? `?${query}` : ""}`)
  },

  getLeadTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/leads${query ? `?${query}` : ""}`)
  },

  getEmailTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/emails${query ? `?${query}` : ""}`)
  },

  getOpenRateTrends: async (params?: DateRangeParams): Promise<TrendDataPoint[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)

    const query = searchParams.toString()
    return apiFetch<TrendDataPoint[]>(`/api/v1/dashboard/trends/opens${query ? `?${query}` : ""}`)
  },

  getLeadDiscoveryNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<LeadDiscoveryNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)
    if (params?.limit) searchParams.append("limit", params.limit.toString())

    const query = searchParams.toString()
    return apiFetch<LeadDiscoveryNotification[]>(
      `/api/v1/dashboard/notifications/lead-discovery${query ? `?${query}` : ""}`,
    )
  },

  getCampaignNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<CampaignNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)
    if (params?.limit) searchParams.append("limit", params.limit.toString())

    const query = searchParams.toString()
    return apiFetch<CampaignNotification[]>(
      `/api/v1/dashboard/notifications/campaigns${query ? `?${query}` : ""}`,
    )
  },

  getReplyNotifications: async (
    params?: DateRangeParams & { limit?: number },
  ): Promise<ReplyNotification[]> => {
    const searchParams = new URLSearchParams()
    if (params?.startDate) searchParams.append("startDate", params.startDate)
    if (params?.endDate) searchParams.append("endDate", params.endDate)
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)
    if (params?.limit) searchParams.append("limit", params.limit.toString())

    const query = searchParams.toString()
    return apiFetch<ReplyNotification[]>(
      `/api/v1/dashboard/notifications/replies${query ? `?${query}` : ""}`,
    )
  },
}
