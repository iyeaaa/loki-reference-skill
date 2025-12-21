import { apiFetch } from "../client"
import type {
  CreateEmailSignatureRequest,
  EmailSignature,
  UpdateEmailSignatureRequest,
} from "../types/email-signature"

const BASE_PATH = "/api/v1/email-signatures"

export const emailSignaturesApi = {
  // Get all signatures (workspaceId 무관, 모든 서명 조회)
  // userId is extracted from JWT token on the server
  list: async (params: { includeInactive?: boolean } = {}): Promise<EmailSignature[]> => {
    const searchParams = new URLSearchParams()
    if (params.includeInactive !== undefined) {
      searchParams.append("includeInactive", params.includeInactive.toString())
    }

    const response = await apiFetch<{ code: number; data: EmailSignature[] }>(
      `${BASE_PATH}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
    )
    return response.data
  },

  // Get signature by ID
  get: async (id: string): Promise<EmailSignature> => {
    const response = await apiFetch<{ code: number; data: EmailSignature }>(`${BASE_PATH}/${id}`)
    return response.data
  },

  // Get default signature (JWT에서 userId 자동 추출)
  getDefault: async (): Promise<EmailSignature | null> => {
    try {
      const response = await apiFetch<{ code: number; data: EmailSignature | null }>(
        `${BASE_PATH}/default`,
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

  // Create a new signature (workspaceId 선택적)
  // userId is extracted from JWT token on the server
  create: async (
    body: CreateEmailSignatureRequest,
    params?: { workspaceId?: string },
  ): Promise<EmailSignature> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const url = params?.workspaceId ? `${BASE_PATH}?${searchParams.toString()}` : BASE_PATH

    const response = await apiFetch<{ code: number; data: EmailSignature }>(url, {
      method: "POST",
      body: JSON.stringify(body),
    })
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

  // Set signature as default (userId extracted from auth token)
  setDefault: async (id: string): Promise<void> => {
    try {
      await apiFetch<void>(`${BASE_PATH}/${id}/set-default`, {
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
