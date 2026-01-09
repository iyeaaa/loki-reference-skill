import { useQuery } from "@tanstack/react-query"
import { dashboardApi, type TrialDashboardParams } from "../services/dashboard"

export type DateRangeParams = {
  startDate?: string
  endDate?: string
  workspaceId?: string
}

// Query Keys
export const dashboardKeys = {
  all: ["dashboard"] as const,
  stats: (params?: DateRangeParams) => [...dashboardKeys.all, "stats", params] as const,
  trends: () => [...dashboardKeys.all, "trends"] as const,
  leadTrends: (params?: DateRangeParams) => [...dashboardKeys.trends(), "leads", params] as const,
  emailTrends: (params?: DateRangeParams) => [...dashboardKeys.trends(), "emails", params] as const,
  openRateTrends: (params?: DateRangeParams) =>
    [...dashboardKeys.trends(), "opens", params] as const,
  notifications: () => [...dashboardKeys.all, "notifications"] as const,
  leadDiscoveryNotifications: (params?: DateRangeParams & { limit?: number }) =>
    [...dashboardKeys.notifications(), "lead-discovery", params] as const,
  campaignNotifications: (params?: DateRangeParams & { limit?: number }) =>
    [...dashboardKeys.notifications(), "campaigns", params] as const,
  replyNotifications: (params?: DateRangeParams & { limit?: number }) =>
    [...dashboardKeys.notifications(), "replies", params] as const,
  trialStats: (params: TrialDashboardParams) => [...dashboardKeys.all, "trial", params] as const,
}

// Queries
export function useDashboardStats(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.stats(params),
    queryFn: () => dashboardApi.getStats(params),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false,
  })
}

export function useLeadTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.leadTrends(params),
    queryFn: () => dashboardApi.getLeadTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false,
  })
}

export function useEmailTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.emailTrends(params),
    queryFn: () => dashboardApi.getEmailTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false,
  })
}

export function useOpenRateTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.openRateTrends(params),
    queryFn: () => dashboardApi.getOpenRateTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false,
  })
}

export function useLeadDiscoveryNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.leadDiscoveryNotifications(params),
    queryFn: () => dashboardApi.getLeadDiscoveryNotifications(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchIntervalInBackground: false,
  })
}

export function useCampaignNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.campaignNotifications(params),
    queryFn: () => dashboardApi.getCampaignNotifications(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
    refetchIntervalInBackground: false,
  })
}

export function useReplyNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.replyNotifications(params),
    queryFn: () => dashboardApi.getReplyNotifications(params),
    staleTime: 10 * 1000, // 10 seconds (shorter for reply notifications)
    gcTime: 5 * 60 * 1000,
    refetchInterval: 15 * 1000, // Refetch every 15 seconds to get updated sentiment labels
    refetchIntervalInBackground: false, // Stop polling when tab is not active
  })
}

// Trial Dashboard - Single optimized API call
// workspaceId가 없으면 전체 워크스페이스 데이터 조회
export function useTrialDashboardStats(params: TrialDashboardParams, enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.trialStats(params),
    queryFn: () => dashboardApi.getTrialDashboardStats(params),
    enabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for real-time updates
    refetchIntervalInBackground: false,
  })
}
