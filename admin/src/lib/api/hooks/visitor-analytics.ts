/**
 * Visitor Analytics API Hooks
 *
 * Hooks for fetching and managing visitor IP tracking data
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

export type VisitorSession = {
  id: string
  workspaceId: string
  ipAddress: string
  userAgent: string | null
  referrer: string | null
  landingPage: string | null
  ipapiData: Record<string, unknown> | null
  country: string | null
  countryCode: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  continent: string | null
  companyName: string | null
  companyDomain: string | null
  companyType: string | null
  asnNumber: number | null
  asnOrg: string | null
  asnType: string | null
  isVpn: boolean
  isProxy: boolean
  isTor: boolean
  isDatacenter: boolean
  isCrawler: boolean
  isMobile: boolean
  isAbuser: boolean
  visitCount: number
  firstVisitAt: string
  lastVisitAt: string
  createdAt: string
  updatedAt: string
}

export type VisitorStats = {
  totalVisitors: number
  uniqueCountries: number
  companyVisitors: number
  vpnVisitors: number
  topCountries: { country: string; count: number }[]
  topCompanies: { company: string; count: number }[]
  recentVisitors: VisitorSession[]
}

type ListVisitorsResponse = {
  success: boolean
  code: string
  message: string
  data: {
    sessions: VisitorSession[]
    total: number
    limit: number
    offset: number
  }
}

type VisitorStatsResponse = {
  success: boolean
  code: string
  message: string
  data: VisitorStats
}

type CleanupResponse = {
  success: boolean
  code: string
  message: string
  data: {
    deletedCount: number
    daysOld: number
  }
}

// ============================================================================
// Query Keys
// ============================================================================

export const visitorQueryKeys = {
  all: ["visitors"] as const,
  list: (workspaceId: string, limit?: number, offset?: number) =>
    [...visitorQueryKeys.all, "list", workspaceId, { limit, offset }] as const,
  stats: (workspaceId: string, days?: number) =>
    [...visitorQueryKeys.all, "stats", workspaceId, { days }] as const,
  detail: (workspaceId: string, visitorId: string) =>
    [...visitorQueryKeys.all, "detail", workspaceId, visitorId] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch visitor sessions list with pagination
 */
export function useVisitorSessions(
  workspaceId: string | undefined,
  options?: { limit?: number; offset?: number; enabled?: boolean },
) {
  const { limit = 50, offset = 0, enabled = true } = options || {}

  return useQuery({
    queryKey: visitorQueryKeys.list(workspaceId || "", limit, offset),
    queryFn: async () => {
      const res = await apiFetch<ListVisitorsResponse>(
        `/api/v1/workspaces/${workspaceId}/visitors?limit=${limit}&offset=${offset}`,
      )
      return res.data
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

/**
 * Fetch visitor statistics
 */
export function useVisitorStats(
  workspaceId: string | undefined,
  options?: { days?: number; enabled?: boolean },
) {
  const { days = 30, enabled = true } = options || {}

  return useQuery({
    queryKey: visitorQueryKeys.stats(workspaceId || "", days),
    queryFn: async () => {
      const res = await apiFetch<VisitorStatsResponse>(
        `/api/v1/workspaces/${workspaceId}/visitors/stats?days=${days}`,
      )
      return res.data
    },
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Fetch single visitor session details
 */
export function useVisitorSession(workspaceId: string | undefined, visitorId: string | undefined) {
  return useQuery({
    queryKey: visitorQueryKeys.detail(workspaceId || "", visitorId || ""),
    queryFn: async () => {
      const res = await apiFetch<{ success: boolean; data: VisitorSession }>(
        `/api/v1/workspaces/${workspaceId}/visitors/${visitorId}`,
      )
      return res.data
    },
    enabled: !!workspaceId && !!visitorId,
  })
}

/**
 * Cleanup old visitor sessions
 */
export function useCleanupVisitorSessions(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (daysOld: number) => {
      const res = await apiFetch<CleanupResponse>(
        `/api/v1/workspaces/${workspaceId}/visitors/cleanup?daysOld=${daysOld}`,
        { method: "DELETE" },
      )
      return res.data
    },
    onSuccess: () => {
      // Invalidate visitor queries to refetch data
      queryClient.invalidateQueries({ queryKey: visitorQueryKeys.all })
    },
  })
}
