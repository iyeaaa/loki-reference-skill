"use client"

import { ChevronLeft, ChevronRight, Edit, Search, Shield, Trash2, UserCheck, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Import API and types
import { usersApi } from "@/lib/api/services/users"
import type {
  Department,
  Language,
  UpdateUserRequest,
  User,
  UserRole,
  UsersApiParams,
} from "@/lib/api/types/user"
import { formatRelativeTime } from "@/lib/date-utils"
import { BulkActionModal } from "./BulkActionModal"
import { PasswordChangeDialog } from "./PasswordChangeDialog"
import { UserFilters } from "./UserFilters"
import { UserForm } from "./UserForm"

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [languages, setLanguages] = useState<Language[]>([])

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [limit] = useState(10)

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<
    "status" | "role" | "department" | "edit_languages" | "review_languages" | null
  >(null)

  const loadUsers = useCallback(async () => {
    try {
      const params: UsersApiParams = {
        page: currentPage,
        limit: limit,
        roles: selectedRoles.length > 0 ? selectedRoles : undefined,
        statuses:
          selectedStatuses.length > 0
            ? selectedStatuses.map((s) => (s === "active" ? "true" : "false"))
            : undefined,
        departments: selectedDepartments.length > 0 ? selectedDepartments : undefined,
        search: search || undefined,
      }
      const response = await usersApi.getUsers(params)

      // Debug: Log the response
      console.log("Users API Response:", response)
      if (response.users && response.users.length > 0) {
        console.log("First user data:", {
          username: response.users[0].username,
          edit_languages: response.users[0].edit_languages,
          review_languages: response.users[0].review_languages,
        })
      }

      setUsers(response.users || [])
      setTotalPages(response.total_pages || 1)
      setTotal(response.total || 0)
    } catch (error) {
      toast.error("사용자 목록을 불러오는데 실패했습니다.")
      console.error("Failed to load users:", error)
    }
  }, [currentPage, limit, search, selectedRoles, selectedStatuses, selectedDepartments])

  const loadDepartments = useCallback(async () => {
    try {
      const response = await usersApi.getDepartments()
      setDepartments(response.departments || [])
    } catch (error) {
      console.error("Failed to load departments:", error)
    }
  }, [])

  const loadLanguages = useCallback(async () => {
    try {
      const response = await usersApi.getLanguages()
      setLanguages(response.languages || [])
    } catch (error) {
      console.error("Failed to load languages:", error)
    }
  }, [])

  // Load initial data
  useEffect(() => {
    Promise.all([loadUsers(), loadDepartments(), loadLanguages()]).finally(() => setLoading(false))
  }, [loadUsers, loadDepartments, loadLanguages])

  // Load users when filters change
  useEffect(() => {
    if (!loading) {
      loadUsers()
    }
  }, [loadUsers, loading])

  const handleUpdateUser = async (userData: unknown) => {
    if (!editingUser) return
    try {
      await usersApi.updateUser(editingUser.id, userData as UpdateUserRequest)
      toast.success("사용자가 수정되었습니다.")
      setEditingUser(null)
      await loadUsers()
    } catch (error) {
      toast.error("사용자 수정에 실패했습니다.")
      console.error("Failed to update user:", error)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedUsers.length}명의 사용자를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return

    try {
      await Promise.all(selectedUsers.map((userId) => usersApi.deleteUser(userId)))
      toast.success(`${selectedUsers.length}명의 사용자가 삭제되었습니다.`)
      setSelectedUsers([])
      await loadUsers()
    } catch {
      toast.error("사용자 삭제에 실패했습니다.")
    }
  }

  // const handleDeleteUser = async (user: User) => {
  //   if (!confirm(`${user.username} 사용자를 삭제하시겠습니까?`)) return
  //
  //   try {
  //     await usersApi.deleteUser(user.id)
  //     toast.success("사용자가 삭제되었습니다.")
  //     await loadUsers()
  //   } catch (error) {
  //     toast.error("사용자 삭제에 실패했습니다.")
  //     console.error('Failed to delete user:', error)
  //   }
  // }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedUsers.length === 0) {
      toast.error("선택된 사용자가 없습니다.")
      return
    }

    try {
      if (actionType === "status") {
        const isActive = value === "active"
        await usersApi.bulkUpdateStatus({ user_ids: selectedUsers, is_active: isActive })
        const action = isActive ? "활성화" : "비활성화"
        toast.success(`${selectedUsers.length}명의 사용자가 ${action}되었습니다.`)
      } else if (actionType === "role") {
        await usersApi.bulkUpdateRole({ user_ids: selectedUsers, user_role: value as UserRole })
        toast.success(`${selectedUsers.length}명의 사용자 역할이 변경되었습니다.`)
      } else if (actionType === "edit_languages" || actionType === "review_languages") {
        const updateData =
          actionType === "edit_languages"
            ? { user_ids: selectedUsers, edit_languages: value as string[] }
            : { user_ids: selectedUsers, review_languages: value as string[] }
        await usersApi.bulkUpdateLanguages(updateData)
        const languageType = actionType === "edit_languages" ? "편집" : "검수"
        toast.success(`${selectedUsers.length}명의 ${languageType} 언어가 변경되었습니다.`)
      }
      setSelectedUsers([])
      await loadUsers()
    } catch (error) {
      toast.error("일괄 변경에 실패했습니다.")
      console.error("Failed to bulk update:", error)
    }
  }

  const openBulkActionModal = (
    type: "status" | "role" | "department" | "edit_languages" | "review_languages"
  ) => {
    if (selectedUsers.length === 0) {
      toast.error("선택된 사용자가 없습니다.")
      return
    }
    setBulkActionType(type)
    setShowBulkActionModal(true)
  }

  const clearFilters = () => {
    setSelectedRoles([])
    setSelectedStatuses([])
    setSelectedDepartments([])
    setSearch("")
    setCurrentPage(1)
    setPageInputValue("1")
  }

  // Pagination input handlers
  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInputValue(e.target.value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handlePageInputSubmit()
    }
  }

  const handlePageInputBlur = () => {
    handlePageInputSubmit()
  }

  const handlePageInputSubmit = () => {
    const page = parseInt(pageInputValue, 10)
    const maxPage = totalPages
    if (page >= 1 && page <= maxPage) {
      setCurrentPage(page)
    } else {
      // Reset to current page if invalid
      setPageInputValue(currentPage.toString())
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    )
  }

  const toggleAllUsers = () => {
    setSelectedUsers((prev) => (prev.length === users.length ? [] : users.map((u) => u.id)))
  }

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin":
        return "관리자"
      case "internal_reviewer":
        return "내부 검수자"
      case "external_reviewer":
        return "외부 검수자"
      default:
        return "사용자"
    }
  }

  const getRoleBadgeVariant = () => {
    return "outline" as const
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <UserFilters
        selectedRoles={selectedRoles}
        selectedStatuses={selectedStatuses}
        selectedDepartments={selectedDepartments}
        departments={departments}
        onRoleChange={setSelectedRoles}
        onStatusChange={setSelectedStatuses}
        onDepartmentChange={setSelectedDepartments}
        onClearFilters={clearFilters}
      />

      {/* Users Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">사용자 관리</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="사용자명, 이메일, 사번으로 검색..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                  setPageInputValue("1")
                }}
                className="pl-10 w-full"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("")
                    setCurrentPage(1)
                    setPageInputValue("1")
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions and Count */}
          <div className="flex items-center gap-4 mb-6">
            {/* Selected count text - always visible, shown first */}
            <div className="text-sm text-muted-foreground">
              {selectedUsers.length > 0 ? (
                <span className="font-medium">{selectedUsers.length}명 선택됨</span>
              ) : (
                <span>총 {total}명의 사용자</span>
              )}
            </div>

            {/* Bulk Actions - shown when items are selected */}
            {selectedUsers.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("status")}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  상태 변경
                </Button>
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("role")}>
                  <Shield className="h-4 w-4 mr-1" />
                  역할 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionModal("department")}
                >
                  부서 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionModal("edit_languages")}
                >
                  편집 언어
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionModal("review_languages")}
                >
                  검수 언어
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  선택 삭제
                </Button>
              </div>
            )}
          </div>

          {/* Users Table */}
          <div className="rounded-md border">
            <div
              className="overflow-x-auto overflow-y-visible"
              style={{
                scrollbarGutter: "stable",
                WebkitOverflowScrolling: "touch",
              }}
            >
              <table className="w-full min-w-[1800px]">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                      <Checkbox
                        checked={users.length > 0 && selectedUsers.length === users.length}
                        onCheckedChange={toggleAllUsers}
                      />
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      사용자명
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      역할
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      부서
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      사번
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      편집언어
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      검수언어
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      최근로그인
                    </th>
                    <th className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      생성일
                    </th>
                    <th className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700">
                      편집
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUserSelection(user.id)}
                        />
                      </td>
                      <td
                        className="p-2 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[7rem]"
                        title={user.username}
                      >
                        {user.username}
                      </td>
                      <td
                        className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate max-w-[12rem]"
                        title={user.email}
                      >
                        {user.email}
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <Badge variant={getRoleBadgeVariant()} className="text-xs">
                          {getRoleText(user.user_role)}
                        </Badge>
                      </td>
                      <td
                        className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 truncate max-w-[9rem]"
                        title={user.department_name || "-"}
                      >
                        {user.department_name || "-"}
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {user.employee_id || "-"}
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-1 max-w-[11rem]">
                          {user.edit_languages && user.edit_languages.length > 0 ? (
                            user.edit_languages.map((lang) => {
                              const langInfo =
                                typeof lang === "string"
                                  ? languages.find((l) => l.code === lang)
                                  : lang
                              return (
                                <Badge
                                  key={
                                    langInfo?.code || (typeof lang === "string" ? lang : lang.code)
                                  }
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {langInfo?.name || (typeof lang === "string" ? lang : lang.name)}
                                </Badge>
                              )
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">없음</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <div className="flex flex-wrap gap-1 max-w-[11rem]">
                          {user.review_languages && user.review_languages.length > 0 ? (
                            user.review_languages.map((lang) => {
                              const langInfo =
                                typeof lang === "string"
                                  ? languages.find((l) => l.code === lang)
                                  : lang
                              return (
                                <Badge
                                  key={
                                    langInfo?.code || (typeof lang === "string" ? lang : lang.code)
                                  }
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {langInfo?.name || (typeof lang === "string" ? lang : lang.name)}
                                </Badge>
                              )
                            })
                          ) : (
                            <span className="text-xs text-muted-foreground">없음</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 whitespace-nowrap text-sm">
                        <Badge variant="outline">{user.is_active ? "활성" : "비활성"}</Badge>
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(user.last_login_at || null)}
                      </td>
                      <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(user.created_at)}
                      </td>
                      <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingUser(user)}
                          className="text-xs h-8 px-3"
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

          {/* Pagination - Always visible */}
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
                onClick={() => {
                  setCurrentPage(1)
                  setPageInputValue("1")
                }}
                disabled={currentPage === 1 || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                처음
              </Button>

              {/* Previous Page */}
              <Button
                onClick={() => {
                  const newPage = Math.max(1, currentPage - 1)
                  setCurrentPage(newPage)
                  setPageInputValue(newPage.toString())
                }}
                disabled={currentPage === 1 || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                <ChevronLeft className="h-4 w-4" />
                이전
              </Button>

              {/* Page Numbers */}
              {(() => {
                const maxVisiblePages = 5
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
                const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1)
                }

                const pages = []
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <Button
                      key={i}
                      onClick={() => {
                        setCurrentPage(i)
                        setPageInputValue(i.toString())
                      }}
                      disabled={loading}
                      variant={i === currentPage ? "default" : "outline"}
                      size="sm"
                      className="px-3 min-w-[40px]"
                    >
                      {i}
                    </Button>
                  )
                }
                return pages
              })()}

              {/* Next Page */}
              <Button
                onClick={() => {
                  const newPage = Math.min(totalPages, currentPage + 1)
                  setCurrentPage(newPage)
                  setPageInputValue(newPage.toString())
                }}
                disabled={currentPage >= totalPages || loading}
                variant="outline"
                size="sm"
                className="px-3"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>

              {/* Last Page */}
              <Button
                onClick={() => {
                  setCurrentPage(totalPages)
                  setPageInputValue(totalPages.toString())
                }}
                disabled={currentPage >= totalPages || loading}
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
                onChange={handlePageInputChange}
                onKeyDown={handlePageInputKeyDown}
                onBlur={handlePageInputBlur}
                className="w-20 h-8 text-sm text-center"
                disabled={loading}
              />
              <span className="text-sm text-muted-foreground">/ {totalPages || 1}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>사용자 수정</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserForm
              user={editingUser}
              isEdit={true}
              departments={departments}
              languages={languages}
              onSave={handleUpdateUser}
              onCancel={() => setEditingUser(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Password Change Dialog */}
      <Dialog open={!!passwordChangeUser} onOpenChange={() => setPasswordChangeUser(null)}>
        {passwordChangeUser && (
          <PasswordChangeDialog
            user={passwordChangeUser}
            onClose={() => setPasswordChangeUser(null)}
          />
        )}
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        userCount={selectedUsers.length}
        actionType={bulkActionType}
        departments={departments}
        languages={languages}
      />
    </div>
  )
}
