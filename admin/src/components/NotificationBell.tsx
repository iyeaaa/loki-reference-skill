/**
 * NotificationBell Component
 *
 * 헤더에 표시되는 알림 벨 아이콘과 드롭다운
 * - 읽지 않은 알림 개수 배지
 * - 날짜별 그룹화된 알림 목록
 * - 읽음/삭제 기능
 */

import { format, isToday, isYesterday } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { type Notification, useNotificationsManager } from "@/lib/api/hooks/notifications"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type NotificationBellProps = {
  workspaceId?: string
  className?: string
}

type GroupedNotifications = {
  dateKey: string
  dateLabel: string
  notifications: Notification[]
}

// ============================================================================
// Fake Progress Hook (Step 2와 동일한 로직)
// ============================================================================

/**
 * Fake Progress Hook
 *
 * UX Best Practice (Harrison et al., CMU 2007 & Nielsen Norman Group):
 * - "Fast start, slow finish" reduces perceived wait time by ~11%
 * - Users prefer progress that starts quickly and decelerates
 * - First 20% of progress has the most psychological impact
 *
 * Algorithm: Ease-out Cubic with optimized timing
 * - 시작: 5% (즉시 진행 중임을 보여줌)
 * - 0-5초: 5% → 12% (빠른 시작, 체감 속도 ↑)
 * - 5-15초: 12% → 14.5% (점진적 감속)
 * - 15-30초: 14.5% → 15% (거의 멈춤, 실제 데이터 대기)
 *
 * Formula: progress = minProgress + (1 - (1 - t)^3) * (maxProgress - minProgress)
 */
function useFakeProgress(
  realProgress: number,
  isActive: boolean,
  maxFakeProgress = 15,
  minFakeProgress = 5,
): number {
  const [fakeProgress, setFakeProgress] = useState(0)
  const startTimeRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isActive) {
      setFakeProgress(0)
      startTimeRef.current = null
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    // Start fake progress animation (항상 시작, realProgress와 무관)
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now()
    }

    const animate = () => {
      if (!startTimeRef.current) {
        return
      }

      const elapsed = Date.now() - startTimeRef.current
      const duration = 30_000 // 30 seconds to reach maxFakeProgress
      const t = Math.min(elapsed / duration, 1)

      // Ease-out Cubic: fast start, slow finish
      // Formula: minProgress + (1 - (1 - t)^3) * (maxProgress - minProgress)
      // At t=0 (0초): 5% (즉시 시작)
      // At t=0.17 (5초): ~12% (빠른 초기 진행)
      // At t=0.5 (15초): ~14% (점진적 감속)
      // At t=1.0 (30초): 15% (최대)
      const easeOutCubic = 1 - (1 - t) ** 3
      const progressRange = maxFakeProgress - minFakeProgress
      const easedProgress = minFakeProgress + easeOutCubic * progressRange

      setFakeProgress(easedProgress)

      // fake progress가 max에 도달하거나 real progress보다 높아질 때까지 계속
      if (t < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      }
    }

    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [isActive, maxFakeProgress, minFakeProgress]) // realProgress 의존성 제거 (animation 중단 방지)

  // isActive일 때 최소 minFakeProgress부터 시작 (즉시 진행 중 표시)
  const effectiveProgress = isActive ? Math.max(fakeProgress, minFakeProgress) : fakeProgress
  // 항상 둘 중 큰 값 반환 (역전 방지)
  return Math.max(realProgress, effectiveProgress)
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNotificationIcon(type: Notification["type"], metadata?: Notification["metadata"]) {
  // 온보딩 완료 상태 체크
  const isOnboardingComplete = metadata?.phase === "complete"

  // 컴팩트 스타일: 36x36 컨테이너, rounded-xl
  const baseClass = "flex h-9 w-9 items-center justify-center rounded-xl"
  const iconClass = "h-[18px] w-[18px]"

  switch (type) {
    case "success":
      return (
        <div className={`${baseClass} bg-green-100 dark:bg-green-900/30`}>
          <CheckCircle2 className={`${iconClass} text-green-600 dark:text-green-400`} />
        </div>
      )
    case "error":
      return (
        <div className={`${baseClass} bg-red-100 dark:bg-red-900/30`}>
          <XCircle className={`${iconClass} text-red-600 dark:text-red-400`} />
        </div>
      )
    case "warning":
      return (
        <div className={`${baseClass} bg-amber-100 dark:bg-amber-900/30`}>
          <AlertCircle className={`${iconClass} text-amber-600 dark:text-amber-400`} />
        </div>
      )
    case "onboarding":
      return isOnboardingComplete ? (
        <div className={`${baseClass} bg-green-100 dark:bg-green-900/30`}>
          <Users className={`${iconClass} text-green-600 dark:text-green-400`} />
        </div>
      ) : (
        <div className={`${baseClass} bg-blue-100 dark:bg-blue-900/30`}>
          <StarSpinner size={18} />
        </div>
      )
    default:
      return (
        <div className={`${baseClass} bg-gray-100 dark:bg-gray-800`}>
          <Bell className={`${iconClass} text-gray-600 dark:text-gray-400`} />
        </div>
      )
  }
}

