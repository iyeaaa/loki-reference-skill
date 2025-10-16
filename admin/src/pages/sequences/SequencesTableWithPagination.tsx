import { ChevronLeft, ChevronRight, Edit, Pause, Play } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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

interface SequencesTableWithPaginationProps {
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
    limit: limit,
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
        return "초안"
      case "active":
        return "활성"
      case "paused":
        return "일시정지"
      case "archived":
        return "보관됨"
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
                  className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={sequences.length > 0 && selectedSequences?.length === sequences.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  시퀀스명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "250px" }}
                >
                  설명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  생성자
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  스텝 수
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  등록 수
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  수정일
                </th>
                <th
                  className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sequences.map((sequence) => (
                <tr
                  key={sequence.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                  // onClick={(e) => handleRowClick(sequence, e)}
                  onClick={() => onEditSequence(sequence)}
                >
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Checkbox
                      checked={selectedSequences?.includes(sequence.id) || false}
                      onCheckedChange={() => onToggleSequence(sequence.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td
                    className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                    title={sequence.name}
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sequence.name}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-600 dark:text-gray-300"
                    title={sequence.description || "-"}
                    style={{
                      maxWidth: "350px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sequence.description || "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm">
                    <Badge variant={getStatusBadgeVariant(sequence.status)} className="text-xs">
                      {getStatusText(sequence.status)}
                    </Badge>
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={sequence.workspaceName || sequence.workspaceId}
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sequence.workspaceName || sequence.workspaceId}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={sequence.createdByUsername || sequence.createdByEmail || "-"}
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {sequence.createdByUsername || sequence.createdByEmail || "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                    {sequence.stepsCount ?? 0}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                    {sequence.enrollmentsCount ?? 0}
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(sequence.createdAt)}
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(sequence.updatedAt)}
                  </td>
                  <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleToggleStatus(sequence)
                        }}
                        className="text-xs h-8 px-3"
                        title={sequence.status === "active" ? "일시정지" : "활성화"}
                        disabled={
                          sequence.status === "archived" ||
                          (sequence.status === "draft" &&
                            (!sequence.stepsCount || sequence.stepsCount === 0))
                        }
                      >
                        {sequence.status === "active" ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                      </Button>
                      {/* <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/sequences/${sequence.id}/designer`)}
                        className="text-xs h-8 px-3"
                        title="노드 편집"
                      >
                        <Workflow className="h-3 w-3" />
                      </Button> */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditSequence(sequence)
                        }}
                        className="text-xs h-8 px-3"
                        title="시퀀스 편집"
                      >
                        <Edit className="h-3 w-3" />
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

      {/* 고객 정보 모달 */}
      <Dialog
        open={!!selectedSequenceForModal}
        onOpenChange={() => setSelectedSequenceForModal(null)}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>등록된 고객 정보 - {selectedSequenceForModal?.name}</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            {customerGroupData && customerGroupData.members.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  총 {customerGroupData.total}명의 고객이 등록되어 있습니다.
                </p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          회사명
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          웹사이트
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          상태
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          추가일
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {customerGroupData.members.map((member: CustomerGroupMemberWithLead) => (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {member.leadCompanyName || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {member.leadWebsiteUrl || "-"}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline">{member.leadStatus || "-"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatRelativeTime(member.addedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">등록된 고객이 없습니다.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
