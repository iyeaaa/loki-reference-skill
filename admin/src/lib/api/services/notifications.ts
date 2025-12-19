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
  userId: string
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
    params.set("userId", filter.userId)
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

    return apiFetch<NotificationListResponse>(`/api/v1/notifications?${params.toString()}`)
  },

  /**
   * 읽지 않은 알림 개수 조회
   */
  getUnreadCount: (userId: string, workspaceId?: string) => {
    const params = new URLSearchParams()
    params.set("userId", userId)
    if (workspaceId) {
      params.set("workspaceId", workspaceId)
    }

    return apiFetch<{ unreadCount: number }>(
      `/api/v1/notifications/unread-count?${params.toString()}`,
    ).then((res) => res.unreadCount)
  },

  /**
   * 알림 상세 조회
   */
  getNotification: (notificationId: string, userId: string) =>
    apiFetch<Notification>(`/api/v1/notifications/${notificationId}?userId=${userId}`),

  /**
   * 알림 읽음 처리
   */
  markAsRead: (notificationId: string, userId: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/notifications/${notificationId}/read`, {
      method: "PATCH",
      body: JSON.stringify({ userId }),
    }).then((res) => res.success),

  /**
   * 모든 알림 읽음 처리
   */
  markAllAsRead: (userId: string, workspaceId?: string) =>
    apiFetch<{ success: boolean; count: number }>("/api/v1/notifications/read-all", {
      method: "PATCH",
      body: JSON.stringify({ userId, workspaceId }),
    }),

  /**
   * 알림 삭제
   */
  deleteNotification: (notificationId: string, userId: string) =>
    apiFetch<{ success: boolean }>(`/api/v1/notifications/${notificationId}?userId=${userId}`, {
      method: "DELETE",
    }).then((res) => res.success),

  /**
   * 모든 알림 삭제
   */
  deleteAllNotifications: (userId: string, workspaceId?: string) => {
    const params = new URLSearchParams()
    params.set("userId", userId)
    if (workspaceId) {
      params.set("workspaceId", workspaceId)
    }

    return apiFetch<{ success: boolean; count: number }>(
      `/api/v1/notifications?${params.toString()}`,
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
