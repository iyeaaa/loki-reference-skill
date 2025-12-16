import {
  Activity,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  useBullMQHealth,
  useBullMQQueues,
  useBullMQSSE,
  useBullMQTestQueue,
  useBullMQWorkerStatus,
  useCleanQueue,
  useDrainQueue,
  usePauseQueue,
  useResumeQueue,
  useStartWorker,
  useStopWorker,
} from "@/lib/api/hooks/bullmq-test"
import type { JobStatus } from "@/lib/api/types/bullmq-test"
import { AddJobModal } from "./bullmq-test/AddJobModal"
import { JobFilters } from "./bullmq-test/JobFilters"
import { JobsTableWithPagination } from "./bullmq-test/JobsTableWithPagination"

export function BullMQTestPage() {
  const autoRefreshId = useId()
  const sseId = useId()

  // State
  const [useSSE, setUseSSE] = useState(true) // SSE enabled by default
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<JobStatus[]>([])
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [isAddJobModalOpen, setIsAddJobModalOpen] = useState(false)
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false)

  // SSE Hook for real-time updates
  const { isConnected: sseConnected } = useBullMQSSE({
    enabled: useSSE,
  })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  // Queries
  const { data: health, refetch: refetchHealth } = useBullMQHealth({
    refetchInterval: autoRefresh ? 2000 : false,
  })
  const { data: queues, refetch: refetchQueues } = useBullMQQueues({
    refetchInterval: autoRefresh ? 2000 : false,
  })
  const { data: testQueueData, refetch: refetchTestQueue } = useBullMQTestQueue(
    { status: "all" },
    { refetchInterval: autoRefresh ? 2000 : false },
  )
  const { data: workerStatus, refetch: refetchWorkerStatus } = useBullMQWorkerStatus({
    refetchInterval: autoRefresh ? 2000 : false,
  })

  // Mutations
  const pauseQueueMutation = usePauseQueue()
  const resumeQueueMutation = useResumeQueue()
  const cleanQueueMutation = useCleanQueue()
  const drainQueueMutation = useDrainQueue()
  const startWorkerMutation = useStartWorker()
  const stopWorkerMutation = useStopWorker()

  const redisStatus = health?.redis ?? "unknown"
  const testQueueCounts = testQueueData?.counts ?? {
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }
  const currentWorkerStatus = workerStatus ?? { running: false, concurrency: 0 }
  const queuesData = queues ?? {}

  const handleRefreshAll = () => {
    refetchHealth()
    refetchQueues()
    refetchTestQueue()
    refetchWorkerStatus()
  }

  const handleToggleJob = (jobId: string) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
    )
  }

  const handleToggleAllJobs = (jobIds: string[]) => {
    setSelectedJobs((prev) => (prev.length === jobIds.length ? [] : jobIds))
  }

  const handleClearFilters = () => {
    setSelectedStatuses([])
    setSearchInput("")
    setSearchQuery("")
  }

  const hasActiveFilters = selectedStatuses.length > 0

  return (
    <TooltipProvider>
      <div className="h-full space-y-6 overflow-y-auto">
        {/* Status Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Redis Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <Activity className="h-4 w-4" />
                Redis 연결
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div
                  className={`h-3 w-3 rounded-full ${
                    redisStatus === "connected"
                      ? "bg-green-500"
                      : redisStatus === "disconnected"
                        ? "bg-red-500"
                        : "bg-gray-400"
                  }`}
                />
                <span className="font-semibold">
                  {redisStatus === "connected"
                    ? "연결됨"
                    : redisStatus === "disconnected"
                      ? "연결 끊김"
                      : "알 수 없음"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Worker Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 font-medium text-sm">
                <Zap className="h-4 w-4" />
                워커 상태
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${currentWorkerStatus.running ? "bg-green-500" : "bg-gray-400"}`}
                  />
                  <span className="font-semibold">
                    {currentWorkerStatus.running ? "실행 중" : "정지됨"}
                  </span>
                  {currentWorkerStatus.running && (
                    <span className="text-muted-foreground text-sm">
                      (x{currentWorkerStatus.concurrency})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentWorkerStatus.running ? (
                    <Button
                      disabled={stopWorkerMutation.isPending}
                      onClick={() => stopWorkerMutation.mutate()}
                      size="sm"
                      variant="outline"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      disabled={startWorkerMutation.isPending}
                      onClick={() => startWorkerMutation.mutate()}
                      size="sm"
                      variant="default"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Test Queue Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-sm">테스트 큐 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-1">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{testQueueCounts.waiting}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>대기중</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-1">
                      <Loader2 className="h-4 w-4 text-blue-500" />
                      <span>{testQueueCounts.active}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>처리중</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{testQueueCounts.completed}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>완료</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-1">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{testQueueCounts.failed}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>실패</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-1">
                      <Clock className="h-4 w-4 text-yellow-500" />
                      <span>{testQueueCounts.delayed}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>지연</TooltipContent>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        {showFilters && (
          <JobFilters
            onClearFilters={handleClearFilters}
            onStatusChange={setSelectedStatuses}
            selectedStatuses={selectedStatuses}
          />
        )}

        <Tabs className="space-y-4" defaultValue="jobs">
          <TabsList>
            <TabsTrigger value="jobs">작업 목록</TabsTrigger>
            <TabsTrigger value="queue-control">큐 제어</TabsTrigger>
            <TabsTrigger value="all-queues">전체 큐</TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent className="space-y-4" value="jobs">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">작업 관리</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          className="h-6 w-6 p-0"
                          onClick={() => setIsHelpModalOpen(true)}
                          size="sm"
                          variant="ghost"
                        >
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>사용 안내</TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* SSE Toggle */}
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2">
                            <Radio
                              className={`h-3 w-3 ${sseConnected ? "text-green-500" : "text-gray-400"}`}
                            />
                            <Label
                              className="cursor-pointer text-muted-foreground text-sm"
                              htmlFor={sseId}
                            >
                              실시간
                            </Label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {sseConnected ? "SSE 연결됨 - 실시간 업데이트 중" : "SSE 연결 끊김"}
                        </TooltipContent>
                      </Tooltip>
                      <Switch
                        checked={useSSE}
                        id={sseId}
                        onCheckedChange={(checked) => {
                          setUseSSE(checked)
                          if (!checked) {
                            setAutoRefresh(false)
                          }
                        }}
                      />
                    </div>
                    {/* Polling Toggle (only when SSE is off) */}
                    {!useSSE && (
                      <div className="flex items-center gap-2">
                        <Label className="text-muted-foreground text-sm" htmlFor={autoRefreshId}>
                          폴링
                        </Label>
                        <Switch
                          checked={autoRefresh}
                          id={autoRefreshId}
                          onCheckedChange={setAutoRefresh}
                        />
                      </div>
                    )}
                    <Button onClick={handleRefreshAll} size="sm" variant="outline">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Actions */}
                <div className="mb-4 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="flex flex-1 items-center gap-2">
                    <div className="relative w-full md:w-[400px]">
                      <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="w-full pr-10 pl-10"
                        onChange={(e) => setSearchInput(e.target.value)}
                        placeholder="ID, 이름, 데이터로 검색..."
                        value={searchInput}
                      />
                      {searchInput && (
                        <button
                          className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
                          onClick={() => {
                            setSearchInput("")
                            setSearchQuery("")
                          }}
                          type="button"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      className="flex items-center gap-2"
                      onClick={() => setShowFilters(!showFilters)}
                      variant={showFilters ? "secondary" : "outline"}
                    >
                      <Filter className="h-4 w-4" />
                      필터
                      {showFilters ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {hasActiveFilters && (
                        <Badge className="ml-1" variant="secondary">
                          {selectedStatuses.length}
                        </Badge>
                      )}
                    </Button>
                  </div>
                  <Button onClick={() => setIsAddJobModalOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    작업 추가
                  </Button>
                </div>

                {/* Jobs Table */}
                <JobsTableWithPagination
                  autoRefresh={autoRefresh}
                  onToggleAll={handleToggleAllJobs}
                  onToggleJob={handleToggleJob}
                  searchQuery={searchQuery}
                  selectedJobs={selectedJobs}
                  selectedStatuses={selectedStatuses}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Queue Control Tab */}
          <TabsContent value="queue-control">
            <Card>
              <CardHeader>
                <CardTitle>큐 제어</CardTitle>
                <CardDescription>테스트 큐 상태 관리</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <Button
                    disabled={queuesData["test-queue"]?.paused || pauseQueueMutation.isPending}
                    onClick={() => pauseQueueMutation.mutate()}
                    variant="outline"
                  >
                    <Pause className="mr-2 h-4 w-4" />큐 일시정지
                  </Button>

                  <Button
                    disabled={!queuesData["test-queue"]?.paused || resumeQueueMutation.isPending}
                    onClick={() => resumeQueueMutation.mutate()}
                    variant="outline"
                  >
                    <Play className="mr-2 h-4 w-4" />큐 재개
                  </Button>

                  <Button
                    disabled={cleanQueueMutation.isPending}
                    onClick={() => cleanQueueMutation.mutate({})}
                    variant="outline"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    완료/실패 정리
                  </Button>

                  <Button
                    disabled={drainQueueMutation.isPending}
                    onClick={() => drainQueueMutation.mutate()}
                    variant="destructive"
                  >
                    <XCircle className="mr-2 h-4 w-4" />큐 비우기
                  </Button>
                </div>

                <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                  <h4 className="mb-2 font-medium">큐 상태</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
                    <div>
                      <span className="text-muted-foreground">일시정지:</span>{" "}
                      <span className="font-medium">
                        {queuesData["test-queue"]?.paused ? "예" : "아니오"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">대기중:</span>{" "}
                      <span className="font-medium">{testQueueCounts.waiting}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">처리중:</span>{" "}
                      <span className="font-medium">{testQueueCounts.active}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">지연:</span>{" "}
                      <span className="font-medium">{testQueueCounts.delayed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">완료:</span>{" "}
                      <span className="font-medium">{testQueueCounts.completed}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">실패:</span>{" "}
                      <span className="font-medium">{testQueueCounts.failed}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* All Queues Tab */}
          <TabsContent value="all-queues">
            <Card>
              <CardHeader>
                <CardTitle>전체 큐 현황</CardTitle>
                <CardDescription>모든 BullMQ 큐의 상태</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>큐 이름</TableHead>
                      <TableHead>대기중</TableHead>
                      <TableHead>처리중</TableHead>
                      <TableHead>완료</TableHead>
                      <TableHead>실패</TableHead>
                      <TableHead>지연</TableHead>
                      <TableHead>상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(queuesData).length === 0 ? (
                      <TableRow>
                        <TableCell className="text-center text-muted-foreground" colSpan={7}>
                          큐가 없습니다
                        </TableCell>
                      </TableRow>
                    ) : (
                      Object.entries(queuesData).map(([name, status]) => (
                        <TableRow key={name}>
                          <TableCell className="font-medium">{name}</TableCell>
                          <TableCell>{status?.waiting ?? 0}</TableCell>
                          <TableCell>{status?.active ?? 0}</TableCell>
                          <TableCell>{status?.completed ?? 0}</TableCell>
                          <TableCell>{status?.failed ?? 0}</TableCell>
                          <TableCell>{status?.delayed ?? 0}</TableCell>
                          <TableCell>
                            <Badge variant={status?.paused ? "destructive" : "outline"}>
                              {status?.paused ? "일시정지" : "활성"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Job Modal */}
        <AddJobModal onOpenChange={setIsAddJobModalOpen} open={isAddJobModalOpen} />

        {/* Help Modal */}
        <Dialog onOpenChange={setIsHelpModalOpen} open={isHelpModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>BullMQ 테스트 안내</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-muted-foreground text-sm">
              <p>Redis 기반 BullMQ 큐 기능을 테스트합니다:</p>
              <ul className="ml-2 list-inside list-disc space-y-2">
                <li>
                  <strong className="text-foreground">작업 추가:</strong> 단일 또는 대량 작업을
                  다양한 옵션으로 추가
                </li>
                <li>
                  <strong className="text-foreground">워커 제어:</strong> 작업을 처리하는 워커
                  시작/정지
                </li>
                <li>
                  <strong className="text-foreground">큐 제어:</strong> 큐 일시정지, 재개, 정리,
                  비우기
                </li>
                <li>
                  <strong className="text-foreground">작업 관리:</strong> 개별 작업 조회, 재시도,
                  삭제
                </li>
                <li>
                  <strong className="text-foreground">자동 새로고침:</strong> 2초마다 실시간
                  업데이트
                </li>
              </ul>
              <div className="rounded-lg bg-blue-50 p-3 pt-2 dark:bg-blue-900/20">
                <p className="font-medium text-blue-700 dark:text-blue-300">
                  팁: 먼저 워커를 시작한 후 작업을 추가하면 처리 과정을 확인할 수 있습니다!
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
