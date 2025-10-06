import { apiFetch } from "@/lib/api/client"
import type {
  BulkUpdateEmailStatusRequest,
  CreateEmailRequest,
  Email,
  EmailEvent,
  EmailsParams,
  RepliedEmail,
  SendEmailRequest,
  UpdateEmailStatusRequest,
} from "../types/email"

export const emailsApi = {
  list: (params?: EmailsParams) => {
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
    if (params?.direction && params.direction !== "all") {
      searchParams.append("direction", params.direction)
    }
    if (params?.workspaceId) searchParams.append("workspaceId", params.workspaceId)
    if (params?.leadId) searchParams.append("leadId", params.leadId)
    if (params?.sequenceId) searchParams.append("sequenceId", params.sequenceId)

    const query = searchParams.toString()
    return apiFetch<{
      data: Email[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/emails/search${query ? `?${query}` : ""}`).then((response) => ({
      emails: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (emailId: string) => {
    return apiFetch<Email>(`/api/v1/emails/${emailId}`)
  },

  send: (data: SendEmailRequest) => {
    return apiFetch<{
      success: boolean
      email: Email
      message: string
    }>("/api/v1/emails/send", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  create: (data: CreateEmailRequest) => {
    return apiFetch<Email>("/api/v1/emails", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateStatus: (emailId: string, data: UpdateEmailStatusRequest) => {
    return apiFetch<Email>(`/api/v1/emails/${emailId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  delete: (emailId: string) => {
    return apiFetch(`/api/v1/emails/${emailId}`, {
      method: "DELETE",
    })
  },

  getEvents: (emailId: string) => {
    return apiFetch<EmailEvent[]>(`/api/v1/emails/${emailId}/events`)
  },

  bulkUpdateStatus: (data: BulkUpdateEmailStatusRequest) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/emails/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  bulkDelete: (emailIds: string[]) => {
    return apiFetch<{ deletedCount: number }>("/api/v1/admin/emails/bulk", {
      method: "DELETE",
      body: JSON.stringify({ emailIds }),
    })
  },

  // Search replied emails with filters - THREAD-BASED (스레드 기반)
  searchRepliedEmails: (params: {
    workspaceId: string
    page?: number
    limit?: number
    status?: string
    leadId?: string
    sequenceId?: string
    search?: string
  }) => {
    const searchParams = new URLSearchParams()

    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params.status && params.status !== "all") searchParams.append("status", params.status)
    if (params.leadId) searchParams.append("leadId", params.leadId)
    if (params.sequenceId) searchParams.append("sequenceId", params.sequenceId)
    if (params.search) searchParams.append("search", params.search)

    const query = searchParams.toString()
    return apiFetch<{
      data: RepliedEmail[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/emails/search-replied?${query}`).then((response) => ({
      repliedEmails: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  // Get thread emails (conversation history)
  getThreadEmails: (threadId: string, workspaceId?: string) => {
    const searchParams = new URLSearchParams()
    if (workspaceId) {
      searchParams.append("workspaceId", workspaceId)
    }
    const query = searchParams.toString()
    return apiFetch<{ data: import("../types/email").ThreadEmail[] }>(
      `/api/v1/emails/thread/${threadId}${query ? `?${query}` : ""}`,
    )
  },
}
