import { ChevronLeft, ChevronRight, Inbox, Rocket } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useToggleImportant } from "@/lib/api/hooks/email-replies"
import { type RepliedEmailsParams, useRepliedEmails } from "@/lib/api/hooks/emails"
import { RepliedEmailsListItem } from "./RepliedEmailsListItem"

type RepliedEmailsListProps = {
  workspaceId: string
  searchQuery: string
  selectedStatuses: string[]
  selectedIntent?: string | null
  filterImportant?: boolean
  filterUnread?: boolean
  selectedThreadId?: string | null
  onThreadSelect: (threadId: string) => void
  selectedThreads: string[]
  onToggleThread: (threadId: string) => void
  onToggleAll: (threadIds: string[]) => void
  filterSentiment?: string[]
  filterCategory?: string[]
  filterPriority?: string[]
  dateFrom?: string
  dateTo?: string
  direction?: "inbound" | "outbound" | "all"
}

export function RepliedEmailsList({
  workspaceId,
  searchQuery,
  selectedStatuses,
  selectedIntent,
  filterImportant,
  filterUnread,
  selectedThreadId,
  onThreadSelect,
  selectedThreads,
  onToggleThread,
  onToggleAll,
  filterSentiment = [],
  filterCategory = [],
  filterPriority = [],
  dateFrom,
  dateTo,
  direction = "all",
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
      limit,
      status:
        selectedStatuses.length === 1
          ? selectedStatuses[0]
          : selectedStatuses.length > 0
            ? "all"
            : undefined,
      search: searchQuery || undefined,
      intent: selectedIntent && selectedIntent !== "all" ? selectedIntent : undefined,
      isImportant: filterImportant,
      isUnread: filterUnread,
      sentiment: filterSentiment.length > 0 ? filterSentiment.join(",") : undefined,
      category: filterCategory.length > 0 ? filterCategory.join(",") : undefined,
      priority: filterPriority.length > 0 ? filterPriority.join(",") : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      direction,
    }),
    [
      workspaceId,
      currentPage,
      selectedStatuses,
      searchQuery,
      selectedIntent,
      filterImportant,
      filterUnread,
      filterSentiment,
      filterCategory,
      filterPriority,
      dateFrom,
      dateTo,
      direction,
    ],
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

  const allSelected =
    repliedEmails.length > 0 &&
    repliedEmails.every((email) => email.threadId && selectedThreads.includes(email.threadId))

  // Toggle important mutation
  const toggleImportant = useToggleImportant()

  const handleToggleImportant = (email: (typeof repliedEmails)[0], e: React.MouseEvent) => {
    e.stopPropagation()
    if (!email.threadId) {
      return
    }
    toggleImportant.mutate({
      threadId: email.threadId,
      isImportant: !email.isImportant,
    })
  }

  return (
    <div>
      {/* List container */}
      <div className="rounded-md border bg-white dark:bg-gray-800">
        {/* Header with select all */}
        <div className="flex items-center gap-3 border-gray-200 border-b bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-700/50">
          <Checkbox
            checked={allSelected}
            onCheckedChange={() =>
              onToggleAll(repliedEmails.map((e) => e.threadId).filter((id): id is string => !!id))
            }
          />
          <span className="text-gray-600 text-sm dark:text-gray-400">
            {selectedThreads.length > 0
              ? `${selectedThreads.length} selected`
              : `${total} conversations`}
          </span>
        </div>

        {/* List items */}
        {isFetching ? (
          <div className="px-4 py-12 text-center text-gray-500 text-sm">
            {t("email-replies.table.empty.loading")}
          </div>
        ) : repliedEmails.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
                <Inbox className="h-7 w-7 text-blue-500" />
              </div>
            </div>
            <h3 className="mb-2 font-semibold text-gray-700">
              {t("email-replies.empty.title", "아직 도착한 답장이 없어요")}
            </h3>
            <p className="mx-auto mb-4 max-w-sm text-gray-500 text-sm">
              {t(
                "email-replies.empty.description",
                "캠페인을 시작하면 바이어 답장이 여기에 모여요. 보통 첫 답장은 3~5일 내에 도착해요!",
              )}
            </p>
            <Link to="/sequences">
              <Button
                className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700"
                size="sm"
              >
                <Rocket className="mr-2 h-4 w-4" />
                {t("email-replies.empty.action", "캠페인 현황 보기")}
              </Button>
            </Link>
          </div>
        ) : (
          <div>
            {repliedEmails.map((email) => (
              <RepliedEmailsListItem
                email={email}
                isActive={selectedThreadId === email.threadId}
                isSelected={email.threadId ? selectedThreads.includes(email.threadId) : false}
                key={email.id}
                onSelect={() => email.threadId && onThreadSelect(email.threadId)}
                onToggleCheckbox={(e) => {
                  e.stopPropagation()
                  if (email.threadId) {
                    onToggleThread(email.threadId)
                  }
                }}
                onToggleImportant={(e) => handleToggleImportant(email, e)}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between px-2">
          <div className="text-gray-600 text-sm dark:text-gray-400">
            {t("email-replies.pagination.showing", {
              start: (currentPage - 1) * limit + 1,
              end: Math.min(currentPage * limit, total),
              total,
            })}
          </div>

          <div className="flex items-center gap-2">
            {/* Previous button */}
            <Button
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              size="sm"
              variant="outline"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Page numbers */}
            {getPageNumbers().map((page) => (
              <Button
                className="min-w-[36px]"
                key={page}
                onClick={() => handlePageChange(page)}
                size="sm"
                variant={page === currentPage ? "default" : "outline"}
              >
                {page}
              </Button>
            ))}

            {/* Page input for jumping */}
            {totalPages > 10 && (
              <div className="flex items-center gap-1">
                <span className="text-gray-600 text-sm dark:text-gray-400">Go to</span>
                <Input
                  className="h-8 w-16 text-center"
                  max={totalPages}
                  min={1}
                  onBlur={handlePageInputBlur}
                  onChange={(e) => handlePageInputChange(e.target.value)}
                  onKeyDown={handlePageInputKeyDown}
                  type="number"
                  value={pageInputValue}
                />
              </div>
            )}

            {/* Next button */}
            <Button
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              size="sm"
              variant="outline"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
