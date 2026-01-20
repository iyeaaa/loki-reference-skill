import { API_BASE_URL, apiFetch, getToken } from "../client"
import type {
  CreateWorkspaceData,
  CreateWorkspaceProductData,
  UpdateWorkspaceData,
  UpdateWorkspaceProductData,
  Workspace,
  WorkspaceMember,
  WorkspaceProduct,
  WorkspacesParams,
  WorkspacesResponse,
  WorkspaceWithProducts,
} from "../types/workspace"

// Types for SSE streaming enrichment
export type SalesStrategy = {
  id: string
  countryCode: string
  countryName: string
  companiesTargeted: number
  description: string
  metrics: {
    openRate: number
    responseRate: number
    meetingRate: number
  }
  isSuggested: boolean
}

export type EnrichmentProgressEvent = {
  step: string
  message: string
}

export type EnrichmentStrategiesEvent = {
  strategies: SalesStrategy[]
}

export type EnrichmentDoneEvent = {
  enrichment: unknown
  strategies: SalesStrategy[]
}

export type EnrichmentErrorEvent = {
  message: string
}

export type EnrichmentEventHandler = {
  onProgress?: (event: EnrichmentProgressEvent) => void
  onStrategies?: (event: EnrichmentStrategiesEvent) => void
  onDone?: (event: EnrichmentDoneEvent) => void
  onError?: (event: EnrichmentErrorEvent) => void
}

