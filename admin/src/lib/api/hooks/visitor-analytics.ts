/**
 * Visitor Analytics API Hooks
 *
 * Hooks for fetching and managing visitor IP tracking data
 * B2B Intelligence features included
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetch } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

export type VisitorType =
  | "isp"
  | "hosting"
  | "business"
  | "education"
  | "government"
  | "residential"
  | "unknown"

export type VisitorSession = {
  id: string
  workspaceId: string
  ipAddress: string
  userAgent: string | null
  referrer: string | null
  landingPage: string | null
  ipapiData: Record<string, unknown> | null

  // B2B Intelligence fields
  visitorType: VisitorType | null
  isB2bLead: boolean
  leadScore: number | null

  // Location fields
  country: string | null
  countryCode: string | null
  city: string | null
  region: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  continent: string | null
  zip: string | null
  isEuMember: boolean
  callingCode: string | null
  currencyCode: string | null

  // Company fields
  companyName: string | null
  companyDomain: string | null
  companyType: string | null
  companyNetwork: string | null
  companyAbuserScore: string | null

  // ASN fields
  asnNumber: number | null
  asnOrg: string | null
  asnType: string | null
  asnRoute: string | null
  asnDescr: string | null
  asnDomain: string | null
  asnCountry: string | null
  asnAbuseEmail: string | null
  asnAbuserScore: string | null

  // Datacenter fields
  datacenterName: string | null
  datacenterDomain: string | null
  datacenterNetwork: string | null

  // Security flags
  isVpn: boolean
  isProxy: boolean
  isTor: boolean
  isDatacenter: boolean
  isCrawler: boolean
  isMobile: boolean
  isAbuser: boolean
  isBogon: boolean
  isSatellite: boolean

  // Metrics
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
  // B2B Intelligence stats
  b2bLeads: number
  avgLeadScore: number
  visitorTypeDistribution: { type: VisitorType; count: number }[]
  topCountries: { country: string; count: number }[]
  topCompanies: { company: string; count: number }[]
  recentVisitors: VisitorSession[]
}

export type VisitorFilters = {
  search?: string
  countries?: string[]
  hasCompany?: boolean
  securityFlags?: ("vpn" | "proxy" | "tor" | "datacenter" | "mobile" | "crawler" | "abuser")[]
  dateFrom?: string
  dateTo?: string
  sortBy?: "lastVisitAt" | "firstVisitAt" | "visitCount" | "country" | "companyName" | "leadScore"
  sortOrder?: "asc" | "desc"
  // B2B filters
  visitorTypes?: VisitorType[]
  isB2bLead?: boolean
  minLeadScore?: number
  // Noise exclusion filters (default: true = exclude)
  excludeIsp?: boolean // ISP traffic (default: true)
  excludeHosting?: boolean // Hosting/cloud providers (default: true)
  excludeDatacenter?: boolean // Datacenter IPs (default: true)
  excludeSuspicious?: boolean // Proxy/Abuser/Tor traffic (default: true)
}

export type VisitorCountry = {
  countryCode: string
  country: string
  count: number
}

export type ExcludedCompany = {
  id: string
  workspaceId: string
  companyDomain: string
  companyName: string | null
  excludedBy: string
  excludedAt: string
  reason: string | null
  createdAt: string
  updatedAt: string
}

// Note: apiFetch auto-unwraps { success, data } responses, so we define the inner data type
type ListVisitorsData = {
  sessions: VisitorSession[]
  total: number
  totalPages: number
  limit: number
  offset: number
  page: number
}

type CleanupData = {
  deletedCount: number
  daysOld: number
}

// ============================================================================
// Query Keys
// ============================================================================

export const visitorQueryKeys = {
  all: ["visitors"] as const,
  list: (
    workspaceId: string,
    params?: { limit?: number; offset?: number; filters?: VisitorFilters },
  ) => [...visitorQueryKeys.all, "list", workspaceId, params] as const,
  stats: (workspaceId: string, days?: number) =>
    [...visitorQueryKeys.all, "stats", workspaceId, { days }] as const,
  countries: (workspaceId: string) => [...visitorQueryKeys.all, "countries", workspaceId] as const,
  detail: (workspaceId: string, visitorId: string) =>
    [...visitorQueryKeys.all, "detail", workspaceId, visitorId] as const,
  excludedCompanies: (workspaceId: string) =>
    [...visitorQueryKeys.all, "excluded-companies", workspaceId] as const,
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Fetch visitor sessions list with pagination and filters
 */
