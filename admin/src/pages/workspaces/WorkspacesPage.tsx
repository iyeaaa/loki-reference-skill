import { Plus, Search, Trash2, UserCheck, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { UpgradePlanModal } from "@/components/UpgradePlanModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBulkUpdateWorkspaceStatus,
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaceMembers,
} from "@/lib/api/hooks/workspaces"
import { usersApi } from "@/lib/api/services/users"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { User } from "@/lib/api/types/user"
import type { Workspace } from "@/lib/api/types/workspace"
import { AddMemberDialog } from "./AddMemberDialog"
import { BulkActionModal } from "./BulkActionModal"
import { WorkspaceFilters } from "./WorkspaceFilters"
import { WorkspaceForm } from "./WorkspaceForm"
import { WorkspacesTableWithPagination } from "./WorkspacesTableWithPagination"

export default function WorkspacesPage() {
  const { t } = useTranslation()
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
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  const updateWorkspace = useUpdateWorkspace()
  const deleteWorkspace = useDeleteWorkspace()
  const bulkUpdateStatus = useBulkUpdateWorkspaceStatus()

  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  // Fetch members for the editing workspace (only when editing)
  const { data: members = [] } = useWorkspaceMembers(editingWorkspace?.id || "", !!editingWorkspace)

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await usersApi.getAll()
      setUsers(allUsers || [])
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
    try {
      await workspacesApi.create(workspaceData as Workspace)
      toast.success("워크스페이스가 생성되었습니다")
      setShowCreateDialog(false)
      // 수동으로 쿼리 무효화
      window.location.reload()
    } catch (error: any) {
      if (error.message?.includes("Trial users can only create 1 workspace")) {
        setShowCreateDialog(false)
        setShowUpgradeModal(true)
      } else {
        toast.error(error.message || "워크스페이스 생성에 실패했습니다")
      }
    }
  }

  const handleUpdateWorkspace = async (workspaceData: unknown) => {
    if (!editingWorkspace) {
      return
    }
    updateWorkspace.mutate(
      {
        workspaceId: editingWorkspace.id,
        data: workspaceData as Workspace,
      },
      {
        onSuccess: () => {
          setEditingWorkspace(null)
        },
      },
    )
  }

  const handleBulkDelete = async () => {
    if (selectedWorkspaces.length === 0) {
      return
    }

    if (!confirm(t("settings.workspaces.deleteConfirm", { count: selectedWorkspaces.length }))) {
      return
    }

    for (const workspaceId of selectedWorkspaces) {
      await deleteWorkspace.mutateAsync(workspaceId)
    }
    setSelectedWorkspaces([])
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedWorkspaces.length === 0) {
      toast.error(t("settings.workspaces.noWorkspaceSelected"))
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
        },
      )
    }
  }

  const openBulkActionModal = (type: "status") => {
    if (selectedWorkspaces.length === 0) {
      toast.error(t("settings.workspaces.noWorkspaceSelected"))
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
      prev.includes(workspaceId) ? prev.filter((id) => id !== workspaceId) : [...prev, workspaceId],
    )
  }, [])

  const toggleAllWorkspaces = useCallback((workspaceIds: string[]) => {
    setSelectedWorkspaces((prev) => (prev.length === workspaceIds.length ? [] : workspaceIds))
  }, [])

  // Handle create workspace button click - check trial limit first
  const handleCreateWorkspaceClick = async () => {
    if (!userId) {
      setShowCreateDialog(true)
      return
    }

    try {
      // Check if user can create workspace (trial limit validation)
      const response = await fetch(
        `${window.location.origin}/api/v1/workspaces/can-create/${userId}`,
        {
          credentials: "include",
        },
      )
      const result = await response.json()

      if (result.canCreate) {
        // User can create workspace - show create dialog
        setShowCreateDialog(true)
      } else {
        // Trial limit reached - show upgrade modal
        setShowUpgradeModal(true)
      }
    } catch (error) {
      console.error("Failed to check trial limit:", error)
      // On error, just show the create dialog
      setShowCreateDialog(true)
    }
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Filters */}
      <WorkspaceFilters
        onClearFilters={clearFilters}
        onOwnerChange={setSelectedOwners}
        onStatusChange={setSelectedStatuses}
        selectedOwners={selectedOwners}
        selectedStatuses={selectedStatuses}
        users={users}
      />

      {/* Workspaces Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{t("settings.workspaces.management")}</CardTitle>
            <Button onClick={handleCreateWorkspaceClick}>
              <Plus className="mr-1 h-4 w-4" />
              {t("settings.workspaces.create")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
              <Input
                className="w-full pr-10 pl-10"
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("settings.workspaces.searchPlaceholder")}
                value={searchInput}
              />
              {searchInput && (
                <button
                  className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
                  onClick={() => {
                    setSearchInput("")
                    setSearchQuery("")
                  }}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedWorkspaces.length > 0 && (
            <div className="mb-6 flex items-center gap-4">
              <div className="text-muted-foreground text-sm">
                <span className="font-medium">
                  {t("settings.workspaces.selected", { count: selectedWorkspaces.length })}
                </span>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => openBulkActionModal("status")} size="sm" variant="outline">
                  <UserCheck className="mr-1 h-4 w-4" />
                  {t("settings.workspaces.changeStatus")}
                </Button>
                <Button
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={handleBulkDelete}
                  size="sm"
                  variant="outline"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  {t("settings.workspaces.deleteSelected")}
                </Button>
              </div>
            </div>
          )}

          {/* Workspaces Table with Pagination */}
          <WorkspacesTableWithPagination
            onEditWorkspace={setEditingWorkspace}
            onToggleAll={toggleAllWorkspaces}
            onToggleWorkspace={toggleWorkspaceSelection}
            searchQuery={searchQuery}
            selectedOwners={selectedOwners}
            selectedStatuses={selectedStatuses}
            selectedWorkspaces={selectedWorkspaces}
          />
        </CardContent>
      </Card>

      {/* Create Workspace Dialog */}
      <Dialog onOpenChange={(open) => setShowCreateDialog(open)} open={_showCreateDialog}>
        <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-semibold text-xl">
              {t("settings.workspaces.create")}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-6 flex-1 overflow-y-auto px-6">
            <WorkspaceForm
              isEdit={false}
              onCancel={() => setShowCreateDialog(false)}
              onSave={_handleCreateWorkspace}
              users={users}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Workspace Dialog */}
      <Dialog onOpenChange={(open) => !open && setEditingWorkspace(null)} open={!!editingWorkspace}>
        <DialogContent className="flex max-h-[90vh] max-w-4xl flex-col">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-semibold text-xl">
              {t("settings.workspaces.edit")}
            </DialogTitle>
          </DialogHeader>
          <div className="-mx-6 flex-1 overflow-y-auto px-6">
            {editingWorkspace && (
              <WorkspaceForm
                isEdit={true}
                onAddMemberClick={() => setShowAddMemberDialog(true)}
                onCancel={() => setEditingWorkspace(null)}
                onSave={handleUpdateWorkspace}
                users={users}
                workspace={editingWorkspace}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        actionType={bulkActionType}
        isOpen={showBulkActionModal}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        workspaceCount={selectedWorkspaces.length}
      />

      {/* Add Member Dialog - 최상위 레벨에서 독립적으로 관리 */}
      {editingWorkspace && (
        <AddMemberDialog
          existingMemberUserIds={members.map((m) => m.userId)}
          isOpen={showAddMemberDialog}
          onClose={() => setShowAddMemberDialog(false)}
          workspaceId={editingWorkspace.id}
        />
      )}

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal onOpenChange={setShowUpgradeModal} open={showUpgradeModal} />
    </div>
  )
}