export const workspacesApi = {
  // List workspaces with pagination and filters
  // userId is extracted from JWT token on the server for permission filtering
  list: async (params?: WorkspacesParams): Promise<WorkspacesResponse> => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.isActive !== undefined) {
      searchParams.append("isActive", params.isActive.toString())
    }
    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.ownerIds?.length) {
      searchParams.append("ownerIds", params.ownerIds.join(","))
    }

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
  get: async (id: string): Promise<Workspace> => apiFetch<Workspace>(`/api/v1/workspaces/${id}`),

  // Get workspace subscription info (tier, plan, status)
  getSubscription: async (
    id: string,
  ): Promise<{
    subscription: {
      id: string
      status: string
      tier: "trial" | "basic" | "pro" | "enterprise"
      plan: {
        id: string
        name: string
        amount: number
      }
      product: {
        id: string
        name: string
      }
      currentPeriodStart: string | null
      currentPeriodEnd: string | null
      trialEnd: string | null
    }
  }> => apiFetch(`/api/v1/workspaces/${id}/subscription`),

  // Create workspace
  create: async (data: CreateWorkspaceData): Promise<Workspace> =>
    apiFetch<Workspace>("/api/v1/workspaces", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update workspace (full update - PUT)
  update: async (id: string, data: UpdateWorkspaceData): Promise<Workspace> =>
    apiFetch<Workspace>(`/api/v1/workspaces/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Partial update workspace (PATCH) - for updating specific fields only
  patch: async (
    id: string,
    data: Partial<{
      name: string
      description: string
      ownerId: string
      isActive: boolean
      companyName: string
      companyWebsite: string | null
      companyPhone: string
      industry: string
      companySize: string
      companyAddress: string
      companyDescription: string
    }>,
  ): Promise<Workspace> =>
    apiFetch<Workspace>(`/api/v1/workspaces/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Trigger onboarding enrichment for a workspace
  enrichWorkspace: async (workspaceId: string, websiteUrl: string): Promise<{ started: boolean }> =>
    apiFetch<{ started: boolean }>(`/api/v1/workspaces/${workspaceId}/enrich`, {
      method: "POST",
      body: JSON.stringify({ websiteUrl }),
    }),

  // Delete workspace
  delete: async (id: string): Promise<void> => {
    await apiFetch(`/api/v1/workspaces/${id}`, {
      method: "DELETE",
    })
  },

  // Get workspaces by owner
  getByOwner: async (ownerId: string): Promise<Workspace[]> =>
    apiFetch<Workspace[]>(`/api/v1/workspaces/owner/${ownerId}`),

  // Get user's workspaces (owned or member) - userId extracted from auth token
  getUserWorkspaces: async (): Promise<Workspace[]> =>
    apiFetch<Workspace[]>("/api/v1/workspaces/user"),

  // Get workspace members
  getMembers: async (workspaceId: string): Promise<WorkspaceMember[]> =>
    apiFetch<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`),

  // Add workspace member
  addMember: async (
    workspaceId: string,
    data: {
      userId: string
      role?: "owner" | "admin" | "member" | "viewer"
      invitedBy?: string
    },
  ): Promise<WorkspaceMember> =>
    apiFetch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update member role
  updateMemberRole: async (
    workspaceId: string,
    memberId: string,
    role: string,
  ): Promise<WorkspaceMember> =>
    apiFetch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),

  // Update member status
  updateMemberStatus: async (
    workspaceId: string,
    memberId: string,
    status: string,
  ): Promise<WorkspaceMember> =>
    apiFetch<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${memberId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  // Remove workspace member
  removeMember: async (workspaceId: string, memberId: string): Promise<void> => {
    await apiFetch(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, {
      method: "DELETE",
    })
  },

  // Bulk update status
  bulkUpdateStatus: async (
    workspaceIds: string[],
    isActive: boolean,
  ): Promise<{ updatedCount: number }> =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/workspaces/bulk/status", {
      method: "PUT",
      body: JSON.stringify({
        workspaceIds,
        isActive,
      }),
    }),

  // Transfer ownership
  transferOwnership: async (workspaceId: string, newOwnerId: string): Promise<Workspace> =>
    apiFetch<Workspace>(`/api/v1/admin/workspaces/${workspaceId}/transfer`, {
      method: "PUT",
      body: JSON.stringify({ newOwnerId }),
    }),

  // ====================================
  // WORKSPACE PRODUCTS OPERATIONS
  // ====================================

  // Get workspace with products
  getWithProducts: async (id: string): Promise<WorkspaceWithProducts> =>
    apiFetch<WorkspaceWithProducts>(`/api/v1/workspaces/${id}/with-products`),

  // List workspace products
  listProducts: async (workspaceId: string): Promise<WorkspaceProduct[]> =>
    apiFetch<WorkspaceProduct[]>(`/api/v1/workspaces/${workspaceId}/products`),

  // Get single workspace product
  getProduct: async (workspaceId: string, productId: string): Promise<WorkspaceProduct> =>
    apiFetch<WorkspaceProduct>(`/api/v1/workspaces/${workspaceId}/products/${productId}`),

  // Create workspace product
  createProduct: async (
    workspaceId: string,
    data: CreateWorkspaceProductData,
  ): Promise<WorkspaceProduct> =>
    apiFetch<WorkspaceProduct>(`/api/v1/workspaces/${workspaceId}/products`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Update workspace product
  updateProduct: async (
    workspaceId: string,
    productId: string,
    data: UpdateWorkspaceProductData,
  ): Promise<WorkspaceProduct> =>
    apiFetch<WorkspaceProduct>(`/api/v1/workspaces/${workspaceId}/products/${productId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  // Delete workspace product
  deleteProduct: async (workspaceId: string, productId: string): Promise<void> => {
    await apiFetch(`/api/v1/workspaces/${workspaceId}/products/${productId}`, {
      method: "DELETE",
    })
  },
}

/**
 * Stream enrichment and strategy generation via SSE
 * Returns a cleanup function to abort the stream
 */
export function streamEnrichAndStrategize(
  workspaceId: string,
  websiteUrl: string,
  handlers: EnrichmentEventHandler,
): () => void {
  const controller = new AbortController()
  const token = getToken()
  const url = `${API_BASE_URL}/api/v1/workspaces/${workspaceId}/enrichAndStrategize`

  // Start the fetch request
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ websiteUrl }),
    signal: controller.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        const errorText = await response.text()
        let message = `Request failed (${response.status})`
        try {
          const errorData = JSON.parse(errorText)
          message = errorData.message || message
        } catch {
          // ignore parse error
        }
        handlers.onError?.({ message })
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        handlers.onError?.({ message: "No response body" })
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Process complete SSE messages
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line in buffer

        let currentEvent = ""
        let currentData = ""

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6)
          } else if (line === "" && currentData) {
            // End of message, process it
            try {
              const data = JSON.parse(currentData)

              switch (currentEvent) {
                case "progress":
                  handlers.onProgress?.(data as EnrichmentProgressEvent)
                  break
                case "strategies":
                  handlers.onStrategies?.(data as EnrichmentStrategiesEvent)
                  break
                case "done":
                  handlers.onDone?.(data as EnrichmentDoneEvent)
                  break
                case "error":
                  handlers.onError?.(data as EnrichmentErrorEvent)
                  break
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e, currentData)
            }

            currentEvent = ""
            currentData = ""
          }
        }
      }
    })
    .catch((error) => {
      if (error.name !== "AbortError") {
        handlers.onError?.({ message: error.message || "Stream error" })
      }
    })

  // Return cleanup function
  return () => controller.abort()
}

// Translate company name
export async function translateCompanyName(
  companyName: string,
  targetLanguage = "English",
): Promise<string> {
  const response = await apiFetch<{ translatedName: string }>(
    "/api/v1/workspaces/translate-company-name",
    {
      method: "POST",
      body: JSON.stringify({
        companyName,
        targetLanguage,
      }),
    },
  )
  return response.translatedName
}
