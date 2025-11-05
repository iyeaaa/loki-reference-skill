import { apiFetch } from "../client"
import type {
  CreateEmailSignatureRequest,
  EmailSignature,
  EmailSignaturesParams,
  GetDefaultSignatureParams,
  UpdateEmailSignatureRequest,
} from "../types/email-signature"

const BASE_PATH = "/api/v1/email-signatures"

export const emailSignaturesApi = {
  // Get all signatures
  list: async (params: EmailSignaturesParams): Promise<EmailSignature[]> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)
    if (params.includeInactive !== undefined) {
      searchParams.append("includeInactive", params.includeInactive.toString())
    }

    const response = await apiFetch<{ code: number; data: EmailSignature[] }>(
      `${BASE_PATH}?${searchParams.toString()}`,
    )
    return response.data
  },

  // Get signature by ID
  get: async (
    id: string,
    params: { workspaceId: string; userId: string },
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)

    const response = await apiFetch<{ code: number; data: EmailSignature }>(
      `${BASE_PATH}/${id}?${searchParams.toString()}`,
    )
    return response.data
  },

  // Get default signature
  getDefault: async (params: GetDefaultSignatureParams): Promise<EmailSignature | null> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)

    try {
      const response = await apiFetch<{ code: number; data: EmailSignature | null }>(
        `${BASE_PATH}/default?${searchParams.toString()}`,
      )
      // Return the data, which could be null if no default signature exists
      return response.data ?? null
    } catch (error) {
      // If the error is a 404 (not found), return null gracefully
      // For other errors, let React Query handle them
      if (error && typeof error === "object" && "status" in error && error.status === 404) {
        return null
      }
      // Re-throw other errors for React Query to handle
      throw error
    }
  },

  // Create a new signature
  create: async (
    body: CreateEmailSignatureRequest,
    params: { workspaceId: string; userId: string },
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)

    const response = await apiFetch<{ code: number; data: EmailSignature }>(
      `${BASE_PATH}?${searchParams.toString()}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    )
    return response.data
  },

  // Update a signature
  update: async (
    id: string,
    body: UpdateEmailSignatureRequest,
    params: { workspaceId: string; userId: string },
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)

    const response = await apiFetch<{ code: number; data: EmailSignature }>(
      `${BASE_PATH}/${id}?${searchParams.toString()}`,
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    )
    return response.data
  },

  // Delete a signature
  delete: async (
    id: string,
    params: { workspaceId: string; userId: string; hardDelete?: boolean },
  ): Promise<void> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)
    if (params.hardDelete !== undefined) {
      searchParams.append("hardDelete", params.hardDelete.toString())
    }

    await apiFetch<void>(`${BASE_PATH}/${id}?${searchParams.toString()}`, {
      method: "DELETE",
    })
  },

  // Set signature as default
  setAsDefault: async (
    id: string,
    params: { workspaceId: string; userId: string },
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("userId", params.userId)

    const response = await apiFetch<{ code: number; data: EmailSignature }>(
      `${BASE_PATH}/${id}/set-default?${searchParams.toString()}`,
      {
        method: "PATCH",
        body: JSON.stringify({}),
      },
    )
    return response.data
  },
}
