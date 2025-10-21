import {
  BarChart3,
  Clock,
  Heart,
  Inbox,
  Mail,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { TodoList } from "@/components/TodoList"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAvgOpenRateStats,
  useBuyerResponseRate,
  useRecentSequences,
  useRepliedEmails,
  useScheduledFollowups,
  useTodaySentStats,
} from "@/lib/api/hooks/emails"
import { useLeads } from "@/lib/api/hooks/leads"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import type { CreateTodoRequest, Todo, UpdateTodoRequest } from "@/lib/types/todo"
import { cn } from "@/lib/utils"

// 캘린더 DayButton 컴포넌트 팩토리 (외부로 분리하여 nested component 경고 방지)
function createFollowupDayButton(followupsByDate: Map<string, { totalCount: number }>) {
  return function FollowupDayButton({
    day,
    modifiers,
    ...props
  }: {
    day: { date: Date }
    modifiers: {
      selected?: boolean
      today?: boolean
      outside?: boolean
    }
  }) {
    const dateStr = day.date.toISOString().split("T")[0]
    const followup = followupsByDate.get(dateStr)

    return (
      <button
        {...props}
        type="button"
        className={cn(
          "relative w-full h-full p-0 text-center flex flex-col items-center justify-center aspect-square select-none",
          "hover:bg-accent rounded-md transition-colors",
          modifiers.selected && "bg-primary text-primary-foreground",
          modifiers.today && "bg-accent",
          modifiers.outside && "text-muted-foreground opacity-50",
        )}
      >
        <span className="text-sm">{day.date.getDate()}</span>
        {<span className="text-[10px] font-bold">{followup?.totalCount ?? 0}건</span>}
      </button>
    )
  }
}

