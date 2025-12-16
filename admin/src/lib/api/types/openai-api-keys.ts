export type ApiKey = {
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

export type CreateApiKeyRequest = {
  workspaceId: string
  name: string
  apiKey: string
}

export type UpdateApiKeyRequest = {
  workspaceId: string
  name?: string
  apiKey?: string
  isActive?: boolean
}

export type DeleteApiKeyParams = {
  id: string
  workspaceId: string
}

export type ApiKeysResponse = {
  success: boolean
  data: ApiKey[]
  error?: string
}

export type ApiKeyResponse = {
  success: boolean
  data?: ApiKey
  error?: string
}
