import { ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useBullMQTestQueue, useRemoveJob, useRetryJob } from "@/lib/api/hooks/bullmq-test"
import type { JobStatus, TestQueueParams } from "@/lib/api/types/bullmq-test"

interface JobsTableWithPaginationProps {
  searchQuery: string
  selectedStatuses: JobStatus[]
  selectedJobs: string[]
  onToggleJob: (jobId: string) => void
  onToggleAll: (jobIds: string[]) => void
  autoRefresh: boolean
}

// Truncated cell component with tooltip
function TruncatedCell({ content, maxLines = 3 }: { content: string; maxLines?: number }) {
  const style = {
    display: "-webkit-box",
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: "vertical" as const,
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word" as const,
    maxWidth: "300px",
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div style={style} className="cursor-help">
          {content}
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-md max-h-64 overflow-auto whitespace-pre-wrap break-words"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  )
}

export function JobsTableWithPagination({
  searchQuery,
  selectedStatuses,
  selectedJobs,
  onToggleJob,
  onToggleAll,
  autoRefresh,
}: JobsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  const retryJob = useRetryJob()
  const removeJob = useRemoveJob()

  // Build params for API call
  const params: TestQueueParams = {
    page: currentPage,
    limit: limit,
    status:
      selectedStatuses.length === 1
        ? selectedStatuses[0]
        : selectedStatuses.length === 0
          ? "all"
          : "all",
    search: searchQuery || undefined,
    sortBy: "timestamp",
    sortOrder: "desc",
  }

  // Use React Query hook for fetching jobs
  const { data: testQueueData, isFetching } = useBullMQTestQueue(params, {
    refetchInterval: autoRefresh ? 2000 : false,
  })

  const jobs = testQueueData?.jobs || []
  const totalPages = testQueueData?.pagination?.totalPages || 1
  const total = testQueueData?.pagination?.total || 0

  // Filter jobs by selected statuses if multiple statuses are selected
  const filteredJobs =
    selectedStatuses.length > 1 ? jobs.filter((job) => selectedStatuses.includes(job.status)) : jobs

  const getStatusBadge = (status: JobStatus) => {
    const statusConfig: Record<
      JobStatus,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      waiting: { label: "대기중", variant: "secondary" },
      active: { label: "처리중", variant: "default" },
      completed: { label: "완료", variant: "outline" },
      failed: { label: "실패", variant: "destructive" },
      delayed: { label: "지연", variant: "secondary" },
    }
    const config = statusConfig[status]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const formatTimestamp = (timestamp?: number | null) => {
    if (!timestamp) return "-"
    return new Date(timestamp).toLocaleString("ko-KR")
  }

  const formatData = (data: Record<string, unknown>) => {
    return JSON.stringify(data, null, 2)
  }

  const handleToggleAll = useCallback(() => {
    onToggleAll(filteredJobs.map((j) => j.id))
  }, [filteredJobs, onToggleAll])

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

  const handleRetry = (jobId: string) => {
    retryJob.mutate(jobId)
  }

  const handleRemove = (jobId: string) => {
    removeJob.mutate(jobId)
  }

  return (
    <>
      {/* Jobs Table */}
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
                <th
                  className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={filteredJobs.length > 0 && selectedJobs.length === filteredJobs.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "80px" }}
                >
                  ID
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  이름
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  데이터
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  결과/에러
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  시도
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일시
                </th>
                <th
                  className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-4 text-center text-gray-500 dark:text-gray-400">
                    {isFetching ? "로딩 중..." : "작업이 없습니다"}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onCheckedChange={() => onToggleJob(job.id)}
                      />
                    </td>
                    <td className="p-2 text-sm font-mono text-gray-900 dark:text-gray-100">
                      {job.id}
                    </td>
                    <td className="p-2 text-sm text-gray-900 dark:text-gray-100">{job.name}</td>
                    <td className="p-2 whitespace-nowrap text-sm">{getStatusBadge(job.status)}</td>
                    <td className="p-2 text-xs font-mono text-gray-700 dark:text-gray-300">
                      <TruncatedCell content={formatData(job.data)} />
                    </td>
                    <td className="p-2 text-xs text-gray-700 dark:text-gray-300">
                      {job.failedReason ? (
                        <TruncatedCell content={job.failedReason} />
                      ) : job.returnvalue ? (
                        <TruncatedCell content={JSON.stringify(job.returnvalue)} />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-2 whitespace-nowrap text-sm text-center text-gray-500 dark:text-gray-400">
                      {job.attemptsMade}
                    </td>
                    <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {formatTimestamp(job.timestamp)}
                    </td>
                    <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                      <div className="flex gap-1">
                        {job.status === "failed" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleRetry(job.id)}
                                disabled={retryJob.isPending}
                                className="h-7 w-7 p-0"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>재시도</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemove(job.id)}
                              disabled={removeJob.isPending}
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>삭제</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))
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
    </>
  )
}
