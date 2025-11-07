import { apiFetch } from "@/lib/api/client"
import type {
  ApiKey,
  ApiKeyResponse,
  ApiKeysResponse,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from "../types/openai-api-keys"

export const openAIApiKeysApi = {
  /**
   * Get all API keys for a workspace
   */
  list: async (workspaceId: string): Promise<ApiKey[]> => {
    const response = await apiFetch<ApiKeysResponse>(`/api/v1/admin/openai-api-keys/${workspaceId}`)

    if (!response.success) {
      throw new Error(response.error || "API 키를 불러오는데 실패했습니다")
    }

    return response.data
  },

  /**
   * Create a new API key
   */
  create: async (data: CreateApiKeyRequest): Promise<ApiKey> => {
    const response = await apiFetch<ApiKeyResponse>("/api/v1/admin/openai-api-keys", {
      method: "POST",
      body: JSON.stringify(data),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error || "API 키 추가에 실패했습니다")
    }

    return response.data
  },

  /**
   * Update an existing API key
   */
  update: async (id: string, data: UpdateApiKeyRequest): Promise<ApiKey> => {
    const response = await apiFetch<ApiKeyResponse>(`/api/v1/admin/openai-api-keys/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })

    if (!response.success || !response.data) {
      throw new Error(response.error || "API 키 수정에 실패했습니다")
    }

    return response.data
  },

  /**
   * Delete an API key
   */
  delete: async (id: string, workspaceId: string): Promise<void> => {
    const response = await apiFetch<ApiKeyResponse>(
      `/api/v1/admin/openai-api-keys/${id}?workspaceId=${workspaceId}`,
      {
        method: "DELETE",
      },
    )

    if (!response.success) {
      throw new Error(response.error || "API 키 삭제에 실패했습니다")
    }
  },
}
