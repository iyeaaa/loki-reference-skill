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
      <div className="space-y-6 h-full overflow-y-auto">
        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Redis Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
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
              <CardTitle className="text-sm font-medium flex items-center gap-2">
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
                    <span className="text-sm text-muted-foreground">
                      (x{currentWorkerStatus.concurrency})
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  {currentWorkerStatus.running ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => stopWorkerMutation.mutate()}
                      disabled={stopWorkerMutation.isPending}
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => startWorkerMutation.mutate()}
                      disabled={startWorkerMutation.isPending}
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
              <CardTitle className="text-sm font-medium">테스트 큐 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span>{testQueueCounts.waiting}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>대기중</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <Loader2 className="h-4 w-4 text-blue-500" />
                      <span>{testQueueCounts.active}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>처리중</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>{testQueueCounts.completed}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>완료</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{testQueueCounts.failed}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>실패</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 cursor-help">
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
            selectedStatuses={selectedStatuses}
            onStatusChange={setSelectedStatuses}
            onClearFilters={handleClearFilters}
          />
        )}

        <Tabs defaultValue="jobs" className="space-y-4">
          <TabsList>
            <TabsTrigger value="jobs">작업 목록</TabsTrigger>
            <TabsTrigger value="queue-control">큐 제어</TabsTrigger>
            <TabsTrigger value="all-queues">전체 큐</TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">작업 관리</CardTitle>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setIsHelpModalOpen(true)}
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
                              htmlFor={sseId}
                              className="text-sm text-muted-foreground cursor-pointer"
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
                        id={sseId}
                        checked={useSSE}
                        onCheckedChange={(checked) => {
                          setUseSSE(checked)
                          if (!checked) setAutoRefresh(false)
                        }}
                      />
                    </div>
                    {/* Polling Toggle (only when SSE is off) */}
                    {!useSSE && (
                      <div className="flex items-center gap-2">
                        <Label htmlFor={autoRefreshId} className="text-sm text-muted-foreground">
                          폴링
                        </Label>
                        <Switch
                          id={autoRefreshId}
                          checked={autoRefresh}
                          onCheckedChange={setAutoRefresh}
                        />
                      </div>
                    )}
                    <Button onClick={handleRefreshAll} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Actions */}
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
                  <div className="flex gap-2 items-center flex-1">
                    <div className="relative w-full md:w-[400px]">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ID, 이름, 데이터로 검색..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="pl-10 pr-10 w-full"
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchInput("")
                            setSearchQuery("")
                          }}
                          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <Button
                      variant={showFilters ? "secondary" : "outline"}
                      onClick={() => setShowFilters(!showFilters)}
                      className="flex items-center gap-2"
                    >
                      <Filter className="h-4 w-4" />
                      필터
                      {showFilters ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {hasActiveFilters && (
                        <Badge variant="secondary" className="ml-1">
                          {selectedStatuses.length}
                        </Badge>
                      )}
                    </Button>
                  </div>
                  <Button onClick={() => setIsAddJobModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    작업 추가
                  </Button>
                </div>

                {/* Jobs Table */}
                <JobsTableWithPagination
                  searchQuery={searchQuery}
                  selectedStatuses={selectedStatuses}
                  selectedJobs={selectedJobs}
                  onToggleJob={handleToggleJob}
                  onToggleAll={handleToggleAllJobs}
                  autoRefresh={autoRefresh}
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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => pauseQueueMutation.mutate()}
                    disabled={queuesData["test-queue"]?.paused || pauseQueueMutation.isPending}
                  >
                    <Pause className="h-4 w-4 mr-2" />큐 일시정지
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => resumeQueueMutation.mutate()}
                    disabled={!queuesData["test-queue"]?.paused || resumeQueueMutation.isPending}
                  >
                    <Play className="h-4 w-4 mr-2" />큐 재개
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => cleanQueueMutation.mutate({})}
                    disabled={cleanQueueMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    완료/실패 정리
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => drainQueueMutation.mutate()}
                    disabled={drainQueueMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />큐 비우기
                  </Button>
                </div>

                <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <h4 className="font-medium mb-2">큐 상태</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
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
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
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
        <AddJobModal open={isAddJobModalOpen} onOpenChange={setIsAddJobModalOpen} />

        {/* Help Modal */}
        <Dialog open={isHelpModalOpen} onOpenChange={setIsHelpModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>BullMQ 테스트 안내</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm text-muted-foreground">
              <p>Redis 기반 BullMQ 큐 기능을 테스트합니다:</p>
              <ul className="list-disc list-inside space-y-2 ml-2">
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
              <div className="pt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
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
