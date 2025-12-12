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

interface ActivityLogsTableWithPaginationProps {
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
    limit: limit,
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

  const getEntityTypeLabel = (entityType: string) => {
    return ENTITY_TYPES.find((e) => e.value === entityType)?.label || entityType
  }

  const getActionLabel = (action: string) => {
    return ACTION_TYPES.find((a) => a.value === action)?.label || action
  }

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
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  시간
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  사용자
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  엔티티
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  액션
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  엔티티 ID
                </th>
                <th
                  className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  IP 주소
                </th>
                <th
                  className="sticky right-0 z-10 p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상세
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500 dark:text-gray-400">
                    {isFetching ? "로딩 중..." : "활동 로그가 없습니다."}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="p-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {formatRelativeTime(log.createdAt)}
                    </td>
                    <td
                      className="p-3 text-sm font-medium text-gray-900 dark:text-gray-100"
                      title={log.userEmail || ""}
                      style={{
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.userName || "-"}
                    </td>
                    <td
                      className="p-3 text-sm text-gray-900 dark:text-gray-100"
                      title={log.workspaceName || ""}
                      style={{
                        maxWidth: "150px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.workspaceName || "-"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm">
                      <Badge variant="outline" className="text-xs">
                        {getEntityTypeLabel(log.entityType)}
                      </Badge>
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm">
                      <Badge variant={getActionBadgeVariant(log.action)} className="text-xs">
                        {getActionLabel(log.action)}
                      </Badge>
                    </td>
                    <td
                      className="p-3 text-xs text-gray-500 dark:text-gray-400 font-mono"
                      title={log.entityId}
                      style={{
                        maxWidth: "200px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.entityId}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                      {log.ipAddress || "-"}
                    </td>
                    <td className="sticky right-0 z-10 p-3 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="text-xs h-8 px-3"
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>활동 로그 상세</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-500">ID</span>
                  <p className="text-sm font-mono">{selectedLog.id}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">시간</span>
                  <p className="text-sm">{new Date(selectedLog.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">사용자</span>
                  <p className="text-sm">
                    {selectedLog.userName || "-"}
                    {selectedLog.userEmail && (
                      <span className="text-gray-400 ml-1">({selectedLog.userEmail})</span>
                    )}
                  </p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">워크스페이스</span>
                  <p className="text-sm">{selectedLog.workspaceName || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">엔티티 타입</span>
                  <p className="text-sm">{getEntityTypeLabel(selectedLog.entityType)}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">액션</span>
                  <p className="text-sm">
                    <Badge variant={getActionBadgeVariant(selectedLog.action)}>
                      {getActionLabel(selectedLog.action)}
                    </Badge>
                  </p>
                </div>
                <div className="col-span-2">
                  <span className="text-sm font-medium text-gray-500">엔티티 ID</span>
                  <p className="text-sm font-mono break-all">{selectedLog.entityId}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">IP 주소</span>
                  <p className="text-sm">{selectedLog.ipAddress || "-"}</p>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-500">User Agent</span>
                  <p className="text-sm text-gray-500 truncate" title={selectedLog.userAgent || ""}>
                    {selectedLog.userAgent || "-"}
                  </p>
                </div>
              </div>
              {selectedLog.details && Object.keys(selectedLog.details).length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-500">상세 정보</span>
                  <pre className="mt-1 p-3 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-auto">
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