/**
 * 온보딩 알림 상세 정보 포맷팅
 */
function formatOnboardingDetails(metadata: Notification["metadata"]): string | null {
  if (!metadata) {
    return null
  }

  const { leadsFound, previewsGenerated, totalPreviews, phase } = metadata as {
    leadsFound?: number
    previewsGenerated?: number
    totalPreviews?: number
    phase?: string
  }

  if (phase === "complete" && leadsFound && previewsGenerated) {
    return `바이어 ${leadsFound}명 · 이메일 ${previewsGenerated}개`
  }

  if (phase === "discovery" && leadsFound) {
    return `${leadsFound}명 찾는 중...`
  }

  if (phase === "previews" && previewsGenerated && totalPreviews) {
    return `이메일 ${previewsGenerated}/${totalPreviews}개 작성 중`
  }

  return null
}

function formatDateLabel(dateString: string): string {
  const date = new Date(dateString)

  if (isToday(date)) {
    return "오늘"
  }

  if (isYesterday(date)) {
    return "어제"
  }

  // 12.15 (월) 형식
  return format(date, "M.dd (E)", { locale: ko })
}

function formatTime(dateString: string): string {
  try {
    const date = new Date(dateString)
    // 오후 2시 4분 형식
    return format(date, "a h시 m분", { locale: ko })
  } catch {
    return ""
  }
}

function getDateKey(dateString: string): string {
  const date = new Date(dateString)
  return format(date, "yyyy-MM-dd")
}

function groupNotificationsByDate(notifications: Notification[]): GroupedNotifications[] {
  const groups = new Map<string, Notification[]>()

  for (const notification of notifications) {
    const key = getDateKey(notification.createdAt)
    const existing = groups.get(key) || []
    groups.set(key, [...existing, notification])
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[0].localeCompare(a[0])) // 날짜 최신순 정렬
    .map(([dateKey, items]) => ({
      dateKey,
      dateLabel: formatDateLabel(items[0]?.createdAt || ""),
      // 그룹 내 알림을 시간순(최신순) 정렬
      notifications: items.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    }))
}

// ============================================================================
// Sub-Components
// ============================================================================

