import { apiFetch } from "@/lib/api/client"
import type {
  AttachPolicyToMemberRequest,
  AttachPolicyToRoleRequest,
  CreateIamPolicyRequest,
  CreateIamRoleRequest,
  CreatePolicyStatementRequest,
  GrantRoleToMemberRequest,
  IamAuditLog,
  IamAuditLogsParams,
  IamAuditLogsResponse,
  IamMemberPolicy,
  IamMemberRole,
  IamPoliciesParams,
  IamPoliciesResponse,
  IamPolicy,
  IamPolicyStatement,
  IamRolePolicy,
  IamRolesParams,
  IamRolesResponse,
  IamTierBoundariesParams,
  IamTierBoundary,
  IamWorkspaceRole,
  UpdateIamPolicyRequest,
  UpdateIamRoleRequest,
  UpdatePolicyStatementRequest,
} from "../types/iam"

// ============================================================================
// Policies API
// ============================================================================

export const iamPoliciesApi = {
  list: async (params?: IamPoliciesParams): Promise<IamPoliciesResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.isManaged !== undefined) {
      searchParams.append("isManaged", String(params.isManaged))
    }
    if (params?.isActive !== undefined) {
      searchParams.append("isActive", String(params.isActive))
    }
    if (params?.filterForWorkspace) {
      searchParams.append("filterForWorkspace", "true")
    }

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: IamPolicy[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/iam/policies${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (policyId: string) => apiFetch<IamPolicy>(`/api/v1/iam/policies/${policyId}`),

  create: (data: CreateIamPolicyRequest) =>
    apiFetch<IamPolicy>("/api/v1/iam/policies", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (policyId: string, data: UpdateIamPolicyRequest) =>
    apiFetch<IamPolicy>(`/api/v1/iam/policies/${policyId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (policyId: string) =>
    apiFetch(`/api/v1/iam/policies/${policyId}`, {
      method: "DELETE",
    }),

  // Policy Statements
  getStatements: (policyId: string) =>
    apiFetch<IamPolicyStatement[]>(`/api/v1/iam/policies/${policyId}/statements`),

  addStatement: (policyId: string, data: CreatePolicyStatementRequest) =>
    apiFetch<IamPolicyStatement>(`/api/v1/iam/policies/${policyId}/statements`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStatement: (policyId: string, statementId: string, data: UpdatePolicyStatementRequest) =>
    apiFetch<IamPolicyStatement>(`/api/v1/iam/policies/${policyId}/statements/${statementId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteStatement: (policyId: string, statementId: string) =>
    apiFetch(`/api/v1/iam/policies/${policyId}/statements/${statementId}`, {
      method: "DELETE",
    }),
}

// ============================================================================
// Roles API
// ============================================================================

export const iamRolesApi = {
  list: async (params?: IamRolesParams): Promise<IamRolesResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.isSystem !== undefined) {
      searchParams.append("isSystem", String(params.isSystem))
    }
    if (params?.isDefault !== undefined) {
      searchParams.append("isDefault", String(params.isDefault))
    }

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: IamWorkspaceRole[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/iam/roles${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (roleId: string) => apiFetch<IamWorkspaceRole>(`/api/v1/iam/roles/${roleId}`),

  create: (data: CreateIamRoleRequest) =>
    apiFetch<IamWorkspaceRole>("/api/v1/iam/roles", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (roleId: string, data: UpdateIamRoleRequest) =>
    apiFetch<IamWorkspaceRole>(`/api/v1/iam/roles/${roleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (roleId: string) =>
    apiFetch(`/api/v1/iam/roles/${roleId}`, {
      method: "DELETE",
    }),

  // Role Policies
  getPolicies: (roleId: string) =>
    apiFetch<IamRolePolicy[]>(`/api/v1/iam/roles/${roleId}/policies`),

  attachPolicy: (data: AttachPolicyToRoleRequest) =>
    apiFetch<IamRolePolicy>(`/api/v1/iam/roles/${data.roleId}/policies`, {
      method: "POST",
      body: JSON.stringify({ policyId: data.policyId }),
    }),

  detachPolicy: (roleId: string, policyId: string) =>
    apiFetch(`/api/v1/iam/roles/${roleId}/policies/${policyId}`, {
      method: "DELETE",
    }),

  // Role Members
  getMembers: (roleId: string) => apiFetch<IamMemberRole[]>(`/api/v1/iam/roles/${roleId}/members`),
}

// ============================================================================
// Member Roles & Policies API
// ============================================================================

export const iamMemberApi = {
  // Member Roles
  getRoles: (memberId: string) =>
    apiFetch<IamMemberRole[]>(`/api/v1/iam/members/${memberId}/roles`),

  grantRole: (data: GrantRoleToMemberRequest) =>
    apiFetch<IamMemberRole>(`/api/v1/iam/members/${data.memberId}/roles`, {
      method: "POST",
      body: JSON.stringify({ roleId: data.roleId }),
    }),

  revokeRole: (memberId: string, roleId: string) =>
    apiFetch(`/api/v1/iam/members/${memberId}/roles/${roleId}`, {
      method: "DELETE",
    }),

  // Member Policies (Inline Policies)
  getPolicies: (memberId: string) =>
    apiFetch<IamMemberPolicy[]>(`/api/v1/iam/members/${memberId}/policies`),

  attachPolicy: (data: AttachPolicyToMemberRequest) =>
    apiFetch<IamMemberPolicy>(`/api/v1/iam/members/${data.memberId}/policies`, {
      method: "POST",
      body: JSON.stringify({ policyId: data.policyId }),
    }),

  detachPolicy: (memberId: string, policyId: string) =>
    apiFetch(`/api/v1/iam/members/${memberId}/policies/${policyId}`, {
      method: "DELETE",
    }),
}

// ============================================================================
// Tier Boundaries API
// ============================================================================

export const iamTierBoundariesApi = {
  list: (params?: IamTierBoundariesParams) => {
    const searchParams = new URLSearchParams()
    if (params?.tier) {
      searchParams.append("tier", params.tier)
    }

    const query = searchParams.toString()
    return apiFetch<IamTierBoundary[]>(`/api/v1/iam/tier-boundaries${query ? `?${query}` : ""}`)
  },

  get: (tier: string) => apiFetch<IamTierBoundary>(`/api/v1/iam/tier-boundaries/${tier}`),

  update: (tier: string, policyId: string) =>
    apiFetch<IamTierBoundary>(`/api/v1/iam/tier-boundaries/${tier}`, {
      method: "PUT",
      body: JSON.stringify({ policyId }),
    }),
}

// ============================================================================
// Audit Logs API
// ============================================================================

export const iamAuditLogsApi = {
  list: async (params?: IamAuditLogsParams): Promise<IamAuditLogsResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.userId) {
      searchParams.append("userId", params.userId)
    }
    if (params?.action) {
      searchParams.append("action", params.action)
    }
    if (params?.targetType) {
      searchParams.append("targetType", params.targetType)
    }
    if (params?.startDate) {
      searchParams.append("startDate", params.startDate)
    }
    if (params?.endDate) {
      searchParams.append("endDate", params.endDate)
    }

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: IamAuditLog[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/iam/audit-logs${query ? `?${query}` : ""}`)

    return {
      data: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }
  },

  get: (logId: string) => apiFetch<IamAuditLog>(`/api/v1/iam/audit-logs/${logId}`),
}

// ============================================================================
// My Permissions API (현재 사용자 권한 조회)
// ============================================================================

export type MyPermissionsResponse = {
  memberId: string | null
  permissions: Array<{
    resource: string
    action: string
  }>
  roles: Array<{
    id: string
    name: string
    priority: number
  }>
  isAdmin: boolean
}

export type CheckPermissionRequest = {
  workspaceId: string
  resource: string
  action: string
}

export type CheckPermissionResponse = {
  hasPermission: boolean
}

export const iamMyPermissionsApi = {
  /**
   * 현재 사용자의 워크스페이스 내 권한 조회
   */
  getMyPermissions: (workspaceId?: string): Promise<MyPermissionsResponse> => {
    const searchParams = new URLSearchParams()
    if (workspaceId) {
      searchParams.append("workspaceId", workspaceId)
    }
    const query = searchParams.toString()
    return apiFetch<MyPermissionsResponse>(`/api/v1/iam/my-permissions${query ? `?${query}` : ""}`)
  },

  /**
   * 특정 권한 체크
   */
  checkPermission: (data: CheckPermissionRequest): Promise<CheckPermissionResponse> =>
    apiFetch<CheckPermissionResponse>("/api/v1/iam/check-permission", {
      method: "POST",
      body: JSON.stringify(data),
    }),
}
