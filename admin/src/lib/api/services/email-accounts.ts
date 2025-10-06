import { apiFetch } from "@/lib/api/client"
import type {
  BulkUpdateEmailAccountStatusRequest,
  CreateEmailAccountRequest,
  EmailAccountsParams,
  SetAsDefaultRequest,
  UpdateEmailAccountRequest,
  UpdateErrorRequest,
  UserEmailAccount,
} from "../types/email-account"

export const emailAccountsApi = {
  list: (params?: EmailAccountsParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.status && params.status !== "all") {
      searchParams.append("status", params.status)
    }
    if (params?.isVerified !== undefined && params.isVerified !== "all") {
      searchParams.append("isVerified", params.isVerified.toString())
    }
    if (params?.isDefault !== undefined && params.isDefault !== "all") {
      searchParams.append("isDefault", params.isDefault.toString())
    }
    if (params?.userIds && params.userIds.length > 0) {
      searchParams.append("userIds", params.userIds.join(","))
    }
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: UserEmailAccount[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/email-accounts/search${query ? `?${query}` : ""}`).then((response) => ({
      emailAccounts: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (accountId: string) => {
    return apiFetch<UserEmailAccount>(`/api/v1/email-accounts/${accountId}`)
  },

  create: (data: CreateEmailAccountRequest) => {
    return apiFetch<UserEmailAccount>("/api/v1/email-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (accountId: string, data: UpdateEmailAccountRequest) => {
    return apiFetch<UserEmailAccount>(`/api/v1/email-accounts/${accountId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (accountId: string) => {
    return apiFetch(`/api/v1/email-accounts/${accountId}`, {
      method: "DELETE",
    })
  },

  setAsDefault: (accountId: string, data: SetAsDefaultRequest) => {
    return apiFetch<UserEmailAccount>(`/api/v1/email-accounts/${accountId}/set-default`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  updateSentCount: (accountId: string) => {
    return apiFetch<UserEmailAccount>(`/api/v1/email-accounts/${accountId}/sent-count`, {
      method: "PATCH",
    })
  },

  resetDailySentCount: (accountId: string) => {
    return apiFetch(`/api/v1/email-accounts/${accountId}/reset-daily`, {
      method: "PATCH",
    })
  },

  resetMonthlySentCount: (accountId: string) => {
    return apiFetch(`/api/v1/email-accounts/${accountId}/reset-monthly`, {
      method: "PATCH",
    })
  },

  updateLastError: (accountId: string, data: UpdateErrorRequest) => {
    return apiFetch(`/api/v1/email-accounts/${accountId}/error`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  updateLastSync: (accountId: string) => {
    return apiFetch(`/api/v1/email-accounts/${accountId}/sync`, {
      method: "PATCH",
    })
  },

  bulkUpdateStatus: (data: BulkUpdateEmailAccountStatusRequest) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/email-accounts/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  getByUser: (userId: string) => {
    return apiFetch<UserEmailAccount[]>(`/api/v1/email-accounts/user/${userId}`)
  },

  getByWorkspace: (workspaceId: string) => {
    return apiFetch<UserEmailAccount[]>(`/api/v1/email-accounts/workspace/${workspaceId}`)
  },

  getActiveByWorkspace: (workspaceId: string) => {
    return apiFetch<UserEmailAccount[]>(`/api/v1/email-accounts/workspace/${workspaceId}/active`)
  },

  getByWorkspaceAndUser: (workspaceId: string, userId: string) => {
    return apiFetch<UserEmailAccount>(
      `/api/v1/email-accounts/workspace/${workspaceId}/user/${userId}`,
    )
  },
}