export function useVisitorSessions(
  workspaceId: string | undefined,
  options?: {
    limit?: number
    offset?: number
    filters?: VisitorFilters
    enabled?: boolean
  },
) {
  const { limit = 50, offset = 0, filters, enabled = true } = options || {}

  return useQuery({
    queryKey: visitorQueryKeys.list(workspaceId || "", { limit, offset, filters }),
    queryFn: async () => {
      const params = new URLSearchParams()
      params.set("limit", limit.toString())
      params.set("offset", offset.toString())

      if (filters) {
        if (filters.search) {
          params.set("search", filters.search)
        }
        if (filters.countries?.length) {
          params.set("countries", filters.countries.join(","))
        }
        if (filters.hasCompany !== undefined) {
          params.set("hasCompany", filters.hasCompany.toString())
        }
        if (filters.securityFlags?.length) {
          params.set("securityFlags", filters.securityFlags.join(","))
        }
        if (filters.dateFrom) {
          params.set("dateFrom", filters.dateFrom)
        }
        if (filters.dateTo) {
          params.set("dateTo", filters.dateTo)
        }
        if (filters.sortBy) {
          params.set("sortBy", filters.sortBy)
        }
        if (filters.sortOrder) {
          params.set("sortOrder", filters.sortOrder)
        }
        // Noise exclusion filters (default: true on backend if not provided)
        if (filters.excludeIsp !== undefined) {
          params.set("excludeIsp", filters.excludeIsp.toString())
        }
        if (filters.excludeHosting !== undefined) {
          params.set("excludeHosting", filters.excludeHosting.toString())
        }
        if (filters.excludeDatacenter !== undefined) {
          params.set("excludeDatacenter", filters.excludeDatacenter.toString())
        }
        if (filters.excludeSuspicious !== undefined) {
          params.set("excludeSuspicious", filters.excludeSuspicious.toString())
        }
      }

      // apiFetch auto-unwraps { success, data } responses
      return apiFetch<ListVisitorsData>(
        `/api/v1/workspaces/${workspaceId}/visitors?${params.toString()}`,
      )
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
      // apiFetch auto-unwraps { success, data } responses
      return apiFetch<VisitorStats>(`/api/v1/workspaces/${workspaceId}/visitors/stats?days=${days}`)
    },
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Fetch unique countries for filter dropdown
 */
export function useVisitorCountries(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: visitorQueryKeys.countries(workspaceId || ""),
    queryFn: async () => {
      // apiFetch auto-unwraps { success, data } responses
      return apiFetch<VisitorCountry[]>(`/api/v1/workspaces/${workspaceId}/visitors/countries`)
    },
    enabled: enabled && !!workspaceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Fetch single visitor session details
 */
export function useVisitorSession(workspaceId: string | undefined, visitorId: string | undefined) {
  return useQuery({
    queryKey: visitorQueryKeys.detail(workspaceId || "", visitorId || ""),
    queryFn: async () => {
      // apiFetch auto-unwraps { success, data } responses
      return apiFetch<VisitorSession>(`/api/v1/workspaces/${workspaceId}/visitors/${visitorId}`)
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
      // apiFetch auto-unwraps { success, data } responses
      return apiFetch<CleanupData>(
        `/api/v1/workspaces/${workspaceId}/visitors/cleanup?daysOld=${daysOld}`,
        { method: "DELETE" },
      )
    },
    onSuccess: () => {
      // Invalidate visitor queries to refetch data
      queryClient.invalidateQueries({ queryKey: visitorQueryKeys.all })
    },
  })
}

// ============================================================================
// Excluded Companies Hooks
// ============================================================================

/**
 * Fetch excluded companies list
 */
export function useExcludedCompanies(workspaceId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: visitorQueryKeys.excludedCompanies(workspaceId || ""),
    queryFn: async () =>
      apiFetch<ExcludedCompany[]>(`/api/v1/workspaces/${workspaceId}/visitors/excluded-companies`),
    enabled: enabled && !!workspaceId,
    staleTime: 60 * 1000, // 1 minute
  })
}

/**
 * Add company to exclusion list
 */
export function useAddExcludedCompany(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      companyDomain: string
      companyName?: string
      reason?: string
      excludedBy: string
    }) =>
      apiFetch<ExcludedCompany>(`/api/v1/workspaces/${workspaceId}/visitors/excluded-companies`, {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      // Invalidate all visitor queries to refetch with new exclusion
      queryClient.invalidateQueries({ queryKey: visitorQueryKeys.all })
    },
  })
}

