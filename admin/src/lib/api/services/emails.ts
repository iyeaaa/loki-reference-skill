import { apiFetch } from "../client"
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

export type TodaySentStatsResponse = {
  success: boolean
  code: string
  message: string
  data: {
    todaySentCount: number
    date: string
  }
  timestamp: string
}

export type TodaySentStatsParams = {
  workspaceId?: string
}

export type AvgOpenRateStatsResponse = {
  success: boolean
  code: string
  message: string
  data: {
    avgOpenRate: number
    totalSent: number
    openedCount: number
  }
  timestamp: string
}

export type AvgOpenRateStatsParams = {
  workspaceId?: string
}

export type RecentSequencesResponse = {
  success: boolean
  code: string
  message: string
  data: {
    sequences: Array<{
      id: string
      name: string
      status: string
      createdAt: string
      sent: number
      opened: number
      clicked: number
    }>
    total: number
  }
  timestamp: string
}

export type RecentSequencesParams = {
  workspaceId?: string
  limit?: number
}

export type ScheduledFollowupsResponse = {
  success: boolean
  code: string
  message: string
  data: {
    followups: Array<{
      delayDays: number
      scheduledDate: string
      totalCount: number
      sequences: Array<{
        sequenceName: string
        subject: string
        count: number
      }>
    }>
    totalScheduled: number
    date: string
  }
  timestamp: string
}

export type ScheduledFollowupsParams = {
  workspaceId?: string
}

export type BuyerResponseRateResponse = {
  success: boolean
  code: string
  message: string
  data: {
    responseRate: number
    totalSent: number
    repliedCount: number
  }
  timestamp: string
}

export type BuyerResponseRateParams = {
  workspaceId?: string
}

