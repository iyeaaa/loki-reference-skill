import { Plus, Search, Trash2, UserCheck, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBulkUpdateWorkspaceStatus,
  useCreateWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
} from "@/lib/api/hooks/workspaces"
import { usersApi } from "@/lib/api/services/users"
import type { User } from "@/lib/api/types/user"
import type { Workspace } from "@/lib/api/types/workspace"
import { BulkActionModal } from "./BulkActionModal"
import { WorkspaceFilters } from "./WorkspaceFilters"
import { WorkspaceForm } from "./WorkspaceForm"
import { WorkspacesTableWithPagination } from "./WorkspacesTableWithPagination"

export default function WorkspacesPage() {
  const [users, setUsers] = useState<User[]>([])

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])

  const [_showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"status" | null>(null)

  const createWorkspace = useCreateWorkspace()
  const updateWorkspace = useUpdateWorkspace()
  const deleteWorkspace = useDeleteWorkspace()
  const bulkUpdateStatus = useBulkUpdateWorkspaceStatus()

  const loadUsers = useCallback(async () => {
    try {
      const response = await usersApi.list({ limit: 1000 })
      setUsers(response.users || [])
    } catch (error) {
      console.error("Failed to load users:", error)
    }
  }, [])

  // Load initial data
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const _handleCreateWorkspace = async (workspaceData: unknown) => {
    createWorkspace.mutate(workspaceData as Workspace, {
      onSuccess: () => {
        setShowCreateDialog(false)
      },
    })
  }

  const handleUpdateWorkspace = async (workspaceData: unknown) => {
    if (!editingWorkspace) return
    updateWorkspace.mutate(
      {
        workspaceId: editingWorkspace.id,
        data: workspaceData as Workspace,
      },
      {
        onSuccess: () => {
          setEditingWorkspace(null)
        },
      }
    )
  }

  const handleBulkDelete = async () => {
    if (selectedWorkspaces.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedWorkspaces.length}개의 워크스페이스를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return

    for (const workspaceId of selectedWorkspaces) {
      await deleteWorkspace.mutateAsync(workspaceId)
    }
    setSelectedWorkspaces([])
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedWorkspaces.length === 0) {
      toast.error("선택된 워크스페이스가 없습니다.")
      return
    }

    if (actionType === "status") {
      const isActive = value === "active"
      bulkUpdateStatus.mutate(
        { workspaceIds: selectedWorkspaces, isActive },
        {
          onSuccess: () => {
            setSelectedWorkspaces([])
          },
        }
      )
    }
  }

  const openBulkActionModal = (type: "status") => {
    if (selectedWorkspaces.length === 0) {
      toast.error("선택된 워크스페이스가 없습니다.")
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
    setSelectedStatuses([])
    setSelectedOwners([])
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleWorkspaceSelection = useCallback((workspaceId: string) => {
    setSelectedWorkspaces((prev) =>
      prev.includes(workspaceId) ? prev.filter((id) => id !== workspaceId) : [...prev, workspaceId]
    )
  }, [])

  const toggleAllWorkspaces = useCallback((workspaceIds: string[]) => {
    setSelectedWorkspaces((prev) => (prev.length === workspaceIds.length ? [] : workspaceIds))
  }, [])

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <WorkspaceFilters
        selectedStatuses={selectedStatuses}
        selectedOwners={selectedOwners}
        users={users}
        onStatusChange={setSelectedStatuses}
        onOwnerChange={setSelectedOwners}
        onClearFilters={clearFilters}
      />

      {/* Workspaces Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">워크스페이스 관리</CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              워크스페이스 생성
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="워크스페이스명, 설명으로 검색..."
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
          {selectedWorkspaces.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedWorkspaces.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("status")}>
                  <UserCheck className="h-4 w-4 mr-1" />
                  상태 변경
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

          {/* Workspaces Table with Pagination */}
          <WorkspacesTableWithPagination
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            selectedOwners={selectedOwners}
            selectedWorkspaces={selectedWorkspaces}
            onToggleWorkspace={toggleWorkspaceSelection}
            onToggleAll={toggleAllWorkspaces}
            onEditWorkspace={setEditingWorkspace}
          />
        </CardContent>
      </Card>

      {/* Create Workspace Dialog */}
      <Dialog open={_showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">워크스페이스 생성</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <WorkspaceForm
              isEdit={false}
              users={users}
              onSave={_handleCreateWorkspace}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog open={!!editingWorkspace} onOpenChange={() => setEditingWorkspace(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">워크스페이스 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingWorkspace && (
              <WorkspaceForm
                workspace={editingWorkspace}
                isEdit={true}
                users={users}
                onSave={handleUpdateWorkspace}
                onCancel={() => setEditingWorkspace(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        workspaceCount={selectedWorkspaces.length}
        actionType={bulkActionType}
      />
    </div>
  )
}
