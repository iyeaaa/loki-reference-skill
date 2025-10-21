import {
  BarChart3,
  Clock,
  Heart,
  Mail,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react"
import { useEffect, useState } from "react"
import { TodoList } from "@/components/TodoList"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useAvgOpenRateStats,
  useBuyerResponseRate,
  useRecentSequences,
  useScheduledFollowups,
  useTodaySentStats,
} from "@/lib/api/hooks/emails"
import { useLeads } from "@/lib/api/hooks/leads"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import type { CreateTodoRequest, Todo, UpdateTodoRequest } from "@/lib/types/todo"

export default function DashboardPage() {
  const { selectedWorkspace } = useWorkspace()

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

  const totalCustomers = leadsData?.total || 0
  const todaySentCount = todaySentData?.todaySentCount || 0
  const avgOpenRate = avgOpenRateData?.avgOpenRate || 0
  const buyerResponseRate = buyerResponseRateData?.responseRate || 0
  const recentSequences = recentSequencesData?.sequences || []
  const scheduledFollowups = scheduledFollowupsData?.followups || []
  const totalScheduled = scheduledFollowupsData?.totalScheduled || 0

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
                Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
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
            <CardDescription>바이어 자동 팔로우업 발송 현황</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {scheduledFollowupsLoading ? (
                // Loading skeleton
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-8" />
                      </div>
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-12" />
                    </div>
                  </div>
                </div>
              ) : scheduledFollowups.length > 0 ? (
                <div className="space-y-3">
                  {scheduledFollowups.map((followup, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {followup.delayDays}일 후 팔로우업
                        </span>
                        <span className="text-sm font-bold">{followup.totalCount}건</span>
                      </div>
                      <div className="text-xs text-blue-600 mb-1">
                        예정일: {followup.scheduledDate}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {followup.sequences.slice(0, 2).map((seq, seqIndex) => (
                          <span key={seqIndex}>
                            {seq.sequenceName}: {seq.subject}
                            {seqIndex < Math.min(followup.sequences.length, 2) - 1 && ", "}
                          </span>
                        ))}
                        {followup.sequences.length > 2 && ` 외 ${followup.sequences.length - 2}개`}
                      </div>
                    </div>
                  ))}
                  <div className="pt-3 mt-3 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">전체 예정</span>
                      <span className="text-sm font-bold">총 {totalScheduled}건</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>예약된 팔로우업이 없습니다.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
