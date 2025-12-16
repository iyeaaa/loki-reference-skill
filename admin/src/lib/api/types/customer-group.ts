// Customer Group Management API Types (aligned with backend database schema)

export type CustomerGroup = {
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
  leadCount?: number
}

export type CustomerGroupMember = {
  id: string
  groupId: string
  leadId: string
  addedBy?: string | null
  addedAt: string
}

export type CreateCustomerGroupRequest = {
  workspaceId: string
  name: string
  description?: string
  criteria?: Record<string, unknown>
  isDynamic?: boolean
  createdBy?: string
  csvData?: Array<{
    companyName: string
    foundCompanyName?: string
    businessType?: string
    websiteUrl?: string
    description?: string
    employeeCount?: string
    foundedYear?: number
    country?: string
    city?: string
    state?: string
    address?: string
    leadSource?: string
    leadStatus?: string
    leadScore?: number
    notes?: string
    primaryEmail?: string
    primaryPhone?: string
    secondaryEmail?: string
    secondaryPhone?: string
  }>
}

export type UpdateCustomerGroupRequest = {
  name: string
  description?: string | null
  criteria?: Record<string, unknown> | null
  isDynamic: boolean
}

export type AddGroupMemberRequest = {
  leadId: string
  addedBy?: string
}

export type CustomerGroupsResponse = {
  data: CustomerGroup[]
  total: number
  limit: number
  offset: number
}

export type CustomerGroupMembersResponse = {
  data: CustomerGroupMember[]
  total: number
  limit: number
  offset: number
}

export type CustomerGroupsParams = {
  page?: number
  limit?: number
  isDynamic?: boolean | "all"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export type BulkAddMembersRequest = {
  groupId: string
  leadIds: string[]
  addedBy?: string
}

export type BulkRemoveMembersRequest = {
  leadIds: string[]
}

// Auto-generated group name types
export type CompanyScale = "Small" | "Medium" | "Large" | "Unknown"

export type GroupNameTemplate = {
  country: string
  scale: CompanyScale
  businessType: string
  businessSector: string
  uploadDate: string
}
