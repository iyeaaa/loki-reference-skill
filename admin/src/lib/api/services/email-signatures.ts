import { apiFetch } from "../client"
import type {
  CreateEmailSignatureRequest,
  EmailSignature,
  UpdateEmailSignatureRequest,
} from "../types/email-signature"

const BASE_PATH = "/api/v1/email-signatures"

export const emailSignaturesApi = {
  // Get all signatures for a workspace (워크스페이스별 서명 조회)
  // workspaceId is required
  list: async (params: {
    workspaceId: string
    includeInactive?: boolean
  }): Promise<EmailSignature[]> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", params.workspaceId)
    if (params.includeInactive !== undefined) {
      searchParams.append("includeInactive", params.includeInactive.toString())
    }

    const response = await apiFetch<{ code: number; data: EmailSignature[] }>(
      `${BASE_PATH}?${searchParams.toString()}`,
    )
    return response.data
  },

  // Get signature by ID
  get: async (id: string): Promise<EmailSignature> => {
    const response = await apiFetch<{ code: number; data: EmailSignature }>(`${BASE_PATH}/${id}`)
    return response.data
  },

  // Get default signature for user in a workspace (JWT에서 userId 자동 추출)
  // workspaceId is required
  getDefault: async (workspaceId: string): Promise<EmailSignature | null> => {
    try {
      const searchParams = new URLSearchParams()
      searchParams.append("workspaceId", workspaceId)

      const response = await apiFetch<{ code: number; data: EmailSignature | null }>(
        `${BASE_PATH}/default?${searchParams.toString()}`,
      )
      return response.data ?? null
    } catch (error) {
      // If the error is a 404 (not found), return null gracefully
      if (error && typeof error === "object" && "status" in error) {
        if (error.status === 404) {
          return null
        }
        if (error.status === 401) {
          console.error("Authorization failed for default signature:", error)
          // 401 에러도 null로 처리 (기본 서명이 없는 것으로 간주)
          return null
        }
      }
      throw error
    }
  },

  // Create a new signature (workspaceId 필수)
  // userId is extracted from JWT token on the server
  create: async (
    body: CreateEmailSignatureRequest,
    workspaceId: string,
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    searchParams.append("workspaceId", workspaceId)

    const response = await apiFetch<{ code: number; data: EmailSignature }>(
      `${BASE_PATH}?${searchParams.toString()}`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    )
    return response.data
  },

  // Update a signature (workspaceId, userId 불필요)
  update: async (id: string, body: UpdateEmailSignatureRequest): Promise<EmailSignature> => {
    const response = await apiFetch<{ code: number; data: EmailSignature }>(`${BASE_PATH}/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    return response.data
  },

  // Delete a signature (workspaceId, userId 불필요)
  delete: async (id: string, params?: { hardDelete?: boolean }): Promise<void> => {
    const searchParams = new URLSearchParams()
    if (params?.hardDelete !== undefined) {
      searchParams.append("hardDelete", params.hardDelete.toString())
    }

    const url =
      params?.hardDelete !== undefined
        ? `${BASE_PATH}/${id}?${searchParams.toString()}`
        : `${BASE_PATH}/${id}`

    await apiFetch<void>(url, {
      method: "DELETE",
    })
  },

  // Set signature as default for user in a workspace
  // workspaceId is required
  setDefault: async (id: string, workspaceId: string): Promise<void> => {
    try {
      const searchParams = new URLSearchParams()
      searchParams.append("workspaceId", workspaceId)

      await apiFetch<void>(`${BASE_PATH}/${id}/set-default?${searchParams.toString()}`, {
        method: "PATCH",
      })
    } catch (error) {
      console.error("Failed to set default signature:", error)
      // 401 에러는 토큰 문제일 수 있음
      if (error && typeof error === "object" && "status" in error && error.status === 401) {
        console.error("Authorization failed. Please check if you are logged in.")
      }
      throw error
    }
  },
}
