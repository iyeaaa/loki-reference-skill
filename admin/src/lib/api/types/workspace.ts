export type Workspace = {
  id: string
  name: string
  description: string | null
  ownerId: string
  companyName?: string | undefined
  companyWebsite?: string | undefined
  companyPhone?: string | undefined
  industry?: string | undefined
  companySize?: string | undefined
  companyAddress?: string | undefined
  companyDescription?: string | undefined
  websiteAnalysis?: unknown | undefined
  targetAudiences?: string[] | undefined
  expansionGoals?: string[] | undefined
  competitiveAdvantages?: string[] | undefined
  rawResearchOutput?: unknown | undefined
  isActive: boolean
  createdAt: string
  updatedAt: string
  ownerUsername?: string
  ownerEmail?: string
}

export type WorkspaceMember = {
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

export type WorkspacesParams = {
  page?: number
  limit?: number
  isActive?: boolean
  search?: string
  ownerIds?: string[]
  // userId is extracted from JWT token on the server for permission filtering
}

export type WorkspacesResponse = {
  workspaces: Workspace[]
  total: number
  totalPages: number
  currentPage: number
}

export type CreateWorkspaceData = {
  name: string
  description?: string | null
  ownerId: string
  companyName?: string | undefined
  companyWebsite?: string | undefined
  companyPhone?: string | undefined
  industry?: string | undefined
  companySize?: string | undefined
  companyAddress?: string | undefined
  companyDescription?: string | undefined
  websiteAnalysis?: unknown | undefined
  targetAudiences?: string[] | undefined
  expansionGoals?: string[] | undefined
  competitiveAdvantages?: string[] | undefined
  rawResearchOutput?: unknown | undefined
  isActive?: boolean
}

export type UpdateWorkspaceData = {
  name: string
  description?: string | null
  ownerId?: string
  companyName?: string | undefined
  companyWebsite?: string | undefined
  companyPhone?: string | undefined
  industry?: string | undefined
  companySize?: string | undefined
  companyAddress?: string | undefined
  companyDescription?: string | undefined
  websiteAnalysis?: unknown | undefined
  targetAudiences?: string[] | undefined
  expansionGoals?: string[] | undefined
  competitiveAdvantages?: string[] | undefined
  rawResearchOutput?: unknown | undefined
  isActive: boolean
}

export type WorkspaceProduct = {
  id: string
  workspaceId: string
  name?: string | null
  description?: string | null
  category?: string | null
  features?: string[] | null
  priceRange?: string | null
  targetAudience?: string | null
  imageUrl?: string | null
  createdAt: string
  updatedAt: string
}

export type CreateWorkspaceProductData = {
  name?: string
  description?: string
  category?: string
  features?: string[]
  priceRange?: string
  targetAudience?: string
  imageUrl?: string
}

export type UpdateWorkspaceProductData = {
  name?: string
  description?: string
  category?: string
  features?: string[]
  priceRange?: string
  targetAudience?: string
  imageUrl?: string
}

export interface WorkspaceWithProducts extends Workspace {
  products: WorkspaceProduct[]
}
