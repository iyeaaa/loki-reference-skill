/**
 * Session Expiry Alert Component
 * 세션 만료 경고 및 알림 UI
 *
 * 기능:
 * - 세션 만료 5분 전 경고 표시
 * - 세션 만료 시 알림 및 새 검색 유도
 * - 세션 연장 기능 (가능한 경우)
 */

import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { AlertCircle, Clock, RefreshCw, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { extendSession } from "@/lib/api/hooks/lead-discovery"
import {
  addSessionExpiryNotificationAtom,
  dismissSessionExpiryNotificationAtom,
  formatSessionRemainingTime,
  getSessionRemainingTime,
  isSessionExpired,
  isSessionExpiringSoon,
  SESSION_TTL_MS,
  sessionExpiryNotificationsAtom,
  streamingStateAtom,
  updateStreamingStateAtom,
} from "../store"

type SessionExpiryAlertProps = {
  onNewSearch?: () => void
}

export function SessionExpiryAlert({ onNewSearch }: SessionExpiryAlertProps) {
  const streamingState = useAtomValue(streamingStateAtom)
  const updateStreamingState = useSetAtom(updateStreamingStateAtom)
  const [notifications, _setNotifications] = useAtom(sessionExpiryNotificationsAtom)
  const addNotification = useSetAtom(addSessionExpiryNotificationAtom)
  const dismissNotification = useSetAtom(dismissSessionExpiryNotificationAtom)

  const [remainingTime, setRemainingTime] = useState<string>("")
  const [isExtending, setIsExtending] = useState(false)
  const [extendError, setExtendError] = useState<string | null>(null)

  const sessionId = streamingState.sessionId
  const sessionCreatedAt = streamingState.sessionCreatedAt

  // 남은 시간 업데이트 (1초마다)
  useEffect(() => {
    if (!sessionCreatedAt) {
      return
    }

    const updateTime = () => {
      setRemainingTime(formatSessionRemainingTime(sessionCreatedAt))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [sessionCreatedAt])

  // 세션 만료 경고 체크 (30초마다)
  useEffect(() => {
    if (!(sessionId && sessionCreatedAt)) {
      return
    }

    const checkExpiry = () => {
      const remaining = getSessionRemainingTime(sessionCreatedAt)

      if (isSessionExpired(sessionCreatedAt)) {
        addNotification({
          sessionId,
          type: "expired",
          message: "세션이 만료되었습니다. 새 검색을 시작해주세요.",
        })
      } else if (isSessionExpiringSoon(sessionCreatedAt)) {
        addNotification({
          sessionId,
          type: "warning",
          message: `세션이 ${Math.ceil(remaining / 60_000)}분 후 만료됩니다.`,
        })
      }
    }

    checkExpiry()
    const interval = setInterval(checkExpiry, 30_000)

    return () => clearInterval(interval)
  }, [sessionId, sessionCreatedAt, addNotification])

  // 세션 연장 핸들러
  const handleExtendSession = useCallback(async () => {
    if (!sessionId) {
      return
    }

    setIsExtending(true)
    setExtendError(null)

    try {
      const result = await extendSession(sessionId)

      if (result.success && result.expiresAt) {
        // 세션 생성 시간 업데이트 (연장된 만료 시간 기준)
        const newCreatedAt = result.expiresAt - SESSION_TTL_MS
        updateStreamingState({ sessionCreatedAt: newCreatedAt })

        // 경고 알림 해제
        dismissNotification(sessionId)
      } else {
        setExtendError(result.error || "세션 연장에 실패했습니다")
      }
    } catch (error) {
      setExtendError(error instanceof Error ? error.message : "세션 연장 실패")
    } finally {
      setIsExtending(false)
    }
  }, [sessionId, updateStreamingState, dismissNotification])

  // 알림 해제 핸들러
  const handleDismiss = useCallback(
    (notificationSessionId: string) => {
      dismissNotification(notificationSessionId)
    },
    [dismissNotification],
  )

  // 새 검색 핸들러
  const handleNewSearch = useCallback(() => {
    if (sessionId) {
      dismissNotification(sessionId)
    }
    onNewSearch?.()
  }, [sessionId, dismissNotification, onNewSearch])

  // 표시할 알림 필터링 (해제되지 않은 것만)
  const activeNotifications = notifications.filter((n) => !n.dismissedAt)

  if (activeNotifications.length === 0) {
    return null
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 flex max-w-md flex-col gap-2">
      {activeNotifications.map((notification) => (
        <Alert
          className={`relative shadow-lg ${
            notification.type === "warning"
              ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
              : ""
          }`}
          key={`${notification.sessionId}-${notification.type}`}
          variant={notification.type === "expired" ? "destructive" : "default"}
        >
          <Button
            className="absolute top-2 right-2 h-6 w-6"
            onClick={() => handleDismiss(notification.sessionId)}
            size="icon"
            variant="ghost"
          >
            <X className="h-4 w-4" />
          </Button>

          {notification.type === "warning" ? (
            <Clock className="h-4 w-4 text-amber-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}

          <AlertTitle className="pr-8">
            {notification.type === "warning" ? "세션 만료 예정" : "세션 만료됨"}
          </AlertTitle>

          <AlertDescription className="mt-2">
            <p className="text-sm">{notification.message}</p>

            {notification.type === "warning" && remainingTime && (
              <p className="mt-1 text-muted-foreground text-xs">
                남은 시간: <span className="font-mono">{remainingTime}</span>
              </p>
            )}

            {extendError && <p className="mt-1 text-red-600 text-xs">{extendError}</p>}

            <div className="mt-3 flex gap-2">
              {notification.type === "warning" && (
                <Button
                  className="h-7 text-xs"
                  disabled={isExtending}
                  onClick={handleExtendSession}
                  size="sm"
                  variant="outline"
                >
                  {isExtending ? (
                    <>
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      연장 중...
                    </>
                  ) : (
                    "세션 연장"
                  )}
                </Button>
              )}

              <Button
                className="h-7 text-xs"
                onClick={handleNewSearch}
                size="sm"
                variant={notification.type === "expired" ? "default" : "ghost"}
              >
                새 검색 시작
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

/**
 * 인라인 세션 상태 표시 (헤더/사이드바용)
 */
export function SessionStatusBadge() {
  const streamingState = useAtomValue(streamingStateAtom)
  const { sessionCreatedAt, status } = streamingState

  const [remainingTime, setRemainingTime] = useState<string>("")

  useEffect(() => {
    if (!sessionCreatedAt) {
      return
    }

    const updateTime = () => {
      setRemainingTime(formatSessionRemainingTime(sessionCreatedAt))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [sessionCreatedAt])

  // 진행 중이거나 대기 중인 상태가 아니면 표시 안 함
  if (
    !(
      sessionCreatedAt &&
      ["searching", "analyzing", "waiting_selection", "waiting_clarification"].includes(status)
    )
  ) {
    return null
  }

  const isExpiringSoon = isSessionExpiringSoon(sessionCreatedAt)
  const isExpired = isSessionExpired(sessionCreatedAt)

  if (isExpired) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-red-700 text-xs dark:bg-red-900/30 dark:text-red-400">
        <AlertCircle className="h-3 w-3" />
        만료됨
      </span>
    )
  }

  if (isExpiringSoon) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 text-xs dark:bg-amber-900/30 dark:text-amber-400">
        <Clock className="h-3 w-3" />
        {remainingTime}
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 text-xs dark:bg-blue-900/30 dark:text-blue-400">
      <Clock className="h-3 w-3" />
      {remainingTime}
    </span>
  )
}
