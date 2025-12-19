/**
 * Notification Store (Jotai + localStorage)
 *
 * SSE 이벤트 및 시스템 알림 관리
 * - 실시간 온보딩 진행 상황 알림
 * - 읽음/안읽음 상태 관리
 * - localStorage persist
 */

import { atom } from "jotai"
import { atomWithStorage, createJSONStorage } from "jotai/utils"
import type { OnboardingPhase, OnboardingProgressEvent } from "@/lib/api/hooks/onboarding"

// ============================================================================
// Types
// ============================================================================

export type NotificationType = "onboarding" | "system" | "success" | "error" | "info"

export type Notification = {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp: string
  read: boolean
  // Onboarding-specific data
  phase?: OnboardingPhase
  progressPercent?: number
  workspaceId?: string
  jobId?: string
  // Auto-dismiss
  autoDismiss?: boolean
  dismissAfterMs?: number
}

export type NotificationState = {
  notifications: Notification[]
  maxNotifications: number
}

// ============================================================================
// Constants
// ============================================================================

export const NOTIFICATION_STORAGE_KEY = "rinda_notifications"
const MAX_NOTIFICATIONS = 50

const DEFAULT_STATE: NotificationState = {
  notifications: [],
  maxNotifications: MAX_NOTIFICATIONS,
}

// ============================================================================
// Storage
// ============================================================================

const syncStorage = createJSONStorage<NotificationState>(() => localStorage)

// ============================================================================
// Atoms
// ============================================================================

/**
 * Notification state atom (localStorage persist)
 */
export const notificationStateAtom = atomWithStorage<NotificationState>(
  NOTIFICATION_STORAGE_KEY,
  DEFAULT_STATE,
  syncStorage,
  { getOnInit: true },
)

/**
 * Notifications list (derived)
 */
export const notificationsAtom = atom((get) => {
  const state = get(notificationStateAtom)
  return state.notifications
})

/**
 * Unread count (derived)
 */
export const unreadCountAtom = atom((get) => {
  const state = get(notificationStateAtom)
  return state.notifications.filter((n) => !n.read).length
})

/**
 * Has unread notifications (derived)
 */
export const hasUnreadAtom = atom((get) => get(unreadCountAtom) > 0)

// ============================================================================
// Action Atoms (write-only)
// ============================================================================

/**
 * Add notification
 */
export const addNotificationAtom = atom(
  null,
  (get, set, notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const state = get(notificationStateAtom)
    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      read: false,
    }

    // Limit notifications to maxNotifications
    const updatedNotifications = [newNotification, ...state.notifications].slice(
      0,
      state.maxNotifications,
    )

    set(notificationStateAtom, {
      ...state,
      notifications: updatedNotifications,
    })

    return newNotification
  },
)

/**
 * Mark notification as read
 */
export const markAsReadAtom = atom(null, (get, set, notificationId: string) => {
  const state = get(notificationStateAtom)
  set(notificationStateAtom, {
    ...state,
    notifications: state.notifications.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n,
    ),
  })
})

/**
 * Mark all as read
 */
export const markAllAsReadAtom = atom(null, (get, set) => {
  const state = get(notificationStateAtom)
  set(notificationStateAtom, {
    ...state,
    notifications: state.notifications.map((n) => ({ ...n, read: true })),
  })
})

/**
 * Remove notification
 */
export const removeNotificationAtom = atom(null, (get, set, notificationId: string) => {
  const state = get(notificationStateAtom)
  set(notificationStateAtom, {
    ...state,
    notifications: state.notifications.filter((n) => n.id !== notificationId),
  })
})

/**
 * Clear all notifications
 */
export const clearNotificationsAtom = atom(null, (get, set) => {
  const state = get(notificationStateAtom)
  set(notificationStateAtom, {
    ...state,
    notifications: [],
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate notification ID
 */
export function generateNotificationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Create onboarding progress notification from SSE event
 */
export function createOnboardingNotification(
  event: OnboardingProgressEvent,
): Omit<Notification, "id" | "timestamp" | "read"> {
  const isComplete = event.phase === "complete"
  const isError = event.phase === "error"

  let title: string
  let type: NotificationType

  if (isComplete) {
    title = "온보딩 완료"
    type = "success"
  } else if (isError) {
    title = "온보딩 오류"
    type = "error"
  } else {
    title = "온보딩 진행 중"
    type = "onboarding"
  }

  return {
    type,
    title,
    message: event.messageKr || event.message,
    phase: event.phase,
    progressPercent: event.progressPercent,
    workspaceId: event.workspaceId,
    jobId: event.jobId,
    autoDismiss: !(isComplete || isError), // Auto-dismiss progress updates
    dismissAfterMs: 30_000, // 30 seconds
  }
}

/**
 * Get phase display name
 */
export function getPhaseDisplayName(phase: OnboardingPhase, isKorean = true): string {
  const names: Record<OnboardingPhase, { en: string; kr: string }> = {
    init: { en: "Initializing", kr: "초기화" },
    discovery: { en: "Lead Discovery", kr: "리드 탐색" },
    group: { en: "Creating Group", kr: "그룹 생성" },
    templates: { en: "Generating Templates", kr: "템플릿 생성" },
    sequence: { en: "Creating Sequence", kr: "시퀀스 생성" },
    previews: { en: "Generating Previews", kr: "프리뷰 생성" },
    complete: { en: "Complete", kr: "완료" },
    error: { en: "Error", kr: "오류" },
  }

  return isKorean ? names[phase].kr : names[phase].en
}

/**
 * Format timestamp for display
 */
export function formatNotificationTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMins < 1) {
    return "방금"
  }
  if (diffMins < 60) {
    return `${diffMins}분 전`
  }
  if (diffHours < 24) {
    return `${diffHours}시간 전`
  }
  if (diffDays < 7) {
    return `${diffDays}일 전`
  }

  return date.toLocaleDateString("ko-KR", {
    month: "short",
    day: "numeric",
  })
}
