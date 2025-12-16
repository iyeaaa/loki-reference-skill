import { ChevronLeft, ChevronRight, Edit, UserPlus, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { useCustomerGroups } from "@/lib/api/hooks/customer-groups"
import type { CustomerGroup, CustomerGroupsParams } from "@/lib/api/types/customer-group"
import { formatRelativeTime } from "@/lib/date-utils"

type CustomerGroupsTableWithPaginationProps = {
  searchQuery: string
  selectedCustomerGroups: string[]
  onToggleCustomerGroup: (customerGroupId: string) => void
  onToggleAll: (customerGroupIds: string[]) => void
  onEditCustomerGroup: (customerGroup: CustomerGroup) => void
  onAddMembers: (customerGroup: CustomerGroup) => void
}

export function CustomerGroupsTableWithPagination({
  searchQuery,
  selectedCustomerGroups,
  onToggleCustomerGroup,
  onToggleAll,
  onEditCustomerGroup,
  onAddMembers,
}: CustomerGroupsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
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
    limit,
    search: searchQuery || undefined,
    workspaceIds: workspaceFilter,
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
                  className="sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={
                      customerGroups.length > 0 &&
                      selectedCustomerGroups?.length === customerGroups.length
                    }
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "200px" }}
                >
                  그룹명
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "250px" }}
                >
                  설명
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  멤버 수
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ minWidth: "150px" }}
                >
                  워크스페이스
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  타입
                </th>
                <th
                  className="p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
                </th>
                <th
                  className="sticky right-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  작업
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
              {customerGroups.map((group) => (
                <tr
                  className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  key={group.id}
                >
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <Checkbox
                      checked={selectedCustomerGroups?.includes(group.id)}
                      onCheckedChange={() => onToggleCustomerGroup(group.id)}
                    />
                  </td>
                  <td
                    className="p-2 font-medium text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "250px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={group.name}
                  >
                    {group.name}
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={group.description || "-"}
                  >
                    {group.description || "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-900 text-sm dark:text-gray-100">
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-gray-400" />
                      <span>0</span>
                    </div>
                  </td>
                  <td
                    className="p-2 text-gray-900 text-sm dark:text-gray-100"
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={group.workspaceName || group.workspaceId || "-"}
                  >
                    {group.workspaceName || group.workspaceId || "-"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-sm">
                    <Badge variant="outline">{group.isDynamic ? "동적" : "정적"}</Badge>
                  </td>
                  <td className="whitespace-nowrap p-2 text-gray-500 text-xs dark:text-gray-400">
                    {formatRelativeTime(group.createdAt)}
                  </td>
                  <td className="sticky right-0 z-10 whitespace-nowrap bg-white p-2 text-sm dark:bg-gray-800">
                    <div className="flex gap-2">
                      <Button
                        className="h-8 px-3 text-xs"
                        onClick={() => onAddMembers(group)}
                        size="sm"
                        title="고객 추가"
                        variant="outline"
                      >
                        <UserPlus className="h-3 w-3" />
                      </Button>
                      <Button
                        className="h-8 px-3 text-xs"
                        onClick={() => onEditCustomerGroup(group)}
                        size="sm"
                        title="편집"
                        variant="outline"
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
