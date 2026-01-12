/**
 * NotificationBell Component
 *
 * 헤더에 표시되는 알림 벨 아이콘과 드롭다운
 * - 읽지 않은 알림 개수 배지
 * - 날짜별 그룹화된 알림 목록
 * - 읽음/삭제 기능
 *
 * NEW: 통합 Onboarding Progress Store 사용
 * - StepBuyerLoading과 진행률 공유
 * - 단일 SSE로 실시간 동기화
 */

import { format, isToday, isYesterday } from "date-fns"
import { ko } from "date-fns/locale"
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Building2,
  Check,
  CheckCircle2,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { type Notification, useNotificationsManager } from "@/lib/api/hooks/notifications"
import { dispatchWorkspaceChange, useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"
import { useOnboardingProgress, useOnboardingProgressReadOnly } from "@/store/onboarding-progress"

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
// Helper Functions
// ============================================================================

function getNotificationIcon(type: Notification["type"], metadata?: Notification["metadata"]) {
  const phase = metadata?.phase as string | undefined

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
    case "onboarding": {
      // 온보딩 상태별 아이콘 분기
      // 1. 완료 또는 phase 없음 (오래된 알림) → Users 아이콘
      // 2. 에러 → XCircle 아이콘
      // 3. 진행 중 (discovery, previews 등) → Loader2 스피너
      if (phase === "complete" || !phase) {
        return (
          <div className={`${baseClass} bg-green-100 dark:bg-green-900/30`}>
            <Users className={`${iconClass} text-green-600 dark:text-green-400`} />
          </div>
        )
      }
      if (phase === "error") {
        return (
          <div className={`${baseClass} bg-red-100 dark:bg-red-900/30`}>
            <XCircle className={`${iconClass} text-red-600 dark:text-red-400`} />
          </div>
        )
      }
      // 진행 중
      return (
        <div className={`${baseClass} bg-blue-100 dark:bg-blue-900/30`}>
          <Loader2 className={`${iconClass} animate-spin text-blue-600 dark:text-blue-400`} />
        </div>
      )
    }
    default:
      return (
        <div className={`${baseClass} bg-gray-100 dark:bg-gray-800`}>
          <Bell className={`${iconClass} text-gray-600 dark:text-gray-400`} />
        </div>
      )
  }
}