/**
 * Remove company from exclusion list
 */
export function useRemoveExcludedCompany(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (excludedCompanyId: string) =>
      apiFetch<{ id: string }>(
        `/api/v1/workspaces/${workspaceId}/visitors/excluded-companies/${excludedCompanyId}`,
        { method: "DELETE" },
      ),
    onSuccess: () => {
      // Invalidate all visitor queries to refetch without exclusion
      queryClient.invalidateQueries({ queryKey: visitorQueryKeys.all })
    },
  })
}

// ============================================================================
// Companies for Exclusion (Dropdown Selection)
// ============================================================================

export type CompanyForExclusion = {
  companyDomain: string
  companyName: string | null
  visitorCount: number
  isExcluded: boolean
}

/**
 * Fetch companies available for exclusion dropdown
 */
export function useCompaniesForExclusion(
  workspaceId: string | undefined,
  options?: { search?: string; limit?: number; enabled?: boolean },
) {
  const { search, limit = 100, enabled = true } = options || {}

  return useQuery({
    queryKey: [...visitorQueryKeys.all, "companies-for-exclusion", workspaceId, { search, limit }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) {
        params.set("search", search)
      }
      if (limit) {
        params.set("limit", limit.toString())
      }

      const queryString = params.toString()
      return apiFetch<CompanyForExclusion[]>(
        `/api/v1/workspaces/${workspaceId}/visitors/companies-for-exclusion${queryString ? `?${queryString}` : ""}`,
      )
    },
    enabled: enabled && !!workspaceId,
    staleTime: 30 * 1000, // 30 seconds
  })
}

export type BulkUpdateExclusionsInput = {
  toAdd?: { domain: string; name?: string }[]
  toRemove?: string[]
  excludedBy: string
  reason?: string
}

export type BulkUpdateExclusionsResult = {
  added: number
  removed: number
  addedDomains: string[]
  removedDomains: string[]
}

/**
 * Bulk update excluded companies (add and remove in one request)
 */
export function useBulkUpdateExcludedCompanies(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BulkUpdateExclusionsInput) =>
      apiFetch<BulkUpdateExclusionsResult>(
        `/api/v1/workspaces/${workspaceId}/visitors/excluded-companies/bulk`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      // Invalidate all visitor queries to refetch with new exclusion settings
      queryClient.invalidateQueries({ queryKey: visitorQueryKeys.all })
    },
  })
}

// ============================================================================
// Visitor to Customer Group Sync
// ============================================================================

export type SyncVisitorsToLeadsInput = {
  userId: string
  days?: number
}

export type SyncVisitorsToLeadsResult = {
  groupId: string
  groupName: string
  leadsCreated: number
  leadsAddedToGroup: number
  skipped: number
  totalFilteredVisitors: number
}

/**
 * Sync filtered visitors to customer group as leads
 * Creates leads from filtered visitors (noise filtered + excluded companies)
 * and adds them to a customer group.
 */
export function useSyncVisitorsToLeads(workspaceId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: SyncVisitorsToLeadsInput) =>
      apiFetch<SyncVisitorsToLeadsResult>(
        `/api/v1/workspaces/${workspaceId}/visitors/sync-to-leads`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),
    onSuccess: () => {
      // Invalidate customer groups queries to show new group
      queryClient.invalidateQueries({ queryKey: ["customer-groups"] })
    },
  })
}
