/**
 * Notifications React Query Hooks
 *
 * 알림 관리 훅
 * - TanStack Query for data fetching
 * - SSE for real-time updates
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import toast from "react-hot-toast"
import { API_BASE_URL, getToken } from "../client"
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
  unreadCount: (workspaceId?: string) =>
    [...notificationKeys.all, "unreadCount", workspaceId] as const,
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
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval,
    staleTime: 10 * 1000, // 10 seconds
  })
}

/**
 * 읽지 않은 알림 개수 조회 훅
 */
export function useUnreadCount(
  workspaceId?: string,
  options?: { enabled?: boolean; refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(workspaceId),
    queryFn: () => notificationsApi.getUnreadCount(workspaceId),
    enabled: options?.enabled !== false,
    refetchInterval: options?.refetchInterval ?? 30_000, // 30 seconds
    staleTime: 5 * 1000, // 5 seconds
  })
}

/**
 * 알림 상세 조회 훅
 */
export function useNotification(notificationId: string, enabled = true) {
  return useQuery({
    queryKey: notificationKeys.detail(notificationId),
    queryFn: () => notificationsApi.getNotification(notificationId),
    enabled: enabled && !!notificationId,
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
    mutationFn: (notificationId: string) => notificationsApi.markAsRead(notificationId),
    onSuccess: () => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (error: Error) => {
      console.error("[Notifications] Failed to mark as read:", error)
    },
  })
}

/**
 * 모든 알림 읽음 처리 훅 (Optimistic Update)
 */
export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaceId?: string) => notificationsApi.markAllAsRead(workspaceId),
    onMutate: async () => {
      // 진행 중인 쿼리 취소
      await queryClient.cancelQueries({ queryKey: notificationKeys.all })

      // 현재 캐시된 데이터 백업
      const previousData = queryClient.getQueriesData({ queryKey: notificationKeys.all })

      // Optimistic update: 모든 알림을 읽음으로 표시
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

      return { previousData }
    },
    onError: (error: Error, _, context) => {
      // 에러 시 이전 데이터로 롤백
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error("알림 읽음 처리에 실패했습니다")
      console.error("[Notifications] Failed to mark all as read:", error)
    },
    // onSuccess에서 invalidate 제거 - optimistic update로 충분
  })
}

/**
 * 알림 삭제 훅
 */
export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.deleteNotification(notificationId),
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
    mutationFn: (workspaceId?: string) => notificationsApi.deleteAllNotifications(workspaceId),
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
 * SSE 연결 상태
 */
export type SSEConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"

/**
 * SSE 연결을 통한 실시간 알림 업데이트 훅
 *
 * TanStack Query 캐시를 실시간으로 업데이트
 * useState 기반 상태 관리로 UI 동기화 보장
 */
