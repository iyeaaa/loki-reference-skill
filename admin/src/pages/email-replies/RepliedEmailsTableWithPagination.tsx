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

interface RepliedEmailsTableWithPaginationProps {
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
    if (!status) return "-"
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.company")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.subject")}
                </th>
                <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.messages")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.lead")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.sequence")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.status")}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t("email-replies.table.header.date")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {repliedEmails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-4 text-center text-sm text-gray-500">
                    {isFetching
                      ? t("email-replies.table.empty.loading")
                      : t("email-replies.table.empty.noReplies")}
                  </td>
                </tr>
              ) : (
                repliedEmails.map((email) => {
                  return (
                    <tr
                      key={email.id}
                      className={`transition-colors ${
                        selectedThreadId === email.threadId
                          ? "bg-gray-100 dark:bg-gray-700"
                          : "hover:bg-gray-50 dark:hover:bg-gray-750"
                      }`}
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
                        className="px-3 py-2 text-sm cursor-pointer"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <div className="min-w-0">
                          {email.companyName || email.contactName ? (
                            <div className="font-medium break-words">
                              {email.companyName || email.contactName}
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 text-sm cursor-pointer"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <div
                          className="font-medium line-clamp-3 break-words"
                          title={email.subject || ""}
                        >
                          {email.subject || t("email-replies.thread.noSubject")}
                        </div>
                      </td>
                      <td
                        className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400 cursor-pointer"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        {email.messageCount && email.messageCount > 1 ? email.messageCount : "-"}
                      </td>
                      <td
                        className="px-3 py-2 text-xs cursor-pointer"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        {email.companyName || email.leadName ? (
                          <Popover>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className="flex items-start gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1.5 py-1 -mx-1.5 transition-colors text-left w-full min-w-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <User className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-600 dark:text-gray-300 line-clamp-3 break-words">
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
                              className="w-96 max-h-[600px] overflow-y-auto"
                              align="start"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-2 border-b">
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
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          회사명:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 break-words">
                                          {email.companyName}
                                        </span>
                                      </div>
                                    )}
                                    {email.foundCompanyName && (
                                      <div className="flex">
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          발견된 회사명:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 break-words">
                                          {email.foundCompanyName}
                                        </span>
                                      </div>
                                    )}
                                    {email.contactName && (
                                      <div className="flex">
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          담당자명:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 break-words">
                                          {email.contactName}
                                        </span>
                                      </div>
                                    )}
                                    {email.leadName && (
                                      <div className="flex">
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          리드명:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 break-words">
                                          {email.leadName}
                                        </span>
                                      </div>
                                    )}
                                    {email.leadEmail && (
                                      <div className="flex">
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          이메일:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 break-words">
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
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              업종:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.businessType}
                                            </span>
                                          </div>
                                        )}
                                        {email.employeeCount && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              직원 수:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.employeeCount}
                                            </span>
                                          </div>
                                        )}
                                        {email.leadStatus && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              리드 상태:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.leadStatus}
                                            </span>
                                          </div>
                                        )}
                                        {email.leadScore !== null &&
                                          email.leadScore !== undefined && (
                                            <div className="flex">
                                              <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                                리드 점수:
                                              </span>
                                              <span className="text-gray-600 dark:text-gray-400 break-words">
                                                {email.leadScore}
                                              </span>
                                            </div>
                                          )}
                                        {email.leadSource && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              출처:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
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
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              국가:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.country}
                                            </span>
                                          </div>
                                        )}
                                        {email.state && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              주/도:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.state}
                                            </span>
                                          </div>
                                        )}
                                        {email.city && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              도시:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {email.city}
                                            </span>
                                          </div>
                                        )}
                                        {email.address && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              주소:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
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
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              웹사이트:
                                            </span>
                                            <a
                                              href={email.websiteUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              {email.websiteUrl}
                                            </a>
                                          </div>
                                        )}
                                        {email.finalUrl && email.finalUrl !== email.websiteUrl && (
                                          <div className="flex">
                                            <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              최종 URL:
                                            </span>
                                            <a
                                              href={email.finalUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                                              onClick={(e) => e.stopPropagation()}
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
                                        <span className="font-medium w-24 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          ID:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 font-mono break-all">
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
                                    type="button"
                                    className="flex items-start gap-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-1.5 py-1 -mx-1.5 transition-colors text-left w-full min-w-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Layers className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <span className="text-gray-600 dark:text-gray-300 line-clamp-3 break-words">
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
                              className="w-96 max-h-[600px] overflow-y-auto"
                              align="start"
                            >
                              <div className="space-y-3">
                                <div className="flex items-center gap-2 pb-2 border-b">
                                  <Layers className="h-4 w-4 text-gray-500" />
                                  <h4 className="font-semibold text-sm">
                                    {t("email-replies.sequenceInfo.title")}
                                  </h4>
                                </div>
                                <div className="space-y-3 text-xs">
                                  {/* 기본 정보 */}
                                  <div className="space-y-1.5">
                                    <div className="flex">
                                      <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                        시퀀스명:
                                      </span>
                                      <span className="text-gray-600 dark:text-gray-400 break-words">
                                        {email.sequenceName}
                                      </span>
                                    </div>
                                    {email.sequenceId && (
                                      <div className="flex">
                                        <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          시퀀스 ID:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 font-mono break-all text-[10px]">
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
                                          <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                            등록 상태:
                                          </span>
                                          <span className="text-gray-600 dark:text-gray-400 break-words">
                                            {getEnrollmentStatusText(
                                              email.enrollmentStatus || null,
                                            )}
                                          </span>
                                        </div>
                                        {email.enrollmentCurrentStepOrder !== null &&
                                          email.enrollmentCurrentStepOrder !== undefined && (
                                            <div className="flex">
                                              <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                                {t("email-replies.sequenceInfo.currentStep")}:
                                              </span>
                                              <span className="text-gray-600 dark:text-gray-400 break-words">
                                                {t("email-replies.sequenceInfo.currentStepValue", {
                                                  step: email.enrollmentCurrentStepOrder + 1,
                                                })}
                                              </span>
                                            </div>
                                          )}
                                        {email.enrollmentEnrolledAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              등록일:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {new Date(email.enrollmentEnrolledAt).toLocaleString(
                                                "ko-KR",
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentFirstEmailSentAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              첫 이메일 전송:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {new Date(
                                                email.enrollmentFirstEmailSentAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentLastEmailSentAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              마지막 이메일 전송:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {new Date(
                                                email.enrollmentLastEmailSentAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentNextStepScheduledAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              다음 스텝 예정:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {new Date(
                                                email.enrollmentNextStepScheduledAt,
                                              ).toLocaleString("ko-KR")}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentCompletedAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              완료일:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
                                              {new Date(email.enrollmentCompletedAt).toLocaleString(
                                                "ko-KR",
                                              )}
                                            </span>
                                          </div>
                                        )}
                                        {email.enrollmentStoppedAt && (
                                          <div className="flex">
                                            <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                              중단일:
                                            </span>
                                            <span className="text-gray-600 dark:text-gray-400 break-words">
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
                                        <span className="font-medium w-32 text-gray-700 dark:text-gray-300 flex-shrink-0">
                                          Enrollment ID:
                                        </span>
                                        <span className="text-gray-600 dark:text-gray-400 font-mono break-all text-[10px]">
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
                        className="px-3 py-2 text-xs whitespace-nowrap cursor-pointer"
                        onClick={() => email.threadId && onThreadSelect(email.threadId)}
                      >
                        <span className="text-gray-600">{getStatusText(email.status)}</span>
                      </td>
                      <td
                        className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap cursor-pointer"
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
          <div className="text-sm text-muted-foreground">
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
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            {t("email-replies.pagination.first")}
          </Button>

          <Button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("email-replies.pagination.previous")}
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
            {t("email-replies.pagination.next")}
            <ChevronRight className="h-4 w-4" />
          </Button>

          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            {t("email-replies.pagination.last")}
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("email-replies.pagination.page")}:
          </span>
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
