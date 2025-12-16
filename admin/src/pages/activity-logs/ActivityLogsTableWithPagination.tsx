import { ChevronLeft, ChevronRight, Eye } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useActivityLogs } from "@/lib/api/hooks/activity-logs"
import type { ActivityLog, ActivityLogsParams } from "@/lib/api/types/activity-log"
import { ACTION_TYPES, ENTITY_TYPES } from "@/lib/api/types/activity-log"
import { formatRelativeTime } from "@/lib/date-utils"

type ActivityLogsTableWithPaginationProps = {
  searchQuery: string
  selectedEntityTypes: string[]
  selectedActions: string[]
  selectedWorkspaces: string[]
  selectedUsers: string[]
}

export function ActivityLogsTableWithPagination({
  searchQuery,
  selectedEntityTypes,
  selectedActions,
  selectedWorkspaces,
  selectedUsers,
}: ActivityLogsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)
  const limit = 20

  // Build params for API call
  const params: ActivityLogsParams = {
    page: currentPage,
    limit,
    search: searchQuery || undefined,
    entityType: selectedEntityTypes.length === 1 ? selectedEntityTypes[0] : undefined,
    action: selectedActions.length === 1 ? selectedActions[0] : undefined,
    workspaceIds: selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined,
    userIds: selectedUsers.length > 0 ? selectedUsers : undefined,
  }

  const { data: logsData, isFetching } = useActivityLogs(params)
  const logs = logsData?.activityLogs || []
  const totalPages = logsData?.totalPages || 1
  const total = logsData?.total || 0

  const getEntityTypeLabel = (entityType: string) =>
    ENTITY_TYPES.find((e) => e.value === entityType)?.label || entityType

  const getActionLabel = (action: string) =>
    ACTION_TYPES.find((a) => a.value === action)?.label || action

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "created":
        return "default"
      case "updated":
        return "secondary"
      case "deleted":
        return "destructive"
      case "sent":
        return "default"
      default:
        return "outline"
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
    <>
      {/* Activity Logs Table */}
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
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "120px" }}
                >
                  시간
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "100px" }}
                >
                  사용자
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "120px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  엔티티
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  액션
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  엔티티 ID
                </th>
                <th
                  className="p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "100px" }}
                >
                  IP 주소
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-3 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {logs.length === 0 ? (
                <tr>
                  <td className="p-8 text-center text-gray-500 dark:text-gray-400" colSpan={8}>
                    {isFetching ? "로딩 중..." : "활동 로그가 없습니다."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                    key={log.id}
                  >
                    <td className="whitespace-nowrap p-3 text-gray-500 text-xs dark:text-gray-400">
                      {formatRelativeTime(log.createdAt)}
                    </td>
                    <td
                      className="p-3 font-medium text-gray-900 text-sm dark:text-gray-100"
                      style={{
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={log.userEmail || ""}
                    >
                      {log.userName || "-"}
                    </td>
                    <td
                      className="p-3 text-gray-900 text-sm dark:text-gray-100"
                      style={{
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={log.workspaceName || ""}
                    >
                      {log.workspaceName || "-"}
                    </td>
                    <td className="whitespace-nowrap p-3 text-sm">
                      <Badge className="text-xs" variant="outline">
                        {getEntityTypeLabel(log.entityType)}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap p-3 text-sm">
                      <Badge className="text-xs" variant={getActionBadgeVariant(log.action)}>
                        {getActionLabel(log.action)}
                      </Badge>
                    </td>
                    <td
                      className="p-3 font-mono text-gray-500 text-xs dark:text-gray-400"
                      style={{
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={log.entityId}
                    >
                      {log.entityId}
                    </td>
                    <td className="whitespace-nowrap p-3 text-gray-500 text-xs dark:text-gray-400">
                      {log.ipAddress || "-"}
                    </td>
                    <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-3 text-sm dark:bg-gray-800">
                      <Button
                        className="h-8 px-3 text-xs"
                        onClick={() => setSelectedLog(log)}
                        size="sm"
                        variant="outline"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
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

      {/* Detail Dialog */}
      <Dialog onOpenChange={() => setSelectedLog(null)} open={!!selectedLog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>활동 로그 상세</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-500 text-sm">ID</span>
                  <p className="font-mono text-sm">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">시간</span>
                  <p className="text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">사용자</span>
                  <p className="text-sm">
                    {selectedLog.userName || "-"}
                    {selectedLog.userEmail && (
                      <span className="ml-1 text-gray-400">({selectedLog.userEmail})</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">워크스페이스</span>
                  <p className="text-sm">{selectedLog.workspaceName || "-"}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">엔티티 타입</span>
                  <p className="text-sm">{getEntityTypeLabel(selectedLog.entityType)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">액션</span>
                  <p className="text-sm">
                    <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                      {getActionLabel(selectedLog.action)}
                    </Badge>
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="font-medium text-gray-500 text-sm">엔티티 ID</span>
                  <p className="break-all font-mono text-sm">{selectedLog.entityId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">IP 주소</span>
                  <p className="text-sm">{selectedLog.ipAddress || "-"}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-500 text-sm">User Agent</span>
                  <p className="truncate text-gray-500 text-sm" title={selectedLog.userAgent || ""}>
                    {selectedLog.userAgent || "-"}
                  </p>
                </div>
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <span className="font-medium text-gray-500 text-sm">상세 정보</span>
                  <pre className="mt-1 overflow-auto rounded bg-gray-100 p-3 text-xs dark:bg-gray-800">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
