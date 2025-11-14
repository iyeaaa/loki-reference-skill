import { apiFetch } from "../client"
import type {
  EmailReplyFilters,
  EmailReplyListResponse,
  EmailReplyWithDetails,
} from "../types/email-reply"

export const emailRepliesApi = {
  /**
   * List email replies with pagination and filters
   */
  list: async (params: {
    limit?: number
    offset?: number
    filters?: EmailReplyFilters
  }): Promise<EmailReplyListResponse> => {
    const queryParams = new URLSearchParams()

    if (params.limit !== undefined) queryParams.append("limit", params.limit.toString())
    if (params.offset !== undefined) queryParams.append("offset", params.offset.toString())

    if (params.filters?.workspaceId) {
      queryParams.append("workspaceId", params.filters.workspaceId)
    }
    if (params.filters?.isRead !== undefined) {
      queryParams.append("isRead", params.filters.isRead.toString())
    }
    if (params.filters?.sentiment) {
      queryParams.append("sentiment", params.filters.sentiment)
    }
    if (params.filters?.search) {
      queryParams.append("search", params.filters.search)
    }
    if (params.filters?.emailAccountId) {
      queryParams.append("emailAccountId", params.filters.emailAccountId)
    }

    return apiFetch<EmailReplyListResponse>(`/api/v1/email-replies?${queryParams.toString()}`)
  },

  /**
   * Get single email reply by ID
   */
  getById: async (id: string): Promise<EmailReplyWithDetails> => {
    return apiFetch<EmailReplyWithDetails>(`/api/v1/email-replies/${id}`)
  },

  /**
   * Mark reply as read
   */
  markAsRead: async (id: string): Promise<void> => {
    await apiFetch(`/api/v1/email-replies/${id}/read`, { method: "PATCH" })
  },

  /**
   * Mark reply as unread
   */
  markAsUnread: async (id: string): Promise<void> => {
    await apiFetch(`/api/v1/email-replies/${id}/unread`, { method: "PATCH" })
  },

  /**
   * Bulk mark as read
   */
  bulkMarkAsRead: async (replyIds: string[]): Promise<{ updatedCount: number }> => {
    return apiFetch<{ updatedCount: number }>("/api/v1/email-replies/bulk/read", {
      method: "PUT",
      body: JSON.stringify({ replyIds }),
    })
  },

  /**
   * Bulk mark as unread
   */
  bulkMarkAsUnread: async (replyIds: string[]): Promise<{ updatedCount: number }> => {
    return apiFetch<{ updatedCount: number }>("/api/v1/email-replies/bulk/unread", {
      method: "PUT",
      body: JSON.stringify({ replyIds }),
    })
  },

  /**
   * Delete email reply
   */
  delete: async (id: string): Promise<void> => {
    await apiFetch(`/api/v1/email-replies/${id}`, { method: "DELETE" })
  },

  /**
   * Bulk delete
   */
  bulkDelete: async (replyIds: string[]): Promise<{ deletedCount: number }> => {
    return apiFetch<{ deletedCount: number }>("/api/v1/email-replies/bulk", {
      method: "DELETE",
      body: JSON.stringify({ replyIds }),
    })
  },

  /**
   * Update email reply intent and sentiment
   */
  update: async (
    id: string,
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
  ): Promise<{
    id: string
    intent: string | null
    sentiment: string | null
  }> => {
    return apiFetch(`/api/v1/email-replies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  /**
   * Reclassify email reply using AI
   */
  reclassify: async (
    id: string,
  ): Promise<{
    success: boolean
    data: {
      id: string
      intent: string | null
      sentiment: string | null
      classification: {
        intent: string
        sentiment: string
        confidence: number
        reasoning: string
      }
    }
    message: string
  }> => {
    return apiFetch(`/api/v1/email-replies/${id}/reclassify`, {
      method: "POST",
    })
  },

  /**
   * Get intent counts for a workspace
   */
  getIntentCounts: async (workspaceId: string): Promise<Record<string, number>> => {
    return apiFetch(`/api/v1/email-replies/stats/by-intent?workspaceId=${workspaceId}`)
  },

  /**
   * Toggle important status for a thread
   */
  toggleImportant: async (threadId: string, isImportant: boolean): Promise<void> => {
    await apiFetch(`/api/v1/email-replies/thread/${threadId}/important`, {
      method: "PATCH",
      body: JSON.stringify({ isImportant }),
    })
  },

  /**
   * Mark thread as read
   */
  markThreadAsRead: async (threadId: string): Promise<void> => {
    await apiFetch(`/api/v1/email-replies/thread/${threadId}/read`, {
      method: "PATCH",
    })
  },
}
