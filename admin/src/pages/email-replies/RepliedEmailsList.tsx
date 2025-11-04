import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { type RepliedEmailsParams, useRepliedEmails } from "@/lib/api/hooks/emails"
import { RepliedEmailsListItem } from "./RepliedEmailsListItem"

interface RepliedEmailsListProps {
  workspaceId: string
  searchQuery: string
  selectedStatuses: string[]
  selectedIntent?: string | null
  selectedThreadId?: string | null
  onThreadSelect: (threadId: string) => void
  selectedThreads: string[]
  onToggleThread: (threadId: string) => void
  onToggleAll: (threadIds: string[]) => void
}

export function RepliedEmailsList({
  workspaceId,
  searchQuery,
  selectedStatuses,
  selectedIntent,
  selectedThreadId,
  onThreadSelect,
  selectedThreads,
  onToggleThread,
  onToggleAll,
}: RepliedEmailsListProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 20

  // Build params for API call (memoized to prevent unnecessary refetches)
  const params: RepliedEmailsParams = useMemo(
    () => ({
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
      intent: selectedIntent && selectedIntent !== "all" ? selectedIntent : undefined,
    }),
    [workspaceId, currentPage, selectedStatuses, searchQuery, selectedIntent],
  )

  // Use React Query hook
  const { data, isFetching } = useRepliedEmails(params)
  const repliedEmails = data?.repliedEmails || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

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

  const allSelected =
    repliedEmails.length > 0 &&
    repliedEmails.every((email) => email.threadId && selectedThreads.includes(email.threadId))

  return (
    <div>
      {/* List container */}
      <div className="rounded-md border bg-white dark:bg-gray-800">
        {/* Header with select all */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() =>
              onToggleAll(repliedEmails.map((e) => e.threadId).filter((id): id is string => !!id))
            }
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedThreads.length > 0
              ? `${selectedThreads.length} selected`
              : `${total} conversations`}
          </span>
        </div>

        {/* List items */}
        {isFetching ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            {t("email-replies.table.empty.loading")}
          </div>
        ) : repliedEmails.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-500">
            {t("email-replies.table.empty.noReplies")}
          </div>
        ) : (
          <div>
            {repliedEmails.map((email) => (
              <RepliedEmailsListItem
                key={email.id}
                email={email}
                isSelected={email.threadId ? selectedThreads.includes(email.threadId) : false}
                isActive={selectedThreadId === email.threadId}
                onSelect={() => email.threadId && onThreadSelect(email.threadId)}
                onToggleCheckbox={(e) => {
                  e.stopPropagation()
                  if (email.threadId) onToggleThread(email.threadId)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-2">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {t("email-replies.pagination.showing", {
              start: (currentPage - 1) * limit + 1,
              end: Math.min(currentPage * limit, total),
              total,
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Previous button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {getPageNumbers().map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page)}
                className="min-w-[36px]"
              >
                {page}
              </Button>
            ))}

            {/* Page input for jumping */}
            {totalPages > 10 && (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-600 dark:text-gray-400">Go to</span>
                <Input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={pageInputValue}
                  onChange={(e) => handlePageInputChange(e.target.value)}
                  onKeyDown={handlePageInputKeyDown}
                  onBlur={handlePageInputBlur}
                  className="w-16 h-8 text-center"
                />
              </div>
            )}

            {/* Next button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