type NotificationItemProps = {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onAction?: (url: string) => void
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onAction,
}: NotificationItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const metadata = notification.metadata as {
    phase?: string
    progressPercent?: number
    leadsFound?: number
    previewsGenerated?: number
    totalPreviews?: number
    actionUrl?: string
    actionLabel?: string
  } | null

  const phase = metadata?.phase
  const rawProgressPercent = metadata?.progressPercent ?? 0
  const isComplete = phase === "complete" || notification.type === "success"
  const isError = phase === "error" || notification.type === "error"
  const isInProgress = notification.type === "onboarding" && !isComplete && !isError

  // Fake progress 적용 (Step 2 UI와 동일한 로직)
  const displayProgress = useFakeProgress(
    rawProgressPercent,
    isInProgress,
    15, // Max fake progress before real data arrives
  )

  // 상세 정보 포맷팅
  const detailsText = formatOnboardingDetails(notification.metadata)

  // CTA 버튼 정보
  const actionUrl = metadata?.actionUrl
  const actionLabel = metadata?.actionLabel

  // 기본 CTA 설정 (체험판 유저는 결과 확인 불가)
  const getDefaultAction = () => {
    if (isError) {
      return { url: "/app/trial?step=2", label: "다시 시도" }
    }
    return null
  }

  const ctaAction = actionUrl
    ? { url: actionUrl, label: actionLabel || "확인하기" }
    : getDefaultAction()

  const handleCtaClick = () => {
    if (ctaAction?.url && onAction) {
      if (!notification.read) {
        onMarkAsRead(notification.id)
      }
      onAction(ctaAction.url)
    }
  }

  return (
    <li
      className={cn(
        "group relative flex gap-3 px-4 py-3 transition-colors",
        "hover:bg-muted/50",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
    >
      {/* Thumbnail Icon */}
      <div className="flex-shrink-0">
        {getNotificationIcon(notification.type, notification.metadata)}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {/* Title */}
            <p
              className={cn(
                "text-sm leading-snug",
                !notification.read && "font-medium text-foreground",
                notification.read && "text-muted-foreground",
              )}
            >
              {notification.title || notification.message}
            </p>

            {/* Details (바이어 수, 이메일 수 등) */}
            {detailsText && <p className="mt-0.5 text-muted-foreground text-xs">{detailsText}</p>}
          </div>

          {!notification.read && (
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
          )}
        </div>

        {/* Progress bar for in-progress onboarding */}
        {isInProgress && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full transition-all duration-500 ease-out",
                  displayProgress >= 100 ? "bg-green-500" : "bg-blue-500",
                )}
                style={{ width: `${Math.min(displayProgress, 100)}%` }}
              />
            </div>
            <p className="mt-1 text-muted-foreground text-xs">{Math.round(displayProgress)}%</p>
          </div>
        )}

        {/* CTA Button for complete/error states */}
        {ctaAction && (isComplete || isError) && (
          <Button
            className={cn(
              "mt-2 h-7 px-3 text-xs",
              isError && "border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700",
            )}
            onClick={handleCtaClick}
            size="sm"
            variant="outline"
          >
            {isError ? (
              <RefreshCw className="mr-1.5 h-3 w-3" />
            ) : (
              <ArrowRight className="mr-1.5 h-3 w-3" />
            )}
            {ctaAction.label}
          </Button>
        )}

        {/* Time - 왼쪽 하단 */}
        <p className="mt-1.5 text-[11px] text-muted-foreground/50">
          {formatTime(notification.createdAt)}
        </p>
      </div>

      {/* Actions Menu */}
      <div
        className={cn(
          "absolute top-2 right-2 transition-opacity",
          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button className="h-7 w-7" size="icon" variant="ghost">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!notification.read && (
              <DropdownMenuItem onClick={() => onMarkAsRead(notification.id)}>
                <Check className="mr-2 h-4 w-4" />
                읽음으로 표시
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => onDelete(notification.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

type DateGroupProps = {
  group: GroupedNotifications
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
  onAction: (url: string) => void
}

function DateGroup({ group, onMarkAsRead, onDelete, onAction }: DateGroupProps) {
  return (
    <div>
      {/* Date Header */}
      <div className="sticky top-0 z-10 bg-muted/80 px-4 py-2 backdrop-blur-sm">
        <span className="font-medium text-muted-foreground text-xs">{group.dateLabel}</span>
      </div>

      {/* Notifications */}
      <ul>
        {group.notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onAction={onAction}
            onDelete={onDelete}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </ul>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function NotificationBell({ workspaceId, className }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const {
    notifications,
    unreadCount,
    hasUnread,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refetch,
  } = useNotificationsManager(workspaceId, {
    limit: 50,
    enableSSE: true,
  })

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications],
  )

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      refetch()
      // 알림 메뉴 열 때 모든 알림 읽음 처리
      if (hasUnread) {
        markAllAsRead()
      }
    }
  }

  const handleAction = (url: string) => {
    setIsOpen(false)
    navigate(url)
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={isOpen}>
      <PopoverTrigger asChild>
        <button
          aria-label={`알림 ${hasUnread ? `(${unreadCount}개 읽지 않음)` : ""}`}
          className={cn(
            "relative inline-flex items-center justify-center",
            "h-9 w-9 rounded-md",
            "text-muted-foreground hover:text-foreground",
            "hover:bg-accent",
            "transition-colors duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
          type="button"
        >
          <Bell className="h-5 w-5" strokeWidth={1.75} />
          {hasUnread && (
            <span
              className={cn(
                "absolute flex items-center justify-center",
                "rounded-full bg-red-500 font-medium text-white",
                "ring-2 ring-background",
                unreadCount > 9
                  ? "-right-0.5 top-0.5 h-4 min-w-4 px-1 text-[10px]"
                  : "top-1 right-1 h-3.5 w-3.5 text-[9px]",
              )}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="font-semibold text-base">알림</h3>
          {hasUnread && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 font-medium text-[11px] text-white">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Notification List */}
        <ScrollArea className="h-[360px]">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <StarSpinner size={24} />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-4 py-8">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                <Bell className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm">알림이 없습니다</p>
            </div>
          ) : (
            <div className="divide-y">
              {groupedNotifications.map((group) => (
                <DateGroup
                  group={group}
                  key={group.dateKey}
                  onAction={handleAction}
                  onDelete={deleteNotification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-4 py-3">
          <p className="mb-3 text-center text-muted-foreground text-xs">
            최근 30일 동안의 알림만 보관되며, 이후 자동 삭제됩니다.
          </p>
          {hasUnread && (
            <Button className="w-full" onClick={markAllAsRead} size="sm" variant="outline">
              모두 읽음 처리
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default NotificationBell
