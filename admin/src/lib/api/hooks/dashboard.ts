import { useQuery } from "@tanstack/react-query"
import { dashboardApi } from "../services/dashboard"

export interface DateRangeParams {
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
}

// Queries
export function useDashboardStats(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.stats(params),
    queryFn: () => dashboardApi.getStats(params),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useLeadTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.leadTrends(params),
    queryFn: () => dashboardApi.getLeadTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmailTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.emailTrends(params),
    queryFn: () => dashboardApi.getEmailTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useOpenRateTrends(params?: DateRangeParams) {
  return useQuery({
    queryKey: dashboardKeys.openRateTrends(params),
    queryFn: () => dashboardApi.getOpenRateTrends(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useLeadDiscoveryNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.leadDiscoveryNotifications(params),
    queryFn: () => dashboardApi.getLeadDiscoveryNotifications(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useCampaignNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.campaignNotifications(params),
    queryFn: () => dashboardApi.getCampaignNotifications(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useReplyNotifications(params?: DateRangeParams & { limit?: number }) {
  return useQuery({
    queryKey: dashboardKeys.replyNotifications(params),
    queryFn: () => dashboardApi.getReplyNotifications(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}
