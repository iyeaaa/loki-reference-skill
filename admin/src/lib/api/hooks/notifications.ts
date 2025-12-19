/**
 * Notifications React Query Hooks
 *
 * 알림 관리 훅
 * - TanStack Query for data fetching
 * - SSE for real-time updates
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef } from "react"
import toast from "react-hot-toast"
import { API_BASE_URL } from "../client"
import {
  type Notification,
  type NotificationFilter,
  type NotificationListResponse,
  notificationsApi,
} from "../services/notifications"

// ============================================================================
// SSE Types
// ============================================================================

type NotificationEventType = "created" | "updated" | "deleted" | "read" | "read_all"

type NotificationEvent = {
  type: NotificationEventType
  userId: string
  workspaceId?: string
  notification?: {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    metadata?: Record<string, unknown>
    createdAt: string
  }
  count?: number
  timestamp: string
}

// ============================================================================
// Query Keys
// ============================================================================

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filter: Partial<NotificationFilter>) => [...notificationKeys.all, "list", filter] as const,
  unreadCount: (userId: string, workspaceId?: string) =>
    [...notificationKeys.all, "unreadCount", userId, workspaceId] as const,
  detail: (notificationId: string) => [...notificationKeys.all, "detail", notificationId] as const,
}

// ============================================================================
// Queries
// ============================================================================

/**
 * 알림 목록 조회 훅
 */
export function useNotifications(
  filter: NotificationFilter,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: notificationKeys.list(filter),
    queryFn: () => notificationsApi.getNotifications(filter),
    enabled: options?.enabled !== false && !!filter.userId,
    refetchInterval: options?.refetchInterval,
    staleTime: 10 * 1000, // 10 seconds
  })
}

/**
 * 읽지 않은 알림 개수 조회 훅
 */
export function useUnreadCount(
  userId: string,
  workspaceId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(userId, workspaceId),
    queryFn: () => notificationsApi.getUnreadCount(userId, workspaceId),
    enabled: options?.enabled !== false && !!userId,
    refetchInterval: options?.refetchInterval ?? 30_000, // 30 seconds
    staleTime: 5 * 1000, // 5 seconds
  })
}

/**
 * 알림 상세 조회 훅
 */
export function useNotification(notificationId: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(notificationId),
    queryFn: () => notificationsApi.getNotification(notificationId, userId),
    enabled: enabled && !!notificationId && !!userId,
  })
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * 알림 읽음 처리 훅
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ notificationId, userId }: { notificationId: string; userId: string }) =>
      notificationsApi.markAsRead(notificationId, userId),
    onSuccess: (_, _variables) => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (error: Error) => {
      console.error("[Notifications] Failed to mark as read:", error)
    },
  })
}

/**
 * 모든 알림 읽음 처리 훅
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, workspaceId }: { userId: string; workspaceId?: string }) =>
      notificationsApi.markAllAsRead(userId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (error: Error) => {
      toast.error("알림 읽음 처리에 실패했습니다")
      console.error("[Notifications] Failed to mark all as read:", error)
    },
  })
}

/**
 * 알림 삭제 훅
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ notificationId, userId }: { notificationId: string; userId: string }) =>
      notificationsApi.deleteNotification(notificationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (error: Error) => {
      toast.error("알림 삭제에 실패했습니다")
      console.error("[Notifications] Failed to delete:", error)
    },
  })
}

/**
 * 모든 알림 삭제 훅
 */
export function useDeleteAllNotifications() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, workspaceId }: { userId: string; workspaceId?: string }) =>
      notificationsApi.deleteAllNotifications(userId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      toast.success("모든 알림이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error("알림 삭제에 실패했습니다")
      console.error("[Notifications] Failed to delete all:", error)
    },
  })
}

// ============================================================================
// SSE Hook for Real-time Updates
// ============================================================================

/**
 * SSE 연결을 통한 실시간 알림 업데이트 훅
 *
 * TanStack Query 캐시를 실시간으로 업데이트
 */
