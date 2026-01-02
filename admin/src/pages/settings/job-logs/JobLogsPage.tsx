import { Radio, RefreshCw, Search, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useBullMQSSE } from "@/lib/api/hooks/bullmq-test"
import { useJobLogQueues, useJobLogStats } from "@/lib/api/hooks/job-logs"
import type { JobLogStatus } from "@/lib/api/types/job-log"
import { JobLogsFilters } from "./JobLogsFilters"
import { JobLogsTableWithPagination } from "./JobLogsTableWithPagination"

export function JobLogsPage() {
  const sseId = useId()
  const [useSSE, setUseSSE] = useState(true) // SSE enabled by default
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<JobLogStatus[]>([])
  const [selectedQueues, setSelectedQueues] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({})

  // SSE Hook for real-time updates
  const { isConnected: sseConnected } = useBullMQSSE({
    enabled: useSSE,
  })

  // Queries
  const { data: queues } = useJobLogQueues()
  const { data: stats, refetch: refetchStats } = useJobLogStats({ hours: 24 })

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const clearFilters = () => {
    setSelectedStatuses([])
    setSelectedQueues([])
    setDateRange({})
    setSearchInput("")
    setSearchQuery("")
  }

  // 통계 계산
  const totalCounts =
    stats?.totalCounts?.reduce(
      (acc, item) => {
        acc[item.status] = item.count
        return acc
      },
      {} as Record<string, number>,
    ) || {}

  const totalJobs = Object.values(totalCounts).reduce((a, b) => a + b, 0)

  return (
    <TooltipProvider>
      <div className="h-full space-y-6 overflow-y-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-muted-foreground text-sm">전체</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl">{totalJobs.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-sm text-yellow-600">대기중</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-yellow-600">
                {(totalCounts.waiting || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-blue-600 text-sm">처리중</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-blue-600">
                {(totalCounts.active || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-green-600 text-sm">완료</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-green-600">
                {(totalCounts.completed || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-red-600 text-sm">실패</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-red-600">
                {(totalCounts.failed || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="font-medium text-orange-600 text-sm">지연/정지</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-bold text-2xl text-orange-600">
                {((totalCounts.delayed || 0) + (totalCounts.stalled || 0)).toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <JobLogsFilters
          dateRange={dateRange}
          onClearFilters={clearFilters}
          onDateRangeChange={setDateRange}
          onQueueChange={setSelectedQueues}
          onStatusChange={setSelectedStatuses}
          queues={queues || []}
          selectedQueues={selectedQueues}
          selectedStatuses={selectedStatuses}
        />

        {/* Job Logs Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">캠페인 작업 기록</CardTitle>
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
                  <Switch checked={useSSE} id={sseId} onCheckedChange={setUseSSE} />
                </div>
                <Button onClick={() => refetchStats()} size="sm" variant="outline">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  새로고침
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search input */}
            <div className="mb-4">
              <div className="relative w-full md:w-[400px]">
                <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="w-full pr-10 pl-10"
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Job ID, 이름, 에러 메시지로 검색..."
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
            </div>

            {/* Job Logs Table with Pagination */}
            <JobLogsTableWithPagination
              dateRange={dateRange}
              searchQuery={searchQuery}
              selectedQueues={selectedQueues}
              selectedStatuses={selectedStatuses}
            />
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