/**
 * 온보딩 알림 상세 정보 포맷팅 (토스 UX 라이팅 스타일)
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
    return `바이어 ${leadsFound}명 · 이메일 ${previewsGenerated}개 완료`
  }

  if (phase === "discovery" && leadsFound) {
    return `${leadsFound}명 찾았어요`
  }

  if (phase === "group") {
    return "리스트 정리하는 중"
  }

  if (phase === "templates") {
    return "이메일 초안 쓰는 중"
  }

  if (phase === "previews" && previewsGenerated !== undefined && totalPreviews) {
    const remaining = totalPreviews - previewsGenerated
    return remaining > 0 ? `${previewsGenerated}개 완료, ${remaining}개 남았어요` : "거의 다 됐어요"
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
  onAction?: (
    url: string,
    targetWorkspaceId?: string | null,
    targetWorkspaceName?: string | null,
  ) => void
  parentWorkspaceId?: string // 부모에서 전달받은 workspaceId (fallback)
  currentWorkspaceId?: string // 현재 선택된 workspaceId (자동 전환용)
}

function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onAction,
  parentWorkspaceId,
  currentWorkspaceId,
}: NotificationItemProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  // 다른 워크스페이스의 알림인지 확인 (배지 표시용)
  const isFromDifferentWorkspace =
    notification.workspaceId &&
    currentWorkspaceId &&
    notification.workspaceId !== currentWorkspaceId

  const metadata = notification.metadata as {
    phase?: string
    progressPercent?: number
    leadsFound?: number
    previewsGenerated?: number
    totalPreviews?: number
    actionUrl?: string
    actionLabel?: string
    workspaceId?: string
    parallelProgress?: {
      discovery: { percent: number; done: boolean }
      templates: { percent: number; done: boolean }
    }
  } | null

  const metadataPhase = metadata?.phase
  const isComplete = metadataPhase === "complete" || notification.type === "success"
  const isError = metadataPhase === "error" || notification.type === "error"
  const isInProgress = notification.type === "onboarding" && !isComplete && !isError

  // workspaceId를 metadata에서 가져오거나 부모에서 받은 것 사용
  const workspaceId = metadata?.workspaceId || parentWorkspaceId || ""

  // NEW: 통합 Onboarding Progress Store에서 실시간 진행률 가져오기
  // StepBuyerLoading과 동일한 상태 공유
  const progressState = useOnboardingProgressReadOnly(workspaceId)

  // 진행 중인 온보딩이면 통합 Store에서 실시간 진행률 사용
  // 완료/에러면 DB에 저장된 값 사용
  const displayProgress = isInProgress
    ? progressState.displayProgress
    : (metadata?.progressPercent ?? 0)

  // 병렬 진행률: 진행 중이면 Store에서, 완료/에러면 metadata에서
  const parallelProgress = isInProgress
    ? progressState.parallelProgress
    : metadata?.parallelProgress

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
      // 워크스페이스 정보 전달 (자동 전환용)
      onAction(ctaAction.url, notification.workspaceId, notification.workspaceName)
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

            {/* Workspace Badge (다른 워크스페이스의 알림일 경우만 표시) */}
            {isFromDifferentWorkspace && notification.workspaceName && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  {notification.workspaceName}
                </span>
              </div>
            )}

            {/* Details (바이어 수, 이메일 수 등) */}
            {detailsText && <p className="mt-0.5 text-muted-foreground text-xs">{detailsText}</p>}
          </div>

          {!notification.read && (
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
          )}
        </div>

        {/* Progress bar for in-progress onboarding */}
        {isInProgress && (
          <div className="mt-2 space-y-2">
            {/* 전체 진행률 */}
            <div>
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

            {/* 병렬 진행률 (Discovery + Templates) */}
            {parallelProgress && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-gray-600">바이어 검색</span>
                    <span className="text-gray-500">
                      {parallelProgress.discovery.done
                        ? "✓"
                        : `${parallelProgress.discovery.percent}%`}
                    </span>
                  </div>
                  {!parallelProgress.discovery.done && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${parallelProgress.discovery.percent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1 rounded border border-gray-200 bg-gray-50 p-2">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-medium text-gray-600">이메일 생성</span>
                    <span className="text-gray-500">
                      {parallelProgress.templates.done
                        ? "✓"
                        : `${parallelProgress.templates.percent}%`}
                    </span>
                  </div>
                  {!parallelProgress.templates.done && (
                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-200">
                      <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${parallelProgress.templates.percent}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
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
  onAction: (
    url: string,
    targetWorkspaceId?: string | null,
    targetWorkspaceName?: string | null,
  ) => void
  workspaceId?: string
  currentWorkspaceId?: string
}

function DateGroup({
  group,
  onMarkAsRead,
  onDelete,
  onAction,
  workspaceId,
  currentWorkspaceId,
}: DateGroupProps) {
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
            currentWorkspaceId={currentWorkspaceId}
            key={notification.id}
            notification={notification}
            onAction={onAction}
            onDelete={onDelete}
            onMarkAsRead={onMarkAsRead}
            parentWorkspaceId={workspaceId}
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
  const { selectedWorkspace } = useWorkspace()

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

  // 현재 선택된 워크스페이스 ID
  const currentWorkspaceId = selectedWorkspace?.id

  // NEW: 진행 중인 온보딩이 있는지 확인
  const hasInProgressOnboarding = useMemo(
    () =>
      notifications.some(
        (n) =>
          n.type === "onboarding" &&
          n.metadata?.phase !== "complete" &&
          n.metadata?.phase !== "error",
      ),
    [notifications],
  )

  // NEW: StepBuyerLoading이 마운트되지 않았고 진행 중인 온보딩이 있으면
  // 여기서 SSE 연결을 시작하여 실시간 진행률 업데이트
  // (StepBuyerLoading이 마운트되면 그쪽에서 관리)
  // NOTE: isConnected 체크 제거 - 연결 상태 변경이 조건을 변경하면 무한 루프 발생
  const shouldConnectSSE = !!workspaceId && hasInProgressOnboarding

  // SSE 연결 (진행 중인 온보딩이 있을 때만 활성화)
  // useOnboardingProgress 내부에서 중복 연결 방지 처리
  useOnboardingProgress(workspaceId || "", {
    enabled: shouldConnectSSE,
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

  const handleAction = (
    url: string,
    targetWorkspaceId?: string | null,
    targetWorkspaceName?: string | null,
  ) => {
    setIsOpen(false)

    // 다른 워크스페이스의 알림이면 워크스페이스 자동 전환
    if (targetWorkspaceId && targetWorkspaceId !== currentWorkspaceId) {
      localStorage.setItem("selectedWorkspace", targetWorkspaceId)
      localStorage.setItem("selectedWorkspaceName", targetWorkspaceName || "")
      dispatchWorkspaceChange()
    }

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
            <div className="space-y-1">
              {/* 로딩 Skeleton: 알림 아이템 3개 형태 */}
              {[1, 2, 3].map((i) => (
                <div className="flex gap-3 px-4 py-3" key={i}>
                  <Skeleton className="h-9 w-9 flex-shrink-0 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
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
                  currentWorkspaceId={currentWorkspaceId}
                  group={group}
                  key={group.dateKey}
                  onAction={handleAction}
                  onDelete={deleteNotification}
                  onMarkAsRead={markAsRead}
                  workspaceId={workspaceId}
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
