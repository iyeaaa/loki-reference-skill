/**
 * SessionManager Component
 * - 검색 히스토리/세션 목록 관리
 * - 검색 바, 필터, 정렬 기능 제공
 */

import { useAtom, useSetAtom } from "jotai"
import {
  ArrowDownUp,
  CheckCircle2,
  Clock,
  Filter,
  Loader2,
  Pause,
  Search,
  Trash2,
  X,
  XCircle,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  activeSessionIdAtom,
  clearAllSessionsAtom,
  getSessionStatusColor,
  getSessionStatusText,
  removeSearchSessionAtom,
  type SearchSession,
  type SearchSessionStatus,
  searchSessionsAtom,
} from "../store"

type SortOption = "newest" | "oldest" | "results_desc" | "results_asc"

type SessionManagerProps = {
  className?: string
  onSessionSelect?: (session: SearchSession) => void
  onClose?: () => void
}

export function SessionManager({ className, onSessionSelect, onClose }: SessionManagerProps) {
  const [sessions] = useAtom(searchSessionsAtom)
  const [activeSessionId, setActiveSessionId] = useAtom(activeSessionIdAtom)
  const removeSession = useSetAtom(removeSearchSessionAtom)
  const clearAllSessions = useSetAtom(clearAllSessionsAtom)

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState("")

  // 필터 상태 (상태별)
  const [statusFilters, setStatusFilters] = useState<SearchSessionStatus[]>([])

  // 정렬 상태
  const [sortOption, setSortOption] = useState<SortOption>("newest")

  // 필터링된 세션 목록
  const filteredSessions = useMemo(() => {
    let result = [...sessions]

    // 검색어 필터링
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (session) =>
          session.query.toLowerCase().includes(query) ||
          session.country?.toLowerCase().includes(query) ||
          session.industry?.toLowerCase().includes(query),
      )
    }

    // 상태 필터링
    if (statusFilters.length > 0) {
      result = result.filter((session) => statusFilters.includes(session.status))
    }

    // 정렬
    switch (sortOption) {
      case "newest":
        result.sort((a, b) => b.createdAt - a.createdAt)
        break
      case "oldest":
        result.sort((a, b) => a.createdAt - b.createdAt)
        break
      case "results_desc":
        result.sort(
          (a, b) => (b.totalCount || b.customers.length) - (a.totalCount || a.customers.length),
        )
        break
      case "results_asc":
        result.sort(
          (a, b) => (a.totalCount || a.customers.length) - (b.totalCount || b.customers.length),
        )
        break
    }

    return result
  }, [sessions, searchQuery, statusFilters, sortOption])

  // 상태 필터 토글
  const toggleStatusFilter = useCallback((status: SearchSessionStatus) => {
    setStatusFilters((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status],
    )
  }, [])

  // 세션 선택 핸들러
  const handleSelectSession = useCallback(
    (session: SearchSession) => {
      setActiveSessionId(session.id)
      onSessionSelect?.(session)
    },
    [setActiveSessionId, onSessionSelect],
  )

  // 세션 삭제 핸들러
  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation()
      removeSession(sessionId)
    },
    [removeSession],
  )

  // 상태별 아이콘 및 색상
  const getStatusIcon = (status: SearchSessionStatus) => {
    switch (status) {
      case "connecting":
      case "analyzing":
      case "searching":
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case "waiting_selection":
      case "waiting_clarification":
        return <Pause className="h-3.5 w-3.5" />
      case "complete":
        return <CheckCircle2 className="h-3.5 w-3.5" />
      case "error":
        return <XCircle className="h-3.5 w-3.5" />
      default:
        return <Clock className="h-3.5 w-3.5" />
    }
  }

  // 시간 포맷
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - timestamp

    // 1시간 이내
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000))
      return `${minutes}분 전`
    }

    // 24시간 이내
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000))
      return `${hours}시간 전`
    }

    // 그 외
    return date.toLocaleDateString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  // 통계
  const stats = useMemo(() => {
    const inProgress = sessions.filter((s) =>
      ["connecting", "analyzing", "searching"].includes(s.status),
    ).length
    const waiting = sessions.filter((s) =>
      ["waiting_selection", "waiting_clarification"].includes(s.status),
    ).length
    const completed = sessions.filter((s) => s.status === "complete").length
    const errors = sessions.filter((s) => s.status === "error").length
    return { inProgress, waiting, completed, errors, total: sessions.length }
  }, [sessions])

  return (
    <div className={cn("flex h-full flex-col border-r bg-background", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">검색 기록</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            {stats.total}
          </span>
        </div>
        {onClose && (
          <Button className="h-7 w-7" onClick={onClose} size="icon" variant="ghost">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* 검색 & 필터 */}
      <div className="space-y-2 border-b p-3">
        {/* 검색 바 */}
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="h-8 pl-8 text-sm"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색어, 국가, 산업으로 검색..."
            value={searchQuery}
          />
          {searchQuery && (
            <button
              className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 필터 & 정렬 버튼 */}
        <div className="flex items-center gap-2">
          {/* 상태 필터 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className={cn(
                  "h-7 gap-1.5 text-xs",
                  statusFilters.length > 0 && "border-primary text-primary",
                )}
                size="sm"
                variant="outline"
              >
                <Filter className="h-3.5 w-3.5" />
                상태
                {statusFilters.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-primary-foreground">
                    {statusFilters.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel>상태별 필터</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={statusFilters.some((s) =>
                  ["connecting", "analyzing", "searching"].includes(s),
                )}
                onCheckedChange={() => {
                  const inProgressStatuses: SearchSessionStatus[] = [
                    "connecting",
                    "analyzing",
                    "searching",
                  ]
                  const hasAny = statusFilters.some((s) => inProgressStatuses.includes(s))
                  if (hasAny) {
                    setStatusFilters((prev) => prev.filter((s) => !inProgressStatuses.includes(s)))
                  } else {
                    setStatusFilters((prev) => [...prev, ...inProgressStatuses])
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 text-blue-500" />
                  진행 중 ({stats.inProgress})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilters.some((s) =>
                  ["waiting_selection", "waiting_clarification"].includes(s),
                )}
                onCheckedChange={() => {
                  const waitingStatuses: SearchSessionStatus[] = [
                    "waiting_selection",
                    "waiting_clarification",
                  ]
                  const hasAny = statusFilters.some((s) => waitingStatuses.includes(s))
                  if (hasAny) {
                    setStatusFilters((prev) => prev.filter((s) => !waitingStatuses.includes(s)))
                  } else {
                    setStatusFilters((prev) => [...prev, ...waitingStatuses])
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Pause className="h-3.5 w-3.5 text-amber-500" />
                  대기 중 ({stats.waiting})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilters.includes("complete")}
                onCheckedChange={() => toggleStatusFilter("complete")}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  완료 ({stats.completed})
                </div>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={statusFilters.includes("error")}
                onCheckedChange={() => toggleStatusFilter("error")}
              >
                <div className="flex items-center gap-2">
                  <XCircle className="h-3.5 w-3.5 text-red-500" />
                  오류 ({stats.errors})
                </div>
              </DropdownMenuCheckboxItem>
              {statusFilters.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <Button
                    className="w-full justify-start text-xs"
                    onClick={() => setStatusFilters([])}
                    size="sm"
                    variant="ghost"
                  >
                    필터 초기화
                  </Button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 정렬 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="h-7 gap-1.5 text-xs" size="sm" variant="outline">
                <ArrowDownUp className="h-3.5 w-3.5" />
                정렬
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuLabel>정렬 기준</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                onValueChange={(v) => setSortOption(v as SortOption)}
                value={sortOption}
              >
                <DropdownMenuRadioItem value="newest">최신순</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="oldest">오래된순</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="results_desc">결과 많은순</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="results_asc">결과 적은순</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 전체 삭제 */}
          {sessions.length > 0 && (
            <Button
              className="ml-auto h-7 gap-1.5 text-destructive text-xs hover:text-destructive"
              onClick={() => clearAllSessions()}
              size="sm"
              variant="ghost"
            >
              <Trash2 className="h-3.5 w-3.5" />
              전체 삭제
            </Button>
          )}
        </div>
      </div>

      {/* 세션 목록 */}
      <ScrollArea className="flex-1">
        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <Search className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground text-sm">
              {sessions.length === 0 ? "검색 기록이 없습니다" : "검색 결과가 없습니다"}
            </p>
            <p className="mt-1 text-muted-foreground/80 text-xs">
              {sessions.length === 0
                ? "새로운 검색을 시작해보세요"
                : "다른 검색어나 필터를 시도해보세요"}
            </p>
          </div>
        ) : (
          <div className="p-2">
            {filteredSessions.map((session) => {
              const statusColors = getSessionStatusColor(session.status)
              const isActive = activeSessionId === session.id

              return (
                <button
                  className={cn(
                    "group mb-1 flex w-full flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
                    "hover:bg-muted/50",
                    isActive ? "border-primary bg-primary/5" : "border-transparent",
                  )}
                  key={session.id}
                  onClick={() => handleSelectSession(session)}
                  type="button"
                >
                  {/* 상단: 쿼리 & 삭제 버튼 */}
                  <div className="flex w-full items-start justify-between gap-2">
                    <span className="line-clamp-2 flex-1 font-medium text-sm">{session.query}</span>
                    <button
                      className="flex-shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* 중단: 조건 태그 */}
                  {(session.country || session.industry) && (
                    <div className="flex flex-wrap gap-1">
                      {session.country && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                          {session.country}
                        </span>
                      )}
                      {session.industry && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                          {session.industry}
                        </span>
                      )}
                    </div>
                  )}

                  {/* 하단: 상태 & 시간 */}
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs",
                        statusColors.bg,
                        statusColors.text,
                      )}
                    >
                      {getStatusIcon(session.status)}
                      {getSessionStatusText(session)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatTime(session.createdAt)}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
