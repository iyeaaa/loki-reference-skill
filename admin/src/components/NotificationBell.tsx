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
import { Bell, Check, CheckCircle2, Loader2, MoreHorizontal, Trash2, XCircle } from "lucide-react"
import { useMemo, useState } from "react"
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
// Helper Functions
// ============================================================================

function getNotificationIcon(type: Notification["type"]) {
  switch (type) {
    case "success":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
      )
    case "error":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
          <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
      )
    case "warning":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
          <Bell className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        </div>
      )
    case "onboarding":
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
          <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
        </div>
      )
    default:
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
          <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </div>
      )
  }
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
    .sort((a, b) => b[0].localeCompare(a[0])) // 최신순 정렬
    .map(([dateKey, items]) => ({
      dateKey,
      dateLabel: formatDateLabel(items[0]?.createdAt || ""),
      notifications: items,
    }))
}

// ============================================================================
// Sub-Components
// ============================================================================

type NotificationItemProps = {
  notification: Notification
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

function NotificationItem({ notification, onMarkAsRead, onDelete }: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false)

  return (
    <li
      className={cn(
        "group relative flex gap-3 px-4 py-3 transition-colors",
        "hover:bg-muted/50",
        !notification.read && "bg-blue-50/50 dark:bg-blue-950/20",
      )}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Thumbnail Icon */}
      <div className="flex-shrink-0">{getNotificationIcon(notification.type)}</div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "line-clamp-2 text-sm leading-snug",
              !notification.read && "font-medium text-foreground",
              notification.read && "text-muted-foreground",
            )}
          >
            {notification.message || notification.title}
          </p>
          {!notification.read && (
            <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-blue-500" />
          )}
        </div>

        {/* Time */}
        <p className="mt-1 text-muted-foreground/70 text-xs">
          {formatTime(notification.createdAt)}
        </p>

        {/* Progress bar for onboarding notifications */}
        {notification.type === "onboarding" && notification.metadata?.progressPercent && (
          <div className="mt-2">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${notification.metadata.progressPercent}%` }}
              />
            </div>
            <p className="mt-1 text-muted-foreground text-xs">
              {notification.metadata.progressPercent}% 완료
            </p>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu>
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
      )}
    </li>
  )
}

type DateGroupProps = {
  group: GroupedNotifications
  onMarkAsRead: (id: string) => void
  onDelete: (id: string) => void
}

function DateGroup({ group, onMarkAsRead, onDelete }: DateGroupProps) {
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
    }
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={isOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "relative flex h-8 w-8 items-center justify-center rounded-full",
            "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700",
            "transition-colors",
            className,
          )}
          type="button"
        >
          <Bell className="h-4 w-4 text-gray-600 dark:text-gray-400" />
          {hasUnread && (
            <span className="-top-0.5 -right-0.5 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-medium text-[10px] text-white">
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
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
