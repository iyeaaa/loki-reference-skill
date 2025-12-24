import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCustomerGroupMembers } from "@/lib/api/hooks/customer-groups"
import {
  useActivateStepBasedSequence,
  useSequences,
  useUpdateSequence,
} from "@/lib/api/hooks/sequences"
import type { CustomerGroupMember } from "@/lib/api/types/customer-group"
import type { Sequence, SequenceStatus, SequencesParams } from "@/lib/api/types/sequence"
import { formatRelativeTime } from "@/lib/date-utils"

interface CustomerGroupMemberWithLead extends CustomerGroupMember {
  leadCompanyName?: string
  leadWebsiteUrl?: string
  leadStatus?: string
}

type SequencesTableWithPaginationProps = {
  searchQuery: string
  selectedStatuses: string[]
  selectedSequences: string[]
  onToggleSequence: (sequenceId: string) => void
  onToggleAll: (sequenceIds: string[]) => void
  onEditSequence: (sequence: Sequence) => void
}

export function SequencesTableWithPagination({
  searchQuery,
  selectedStatuses,
  selectedSequences,
  onToggleSequence,
  onToggleAll,
  onEditSequence,
}: SequencesTableWithPaginationProps) {
  const { t } = useTranslation()
  const updateSequence = useUpdateSequence()
  const activateStepBased = useActivateStepBasedSequence()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )
  const [selectedSequenceForModal, setSelectedSequenceForModal] = useState<Sequence | null>(null)
  const limit = 10

  // localStorage 변경 감지
  useEffect(() => {
    const interval = setInterval(() => {
      const workspace = localStorage.getItem("selectedWorkspace") || "all"
      if (workspace !== currentWorkspace) {
        setCurrentWorkspace(workspace)
        setCurrentPage(1) // 워크스페이스 변경 시 첫 페이지로
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentWorkspace])

  const workspaceFilter = currentWorkspace === "all" ? undefined : [currentWorkspace]

  // Build params for API call
  const params: SequencesParams = {
    page: currentPage,
    limit,
    status:
      selectedStatuses?.length === 1
        ? (selectedStatuses[0] as SequenceStatus)
        : selectedStatuses?.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    workspaceIds: workspaceFilter,
  }

  // Use React Query hook for fetching sequences
  const { data: sequencesData, isFetching } = useSequences(params)
  const sequences = sequencesData?.sequences || []
  const totalPages = sequencesData?.totalPages || 1
  const total = sequencesData?.total || 0

  const getStatusText = (status: SequenceStatus) => {
    switch (status) {
      case "draft":
        return t("sequences.table.status.draft")
      case "active":
        return t("sequences.table.status.active")
      case "paused":
        return t("sequences.table.status.paused")
      case "archived":
        return t("sequences.table.status.archived")
      case "completed":
        return t("sequences.table.status.completed")
      case "no_response":
        return t("sequences.table.status.noResponse")
      case "ready":
        return t("sequences.table.status.ready")
      default:
        return status
    }
  }

  const getStatusBadgeVariant = (status: SequenceStatus) => {
    switch (status) {
      case "active":
        return "default" as const
      case "draft":
        return "secondary" as const
      case "paused":
        return "outline" as const
      case "archived":
        return "outline" as const
      case "completed":
        return "default" as const
      case "no_response":
        return "destructive" as const
      default:
        return "outline" as const
    }
  }

  const handleToggleAll = useCallback(() => {
    onToggleAll(sequences.map((s) => s.id))
  }, [sequences, onToggleAll])

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

  const handleToggleStatus = (sequence: Sequence) => {
    const newStatus: SequenceStatus = sequence.status === "active" ? "paused" : "active"

    // 활성화 시: stepsCount가 있으면 스텝 기반 시퀀스로 간주
    // (워크플로우 기반 시퀀스는 stepsCount가 0이거나 없음)
    if (newStatus === "active" && sequence.stepsCount && sequence.stepsCount > 0) {
      // 스텝 기반 시퀀스 활성화 API 호출
      activateStepBased.mutate(sequence.id)
    } else {
      // 일반 상태 업데이트 (워크플로우 기반 또는 일시정지)
      updateSequence.mutate({
        sequenceId: sequence.id,
        data: {
          status: newStatus,
        },
      })
    }
  }

  // 고객 그룹 멤버 조회
  const { data: customerGroupData } = useCustomerGroupMembers(
    selectedSequenceForModal?.customerGroupId || "",
    1,
    100,
    !!selectedSequenceForModal?.customerGroupId,
  )

  return (
    <>
      {/* Sequences Table */}
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
                    checked={sequences.length > 0 && selectedSequences?.length === sequences.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  {t("sequences.table.column.sequenceName")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.status")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  {t("sequences.table.column.workspace")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "120px" }}
                >
                  {t("sequences.table.column.customerGroup")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.customerCount")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.stepCount")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.sentCount")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.openRate")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.replyRate")}
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.updatedAt")}
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  {t("sequences.table.column.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {sequences.map((sequence) => (
                <tr
                  className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  key={sequence.id}
                  // onClick={(e) => handleRowClick(sequence, e)}
                  onClick={() => onEditSequence(sequence)}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Checkbox
                      checked={selectedSequences?.includes(sequence.id)}
                      onCheckedChange={() => onToggleSequence(sequence.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td
                    className="p-2 font-medium text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={sequence.name}
                  >
                    {sequence.name}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    <Badge className="text-xs" variant={getStatusBadgeVariant(sequence.status)}>
                      {getStatusText(sequence.status)}
                    </Badge>
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={sequence.workspaceName || sequence.workspaceId}
                  >
                    {sequence.workspaceName || sequence.workspaceId}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={sequence.customerGroupName || "-"}
                  >
                    {sequence.customerGroupName || "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-gray-900 text-sm dark:text-gray-100">
                    {sequence.enrollmentsCount ||
                      (() => {
                        try {
                          const ids = sequence.selectedLeadIds
                            ? JSON.parse(sequence.selectedLeadIds)
                            : []
                          return Array.isArray(ids) ? ids.length : 0
                        } catch {
                          return 0
                        }
                      })()}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-gray-900 text-sm dark:text-gray-100">
                    {sequence.currentMaxStep ?? 0}/{sequence.stepsCount ?? 0}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-gray-900 text-sm dark:text-gray-100">
                    {sequence.sentCount ?? 0}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-gray-900 text-sm dark:text-gray-100">
                    {sequence.deliveredCount && sequence.openedCount
                      ? `${Math.round((sequence.openedCount / sequence.deliveredCount) * 100)}%`
                      : "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-gray-900 text-sm dark:text-gray-100">
                    {sequence.deliveredCount && sequence.repliedCount
                      ? `${Math.round((sequence.repliedCount / sequence.deliveredCount) * 100)}%`
                      : "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(sequence.updatedAt)}
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <div className="flex gap-2">
                      <Button
                        className="h-8 px-3 text-xs"
                        disabled={
                          sequence.status === "archived" ||
                          sequence.status === "completed" ||
                          (sequence.status === "draft" &&
                            (!sequence.stepsCount || sequence.stepsCount === 0)) ||
                          (sequence.completedEnrollmentsCount !== null &&
                            sequence.completedEnrollmentsCount !== undefined &&
                            sequence.completedEnrollmentsCount > 0)
                        }
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(sequence)
                        }}
                        size="sm"
                        title={
                          sequence.status === "active"
                            ? t("sequences.table.button.pause")
                            : t("sequences.table.button.activate")
                        }
                        variant="outline"
                      >
                        {sequence.status === "active" ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
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
                {t("sequences.table.pagination.displaying", { count: total })}
              </>
            ) : (
              t("sequences.table.pagination.displayingZero")
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
            {t("sequences.table.pagination.first")}
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
            {t("sequences.table.pagination.previous")}
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
            {t("sequences.table.pagination.next")}
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
            {t("sequences.table.pagination.last")}
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-muted-foreground text-sm">
            {t("sequences.table.pagination.page")}
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

      {/* 고객 정보 모달 */}
      <Dialog
        onOpenChange={() => setSelectedSequenceForModal(null)}
        open={!!selectedSequenceForModal}
      >
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t("sequences.table.modal.title", { sequenceName: selectedSequenceForModal?.name })}
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {customerGroupData && customerGroupData.members.length > 0 ? (
              <div className="space-y-4">
                <p className="text-gray-600 text-sm">
                  {t("sequences.table.modal.totalCustomers", { count: customerGroupData.total })}
                </p>
                <div className="overflow-hidden rounded-lg border">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 text-xs uppercase">
                          {t("sequences.table.modal.column.companyName")}
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 text-xs uppercase">
                          {t("sequences.table.modal.column.website")}
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 text-xs uppercase">
                          상태
                        </th>
                        <th className="px-4 py-2 text-left font-medium text-gray-500 text-xs uppercase">
                          {t("sequences.table.modal.column.addedAt")}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customerGroupData.members.map((member: CustomerGroupMemberWithLead) => (
                        <tr className="hover:bg-gray-50" key={member.id}>
                          <td className="px-4 py-3 text-gray-900 text-sm">
                            {member.leadCompanyName || "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {member.leadWebsiteUrl || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline">{member.leadStatus || "-"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-gray-600 text-sm">
                            {formatRelativeTime(member.addedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500">
                {t("sequences.table.modal.noCustomers")}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
