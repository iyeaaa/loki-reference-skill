export interface Workspace {
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

export interface UpdateWorkspaceData {
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

export interface WorkspaceProduct {
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

export interface CreateWorkspaceProductData {
  name?: string
  description?: string
  category?: string
  features?: string[]
  priceRange?: string
  targetAudience?: string
  imageUrl?: string
}

export interface UpdateWorkspaceProductData {
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
