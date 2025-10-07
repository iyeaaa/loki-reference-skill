import { ChevronLeft, ChevronRight, User } from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type RepliedEmailsParams, useRepliedEmails } from "@/lib/api/hooks/emails"
import { formatRelativeTime } from "@/lib/date-utils"

interface RepliedEmailsTableWithPaginationProps {
  workspaceId: string
  searchQuery: string
  selectedStatuses: string[]
  selectedThreadId?: string | null
  onThreadSelect: (threadId: string) => void
}

export function RepliedEmailsTableWithPagination({
  workspaceId,
  searchQuery,
  selectedStatuses,
  selectedThreadId,
  onThreadSelect,
}: RepliedEmailsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 20

  // Build params for API call
  const params: RepliedEmailsParams = {
    workspaceId,
    page: currentPage,
    limit: limit,
    status:
      selectedStatuses.length === 1
        ? selectedStatuses[0]
        : selectedStatuses.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
  }

  // Use React Query hook
  const { data, isFetching } = useRepliedEmails(params)
  const repliedEmails = data?.repliedEmails || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return "전달됨"
      case "opened":
        return "열림"
      case "clicked":
        return "클릭됨"
      case "replied":
        return "답장됨"
      case "bounced":
        return "반송됨"
      case "failed":
        return "실패"
      default:
        return status
    }
  }

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

  return (
    <TooltipProvider>
      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[15%] min-w-[150px]" />
              <col className="w-[17%] min-w-[160px]" />
              <col className="w-[8%] min-w-[70px]" />
              <col className="w-[20%] min-w-[100px]" />
              <col className="w-[12%] min-w-[100px]" />
              <col className="w-[12%] min-w-[100px]" />
              <col className="w-[8%] min-w-[80px]" />
              <col className="w-[8%] min-w-[90px]" />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  발신자
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  제목
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  메시지
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  본문
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  리드
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  시퀀스
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  상태
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  수신일
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {repliedEmails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-sm text-gray-500">
                    {isFetching ? "로딩 중..." : "답장 이메일이 없습니다"}
                  </td>
                </tr>
              ) : (
                repliedEmails.map((email) => {
                  const bodyPreview = email.bodyText
                    ? email.bodyText.replace(/\s+/g, " ").trim().slice(0, 60)
                    : email.bodyHtml
                      ? email.bodyHtml
                          .replace(/<[^>]*>/g, "")
                          .replace(/\s+/g, " ")
                          .trim()
                          .slice(0, 60)
                      : ""

                  return (
                    <tr
                      key={email.id}
                      onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      className={`cursor-pointer transition-colors ${
                        selectedThreadId === email.threadId
                          ? "bg-gray-100 dark:bg-gray-700"
                          : "hover:bg-gray-50 dark:hover:bg-gray-750"
                      }`}
                    >
                      <td className="px-3 py-2 text-sm">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">{email.fromEmail}</div>
                            {email.leadName && (
                              <div className="text-xs text-gray-500 truncate">{email.leadName}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm">
                        <div className="truncate font-medium" title={email.subject || ""}>
                          {email.subject || "(제목 없음)"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400">
                        {email.messageCount && email.messageCount > 1 ? email.messageCount : "-"}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                        <div className="truncate" title={bodyPreview}>
                          {bodyPreview || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {email.leadName ? (
                          <Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex items-center gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1.5 py-1 -mx-1.5 transition-colors text-left w-full min-w-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                    <span className="text-gray-600 dark:text-gray-300 truncate">
                                      {email.leadName}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>리드 정보 보기</p>
                              </TooltipContent>
                            </Tooltip>
                            <PopoverContent className="w-80" align="start">
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-2 border-b">
                                  <User className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-sm">리드 정보</h4>
                                </div>
                                <div className="space-y-2 text-xs">
                                  <div className="flex">
                                    <span className="font-medium w-20 text-gray-700 dark:text-gray-300">
                                      이름:
                                    </span>
                                    <span className="text-gray-600 dark:text-gray-400">
                                      {email.leadName}
                                    </span>
                                  </div>
                                  {email.leadEmail && (
                                    <div className="flex">
                                      <span className="font-medium w-20 text-gray-700 dark:text-gray-300">
                                        이메일:
                                      </span>
                                      <span className="text-gray-600 dark:text-gray-400">
                                        {email.leadEmail}
                                      </span>
                                    </div>
                                  )}
                                  {email.leadId && (
                                    <div className="flex">
                                      <span className="font-medium w-20 text-gray-700 dark:text-gray-300">
                                        ID:
                                      </span>
                                      <span className="text-gray-600 dark:text-gray-400 font-mono text-xs">
                                        {email.leadId}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="truncate">
                          {email.sequenceName ? (
                            <span className="text-gray-600">{email.sequenceName}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs whitespace-nowrap">
                        <span className="text-gray-600">{getStatusText(email.status)}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                        {formatRelativeTime(email.createdAt)}
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
          <Button
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            처음
          </Button>

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
    </TooltipProvider>
  )
}
