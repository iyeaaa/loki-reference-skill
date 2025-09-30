// Customer Group Management API Types (aligned with backend database schema)

export interface CustomerGroup {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  criteria?: Record<string, unknown> | null // JSON field for segmentation criteria
  isDynamic: boolean
  createdBy?: string | null
  createdAt: string
  updatedAt: string
  // Extended fields from backend joins
  workspaceName?: string
  createdByUsername?: string
  createdByEmail?: string
}

export interface CustomerGroupMember {
  id: string
  groupId: string
  leadId: string
  addedBy?: string | null
  addedAt: string
}

export interface CreateCustomerGroupRequest {
  workspaceId: string
  name: string
  description?: string
  criteria?: Record<string, unknown>
  isDynamic?: boolean
  createdBy?: string
}

export interface UpdateCustomerGroupRequest {
  name: string
  description?: string
  criteria?: Record<string, unknown>
  isDynamic: boolean
}

export interface AddGroupMemberRequest {
  leadId: string
  addedBy?: string
}

export interface CustomerGroupsResponse {
  data: CustomerGroup[]
  total: number
  limit: number
  offset: number
}

export interface CustomerGroupMembersResponse {
  data: CustomerGroupMember[]
  total: number
  limit: number
  offset: number
}

export interface CustomerGroupsParams {
  page?: number
  limit?: number
  isDynamic?: boolean | "all"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export interface BulkAddMembersRequest {
  groupId: string
  leadIds: string[]
  addedBy?: string
}

export interface BulkRemoveMembersRequest {
  leadIds: string[]
}