export function useNotificationSSE(
  _userId?: string, // Kept for backwards compatibility but no longer used (token is used instead)
  _workspaceId?: string,
  options?: {
    enabled?: boolean
    onNotification?: (event: NotificationEvent) => void
    onConnectionChange?: (state: SSEConnectionState) => void
  },
) {
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  // ✅ useState로 연결 상태 관리 (리렌더링 트리거)
  const [connectionState, setConnectionState] = useState<SSEConnectionState>("disconnected")

  const { enabled = true, onNotification, onConnectionChange } = options ?? {}

  // 상태 변경 시 콜백 호출
  const updateConnectionState = useCallback(
    (newState: SSEConnectionState) => {
      setConnectionState(newState)
      onConnectionChange?.(newState)
    },
    [onConnectionChange],
  )

  const invalidateQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: notificationKeys.all })
  }, [queryClient])

  const handleEvent = useCallback(
    (event: NotificationEvent) => {
      console.log("[NotificationSSE] Event received:", event.type)

      // 콜백 호출
      onNotification?.(event)

      // TanStack Query 캐시 업데이트
      switch (event.type) {
        case "created":
        case "updated":
          invalidateQueries()
          break

        case "read":
          if (event.notification?.id) {
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
            queryClient.setQueriesData<number>(
              { queryKey: [...notificationKeys.all, "unreadCount"] },
              (old) => Math.max(0, (old ?? 0) - 1),
            )
          }
          break

        case "read_all":
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
          if (event.notification?.id) {
            invalidateQueries()
          }
          break
      }
    },
    [invalidateQueries, onNotification, queryClient],
  )

  // 연결 해제 함수
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
  }, [])

  // 연결 함수
  const connect = useCallback(() => {
    if (!enabled) {
      return
    }

    const token = getToken()
    if (!token) {
      console.warn("[NotificationSSE] No auth token available")
      updateConnectionState("error")
      return
    }

    // 기존 연결 정리
    disconnect()

    // 연결 중 상태 설정
    updateConnectionState(reconnectAttemptsRef.current > 0 ? "reconnecting" : "connecting")

    const url = `${API_BASE_URL}/api/v1/notifications/stream?token=${encodeURIComponent(token)}`
    console.log("[NotificationSSE] Connecting to:", url)

    const eventSource = new EventSource(url)
    eventSourceRef.current = eventSource

    eventSource.onopen = () => {
      console.log("[NotificationSSE] Connected")
      reconnectAttemptsRef.current = 0
      updateConnectionState("connected") // ✅ 연결됨
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
      updateConnectionState("disconnected") // ✅ 연결 끊김

      // 재연결 시도
      if (reconnectAttemptsRef.current < maxReconnectAttempts && enabled) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30_000)
        console.log(
          `[NotificationSSE] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`,
        )

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++
          connect()
        }, delay)
      } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        updateConnectionState("error") // ✅ 최대 재시도 초과
      }
    }
  }, [enabled, handleEvent, disconnect, updateConnectionState])

  // 연결 설정
  useEffect(() => {
    if (enabled) {
      connect()
    } else {
      disconnect()
      updateConnectionState("disconnected")
    }

    return () => {
      disconnect()
    }
  }, [connect, disconnect, enabled, updateConnectionState])

  return {
    // ✅ 상태 기반 반환값 (리렌더링 트리거됨)
    connectionState,
    isConnected: connectionState === "connected",
    isConnecting: connectionState === "connecting" || connectionState === "reconnecting",
    isError: connectionState === "error",
    reconnectAttempts: reconnectAttemptsRef.current,

    // Actions
    reconnect: connect,
    disconnect,
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
  workspaceId?: string,
  options?: {
    limit?: number
    refetchInterval?: number | false
    enableSSE?: boolean
  },
) {
  const { limit = 20, refetchInterval = false, enableSSE = true } = options ?? {}

  // SSE 연결 (실시간 업데이트)
  useNotificationSSE(undefined, workspaceId, {
    enabled: enableSSE,
  })

  // 알림 목록 + unreadCount 통합 조회 (SSE가 활성화되면 polling 비활성화)
  // getNotifications API가 notifications, total, unreadCount를 모두 반환
  const notificationsQuery = useNotifications(
    { workspaceId, limit },
    { refetchInterval: enableSSE ? false : refetchInterval },
  )

  // Mutations
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const deleteNotification = useDeleteNotification()
  const deleteAllNotifications = useDeleteAllNotifications()

  // unreadCount를 notificationsQuery에서 직접 가져옴 (별도 API 호출 제거)
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0

  return {
    // Data
    notifications: notificationsQuery.data?.notifications ?? [],
    total: notificationsQuery.data?.total ?? 0,
    unreadCount,
    hasUnread: unreadCount > 0,

    // Loading states
    isLoading: notificationsQuery.isLoading,
    isFetching: notificationsQuery.isFetching,

    // Actions
    markAsRead: (notificationId: string) => markAsRead.mutate(notificationId),
    markAllAsRead: () => markAllAsRead.mutate(workspaceId),
    deleteNotification: (notificationId: string) => deleteNotification.mutate(notificationId),
    deleteAllNotifications: () => deleteAllNotifications.mutate(workspaceId),

    // Refetch
    refetch: () => {
      notificationsQuery.refetch()
    },
  }
}

// ============================================================================
// Re-exports
// ============================================================================

export type { Notification, NotificationFilter, NotificationListResponse }