export function useNotificationSSE(
  userId: string,
  _workspaceId?: string,
  options?: {
    enabled?: boolean
    onNotification?: (event: NotificationEvent) => void
  },
) {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5
  const { enabled = true, onNotification } = options ?? {}

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  }, [queryClient])

  const handleEvent = useCallback(
    (event: NotificationEvent) => {
      console.log("[NotificationSSE] Event received:", event.type, event)

      // 콜백 호출
      onNotification?.(event)

      // TanStack Query 캐시 업데이트
      switch (event.type) {
        case "created":
          // 새 알림 생성 시 목록 및 카운트 갱신
          invalidateQueries()
          break

        case "updated":
          // 알림 업데이트 시 목록 갱신
          invalidateQueries()
          break

        case "read":
          // 단일 읽음 처리 - optimistic update 가능
          if (event.notification?.id) {
            // 목록에서 해당 알림 읽음 처리
            queryClient.setQueriesData<NotificationListResponse>(
              { queryKey: notificationKeys.all },
              (old) => {
                if (!old) {
                  return old
                }
                return {
                  ...old,
                  notifications: old.notifications.map((n) =>
                    n.id === event.notification?.id ? { ...n, read: true } : n,
                  ),
                  unreadCount: Math.max(0, old.unreadCount - 1),
                }
              },
            )
            // 읽지 않은 개수 갱신
            queryClient.setQueriesData<number>(
              { queryKey: [...notificationKeys.all, "unreadCount"] },
              (old) => Math.max(0, (old ?? 0) - 1),
            )
          }
          break

        case "read_all":
          // 전체 읽음 처리
          queryClient.setQueriesData<NotificationListResponse>(
            { queryKey: notificationKeys.all },
            (old) => {
              if (!old) {
                return old
              }
              return {
                ...old,
                notifications: old.notifications.map((n) => ({ ...n, read: true })),
                unreadCount: 0,
              }
            },
          )
          queryClient.setQueriesData<number>(
            { queryKey: [...notificationKeys.all, "unreadCount"] },
            () => 0,
          )
          break

        case "deleted":
          // 삭제 시 목록에서 제거
          if (event.notification?.id) {
            invalidateQueries()
          }
          break
      }
    },
    [invalidateQueries, onNotification, queryClient],
  )

  const connect = useCallback(() => {
    if (!(userId && enabled)) {
      return
    }

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `${API_BASE_URL}/api/v1/notifications/stream/${userId}`
    console.log("[NotificationSSE] Connecting to:", url)

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("[NotificationSSE] Connected")
      reconnectAttemptsRef.current = 0
    }

    eventSource.addEventListener("connected", (e) => {
      console.log("[NotificationSSE] Connection established:", e.data)
    })

    eventSource.addEventListener("notification", (e) => {
      try {
        const event = JSON.parse(e.data) as NotificationEvent
        handleEvent(event)
      } catch (error) {
        console.error("[NotificationSSE] Failed to parse event:", error)
      }
    })

    eventSource.onerror = (error) => {
      console.error("[NotificationSSE] Connection error:", error)
      eventSource.close()
      eventSourceRef.current = null

      // 재연결 시도
      if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000)
        console.log(`[NotificationSSE] Reconnecting in ${delay}ms...`)
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      }
    }
  }, [userId, enabled, handleEvent])

  // 연결 설정
  useEffect(() => {
    if (enabled && userId) {
      connect()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
    }
  }, [connect, enabled, userId])

  return {
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
    reconnect: connect,
  }
}

// ============================================================================
// Combined Hook
// ============================================================================

/**
 * 알림 관리 통합 훅
 *
 * 알림 목록, 읽지 않은 개수, 읽음/삭제 기능을 한 번에 제공
 * SSE를 통한 실시간 업데이트 지원
 */
export function useNotificationsManager(
  userId: string,
  workspaceId?: string,
  options?: {
    limit?: number
    refetchInterval?: number | false
    enableSSE?: boolean
  },
) {
  const { limit = 20, refetchInterval = false, enableSSE = true } = options ?? {}

  // SSE 연결 (실시간 업데이트)
  useNotificationSSE(userId, workspaceId, {
    enabled: enableSSE && !!userId,
  })

  // 알림 목록 (SSE가 활성화되면 polling 비활성화)
  const notificationsQuery = useNotifications(
    { userId, workspaceId, limit },
    { refetchInterval: enableSSE ? false : refetchInterval },
  )

  // 읽지 않은 개수 (SSE가 활성화되면 polling 비활성화)
  const unreadCountQuery = useUnreadCount(userId, workspaceId, {
    refetchInterval: enableSSE ? false : refetchInterval,
  })

  // Mutations
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const deleteNotification = useDeleteNotification()
  const deleteAllNotifications = useDeleteAllNotifications()

  return {
    // Data
    notifications: notificationsQuery.data?.notifications ?? [],
    total: notificationsQuery.data?.total ?? 0,
    unreadCount: unreadCountQuery.data ?? 0,
    hasUnread: (unreadCountQuery.data ?? 0) > 0,

    // Loading states
    isLoading: notificationsQuery.isLoading || unreadCountQuery.isLoading,
    isFetching: notificationsQuery.isFetching || unreadCountQuery.isFetching,

    // Actions
    markAsRead: (notificationId: string) => markAsRead.mutate({ notificationId, userId }),
    markAllAsRead: () => markAllAsRead.mutate({ userId, workspaceId }),
    deleteNotification: (notificationId: string) =>
      deleteNotification.mutate({ notificationId, userId }),
    deleteAllNotifications: () => deleteAllNotifications.mutate({ userId, workspaceId }),

    // Refetch
    refetch: () => {
      notificationsQuery.refetch()
      unreadCountQuery.refetch()
    },
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export type { Notification, NotificationFilter, NotificationListResponse }