export default function DashboardPage() {
  const { selectedWorkspace } = useWorkspace()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)

  // 투두리스트 상태 관리
  const [todos, setTodos] = useState<Todo[]>([])
  const [filteredTodos, setFilteredTodos] = useState<Todo[]>([])

  // 로컬 스토리지에서 투두리스트 로드
  useEffect(() => {
    const savedTodos = localStorage.getItem("todos")
    if (savedTodos) {
      setTodos(JSON.parse(savedTodos))
    }
  }, [])

  // 워크스페이스별 투두리스트 필터링
  useEffect(() => {
    if (selectedWorkspace?.id === "all") {
      setFilteredTodos(todos)
    } else {
      setFilteredTodos(
        todos.filter((todo) => todo.workspaceId === selectedWorkspace?.id || !todo.workspaceId),
      )
    }
  }, [todos, selectedWorkspace])

  // 투두리스트 CRUD 함수들
  const handleAddTodo = (newTodo: CreateTodoRequest) => {
    const todo: Todo = {
      id: Date.now().toString(),
      ...newTodo,
      completed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    const updatedTodos = [...todos, todo]
    setTodos(updatedTodos)
    localStorage.setItem("todos", JSON.stringify(updatedTodos))
  }

  const handleUpdateTodo = (id: string, updates: UpdateTodoRequest) => {
    const updatedTodos = todos.map((todo) =>
      todo.id === id ? { ...todo, ...updates, updatedAt: new Date().toISOString() } : todo,
    )
    setTodos(updatedTodos)
    localStorage.setItem("todos", JSON.stringify(updatedTodos))
  }

  const handleDeleteTodo = (id: string) => {
    const updatedTodos = todos.filter((todo) => todo.id !== id)
    setTodos(updatedTodos)
    localStorage.setItem("todos", JSON.stringify(updatedTodos))
  }

  // 워크스페이스별 고객 수 조회
  const { data: leadsData, isLoading: leadsLoading } = useLeads({
    limit: 1, // 총 개수만 필요하므로 1개만 조회
    page: 1,
    workspaceIds:
      selectedWorkspace?.id === "all"
        ? undefined
        : selectedWorkspace?.id
          ? [selectedWorkspace.id]
          : undefined,
  })

  // 오늘 발송된 이메일 수 조회
  const { data: todaySentData, isLoading: todaySentLoading } = useTodaySentStats({
    workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
  })

  // 평균 오픈률 조회
  const { data: avgOpenRateData, isLoading: avgOpenRateLoading } = useAvgOpenRateStats({
    workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
  })

  // 최근 시퀀스 성과 조회
  const { data: recentSequencesData, isLoading: recentSequencesLoading } = useRecentSequences({
    workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
    limit: 4,
  })

  // 예약된 팔로우업 발송 조회
  const { data: scheduledFollowupsData, isLoading: scheduledFollowupsLoading } =
    useScheduledFollowups({
      workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
    })

  // 바이어 응답률 조회
  const { data: buyerResponseRateData, isLoading: buyerResponseRateLoading } = useBuyerResponseRate(
    {
      workspaceId: selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id,
    },
  )

  // 최근 답장 이메일 조회 (인박스 미리보기용)
  const { data: repliedEmailsData, isLoading: repliedEmailsLoading } = useRepliedEmails({
    workspaceId:
      selectedWorkspace?.id === "all" || !selectedWorkspace?.id ? "" : selectedWorkspace.id,
    limit: 5,
    page: 1,
  })

  const totalCustomers = leadsData?.total || 0
  const todaySentCount = todaySentData?.todaySentCount || 0
  const avgOpenRate = avgOpenRateData?.avgOpenRate || 0
  const buyerResponseRate = buyerResponseRateData?.responseRate || 0
  const recentSequences = recentSequencesData?.sequences || []
  const scheduledFollowups = scheduledFollowupsData?.followups || []
  const totalScheduled = scheduledFollowupsData?.totalScheduled || 0
  const recentReplies = repliedEmailsData?.repliedEmails || []

  // 날짜별 발송 예정 건수를 매핑
  const followupsByDate = useMemo(() => {
    const map = new Map<string, (typeof scheduledFollowups)[0]>()
    scheduledFollowups.forEach((followup) => {
      map.set(followup.scheduledDate, followup)
    })
    return map
  }, [scheduledFollowups])

  // 선택된 날짜의 상세 정보
  const selectedDateInfo = selectedDate
    ? followupsByDate.get(selectedDate.toISOString().split("T")[0])
    : undefined

  // DayButton 컴포넌트를 메모이제이션
  const DayButtonComponent = useMemo(
    () => createFollowupDayButton(followupsByDate),
    [followupsByDate],
  )

  return (
    <div className="p-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {selectedWorkspace?.id === "all" ? "전체 고객" : "워크스페이스 고객"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {leadsLoading ? <Skeleton className="h-8 w-16" /> : totalCustomers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedWorkspace?.name || "중소 뷰티업체"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">오늘 발송</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todaySentLoading ? (
                <Skeleton className="h-8 w-12" />
              ) : (
                todaySentCount.toLocaleString()
              )}
            </div>
            <p className="text-xs text-muted-foreground">해외 바이어 컨택</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 오픈율</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {avgOpenRateLoading ? <Skeleton className="h-8 w-16" /> : `${avgOpenRate}%`}
            </div>
            <p className="text-xs text-muted-foreground">해외 바이어 오픈</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">바이어 응답률</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {buyerResponseRateLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                `${buyerResponseRate}%`
              )}
            </div>
            <p className="text-xs text-muted-foreground">미팅 요청 포함</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>최근 시퀀스 성과</CardTitle>
            <CardDescription>해외 바이어 컨택 자동 시퀀스 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSequencesLoading ? (
                // Loading skeleton
                Array.from({ length: 4 }, (_, i) => i).map((skeletonId) => (
                  <div
                    key={`skeleton-${skeletonId}`}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div>
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-4 w-16 mb-1" />
                      <Skeleton className="h-3 w-12" />
                    </div>
                  </div>
                ))
              ) : recentSequences.length > 0 ? (
                recentSequences.map((sequence, index) => {
                  const icons = [Sparkles, Heart, ShoppingBag, Clock]
                  const Icon = icons[index % icons.length]

                  return (
                    <div
                      key={sequence.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{sequence.name}</h4>
                          <p className="text-xs text-muted-foreground">
                            {sequence.status === "active"
                              ? "활성"
                              : sequence.status === "paused"
                                ? "일시정지"
                                : sequence.status === "draft"
                                  ? "초안"
                                  : "보관됨"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{sequence.sent} 발송</div>
                        <div className="text-xs text-muted-foreground">
                          {sequence.opened} 오픈 • {sequence.clicked} 클릭
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>최근 시퀀스가 없습니다.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>팔로우업 발송 예정</CardTitle>
            <CardDescription>
              바이어 자동 팔로우업 발송 현황 (총 {totalScheduled}건)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {scheduledFollowupsLoading ? (
              // Loading skeleton
              <div className="space-y-4">
                <Skeleton className="h-[300px] w-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex justify-center items-center flex-col">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className="rounded-md border w-[50%]"
                  modifiers={{
                    scheduled: Array.from(followupsByDate.keys()).map(
                      (dateStr) => new Date(dateStr),
                    ),
                  }}
                  modifiersClassNames={{
                    scheduled: "bg-primary/10 font-bold",
                  }}
                  components={{
                    DayButton: DayButtonComponent,
                  }}
                />

                {selectedDateInfo ? (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">
                        {selectedDate?.toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </h4>
                      <span className="text-sm font-bold text-primary">
                        {selectedDateInfo.totalCount}건
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedDateInfo.delayDays}일 후 팔로우업
                    </div>
                    <div className="space-y-2">
                      {selectedDateInfo.sequences.map((seq) => (
                        <div
                          key={`${seq.sequenceName}-${seq.subject}`}
                          className="p-2 bg-background rounded border"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">{seq.sequenceName}</span>
                            <span className="text-xs text-muted-foreground">{seq.count}건</span>
                          </div>
                          <div className="text-xs text-muted-foreground">{seq.subject}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : scheduledFollowups.length === 0 ? (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    예약된 팔로우업이 없습니다
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    날짜를 선택하여 상세 정보를 확인하세요
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              인박스 미리보기
            </CardTitle>
            <CardDescription>최근 받은 답장 이메일</CardDescription>
          </div>
          <Link
            to="/replied-emails"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            전체 보기 →
          </Link>
        </CardHeader>
        <CardContent>
          {repliedEmailsLoading ? (
            // Loading skeleton
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => i).map((skeletonId) => (
                <div key={`inbox-skeleton-${skeletonId}`} className="p-4 border rounded-lg">
                  <div className="flex items-start justify-between mb-2">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-3 w-full mb-2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : recentReplies.length > 0 ? (
            <div className="space-y-3">
              {recentReplies.map((reply) => {
                const createdDate = new Date(reply.createdAt)
                const now = new Date()
                const diffMs = now.getTime() - createdDate.getTime()
                const diffMins = Math.floor(diffMs / 60000)
                const diffHours = Math.floor(diffMins / 60)
                const diffDays = Math.floor(diffHours / 24)

                let timeAgo = ""
                if (diffDays > 0) {
                  timeAgo = `${diffDays}일 전`
                } else if (diffHours > 0) {
                  timeAgo = `${diffHours}시간 전`
                } else if (diffMins > 0) {
                  timeAgo = `${diffMins}분 전`
                } else {
                  timeAgo = "방금 전"
                }

                return (
                  <Link
                    key={reply.id}
                    to={`/replied-emails/${reply.id}`}
                    className="block p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{reply.fromEmail}</span>
                        {reply.leadName && (
                          <Badge variant="secondary" className="text-xs">
                            {reply.leadName}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="text-sm font-medium mb-1 truncate">
                      {reply.subject || "(제목 없음)"}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {reply.bodyText?.slice(0, 150) || "(내용 없음)"}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>받은 답장이 없습니다</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 투두리스트 섹션 */}
      <div className="mt-6">
        <TodoList
          todos={filteredTodos}
          workspaceId={selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id}
          onAddTodo={handleAddTodo}
          onUpdateTodo={handleUpdateTodo}
          onDeleteTodo={handleDeleteTodo}
        />
      </div>
    </div>
  )
}
