import { RefreshCw, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useJobLogQueues, useJobLogStats } from "@/lib/api/hooks/job-logs"
import type { JobLogStatus } from "@/lib/api/types/job-log"
import { JobLogsFilters } from "./JobLogsFilters"
import { JobLogsTableWithPagination } from "./JobLogsTableWithPagination"

export function JobLogsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<JobLogStatus[]>([])
  const [selectedQueues, setSelectedQueues] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({})

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
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalJobs.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-600">대기중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {(totalCounts.waiting || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-600">처리중</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {(totalCounts.active || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">완료</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {(totalCounts.completed || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">실패</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {(totalCounts.failed || 0).toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">지연/정지</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {((totalCounts.delayed || 0) + (totalCounts.stalled || 0)).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <JobLogsFilters
        selectedStatuses={selectedStatuses}
        selectedQueues={selectedQueues}
        dateRange={dateRange}
        queues={queues || []}
        onStatusChange={setSelectedStatuses}
        onQueueChange={setSelectedQueues}
        onDateRangeChange={setDateRange}
        onClearFilters={clearFilters}
      />

      {/* Job Logs Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">BullMQ Job 로그</CardTitle>
            <Button onClick={() => refetchStats()} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              새로고침
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Job ID, 이름, 에러 메시지로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
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
          </div>

          {/* Job Logs Table with Pagination */}
          <JobLogsTableWithPagination
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            selectedQueues={selectedQueues}
            dateRange={dateRange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
