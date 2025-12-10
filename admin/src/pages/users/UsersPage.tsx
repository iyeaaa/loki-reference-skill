import { Search, Shield, Trash2, UserCheck, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Import API and types
import {
  useBulkUpdateDepartment,
  useBulkUpdateRole,
  useBulkUpdateStatus,
  useDeleteUser,
  useUpdateUser,
} from "@/lib/api/hooks/users"
import { departmentsApi } from "@/lib/api/services/departments"
import type { Department, User } from "@/lib/api/types/user"
import { BulkActionModal } from "./BulkActionModal"
import { PasswordChangeDialog } from "./PasswordChangeDialog"
import { UserFilters } from "./UserFilters"
import { UserForm } from "./UserForm"
import { UsersTableWithPagination } from "./UsersTableWithPagination"

export default function UsersPage() {
  const [departments, setDepartments] = useState<Department[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([])

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [passwordChangeUser, setPasswordChangeUser] = useState<User | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<
    "status" | "role" | "department" | "edit_languages" | "review_languages" | null
  >(null)

  const updateUser = useUpdateUser()
  const deleteUser = useDeleteUser()
  const bulkUpdateStatus = useBulkUpdateStatus()
  const bulkUpdateRole = useBulkUpdateRole()
  const bulkUpdateDepartment = useBulkUpdateDepartment()

  const loadDepartments = useCallback(async () => {
    try {
      const response = await departmentsApi.list()
      setDepartments(response || [])
    } catch (error) {
      console.error("Failed to load departments:", error)
    }
  }, [])

  // Load initial data
  useEffect(() => {
    loadDepartments()
  }, [loadDepartments])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleUpdateUser = async (userData: unknown) => {
    if (!editingUser) return
    updateUser.mutate(
      {
        userId: editingUser.id,
        data: userData as Partial<User>,
      },
      {
        onSuccess: () => {
          setEditingUser(null)
        },
      },
    )
  }

  const handleBulkDelete = async () => {
    if (selectedUsers.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedUsers.length}명의 사용자를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
      )
    )
      return

    for (const userId of selectedUsers) {
      await deleteUser.mutateAsync(userId)
    }
    setSelectedUsers([])
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

    if (actionType === "status") {
      const isActive = value === "active"
      bulkUpdateStatus.mutate(
        { userIds: selectedUsers, isActive },
        {
          onSuccess: () => {
            setSelectedUsers([])
          },
        },
      )
    } else if (actionType === "role") {
      bulkUpdateRole.mutate(
        { userIds: selectedUsers, role: value as string },
        {
          onSuccess: () => {
            setSelectedUsers([])
          },
        },
      )
    } else if (actionType === "department") {
      bulkUpdateDepartment.mutate(
        { userIds: selectedUsers, departmentId: value as string },
        {
          onSuccess: () => {
            setSelectedUsers([])
          },
        },
      )
    }
  }

  const openBulkActionModal = (
    type: "status" | "role" | "department" | "edit_languages" | "review_languages",
  ) => {
    if (selectedUsers.length === 0) {
      toast.error("선택된 사용자가 없습니다.")
      return
    }
    setBulkActionType(type)
    setShowBulkActionModal(true)
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  const clearFilters = () => {
    setSelectedRoles([])
    setSelectedStatuses([])
    setSelectedDepartments([])
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleUserSelection = useCallback((userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }, [])

  const toggleAllUsers = useCallback((userIds: string[]) => {
    setSelectedUsers((prev) => (prev.length === userIds.length ? [] : userIds))
  }, [])

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
                placeholder="사용자명, 이메일로 검색..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="pl-10 pr-10 w-full"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedUsers.length}명 선택됨</span>
              </div>
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
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  선택 삭제
                </Button>
              </div>
            </div>
          )}

          {/* Users Table with Pagination */}
          <UsersTableWithPagination
            searchQuery={searchQuery}
            selectedRoles={selectedRoles}
            selectedStatuses={selectedStatuses}
            selectedDepartments={selectedDepartments}
            selectedUsers={selectedUsers}
            onToggleUser={toggleUserSelection}
            onToggleAll={toggleAllUsers}
            onEditUser={setEditingUser}
          />
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">사용자 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingUser && (
              <UserForm
                user={editingUser}
                isEdit={true}
                onSave={handleUpdateUser}
                onCancel={() => setEditingUser(null)}
              />
            )}
          </div>
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
      />
    </div>
  )
}
