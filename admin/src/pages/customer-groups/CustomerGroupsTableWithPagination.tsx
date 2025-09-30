import { ChevronLeft, ChevronRight, Edit, UserPlus, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useCustomerGroups } from "@/lib/api/hooks/customer-groups"
import type { CustomerGroup, CustomerGroupsParams } from "@/lib/api/types/customer-group"
import { formatRelativeTime } from "@/lib/date-utils"

interface CustomerGroupsTableWithPaginationProps {
  searchQuery: string
  selectedWorkspaces: string[]
  selectedCustomerGroups: string[]
  onToggleCustomerGroup: (customerGroupId: string) => void
  onToggleAll: (customerGroupIds: string[]) => void
  onEditCustomerGroup: (customerGroup: CustomerGroup) => void
  onAddMembers: (customerGroup: CustomerGroup) => void
}

export function CustomerGroupsTableWithPagination({
  searchQuery,
  selectedWorkspaces,
  selectedCustomerGroups,
  onToggleCustomerGroup,
  onToggleAll,
  onEditCustomerGroup,
  onAddMembers,
}: CustomerGroupsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all"
  )
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
  const params: CustomerGroupsParams = {
    page: currentPage,
    limit: limit,
    search: searchQuery || undefined,
    workspaceIds:
      workspaceFilter || (selectedWorkspaces.length > 0 ? selectedWorkspaces : undefined),
  }

  // Use React Query hook for fetching customer groups
  const { data: customerGroupsData, isFetching } = useCustomerGroups(params)
  const customerGroups = customerGroupsData?.customerGroups || []
  const totalPages = customerGroupsData?.totalPages || 1
  const total = customerGroupsData?.total || 0

  const handleToggleAll = useCallback(() => {
    onToggleAll(customerGroups.map((g) => g.id))
  }, [customerGroups, onToggleAll])

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
      {/* Customer Groups Table */}
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
                    checked={
                      customerGroups.length > 0 &&
                      selectedCustomerGroups.length === customerGroups.length
                    }
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  그룹명
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
                  멤버 수
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  타입
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
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
              {customerGroups.map((group) => (
                <tr
                  key={group.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Checkbox
                      checked={selectedCustomerGroups.includes(group.id)}
                      onCheckedChange={() => onToggleCustomerGroup(group.id)}
                    />
                  </td>
                  <td
                    className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                    title={group.name}
                    style={{
                      maxWidth: "250px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.name}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={group.description || "-"}
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.description || "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span>0</span>
                    </div>
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={group.workspaceId || "-"}
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {group.workspaceId || "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm">
                    <Badge variant="outline">{group.isDynamic ? "동적" : "정적"}</Badge>
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(group.createdAt)}
                  </td>
                  <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAddMembers(group)}
                        className="text-xs h-8 px-3"
                        title="고객 추가"
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditCustomerGroup(group)}
                        className="text-xs h-8 px-3"
                        title="편집"
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
    </>
  )
}
