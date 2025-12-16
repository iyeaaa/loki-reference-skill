import { ChevronLeft, ChevronRight, RotateCcw, Trash2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useBullMQTestQueue, useRemoveJob, useRetryJob } from "@/lib/api/hooks/bullmq-test"
import type { JobStatus, TestQueueParams } from "@/lib/api/types/bullmq-test"

type JobsTableWithPaginationProps = {
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
        <div className="cursor-help" style={style}>
          {content}
        </div>
      </TooltipTrigger>
      <TooltipContent
        className="max-h-64 max-w-md overflow-auto whitespace-pre-wrap break-words"
        side="top"
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
    limit,
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
    if (!timestamp) {
      return "-"
    }
    return new Date(timestamp).toLocaleString("ko-KR")
  }

  const formatData = (data: Record<string, unknown>) => JSON.stringify(data, null, 2)

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
                  className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={filteredJobs.length > 0 && selectedJobs.length === filteredJobs.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "80px" }}
                >
                  ID
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "100px" }}
                >
                  이름
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  데이터
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  결과/에러
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  시도
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일시
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  액션
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {filteredJobs.length === 0 ? (
                <tr>
                  <td className="p-4 text-center text-gray-500 dark:text-gray-400" colSpan={9}>
                    {isFetching ? "로딩 중..." : "작업이 없습니다"}
                  </td>
                </tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                    key={job.id}
                  >
                    <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                      <Checkbox
                        checked={selectedJobs.includes(job.id)}
                        onCheckedChange={() => onToggleJob(job.id)}
                      />
                    </td>
                    <td className="p-2 font-mono text-gray-900 text-sm dark:text-gray-100">
                      {job.id}
                    </td>
                    <td className="p-2 text-gray-900 text-sm dark:text-gray-100">{job.name}</td>
                    <td className="whitespace-nowrap p-2 text-sm">{getStatusBadge(job.status)}</td>
                    <td className="p-2 font-mono text-gray-700 text-xs dark:text-gray-300">
                      <TruncatedCell content={formatData(job.data)} />
                    </td>
                    <td className="p-2 text-gray-700 text-xs dark:text-gray-300">
                      {job.failedReason ? (
                        <TruncatedCell content={job.failedReason} />
                      ) : job.returnvalue ? (
                        <TruncatedCell content={JSON.stringify(job.returnvalue)} />
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="whitespace-nowrap p-2 text-center text-gray-500 text-sm dark:text-gray-400">
                      {job.attemptsMade}
                    </td>
                    <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                      {formatTimestamp(job.timestamp)}
                    </td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                      <div className="flex gap-1">
                        {job.status === "failed" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                className="h-7 w-7 p-0"
                                disabled={retryJob.isPending}
                                onClick={() => handleRetry(job.id)}
                                size="sm"
                                variant="outline"
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
                              className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                              disabled={removeJob.isPending}
                              onClick={() => handleRemove(job.id)}
                              size="sm"
                              variant="outline"
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
    </>
  )
}
