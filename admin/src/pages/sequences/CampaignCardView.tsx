import {
  BarChart3,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit,
  Mail,
  Pause,
  Play,
  Users,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { useSequences, useUpdateSequence } from "@/lib/api/hooks/sequences"
import type { Sequence, SequenceStatus, SequencesParams } from "@/lib/api/types/sequence"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"

interface CampaignCardViewProps {
  searchQuery: string
  selectedStatuses: string[]
  selectedSequences?: string[]
  onToggleSequence?: (sequenceId: string) => void
  onEditSequence: (sequence: Sequence) => void
}

export function CampaignCardView({
  searchQuery,
  selectedStatuses,
  selectedSequences = [],
  onToggleSequence,
  onEditSequence,
}: CampaignCardViewProps) {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const updateSequence = useUpdateSequence()
  const limit = 8

  const workspaceFilter =
    !selectedWorkspace || selectedWorkspace.id === "all" ? undefined : [selectedWorkspace.id]

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

  const { data: sequencesData, isLoading, isFetching } = useSequences(params)

  const sequences = sequencesData?.sequences || []
  const totalPages = sequencesData?.totalPages || 1
  const total = sequencesData?.total || 0

  // Handle status toggle
  const handleStatusToggle = async (sequence: Sequence, e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = sequence.status === "active" ? "paused" : "active"
    try {
      await updateSequence.mutateAsync({
        sequenceId: sequence.id,
        data: { status: newStatus },
      })
    } catch (error) {
      console.error("Failed to update sequence status:", error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      case "ready":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      case "active":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
      case "paused":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
      case "completed":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
      case "archived":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <CheckCircle className="h-3 w-3" />
      case "paused":
        return <Pause className="h-3 w-3" />
      case "completed":
        return <CheckCircle className="h-3 w-3" />
      default:
        return <Clock className="h-3 w-3" />
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

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-4 bg-muted rounded w-3/4" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (sequences.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Mail className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-lg font-medium text-muted-foreground">캠페인이 없습니다</p>
        <p className="text-sm text-muted-foreground">
          "새 캠페인" 버튼을 눌러 첫 캠페인을 만들어보세요
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {sequences.map((sequence) => {
          const isActive = ["active", "paused", "completed", "archived"].includes(sequence.status)
          const progress = isActive
            ? sequence.completedEnrollmentsCount && sequence.enrollmentsCount
              ? (sequence.completedEnrollmentsCount / sequence.enrollmentsCount) * 100
              : 0
            : 0
          const isSelected = selectedSequences.includes(sequence.id)

          return (
            <Card key={sequence.id} className="hover:shadow-md transition-shadow relative">
              {/* Checkbox - 오른쪽 위 */}
              {onToggleSequence && (
                <div className="absolute top-3 right-3 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => onToggleSequence(sequence.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}

              <button
                type="button"
                className="cursor-pointer w-full text-left"
                onClick={() => onEditSequence(sequence)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-base line-clamp-1 flex-1">{sequence.name}</h3>
                    {onToggleSequence && <div className="w-6" />}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs flex items-center gap-1",
                        getStatusColor(sequence.status),
                      )}
                    >
                      {getStatusIcon(sequence.status)}
                      {t(`sequences.table.status.${sequence.status}`)}
                    </Badge>
                  </div>
                  {sequence.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {sequence.description}
                    </p>
                  )}
                </CardHeader>

                <CardContent className="pb-3">
                  <div className="space-y-2">
                    {/* Basic Info - 아이콘과 함께 깔끔하게 */}
                    <div className="flex items-center gap-1.5 text-xs">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground truncate">
                        {sequence.customerGroupName || "그룹 미지정"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs">
                      <Users className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">{sequence.enrollmentsCount || 0}명</span>
                    </div>

                    {/* Step Progress (if available) */}
                    {sequence.currentMaxStep !== undefined && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Mail className="h-4 w-4 text-indigo-500" />
                        <span className="font-medium">
                          {sequence.currentMaxStep}/{sequence.stepsCount || 0} 스텝
                        </span>
                      </div>
                    )}

                    {/* Progress Section */}
                    {isActive && (
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs">
                          <BarChart3 className="h-4 w-4 text-green-500" />
                          <span className="font-medium">
                            {sequence.completedEnrollmentsCount || 0}/
                            {sequence.enrollmentsCount || 0}
                          </span>
                          <span className="text-muted-foreground">진행중</span>
                        </div>
                        <Progress value={progress} className="h-1.5" />
                      </div>
                    )}

                    {/* Stats Section - Use new fields if available, fallback to aggregated */}
                    <div className="pt-3 border-t space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-blue-500" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">
                              {sequence.sentCount ?? sequence.totalSent ?? 0}
                            </span>
                            <span className="text-xs text-muted-foreground">발송</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-orange-500" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">
                              {sequence.deliveredCount && sequence.openedCount
                                ? `${Math.round((sequence.openedCount / sequence.deliveredCount) * 100)}%`
                                : sequence.openRate !== undefined
                                  ? `${sequence.openRate}%`
                                  : "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">오픈율</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-4 w-4 text-green-500" />
                          <div className="flex flex-col">
                            <span className="text-xs font-semibold">
                              {sequence.deliveredCount && sequence.repliedCount
                                ? `${Math.round((sequence.repliedCount / sequence.deliveredCount) * 100)}%`
                                : sequence.replyRate !== undefined
                                  ? `${sequence.replyRate}%`
                                  : "-"}
                            </span>
                            <span className="text-xs text-muted-foreground">회신율</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </button>

              <CardFooter className="pt-3 border-t flex-col gap-2 items-start">
                {/* 최종 수정일 */}
                <div className="w-full text-left text-xs text-muted-foreground">
                  {new Date(sequence.updatedAt).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>

                {/* Action Button - 중앙 정렬 */}
                {sequence.status === "active" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => handleStatusToggle(sequence, e)}
                  >
                    <Pause className="h-3.5 w-3.5 mr-1" />
                    일시정지
                  </Button>
                ) : sequence.status === "paused" ||
                  sequence.status === "ready" ||
                  sequence.status === "draft" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => handleStatusToggle(sequence, e)}
                  >
                    <Play className="h-3.5 w-3.5 mr-1" />
                    활성화
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditSequence(sequence)
                    }}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" />
                    편집
                  </Button>
                )}
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {/* Pagination */}
      <div className="mt-6 space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-center">
          <div className="text-sm text-muted-foreground">
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
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            {t("sequences.table.pagination.first")}
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
            {t("sequences.table.pagination.previous")}
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
            {t("sequences.table.pagination.next")}
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
            {t("sequences.table.pagination.last")}
          </Button>
        </div>

        {/* Page Jump */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("sequences.table.pagination.page")}
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
    </>
  )
}
