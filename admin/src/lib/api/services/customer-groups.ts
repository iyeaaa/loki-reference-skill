import { apiFetch } from "@/lib/api/client"
import { generateGroupName } from "@/lib/utils/group-name-generator"
import { analyzeLeadsForGroupName } from "@/lib/utils/lead-analyzer"
import type {
  AddGroupMemberRequest,
  CreateCustomerGroupRequest,
  CustomerGroup,
  CustomerGroupMember,
  CustomerGroupsParams,
  UpdateCustomerGroupRequest,
} from "../types/customer-group"
import type { Lead } from "../types/lead"

export const customerGroupsApi = {
  list: (params?: CustomerGroupsParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.isDynamic !== undefined && params.isDynamic !== "all") {
      searchParams.append("isDynamic", params.isDynamic.toString())
    }
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","))
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: CustomerGroup[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/customer-groups/search${query ? `?${query}` : ""}`).then((response) => ({
      customerGroups: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (groupId: string) => apiFetch<CustomerGroup>(`/api/v1/customer-groups/${groupId}`),

  create: (data: CreateCustomerGroupRequest) =>
    apiFetch<CustomerGroup>("/api/v1/customer-groups", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (groupId: string, data: UpdateCustomerGroupRequest) =>
    apiFetch<CustomerGroup>(`/api/v1/customer-groups/${groupId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (groupId: string) =>
    apiFetch(`/api/v1/customer-groups/${groupId}`, {
      method: "DELETE",
    }),

  // Group members
  getMembers: (groupId: string, page = 1, limit = 10) => {
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    return apiFetch<{
      data: CustomerGroupMember[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/customer-groups/${groupId}/members?${searchParams.toString()}`).then(
      (response) => ({
        members: response.data,
        total: response.total,
        page,
        limit,
        totalPages: Math.ceil(response.total / limit),
      }),
    )
  },

  addMember: (groupId: string, data: AddGroupMemberRequest) =>
    apiFetch<CustomerGroupMember>(`/api/v1/customer-groups/${groupId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  removeMember: (groupId: string, leadId: string) =>
    apiFetch(`/api/v1/customer-groups/${groupId}/members/${leadId}`, {
      method: "DELETE",
    }),

  bulkRemoveMembers: (groupId: string, leadIds: string[]) =>
    apiFetch<{ removedCount: number }>(`/api/v1/admin/customer-groups/${groupId}/members/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ leadIds }),
    }),

  bulkDelete: (groupIds: string[]) =>
    apiFetch<{ deletedCount: number }>("/api/v1/admin/customer-groups/bulk", {
      method: "DELETE",
      body: JSON.stringify({ groupIds }),
    }),

  getByWorkspace: (workspaceId: string) =>
    apiFetch<CustomerGroup[]>(`/api/v1/customer-groups/workspace/${workspaceId}`),

  getLeadGroups: (leadId: string) =>
    apiFetch<CustomerGroup[]>(`/api/v1/customer-groups/lead/${leadId}/groups`),

  // Get group members with emails and reply status for sequence enrollment
  getMembersWithEmails: (groupId: string) =>
    apiFetch<
      Array<{
        id: string
        name: string
        email: string
        hasReplied: boolean
        country?: string | null
        city?: string | null
        state?: string | null
        businessType?: string | null
        leadSource?: string | null
        employeeCount?: string | null
        leadStatus?: string | null
      }>
    >(`/api/v1/customer-groups/${groupId}/members-with-emails`),

  // 그룹에 리드 일괄 추가
  bulkAddMembers: (groupId: string, leadIds: string[]) =>
    apiFetch<{ addedCount: number }>(`/api/v1/admin/customer-groups/${groupId}/members/bulk`, {
      method: "POST",
      body: JSON.stringify({ leadIds }),
    }),

  /**
   * Generates a group name based on lead data analysis.
   * Fetches lead data, analyzes common attributes, and returns a formatted group name.
   *
   * @param leadIds - Array of lead IDs to analyze
   * @returns Promise resolving to generated group name string
   *
   * @example
   * ```typescript
   * const name = await customerGroupsApi.generateGroupNameFromLeads(['lead-1', 'lead-2'])
   * // Returns: "Korea_Large_B2B_SaaS_2025-10-28"
   * ```
   */
  generateGroupNameFromLeads: async (leadIds: string[]): Promise<string> => {
    if (!leadIds || leadIds.length === 0) {
      return generateGroupName({
        country: "Unknown",
        scale: "Unknown",
        businessType: "Unknown",
        businessSector: "Unknown",
        uploadDate: new Date().toISOString().split("T")[0],
      })
    }

    try {
      // Fetch all leads in parallel
      const leadsPromises = leadIds.map((leadId) =>
        apiFetch<Lead>(`/api/v1/leads/${leadId}`).catch((error) => {
          console.error(`Failed to fetch lead ${leadId}:`, error)
          return null
        }),
      )

      const leads = await Promise.all(leadsPromises)
      const validLeads = leads.filter((lead): lead is Lead => lead !== null)

      if (validLeads.length === 0) {
        throw new Error("No valid leads found")
      }

      // Analyze leads and generate name
      const template = analyzeLeadsForGroupName(validLeads)
      return generateGroupName(template)
    } catch (error) {
      console.error("Error generating group name from leads:", error)
      // Return fallback name
      return generateGroupName({
        country: "Unknown",
        scale: "Unknown",
        businessType: "Unknown",
        businessSector: "Unknown",
        uploadDate: new Date().toISOString().split("T")[0],
      })
    }
  },
}
