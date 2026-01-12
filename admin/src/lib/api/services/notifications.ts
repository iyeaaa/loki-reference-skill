/**
 * Notifications API Service
 *
 * 알림 조회/관리 API
 */

import { apiFetch } from "@/lib/api/client"

// ============================================================================
// Types
// ============================================================================

export type NotificationType = "onboarding" | "system" | "success" | "error" | "info" | "warning"
export type NotificationPriority = "low" | "normal" | "high" | "urgent"

export type NotificationMetadata = {
  phase?: string
  progressPercent?: number
  jobId?: string
  errorCode?: string
  errorDetails?: string
  actionUrl?: string
  actionLabel?: string
  [key: string]: unknown
}

export type Notification = {
  id: string
  userId: string
  workspaceId: string | null
  workspaceName: string | null
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  read: boolean
  readAt: string | null
  metadata: NotificationMetadata | null
  entityType: string | null
  entityId: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationListResponse = {
  notifications: Notification[]
  total: number
  unreadCount: number
}

export type NotificationFilter = {
  workspaceId?: string
  type?: NotificationType
  read?: boolean
  limit?: number
  offset?: number
}

// ============================================================================
// API Functions
// ============================================================================

export const notificationsApi = {
  /**
   * 알림 목록 조회
   * Note: apiFetch already unwraps { success, data } response
   */
  getNotifications: (filter: NotificationFilter) => {
    const params = new URLSearchParams()
    if (filter.workspaceId) {
      params.set("workspaceId", filter.workspaceId)
    }
    if (filter.type) {
      params.set("type", filter.type)
    }
    if (filter.read !== undefined) {
      params.set("read", String(filter.read))
    }
    if (filter.limit) {
      params.set("limit", String(filter.limit))
    }
    if (filter.offset) {
      params.set("offset", String(filter.offset))
    }

    const queryString = params.toString()
    return apiFetch<NotificationListResponse>(
      `/api/v1/notifications${queryString ? `?${queryString}` : ""}`,
    )
  },

  /**
   * 읽지 않은 알림 개수 조회
   */
  getUnreadCount: (workspaceId?: string) => {
    const params = new URLSearchParams()
    if (workspaceId) {
      params.set("workspaceId", workspaceId)
    }

    const queryString = params.toString()
    return apiFetch<{ unreadCount: number }>(
      `/api/v1/notifications/unread-count${queryString ? `?${queryString}` : ""}`,
    ).then((res) => res.unreadCount)
  },

  /**
   * 알림 상세 조회
   */
  getNotification: (notificationId: string) =>
    apiFetch<Notification>(`/api/v1/notifications/${notificationId}`),

  /**
   * 알림 읽음 처리
   */
  markAsRead: (notificationId: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
    }).then((res) => res.success),

  /**
   * 모든 알림 읽음 처리
   */
  markAllAsRead: (workspaceId?: string) =>
    apiFetch<{ success: boolean; count: number }>("/api/v1/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({ workspaceId }),
    }),

  /**
   * 알림 삭제
   */
  deleteNotification: (notificationId: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/notifications/${notificationId}`, {
      method: "DELETE",
    }).then((res) => res.success),

  /**
   * 모든 알림 삭제
   */
  deleteAllNotifications: (workspaceId?: string) => {
    const params = new URLSearchParams()
    if (workspaceId) {
      params.set("workspaceId", workspaceId)
    }

    const queryString = params.toString()
    return apiFetch<{ success: boolean; count: number }>(
      `/api/v1/notifications${queryString ? `?${queryString}` : ""}`,
      { method: "DELETE" },
    )
  },

  /**
   * 알림 생성 (테스트/시스템 용)
   */
  createNotification: (params: {
    userId: string
    workspaceId?: string
    type: NotificationType
    priority?: NotificationPriority
    title: string
    message: string
    metadata?: NotificationMetadata
    entityType?: string
    entityId?: string
  }) =>
    apiFetch<Notification>("/api/v1/notifications", {
      method: "POST",
      body: JSON.stringify(params),
    }),
}
