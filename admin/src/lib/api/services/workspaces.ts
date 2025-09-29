import { apiFetch } from "../client"
import type {
  CreateWorkspaceData,
  UpdateWorkspaceData,
  Workspace,
  WorkspaceMember,
  WorkspacesParams,
  WorkspacesResponse,
} from "../types/workspace"

export const workspacesApi = {
  // List workspaces with pagination and filters
  list: async (params?: WorkspacesParams): Promise<WorkspacesResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.isActive !== undefined) searchParams.append("isActive", params.isActive.toString())
    if (params?.search) searchParams.append("search", params.search)
    if (params?.ownerIds?.length) searchParams.append("ownerIds", params.ownerIds.join(","))

    const query = searchParams.toString()
    const response = await apiFetch<{
      data: Workspace[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/workspaces/search?${query}`)

    const totalPages = Math.ceil(response.total / limit)

    return {
      workspaces: response.data,
      total: response.total,
      totalPages,
      currentPage: page,
    }
  },

  // Get single workspace
  get: async (id: string): Promise<Workspace> => {
    return apiFetch<Workspace>(`/api/v1/workspaces/${id}`)
  },

  // Create workspace
  create: async (data: CreateWorkspaceData): Promise<Workspace> => {
    return apiFetch<Workspace>("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // Update workspace
  update: async (id: string, data: UpdateWorkspaceData): Promise<Workspace> => {
    return apiFetch<Workspace>(`/api/v1/workspaces/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  // Delete workspace
  delete: async (id: string): Promise<void> => {
    await apiFetch(`/api/v1/workspaces/${id}`, {
      method: "DELETE",
    })
  },

  // Get workspaces by owner
  getByOwner: async (ownerId: string): Promise<Workspace[]> => {
    return apiFetch<Workspace[]>(`/api/v1/workspaces/owner/${ownerId}`)
  },

  // Get workspace members
  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> => {
    return apiFetch<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`)
  },

  // Add workspace member
  addMember: async (
    workspaceId: string,
    data: {
      userId: string
      role?: "owner" | "admin" | "member" | "viewer"
      invitedBy?: string
    }
  ): Promise<WorkspaceMember> => {
    return apiFetch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // Update member role
  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    role: string
  ): Promise<WorkspaceMember> => {
    return apiFetch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    })
  },

  // Update member status
  updateMemberStatus: async (
    workspaceId: string,
    memberId: string,
    status: string
  ): Promise<WorkspaceMember> => {
    return apiFetch<WorkspaceMember>(
      `/api/v1/workspaces/${workspaceId}/members/${memberId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    )
  },

  // Remove workspace member
  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
      method: "DELETE",
    })
  },

  // Bulk update status
  bulkUpdateStatus: async (
    workspaceIds: string[],
    isActive: boolean
  ): Promise<{ updatedCount: number }> => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/workspaces/bulk/status", {
      method: "PUT",
      body: JSON.stringify({
        workspaceIds,
        isActive,
      }),
    })
  },

  // Transfer ownership
  transferOwnership: async (workspaceId: string, newOwnerId: string): Promise<Workspace> => {
    return apiFetch<Workspace>(`/api/v1/admin/workspaces/${workspaceId}/transfer`, {
      method: "PUT",
      body: JSON.stringify({ newOwnerId }),
    })
  },
}
