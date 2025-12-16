import {
  AlertCircle,
  ArrowUp,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Pause,
  Timer,
  XCircle,
} from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useJobLogs } from "@/lib/api/hooks/job-logs"
import type { JobLog, JobLogStatus, JobLogsSearchParams } from "@/lib/api/types/job-log"
import { formatRelativeTime } from "@/lib/date-utils"

interface JobLogsTableWithPaginationProps {
  searchQuery: string
  selectedStatuses: JobLogStatus[]
  selectedQueues: string[]
  dateRange: { start?: string; end?: string }
}

const STATUS_CONFIG: Record<
  JobLogStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: React.ReactNode
  }
> = {
  waiting: {
    label: "대기중",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  active: {
    label: "처리중",
    variant: "default",
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  completed: {
    label: "완료",
    variant: "outline",
    icon: <CheckCircle2 className="h-3 w-3 text-green-600" />,
  },
  failed: {
    label: "실패",
    variant: "destructive",
    icon: <XCircle className="h-3 w-3" />,
  },
  delayed: {
    label: "지연",
    variant: "secondary",
    icon: <Timer className="h-3 w-3 text-orange-500" />,
  },
  stalled: {
    label: "정지",
    variant: "secondary",
    icon: <Pause className="h-3 w-3 text-gray-500" />,
  },
}

export function JobLogsTableWithPagination({
  searchQuery,
  selectedStatuses,
  selectedQueues,
  dateRange,
}: JobLogsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [selectedLog, setSelectedLog] = useState<JobLog | null>(null)
  const limit = 20

  // Build params for API call
  const params: JobLogsSearchParams = {
    page: currentPage,
    limit: limit,
    search: searchQuery || undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    queueName: selectedQueues.length === 1 ? selectedQueues[0] : undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
  }

  // Use React Query hook for fetching job logs
  const { data: logsData, isFetching } = useJobLogs(params)
  const logs = logsData?.logs || []
  const totalPages = logsData?.totalPages || 1
  const total = logsData?.total || 0

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageInputValue(page.toString())
  }

  const handlePageInputChange = (value: string) => {
    setPageInputValue(value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = parseInt(pageInputValue, 10)
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    } else {
      setPageInputValue(currentPage.toString())
    }
  }

  const getPageNumbers = () => {
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "-"
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    return `${(ms / 60000).toFixed(1)}m`
  }

  return (
    <>
      {/* Table */}
      <div className="rounded-md border">
        <div
          className="overflow-x-auto overflow-y-visible"
          style={{
            scrollbarGutter: "stable",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table className="w-full" style={{ tableLayout: "auto" }}>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Job ID
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Queue
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Job 이름
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  우선순위
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  시도
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  소요시간
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  에러
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  추가일시
                </th>
                <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-muted-foreground">
                    {isFetching ? "로딩 중..." : "Job 로그가 없습니다"}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const statusConfig = STATUS_CONFIG[log.status]
                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td
                        className="p-2 text-sm font-mono text-gray-900 dark:text-gray-100"
                        title={log.jobId}
                        style={{
                          maxWidth: "120px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.jobId}
                      </td>
                      <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                        <Badge variant="outline" className="text-xs font-mono">
                          {log.queueName}
                        </Badge>
                      </td>
                      <td
                        className="p-2 text-sm text-gray-900 dark:text-gray-100"
                        title={log.jobName || "-"}
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {log.jobName || "-"}
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <Badge variant={statusConfig.variant} className="text-xs gap-1">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                        {log.priority !== null && log.priority !== 0 ? (
                          <span className="flex items-center gap-1">
                            <ArrowUp className="h-3 w-3 text-orange-500" />
                            {log.priority}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                        {log.attemptsMade}/{log.maxAttempts}
                      </td>
                      <td className="p-2 text-sm text-gray-600 dark:text-gray-400">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="p-2 text-sm">
                        {log.errorCode ? (
                          <Badge variant="destructive" className="text-xs">
                            {log.errorCode}
                          </Badge>
                        ) : log.errorMessage ? (
                          <span
                            className="text-red-600 dark:text-red-400"
                            title={log.errorMessage}
                            style={{
                              maxWidth: "150px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                            }}
                          >
                            <AlertCircle className="h-3 w-3 inline mr-1" />
                            오류
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(log.addedAt)}
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                          className="text-xs h-8 px-2"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-6 space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
            {total > 0 ? (
              <>
                {(currentPage - 1) * limit + 1}-{Math.min(currentPage * limit, total)} /{" "}
                {total.toLocaleString()}개 표시
              </>
            ) : (
              "0개 표시"
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-1">
          {/* First Page */}
          <Button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            처음
          </Button>

          {/* Previous Page */}
          <Button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              key={page}
              onClick={() => handlePageChange(page)}
              disabled={isFetching}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="px-3 min-w-[40px]"
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            마지막
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">페이지:</span>
          <Input
            type="number"
            min="1"
            max={totalPages || 1}
            value={pageInputValue}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            onBlur={handlePageInputBlur}
            className="w-20 h-8 text-sm text-center"
            disabled={isFetching}
          />
          <span className="text-sm text-muted-foreground">/ {totalPages || 1}</span>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Job 상세 정보
              {selectedLog && (
                <Badge variant={STATUS_CONFIG[selectedLog.status].variant} className="text-xs">
                  {STATUS_CONFIG[selectedLog.status].icon}
                  {STATUS_CONFIG[selectedLog.status].label}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription>Job ID: {selectedLog?.jobId}</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Queue:</span>
                  <span className="ml-2 font-mono">{selectedLog.queueName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Job 이름:</span>
                  <span className="ml-2">{selectedLog.jobName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">시도 횟수:</span>
                  <span className="ml-2">
                    {selectedLog.attemptsMade}/{selectedLog.maxAttempts}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">소요 시간:</span>
                  <span className="ml-2">{formatDuration(selectedLog.durationMs)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">우선순위:</span>
                  <span className="ml-2">
                    {selectedLog.priority !== null && selectedLog.priority !== 0 ? (
                      <span className="inline-flex items-center gap-1 text-orange-600">
                        <ArrowUp className="h-3 w-3" />
                        {selectedLog.priority}
                      </span>
                    ) : (
                      "-"
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Worker:</span>
                  <span className="ml-2 font-mono text-xs">{selectedLog.workerName || "-"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">처리 서버:</span>
                  <span className="ml-2 font-mono text-xs">{selectedLog.processedBy || "-"}</span>
                </div>
                {selectedLog.delayedUntil && (
                  <div>
                    <span className="text-muted-foreground">지연 예정:</span>
                    <span className="ml-2 text-orange-600">
                      {new Date(selectedLog.delayedUntil).toLocaleString("ko-KR")}
                    </span>
                  </div>
                )}
              </div>

              {/* Timestamps */}
              <div className="space-y-2">
                <h4 className="font-medium text-sm">타임스탬프</h4>
                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  <div>
                    <span className="text-muted-foreground">추가:</span>
                    <span className="ml-2">
                      {new Date(selectedLog.addedAt).toLocaleString("ko-KR")}
                    </span>
                  </div>
                  {selectedLog.processedAt && (
                    <div>
                      <span className="text-muted-foreground">처리 시작:</span>
                      <span className="ml-2">
                        {new Date(selectedLog.processedAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  )}
                  {selectedLog.completedAt && (
                    <div>
                      <span className="text-muted-foreground">완료:</span>
                      <span className="ml-2">
                        {new Date(selectedLog.completedAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  )}
                  {selectedLog.failedAt && (
                    <div>
                      <span className="text-muted-foreground">실패:</span>
                      <span className="ml-2 text-red-600">
                        {new Date(selectedLog.failedAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Input Data */}
              {selectedLog.inputData && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">입력 데이터</h4>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.inputData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output Data */}
              {selectedLog.outputData && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">출력 데이터</h4>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs overflow-x-auto max-h-40">
                    {JSON.stringify(selectedLog.outputData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Info */}
              {(selectedLog.errorMessage || selectedLog.stackTrace) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm text-red-600">에러 정보</h4>
                  {selectedLog.errorCode && (
                    <Badge variant="destructive">{selectedLog.errorCode}</Badge>
                  )}
                  {selectedLog.errorMessage && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {selectedLog.errorMessage}
                    </p>
                  )}
                  {selectedLog.stackTrace && (
                    <pre className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg text-xs overflow-x-auto max-h-60 text-red-700 dark:text-red-300">
                      {selectedLog.stackTrace}
                    </pre>
                  )}
                </div>
              )}

              {/* Job Options */}
              {selectedLog.jobOptions && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Job 옵션</h4>
                  <pre className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-xs overflow-x-auto max-h-32">
                    {JSON.stringify(selectedLog.jobOptions, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
