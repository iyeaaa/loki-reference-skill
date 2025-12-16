import { motion } from "framer-motion"
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
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { TodoList } from "@/components/TodoList"
import { Badge } from "@/components/ui/badge"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  shouldReduceMotion,
  staggerContainerFastVariants,
  staggerItemVariants,
} from "@/lib/animations"
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
        className={cn(
          "relative flex aspect-square h-full w-full select-none flex-col items-center justify-center p-0 text-center",
          "rounded-md transition-colors hover:bg-accent",
          modifiers.selected && "bg-primary text-primary-foreground",
          modifiers.today && "bg-accent",
          modifiers.outside && "text-muted-foreground opacity-50",
        )}
        type="button"
      >
        <span className="text-sm">{day.date.getDate()}</span>
        {<span className="font-bold text-[10px]">{followup?.totalCount ?? 0}</span>}
      </button>
    )
  }
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const reducedMotion = shouldReduceMotion()

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
      <motion.div
        animate="visible"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        initial="hidden"
        variants={reducedMotion ? undefined : staggerContainerFastVariants}
      >
        <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
          <Card animated hoverable>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {selectedWorkspace?.id === "all"
                  ? t("dashboard.stats.customers.all")
                  : t("dashboard.stats.customers.workspace")}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {leadsLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <AnimatedNumber value={totalCustomers} />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {selectedWorkspace?.name || t("dashboard.stats.defaultWorkspace")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
          <Card animated hoverable>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {t("dashboard.stats.todaySent")}
              </CardTitle>
              <Mail className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {todaySentLoading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <AnimatedNumber value={todaySentCount} />
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("dashboard.stats.description.overseasContact")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
          <Card animated hoverable>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {t("dashboard.stats.avgOpenRate")}
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {avgOpenRateLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <AnimatedNumber decimals={1} value={avgOpenRate} />%
                  </>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("dashboard.stats.description.overseasOpen")}
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={reducedMotion ? undefined : staggerItemVariants}>
          <Card animated hoverable>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="font-medium text-sm">
                {t("dashboard.stats.buyerResponseRate")}
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">
                {buyerResponseRateLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <AnimatedNumber decimals={1} value={buyerResponseRate} />%
                  </>
                )}
              </div>
              <p className="text-muted-foreground text-xs">
                {t("dashboard.stats.description.meetingRequest")}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.sequences.recent.title")}</CardTitle>
            <CardDescription>{t("dashboard.sequences.recent.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSequencesLoading ? (
                // Loading skeleton
                Array.from({ length: 4 }, (_, i) => i).map((skeletonId) => (
                  <div
                    className="flex items-center justify-between rounded-lg border p-4"
                    key={`skeleton-${skeletonId}`}
                  >
                    <div className="flex items-center space-x-3">
                      <Skeleton className="h-8 w-8 rounded" />
                      <div>
                        <Skeleton className="mb-2 h-4 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <div className="text-right">
                      <Skeleton className="mb-1 h-4 w-16" />
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
                      className="flex items-center justify-between rounded-lg border p-3"
                      key={sequence.id}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{sequence.name}</h4>
                          <p className="text-muted-foreground text-xs">
                            {sequence.status === "active"
                              ? t("dashboard.sequences.status.active")
                              : sequence.status === "paused"
                                ? t("dashboard.sequences.status.paused")
                                : sequence.status === "draft"
                                  ? t("dashboard.sequences.status.draft")
                                  : t("dashboard.sequences.status.archived")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-sm">
                          {sequence.sent} {t("dashboard.sequences.sent")}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {sequence.opened} {t("dashboard.sequences.opened")} • {sequence.clicked}{" "}
                          {t("dashboard.sequences.clicked")}
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="py-8 text-center text-muted-foreground">
                  <p>{t("dashboard.sequences.noRecent")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.followup.title")}</CardTitle>
            <CardDescription>
              {t("dashboard.followup.description", { total: totalScheduled })}
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
              <div className="max-w-[400px] space-y-4">
                <Calendar
                  className="w-full rounded-md border [--cell-size:1rem]"
                  components={{
                    DayButton: DayButtonComponent,
                  }}
                  mode="single"
                  modifiers={{
                    scheduled: Array.from(followupsByDate.keys()).map(
                      (dateStr) => new Date(dateStr),
                    ),
                  }}
                  modifiersClassNames={{
                    scheduled: "bg-primary/10 font-bold",
                  }}
                  onSelect={setSelectedDate}
                  selected={selectedDate}
                />

                {selectedDateInfo ? (
                  <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">
                        {selectedDate?.toLocaleDateString("ko-KR", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </h4>
                      <span className="font-bold text-primary text-sm">
                        {selectedDateInfo.totalCount} {t("dashboard.unit.count")}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {t("dashboard.followup.delayDays", {
                        days: selectedDateInfo.delayDays,
                      })}
                    </div>
                    <div className="space-y-2">
                      {selectedDateInfo.sequences.map((seq) => (
                        <div
                          className="rounded border bg-background p-2"
                          key={`${seq.sequenceName}-${seq.subject}`}
                        >
                          <div className="mb-1 flex items-center justify-between">
                            <span className="font-medium text-xs">{seq.sequenceName}</span>
                            <span className="text-muted-foreground text-xs">
                              {seq.count} {t("dashboard.unit.count")}
                            </span>
                          </div>
                          <div className="text-muted-foreground text-xs">{seq.subject}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : scheduledFollowups.length === 0 ? (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    {t("dashboard.followup.noScheduled")}
                  </div>
                ) : (
                  <div className="py-4 text-center text-muted-foreground text-sm">
                    {t("dashboard.followup.selectDate")}
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
              {t("dashboard.inbox.title")}
            </CardTitle>
            <CardDescription>{t("dashboard.inbox.description")}</CardDescription>
          </div>
          <Link
            className="flex items-center gap-1 text-primary text-sm hover:underline"
            to="/replied-emails"
          >
            {t("dashboard.inbox.viewAll")} →
          </Link>
        </CardHeader>
        <CardContent>
          {repliedEmailsLoading ? (
            // Loading skeleton
            <div className="space-y-3">
              {Array.from({ length: 3 }, (_, i) => i).map((skeletonId) => (
                <div className="rounded-lg border p-4" key={`inbox-skeleton-${skeletonId}`}>
                  <div className="mb-2 flex items-start justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="mb-2 h-3 w-full" />
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
                const diffMins = Math.floor(diffMs / 60_000)
                const diffHours = Math.floor(diffMins / 60)
                const diffDays = Math.floor(diffHours / 24)

                let timeAgo = ""
                if (diffDays > 0) {
                  timeAgo = t("dashboard.time.ago.daysAgo", { days: diffDays })
                } else if (diffHours > 0) {
                  timeAgo = t("dashboard.time.ago.hoursAgo", {
                    hours: diffHours,
                  })
                } else if (diffMins > 0) {
                  timeAgo = t("dashboard.time.ago.minutesAgo", {
                    minutes: diffMins,
                  })
                } else {
                  timeAgo = t("dashboard.time.ago.justNow")
                }

                return (
                  <Link
                    className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
                    key={reply.id}
                    to={`/replied-emails/${reply.id}`}
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="truncate font-medium text-sm">{reply.fromEmail}</span>
                        {reply.leadName && (
                          <Badge className="text-xs" variant="secondary">
                            {reply.leadName}
                          </Badge>
                        )}
                      </div>
                      <span className="ml-2 whitespace-nowrap text-muted-foreground text-xs">
                        {timeAgo}
                      </span>
                    </div>
                    <div className="mb-1 truncate font-medium text-sm">
                      {reply.subject || t("dashboard.inbox.noSubject")}
                    </div>
                    <div className="line-clamp-2 text-muted-foreground text-xs">
                      {reply.bodyText?.slice(0, 150) || t("dashboard.inbox.noContent")}
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <Inbox className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>{t("dashboard.inbox.noReplies")}</p>
            </div>
          )}
        </CardContent>
      </Card>
      {/* 투두리스트 섹션 */}
      <div className="mt-6">
        <TodoList
          onAddTodo={handleAddTodo}
          onDeleteTodo={handleDeleteTodo}
          onUpdateTodo={handleUpdateTodo}
          todos={filteredTodos}
          workspaceId={selectedWorkspace?.id === "all" ? undefined : selectedWorkspace?.id}
        />
      </div>
    </div>
  )
}
