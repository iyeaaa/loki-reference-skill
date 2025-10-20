export interface Workspace {
  id: string
  name: string
  description: string | null
  ownerId: string
  isActive: boolean
  createdAt: string
  updatedAt: string
  ownerUsername?: string
  ownerEmail?: string
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: "owner" | "admin" | "member" | "viewer"
  status: "active" | "inactive" | "removed"
  invitedBy: string | null
  invitedAt: string
  joinedAt: string | null
  username?: string
  email?: string
}

export interface WorkspacesParams {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
  ownerIds?: string[]
}

export interface WorkspacesResponse {
  workspaces: Workspace[]
  total: number
  totalPages: number
  currentPage: number
}

export interface CreateWorkspaceData {
  name: string
  description?: string | null
  ownerId: string
  isActive?: boolean
}

export interface UpdateWorkspaceData {
  name: string
  description?: string | null
  ownerId?: string
  isActive: boolean
}
