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

type JobLogsTableWithPaginationProps = {
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
    limit,
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
      const page = Number.parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = Number.parseInt(pageInputValue, 10)
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
    if (ms === null) {
      return "-"
    }
    if (ms < 1000) {
      return `${ms}ms`
    }
    if (ms < 60_000) {
      return `${(ms / 1000).toFixed(1)}s`
    }
    return `${(ms / 60_000).toFixed(1)}m`
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
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  Job ID
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  Queue
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  Job 이름
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  상태
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  우선순위
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  시도
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  소요시간
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  에러
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  추가일시
                </th>
                <th className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-muted-foreground" colSpan={10}>
                    {isFetching ? "로딩 중..." : "Job 로그가 없습니다"}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const statusConfig = STATUS_CONFIG[log.status]
                  return (
                    <tr
                      className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                      key={log.id}
                    >
                      <td
                        className="p-2 font-mono text-gray-900 text-sm dark:text-gray-100"
                        style={{
                          maxWidth: "120px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={log.jobId}
                      >
                        {log.jobId}
                      </td>
                      <td className="p-2 text-gray-600 text-sm dark:text-gray-400">
                        <Badge className="font-mono text-xs" variant="outline">
                          {log.queueName}
                        </Badge>
                      </td>
                      <td
                        className="p-2 text-gray-900 text-sm dark:text-gray-100"
                        style={{
                          maxWidth: "150px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={log.jobName || "-"}
                      >
                        {log.jobName || "-"}
                      </td>
                      <td className="whitespace-nowrap p-2 text-sm">
                        <Badge className="gap-1 text-xs" variant={statusConfig.variant}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </td>
                      <td className="p-2 text-gray-600 text-sm dark:text-gray-400">
                        {log.priority !== null && log.priority !== 0 ? (
                          <span className="flex items-center gap-1">
                            <ArrowUp className="h-3 w-3 text-orange-500" />
                            {log.priority}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-2 text-gray-600 text-sm dark:text-gray-400">
                        {log.attemptsMade}/{log.maxAttempts}
                      </td>
                      <td className="p-2 text-gray-600 text-sm dark:text-gray-400">
                        {formatDuration(log.durationMs)}
                      </td>
                      <td className="p-2 text-sm">
                        {log.errorCode ? (
                          <Badge className="text-xs" variant="destructive">
                            {log.errorCode}
                          </Badge>
                        ) : log.errorMessage ? (
                          <span
                            className="text-red-600 dark:text-red-400"
                            style={{
                              maxWidth: "150px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              display: "inline-block",
                            }}
                            title={log.errorMessage}
                          >
                            <AlertCircle className="mr-1 inline h-3 w-3" />
                            오류
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                        {formatRelativeTime(log.addedAt)}
                      </td>
                      <td className="whitespace-nowrap p-2 text-sm">
                        <Button
                          className="h-8 px-2 text-xs"
                          onClick={() => setSelectedLog(log)}
                          size="sm"
                          variant="ghost"
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
          <div className="text-muted-foreground text-sm">
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
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(1)}
            size="sm"
            variant="outline"
          >
            처음
          </Button>

          {/* Previous Page */}
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              className="min-w-[40px] px-3"
              disabled={isFetching}
              key={page}
              onClick={() => handlePageChange(page)}
              size="sm"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            size="sm"
            variant="outline"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(totalPages)}
            size="sm"
            variant="outline"
          >
            마지막
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">페이지:</span>
          <Input
            className="h-8 w-20 text-center text-sm"
            disabled={isFetching}
            max={totalPages || 1}
            min="1"
            onBlur={handlePageInputBlur}
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            type="number"
            value={pageInputValue}
          />
          <span className="text-muted-foreground text-sm">/ {totalPages || 1}</span>
        </div>
      </div>

      {/* Detail Modal */}
      <Dialog onOpenChange={() => setSelectedLog(null)} open={!!selectedLog}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Job 상세 정보
              {selectedLog && (
                <Badge className="text-xs" variant={STATUS_CONFIG[selectedLog.status].variant}>
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
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
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
                  <pre className="max-h-40 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
                    {JSON.stringify(selectedLog.inputData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Output Data */}
              {selectedLog.outputData && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">출력 데이터</h4>
                  <pre className="max-h-40 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
                    {JSON.stringify(selectedLog.outputData, null, 2)}
                  </pre>
                </div>
              )}

              {/* Error Info */}
              {(selectedLog.errorMessage || selectedLog.stackTrace) && (
                <div className="space-y-2">
                  <h4 className="font-medium text-red-600 text-sm">에러 정보</h4>
                  {selectedLog.errorCode && (
                    <Badge variant="destructive">{selectedLog.errorCode}</Badge>
                  )}
                  {selectedLog.errorMessage && (
                    <p className="text-red-600 text-sm dark:text-red-400">
                      {selectedLog.errorMessage}
                    </p>
                  )}
                  {selectedLog.stackTrace && (
                    <pre className="max-h-60 overflow-x-auto rounded-lg bg-red-50 p-3 text-red-700 text-xs dark:bg-red-900/20 dark:text-red-300">
                      {selectedLog.stackTrace}
                    </pre>
                  )}
                </div>
              )}

              {/* Job Options */}
              {selectedLog.jobOptions && (
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Job 옵션</h4>
                  <pre className="max-h-32 overflow-x-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-800">
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
