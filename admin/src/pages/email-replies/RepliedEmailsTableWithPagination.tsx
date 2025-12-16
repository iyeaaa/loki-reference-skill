import { ChevronLeft, ChevronRight, Layers, User } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { type RepliedEmailsParams, useRepliedEmails } from "@/lib/api/hooks/emails"
import { formatRelativeTime } from "@/lib/date-utils"

type RepliedEmailsTableWithPaginationProps = {
  workspaceId: string
  searchQuery: string
  selectedStatuses: string[]
  selectedThreadId?: string | null
  onThreadSelect: (threadId: string) => void
  selectedThreads: string[]
  onToggleThread: (threadId: string) => void
  onToggleAll: (threadIds: string[]) => void
}

export function RepliedEmailsTableWithPagination({
  workspaceId,
  searchQuery,
  selectedStatuses,
  selectedThreadId,
  onThreadSelect,
  selectedThreads,
  onToggleThread,
  onToggleAll,
}: RepliedEmailsTableWithPaginationProps) {
  const { t } = useTranslation()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 20

  // Build params for API call
  const params: RepliedEmailsParams = {
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
  }

  // Use React Query hook
  const { data, isFetching } = useRepliedEmails(params)
  const repliedEmails = data?.repliedEmails || []
  const totalPages = data?.totalPages || 1
  const total = data?.total || 0

  const getStatusText = (status: string) => {
    switch (status) {
      case "delivered":
        return t("email-replies.status.delivered")
      case "opened":
        return t("email-replies.status.opened")
      case "clicked":
        return t("email-replies.status.clicked")
      case "replied":
        return t("email-replies.status.replied")
      case "bounced":
        return t("email-replies.status.bounced")
      case "failed":
        return t("email-replies.status.failed")
      default:
        return status
    }
  }

  const getEnrollmentStatusText = (
    status: "active" | "paused" | "completed" | "stopped" | "bounced" | "unsubscribed" | null,
  ) => {
    if (!status) {
      return "-"
    }
    switch (status) {
      case "active":
        return t("email-replies.enrollment.status.active")
      case "paused":
        return t("email-replies.enrollment.status.paused")
      case "completed":
        return t("email-replies.enrollment.status.completed")
      case "stopped":
        return t("email-replies.enrollment.status.stopped")
      case "bounced":
        return t("email-replies.enrollment.status.bounced")
      case "unsubscribed":
        return t("email-replies.enrollment.status.unsubscribed")
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

  return (
    <TooltipProvider>
      {/* Table */}
      <div className="rounded-md border">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed">
            <colgroup>
              <col className="w-[40px]" />
              <col className="w-[16%] min-w-[140px]" />
              <col className="w-[22%] min-w-[170px]" />
              <col className="w-[8%] min-w-[80px]" />
              <col className="w-[16%] min-w-[110px]" />
              <col className="w-[16%] min-w-[110px]" />
              <col className="w-[10%] min-w-[90px]" />
              <col className="w-[10%] min-w-[100px]" />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-3 py-2 text-center">
                  <Checkbox
                    checked={
                      repliedEmails.length > 0 &&
                      repliedEmails.every(
                        (email) => email.threadId && selectedThreads.includes(email.threadId),
                      )
                    }
                    onCheckedChange={() =>
                      onToggleAll(
                        repliedEmails.map((e) => e.threadId).filter((id): id is string => !!id),
                      )
                    }
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.company")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.subject")}
                </th>
                <th className="px-3 py-2 text-center font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.messages")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.lead")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.sequence")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.status")}
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400">
                  {t("email-replies.table.header.date")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {repliedEmails.length === 0 ? (
                <tr>
                  <td className="px-2 py-4 text-center text-gray-500 text-sm" colSpan={8}>
                    {isFetching
                      ? t("email-replies.table.empty.loading")
                      : t("email-replies.table.empty.noReplies")}
                  </td>
                </tr>
              ) : (
                repliedEmails.map((email) => {
                  return (
                    <tr
                      className={`transition-colors ${
                        selectedThreadId === email.threadId
                          ? "bg-gray-100 dark:bg-gray-700"
                          : "hover:bg-gray-50 dark:hover:bg-gray-750"
                      }`}
                      key={email.id}
                    >
                      <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={
                            email.threadId ? selectedThreads.includes(email.threadId) : false
                          }
                          onCheckedChange={() => email.threadId && onToggleThread(email.threadId)}
                        />
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 text-sm"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <div className="min-w-0">
                          {email.companyName || email.contactName ? (
                            <div className="break-words font-medium">
                              {email.companyName || email.contactName}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 text-sm"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <div
                          className="line-clamp-3 break-words font-medium"
                          title={email.subject || ""}
                        >
                          {email.subject || t("email-replies.thread.noSubject")}
                        </div>
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 text-center text-gray-600 text-xs dark:text-gray-400"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        {email.messageCount && email.messageCount > 1 ? email.messageCount : "-"}
                      </td>
                      <td
                        className="cursor-pointer px-3 py-2 text-xs"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        {email.companyName || email.leadName ? (
                          <Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    className="-mx-1.5 flex w-full min-w-0 items-start gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={(e) => e.stopPropagation()}
                                    type="button"
                                  >
                                    <User className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                                    <span className="line-clamp-3 break-words text-gray-600 dark:text-gray-300">
                                      {email.companyName || email.leadName}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("email-replies.tooltip.viewLead")}</p>
                              </TooltipContent>
                            </Tooltip>
                            <PopoverContent
                              align="start"
                              className="max-h-[600px] w-96 overflow-y-auto"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <User className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-sm">
                                    {t("email-replies.leadInfo.title")}
                                  </h4>
                                </div>
                                <div className="space-y-3 text-xs">
                                  {/* 기본 정보 */}
                                  <div className="space-y-1.5">
                                    {email.companyName && (
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          회사명:
                                        </span>
                                        <span className="break-words text-gray-600 dark:text-gray-400">
                                          {email.companyName}
                                        </span>
                                      </div>
                                    )}
                                    {email.foundCompanyName && (
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          발견된 회사명:
                                        </span>
                                        <span className="break-words text-gray-600 dark:text-gray-400">
                                          {email.foundCompanyName}
                                        </span>
                                      </div>
                                    )}
                                    {email.contactName && (
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          담당자명:
                                        </span>
                                        <span className="break-words text-gray-600 dark:text-gray-400">
                                          {email.contactName}
                                        </span>
                                      </div>
                                    )}
                                    {email.leadName && (
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          리드명:
                                        </span>
                                        <span className="break-words text-gray-600 dark:text-gray-400">
                                          {email.leadName}
                                        </span>
                                      </div>
                                    )}
                                    {email.leadEmail && (
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          이메일:
                                        </span>
                                        <span className="break-words text-gray-600 dark:text-gray-400">
                                          {email.leadEmail}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* 비즈니스 정보 */}
                                  {(email.businessType ||
                                    email.employeeCount ||
                                    email.leadStatus ||
                                    email.leadScore !== null ||
                                    email.leadSource) && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="space-y-1.5">
                                        {email.businessType && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              업종:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.businessType}
                                            </span>
                                          </div>
                                        )}
                                        {email.employeeCount && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              직원 수:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.employeeCount}
                                            </span>
                                          </div>
                                        )}
                                        {email.leadStatus && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              리드 상태:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.leadStatus}
                                            </span>
                                          </div>
                                        )}
                                        {email.leadScore !== null &&
                                          email.leadScore !== undefined && (
                                            <div className="flex">
                                              <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                                리드 점수:
                                              </span>
                                              <span className="break-words text-gray-600 dark:text-gray-400">
                                                {email.leadScore}
                                              </span>
                                            </div>
                                          )}
                                        {email.leadSource && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              출처:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.leadSource}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* 위치 정보 */}
                                  {(email.address ||
                                    email.country ||
                                    email.city ||
                                    email.state) && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="space-y-1.5">
                                        {email.country && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              국가:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.country}
                                            </span>
                                          </div>
                                        )}
                                        {email.state && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              주/도:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.state}
                                            </span>
                                          </div>
                                        )}
                                        {email.city && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              도시:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.city}
                                            </span>
                                          </div>
                                        )}
                                        {email.address && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              주소:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {email.address}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* 웹사이트 정보 */}
                                  {(email.websiteUrl || email.finalUrl) && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="space-y-1.5">
                                        {email.websiteUrl && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              웹사이트:
                                            </span>
                                            <a
                                              className="break-all text-blue-600 hover:underline dark:text-blue-400"
                                              href={email.websiteUrl}
                                              onClick={(e) => e.stopPropagation()}
                                              rel="noopener noreferrer"
                                              target="_blank"
                                            >
                                              {email.websiteUrl}
                                            </a>
                                          </div>
                                        )}
                                        {email.finalUrl && email.finalUrl !== email.websiteUrl && (
                                          <div className="flex">
                                            <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              최종 URL:
                                            </span>
                                            <a
                                              className="break-all text-blue-600 hover:underline dark:text-blue-400"
                                              href={email.finalUrl}
                                              onClick={(e) => e.stopPropagation()}
                                              rel="noopener noreferrer"
                                              target="_blank"
                                            >
                                              {email.finalUrl}
                                            </a>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* ID */}
                                  {email.leadId && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="flex">
                                        <span className="w-24 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          ID:
                                        </span>
                                        <span className="break-all font-mono text-gray-600 dark:text-gray-400">
                                          {email.leadId}
                                        </span>
                                      </div>
                                    </>
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
                        {email.sequenceName ? (
                          <Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    className="-mx-1.5 flex w-full min-w-0 items-start gap-1.5 rounded px-1.5 py-1 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                                    onClick={(e) => e.stopPropagation()}
                                    type="button"
                                  >
                                    <Layers className="mt-0.5 h-3 w-3 flex-shrink-0 text-gray-400" />
                                    <span className="line-clamp-3 break-words text-gray-600 dark:text-gray-300">
                                      {email.sequenceName}
                                    </span>
                                  </button>
                                </PopoverTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{t("email-replies.tooltip.viewSequence")}</p>
                              </TooltipContent>
                            </Tooltip>
                            <PopoverContent
                              align="start"
                              className="max-h-[600px] w-96 overflow-y-auto"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 border-b pb-2">
                                  <Layers className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-sm">
                                    {t("email-replies.sequenceInfo.title")}
                                  </h4>
                                </div>
                                <div className="space-y-3 text-xs">
                                  {/* 기본 정보 */}
                                  <div className="space-y-1.5">
                                    <div className="flex">
                                      <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                        시퀀스명:
                                      </span>
                                      <span className="break-words text-gray-600 dark:text-gray-400">
                                        {email.sequenceName}
                                      </span>
                                    </div>
                                    {email.sequenceId && (
                                      <div className="flex">
                                        <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          시퀀스 ID:
                                        </span>
                                        <span className="break-all font-mono text-[10px] text-gray-600 dark:text-gray-400">
                                          {email.sequenceId}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Enrollment 정보 */}
                                  {email.enrollmentId && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="space-y-1.5">
                                        <div className="flex">
                                          <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                            등록 상태:
                                          </span>
                                          <span className="break-words text-gray-600 dark:text-gray-400">
                                            {getEnrollmentStatusText(
                                              email.enrollmentStatus || null,
                                            )}
                                          </span>
                                        </div>
                                        {email.enrollmentCurrentStepOrder !== null &&
                                          email.enrollmentCurrentStepOrder !== undefined && (
                                            <div className="flex">
                                              <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                                {t("email-replies.sequenceInfo.currentStep")}:
                                              </span>
                                              <span className="break-words text-gray-600 dark:text-gray-400">
                                                {t("email-replies.sequenceInfo.currentStepValue", {
                                                  step: email.enrollmentCurrentStepOrder + 1,
                                                })}
                                              </span>
                                            </div>
                                          )}
                                        {email.enrollmentEnrolledAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              등록일:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(email.enrollmentEnrolledAt).toLocaleString(
                                                "ko-KR",
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentFirstEmailSentAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              첫 이메일 전송:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(
                                                email.enrollmentFirstEmailSentAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentLastEmailSentAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              마지막 이메일 전송:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(
                                                email.enrollmentLastEmailSentAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentNextStepScheduledAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              다음 스텝 예정:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(
                                                email.enrollmentNextStepScheduledAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentCompletedAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              완료일:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(email.enrollmentCompletedAt).toLocaleString(
                                                "ko-KR",
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentStoppedAt && (
                                          <div className="flex">
                                            <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                              중단일:
                                            </span>
                                            <span className="break-words text-gray-600 dark:text-gray-400">
                                              {new Date(email.enrollmentStoppedAt).toLocaleString(
                                                "ko-KR",
                                              )}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}

                                  {/* Enrollment ID */}
                                  {email.enrollmentId && (
                                    <>
                                      <div className="border-t pt-2" />
                                      <div className="flex">
                                        <span className="w-32 flex-shrink-0 font-medium text-gray-700 dark:text-gray-300">
                                          Enrollment ID:
                                        </span>
                                        <span className="break-all font-mono text-[10px] text-gray-600 dark:text-gray-400">
                                          {email.enrollmentId}
                                        </span>
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td
                        className="cursor-pointer whitespace-nowrap px-3 py-2 text-xs"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <span className="text-gray-600">{getStatusText(email.status)}</span>
                      </td>
                      <td
                        className="cursor-pointer whitespace-nowrap px-3 py-2 text-gray-500 text-xs"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
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
      <div className="mt-6 space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            {total > 0
              ? t("email-replies.pagination.showing", {
                  start: (currentPage - 1) * limit + 1,
                  end: Math.min(currentPage * limit, total),
                  total: total.toLocaleString(),
                })
              : t("email-replies.pagination.showingZero")}
          </div>
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-1">
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(1)}
            size="sm"
            variant="outline"
          >
            {t("email-replies.pagination.first")}
          </Button>

          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("email-replies.pagination.previous")}
          </Button>

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

          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            size="sm"
            variant="outline"
          >
            {t("email-replies.pagination.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(totalPages)}
            size="sm"
            variant="outline"
          >
            {t("email-replies.pagination.last")}
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t("email-replies.pagination.page")}:
          </span>
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
    </TooltipProvider>
  )
}
