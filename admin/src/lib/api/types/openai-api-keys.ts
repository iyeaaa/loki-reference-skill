export interface ApiKey {
  id: string
  workspaceId: string
  name: string
  apiKey: string
  orderIndex: number
  isActive: boolean
  lastUsedAt: string | null
  usageCount: number
  createdAt: string
  updatedAt: string
}

export interface CreateApiKeyRequest {
  workspaceId: string
  name: string
  apiKey: string
}

export interface UpdateApiKeyRequest {
  workspaceId: string
  name?: string
  apiKey?: string
  isActive?: boolean
}

export interface DeleteApiKeyParams {
  id: string
  workspaceId: string
}

export interface ApiKeysResponse {
  success: boolean
  data: ApiKey[]
  error?: string
}

export interface ApiKeyResponse {
  success: boolean
  data?: ApiKey
  error?: string
}
