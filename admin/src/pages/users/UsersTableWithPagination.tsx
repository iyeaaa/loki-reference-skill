import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useUsers } from "@/lib/api/hooks/users"
import type { User, UserRole, UsersParams } from "@/lib/api/types/user"
import { formatRelativeTime } from "@/lib/date-utils"

type UsersTableWithPaginationProps = {
  searchQuery: string
  selectedRoles: string[]
  selectedStatuses: string[]
  selectedDepartments: string[]
  selectedUsers: string[]
  onToggleUser: (userId: string) => void
  onToggleAll: (userIds: string[]) => void
  onEditUser: (user: User) => void
}

export function UsersTableWithPagination({
  searchQuery,
  selectedRoles,
  selectedStatuses,
  selectedDepartments,
  selectedUsers,
  onToggleUser,
  onToggleAll,
  onEditUser,
}: UsersTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Build params for API call
  const params: UsersParams = {
    page: currentPage,
    limit,
    role:
      selectedRoles.length === 1
        ? (selectedRoles[0] as UserRole)
        : selectedRoles.length > 0
          ? "all"
          : undefined,
    status:
      selectedStatuses.length === 1
        ? selectedStatuses[0]
        : selectedStatuses.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    departmentIds: selectedDepartments.length > 0 ? selectedDepartments : undefined,
  }

  // Use React Query hook for fetching users
  const { data: usersData, isFetching } = useUsers(params)
  const users = usersData?.users || []
  const totalPages = usersData?.totalPages || 1
  const total = usersData?.total || 0

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin":
        return "관리자"
      default:
        return "사용자"
    }
  }

  const getRoleBadgeVariant = () => "outline" as const

  const handleToggleAll = useCallback(() => {
    onToggleAll(users.map((u) => u.id))
  }, [users, onToggleAll])

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
      {/* Users Table */}
      <div className="rounded-md border">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[40px]" />
            <col className="w-[15%] min-w-[120px]" />
            <col className="w-[25%] min-w-[200px]" />
            <col className="w-[80px]" />
            <col className="w-[80px]" />
            <col className="w-[100px]" />
            <col className="w-[100px]" />
            <col className="w-[60px]" />
          </colgroup>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="text-center">
                <Checkbox
                  checked={users.length > 0 && selectedUsers.length === users.length}
                  onCheckedChange={handleToggleAll}
                />
              </TableHead>
              <TableHead>사용자명</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>역할</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>최근로그인</TableHead>
              <TableHead>생성일</TableHead>
              <TableHead className="text-center">편집</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="text-center">
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => onToggleUser(user.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="line-clamp-3 break-words font-medium" title={user.username}>
                    {user.username}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="line-clamp-3 break-all text-muted-foreground" title={user.email}>
                    {user.email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className="text-xs" variant={getRoleBadgeVariant()}>
                    {getRoleText(user.userRole)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user.isActive ? "활성" : "비활성"}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatRelativeTime(user.lastLoginAt || null)}
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {formatRelativeTime(user.createdAt)}
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    className="h-8 w-8 p-0"
                    onClick={() => onEditUser(user)}
                    size="sm"
                    variant="outline"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
