import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useWorkspaces } from "@/lib/api/hooks/workspaces"
import type { Workspace, WorkspacesParams } from "@/lib/api/types/workspace"
import { formatRelativeTime } from "@/lib/date-utils"

type WorkspacesTableWithPaginationProps = {
  searchQuery: string
  selectedStatuses: string[]
  selectedOwners: string[]
  selectedWorkspaces: string[]
  onToggleWorkspace: (workspaceId: string) => void
  onToggleAll: (workspaceIds: string[]) => void
  onEditWorkspace: (workspace: Workspace) => void
}

export function WorkspacesTableWithPagination({
  searchQuery,
  selectedStatuses,
  selectedOwners,
  selectedWorkspaces,
  onToggleWorkspace,
  onToggleAll,
  onEditWorkspace,
}: WorkspacesTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  // userId is extracted from JWT token on the server for permission filtering
  const params: WorkspacesParams = {
    page: currentPage,
    limit,
    isActive:
      selectedStatuses.length === 1
        ? selectedStatuses[0] === "active"
        : selectedStatuses.length > 0
          ? undefined
          : undefined,
    search: searchQuery || undefined,
    ownerIds: selectedOwners.length > 0 ? selectedOwners : undefined,
  }

  // Use React Query hook for fetching workspaces
  const { data: workspacesData, isFetching } = useWorkspaces(params)
  const workspaces = workspacesData?.workspaces || []
  const totalPages = workspacesData?.totalPages || 1
  const total = workspacesData?.total || 0

  const handleToggleAll = useCallback(() => {
    onToggleAll(workspaces.map((w) => w.id))
  }, [workspaces, onToggleAll])

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
      {/* Workspaces Table */}
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
                    checked={
                      workspaces.length > 0 && selectedWorkspaces.length === workspaces.length
                    }
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  워크스페이스명
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  고객사명
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "220px" }}
                >
                  홈페이지
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "30%", minWidth: "250px" }}
                >
                  설명
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  소유자
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  수정일
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  편집
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {workspaces.map((workspace) => (
                <tr
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  key={workspace.id}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Checkbox
                      checked={selectedWorkspaces.includes(workspace.id)}
                      onCheckedChange={() => onToggleWorkspace(workspace.id)}
                    />
                  </td>
                  <td
                    className="p-2 font-medium text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={workspace.name}
                  >
                    {workspace.name}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={workspace.companyName || "-"}
                  >
                    {workspace.companyName || "-"}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "280px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={workspace.companyWebsite || "-"}
                  >
                    {workspace.companyWebsite ? (
                      <a
                        className="text-blue-600 hover:underline"
                        href={
                          workspace.companyWebsite.startsWith("http")
                            ? workspace.companyWebsite
                            : `https://${workspace.companyWebsite}`
                        }
                        rel="noreferrer"
                        target="_blank"
                      >
                        {workspace.companyWebsite}
                      </a>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    title={workspace.description || "-"}
                  >
                    {workspace.description ? (
                      <div className="line-clamp-3 break-words">{workspace.description}</div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={workspace.ownerUsername || workspace.ownerEmail || "-"}
                  >
                    {workspace.ownerUsername || workspace.ownerEmail || "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    <Badge variant="outline">{workspace.isActive ? "활성" : "비활성"}</Badge>
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(workspace.createdAt)}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(workspace.updatedAt)}
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Button
                      className="h-8 px-3 text-xs"
                      onClick={() => onEditWorkspace(workspace)}
                      size="sm"
                      variant="outline"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
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
    </>
  )
}