export const emailsApi = {
  list: (params?: EmailsParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.status && params.status !== "all") {
      searchParams.append("status", params.status)
    }
    if (params?.direction && params.direction !== "all") {
      searchParams.append("direction", params.direction)
    }
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.leadId) {
      searchParams.append("leadId", params.leadId)
    }
    if (params?.sequenceId) {
      searchParams.append("sequenceId", params.sequenceId)
    }

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

  get: (emailId: string) => apiFetch<Email>(`/api/v1/emails/${emailId}`),

  send: (data: SendEmailRequest) => {
    // If files are provided, use FormData, otherwise use JSON
    if (data.files && data.files.length > 0) {
      const formData = new FormData()

      // Append all fields to FormData
      formData.append("toEmail", data.toEmail)
      formData.append("subject", data.subject)
      formData.append("workspaceId", data.workspaceId)
      formData.append("userId", data.userId)

      if (data.bodyText) {
        formData.append("bodyText", data.bodyText)
      }
      if (data.bodyHtml) {
        formData.append("bodyHtml", data.bodyHtml)
      }
      if (data.fromName) {
        formData.append("fromName", data.fromName)
      }
      if (data.leadId) {
        formData.append("leadId", data.leadId)
      }
      if (data.sequenceId) {
        formData.append("sequenceId", data.sequenceId)
      }
      if (data.stepId) {
        formData.append("stepId", data.stepId)
      }
      if (data.replyTo) {
        formData.append("replyTo", data.replyTo)
      }
      if (data.inReplyTo) {
        formData.append("inReplyTo", data.inReplyTo)
      }
      if (data.scheduledAt) {
        formData.append("scheduledAt", data.scheduledAt)
      }
      if (data.includeSignature !== undefined) {
        formData.append("includeSignature", String(data.includeSignature))
      }

      // Append arrays
      if (data.ccEmails && data.ccEmails.length > 0) {
        for (const email of data.ccEmails) {
          formData.append("ccEmails", email)
        }
      }
      if (data.bccEmails && data.bccEmails.length > 0) {
        for (const email of data.bccEmails) {
          formData.append("bccEmails", email)
        }
      }
      if (data.references && data.references.length > 0) {
        for (const ref of data.references) {
          formData.append("references", ref)
        }
      }

      // Append files
      for (const file of data.files) {
        formData.append("files", file)
      }

      return apiFetch<{
        success: boolean
        email: Email
        message: string
      }>("/api/v1/emails/send", {
        method: "POST",
        body: formData,
        // Don't set Content-Type header, let browser set it with boundary
        headers: {},
      })
    }

    // No files, use JSON
    return apiFetch<{
      success: boolean
      email: Email
      message: string
    }>("/api/v1/emails/send", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  sendNylasTestEmail: (data: {
    toEmail: string
    subject: string
    content: string
    grantId: string
  }) =>
    apiFetch<{
      success: boolean
      message: string
      messageId?: string
      nylasMessageId?: string
    }>("/api/v1/emails/send-nylas-test", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  create: (data: CreateEmailRequest) =>
    apiFetch<Email>("/api/v1/emails", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateStatus: (emailId: string, data: UpdateEmailStatusRequest) =>
    apiFetch<Email>(`/api/v1/emails/${emailId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  updateIntent: (
    emailId: string,
    data: {
      intent?:
        | "meeting_request"
        | "question"
        | "objection"
        | "out_of_office"
        | "not_interested"
        | "positive_interest"
        | "neutral"
        | null
      sentiment?: "positive" | "neutral" | "negative" | "interested" | "not_interested" | null
    },
  ) =>
    apiFetch<{
      id: string
      intent: string | null
      sentiment: string | null
    }>(`/api/v1/emails/${emailId}/intent`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (emailId: string) =>
    apiFetch(`/api/v1/emails/${emailId}`, {
      method: "DELETE",
    }),

  getEvents: (emailId: string) => apiFetch<EmailEvent[]>(`/api/v1/emails/${emailId}/events`),

  bulkUpdateStatus: (data: BulkUpdateEmailStatusRequest) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/emails/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  bulkDelete: (emailIds: string[]) =>
    apiFetch<{ deletedCount: number }>("/api/v1/admin/emails/bulk", {
      method: "DELETE",
      body: JSON.stringify({ emailIds }),
    }),

  // Search replied emails with filters - THREAD-BASED (스레드 기반)
  searchRepliedEmails: (params: {
    workspaceId: string
    page?: number
    limit?: number
    status?: string
    leadId?: string
    sequenceId?: string
    search?: string
    intent?: string
    isImportant?: boolean
    isUnread?: boolean
    sentiment?: string
    category?: string
    priority?: string
    dateFrom?: string
    dateTo?: string
    direction?: "inbound" | "outbound" | "all" // "inbound" (replies), "outbound" (sent), "all" (both)
  }) => {
    const searchParams = new URLSearchParams()

    const page = params.page || 1
    const limit = params.limit || 20
    const offset = (page - 1) * limit

    searchParams.append("workspaceId", params.workspaceId)
    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params.status && params.status !== "all") {
      searchParams.append("status", params.status)
    }
    if (params.leadId) {
      searchParams.append("leadId", params.leadId)
    }
    if (params.sequenceId) {
      searchParams.append("sequenceId", params.sequenceId)
    }
    if (params.search) {
      searchParams.append("search", params.search)
    }
    if (params.intent && params.intent !== "all") {
      searchParams.append("intent", params.intent)
    }
    if (params.isImportant !== undefined) {
      searchParams.append("isImportant", params.isImportant.toString())
    }
    if (params.isUnread !== undefined) {
      searchParams.append("isUnread", params.isUnread.toString())
    }
    if (params.sentiment) {
      searchParams.append("sentiment", params.sentiment)
    }
    if (params.category) {
      searchParams.append("category", params.category)
    }
    if (params.priority) {
      searchParams.append("priority", params.priority)
    }
    if (params.dateFrom) {
      searchParams.append("dateFrom", params.dateFrom)
    }
    if (params.dateTo) {
      searchParams.append("dateTo", params.dateTo)
    }
    if (params.direction) {
      searchParams.append("direction", params.direction)
    }

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

  // NEW: Get today's sent email count
  getTodaySentStats: async (
    params?: TodaySentStatsParams,
  ): Promise<TodaySentStatsResponse["data"]> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const response = await apiFetch<TodaySentStatsResponse["data"]>(
      `/api/v1/emails/stats/today-sent?${searchParams.toString()}`,
    )

    return response
  },

  // NEW: Get average open rate
  getAvgOpenRateStats: async (
    params?: AvgOpenRateStatsParams,
  ): Promise<AvgOpenRateStatsResponse["data"]> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const response = await apiFetch<AvgOpenRateStatsResponse["data"]>(
      `/api/v1/emails/stats/avg-open-rate?${searchParams.toString()}`,
    )

    return response
  },

  // NEW: Get recent sequence performance
  getRecentSequences: async (
    params?: RecentSequencesParams,
  ): Promise<RecentSequencesResponse["data"]> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }
    if (params?.limit) {
      searchParams.append("limit", params.limit.toString())
    }

    const response = await apiFetch<RecentSequencesResponse["data"]>(
      `/api/v1/emails/stats/recent-sequences?${searchParams.toString()}`,
    )

    return response
  },

  // NEW: Get scheduled follow-up emails
  getScheduledFollowups: async (
    params?: ScheduledFollowupsParams,
  ): Promise<ScheduledFollowupsResponse["data"]> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const response = await apiFetch<ScheduledFollowupsResponse["data"]>(
      `/api/v1/emails/stats/scheduled-followups?${searchParams.toString()}`,
    )

    return response
  },

  // NEW: Get buyer response rate
  getBuyerResponseRate: async (
    params?: BuyerResponseRateParams,
  ): Promise<BuyerResponseRateResponse["data"]> => {
    const searchParams = new URLSearchParams()
    if (params?.workspaceId) {
      searchParams.append("workspaceId", params.workspaceId)
    }

    const response = await apiFetch<BuyerResponseRateResponse["data"]>(
      `/api/v1/emails/stats/buyer-response-rate?${searchParams.toString()}`,
    )

    return response
  },
}
