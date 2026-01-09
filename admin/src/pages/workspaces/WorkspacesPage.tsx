import { ArrowLeft, Plus, Search, Trash2, UserCheck, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { UpgradePlanModal } from "@/components/UpgradePlanModal"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

type ViewMode = "list" | "create" | "edit"

export default function WorkspacesPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<User[]>([])

  // View mode state
  const [viewMode, setViewMode] = useState<ViewMode>("list")
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)

  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedOwners, setSelectedOwners] = useState<string[]>([])

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

  // Navigate to list view
  const goToList = () => {
    setViewMode("list")
    setEditingWorkspace(null)
  }

  // Navigate to edit view
  const goToEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace)
    setViewMode("edit")
  }

  // Navigate to create view
  const goToCreate = () => {
    setEditingWorkspace(null)
    setViewMode("create")
  }

  const handleCreateWorkspace = async (workspaceData: unknown) => {
    try {
      await workspacesApi.create(workspaceData as Workspace)
      toast.success("워크스페이스가 생성되었습니다")
      goToList()
      // 수동으로 쿼리 무효화
      window.location.reload()
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage?.includes("Trial users can only create 1 workspace")) {
        goToList()
        setShowUpgradeModal(true)
      } else {
        toast.error(errorMessage || "워크스페이스 생성에 실패했습니다")
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
          goToList()
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
      goToCreate()
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

      // API 응답: { success, data: { canCreate, ... } }
      const canCreate = result.data?.canCreate ?? result.canCreate
      if (canCreate) {
        // User can create workspace
        goToCreate()
      } else {
        // Trial limit reached - show upgrade modal
        setShowUpgradeModal(true)
      }
    } catch (error) {
      console.error("Failed to check trial limit:", error)
      // On error, just show the create form
      goToCreate()
    }
  }

  // Render create/edit form view
  if (viewMode === "create" || viewMode === "edit") {
    const isEdit = viewMode === "edit"
    return (
      <div className="h-full overflow-y-auto">
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <Button className="h-8 w-8 p-0" onClick={goToList} size="sm" variant="ghost">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-lg">
                  {isEdit ? t("settings.workspaces.edit") : t("settings.workspaces.create")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {isEdit
                    ? t("settings.workspaces.editDescription", "워크스페이스 정보를 수정합니다")
                    : t("settings.workspaces.createDescription", "새 워크스페이스를 생성합니다")}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <WorkspaceForm
              isEdit={isEdit}
              onAddMemberClick={() => setShowAddMemberDialog(true)}
              onCancel={goToList}
              onSave={isEdit ? handleUpdateWorkspace : handleCreateWorkspace}
              users={users}
              workspace={editingWorkspace || undefined}
            />
          </CardContent>
        </Card>

        {/* Add Member Dialog */}
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

  // Render list view
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
            onEditWorkspace={goToEdit}
            onToggleAll={toggleAllWorkspaces}
            onToggleWorkspace={toggleWorkspaceSelection}
            searchQuery={searchQuery}
            selectedOwners={selectedOwners}
            selectedStatuses={selectedStatuses}
            selectedWorkspaces={selectedWorkspaces}
          />
        </CardContent>
      </Card>

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

      {/* Upgrade Plan Modal */}
      <UpgradePlanModal onOpenChange={setShowUpgradeModal} open={showUpgradeModal} />
    </div>
  )
}
