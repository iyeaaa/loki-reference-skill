import { Plus, Search, Trash2, UserPlus, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
// Import API and types
import {
  useCreateCustomerGroup,
  useDeleteCustomerGroup,
  useUpdateCustomerGroup,
} from "@/lib/api/hooks/customer-groups"
import type { CreateCustomerGroupRequest, CustomerGroup } from "@/lib/api/types/customer-group"
import { AddMembersDialog } from "./AddMembersDialog"
import { BulkActionModal } from "./BulkActionModal"
import { CustomerGroupFilters } from "./CustomerGroupFilters"
import { CustomerGroupForm } from "./CustomerGroupForm"
import { CustomerGroupsTableWithPagination } from "./CustomerGroupsTableWithPagination"

export default function CustomerGroupsPage() {
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCustomerGroup, setEditingCustomerGroup] = useState<CustomerGroup | null>(null)
  const [selectedCustomerGroups, setSelectedCustomerGroups] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"delete" | null>(null)
  const [showAddMembersDialog, setShowAddMembersDialog] = useState(false)
  const [addingMembersToGroup, setAddingMembersToGroup] = useState<CustomerGroup | null>(null)

  const createCustomerGroup = useCreateCustomerGroup()
  const updateCustomerGroup = useUpdateCustomerGroup()
  const deleteCustomerGroup = useDeleteCustomerGroup()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleCreateCustomerGroup = async (customerGroupData: unknown) => {
    createCustomerGroup.mutate(customerGroupData as CreateCustomerGroupRequest, {
      onSuccess: () => {
        setShowCreateDialog(false)
      },
    })
  }

  const handleUpdateCustomerGroup = async (customerGroupData: unknown) => {
    if (!editingCustomerGroup) return
    const data = customerGroupData as Partial<CustomerGroup>
    updateCustomerGroup.mutate(
      {
        groupId: editingCustomerGroup.id,
        data: {
          name: data.name || editingCustomerGroup.name,
          description: data.description,
          criteria: data.criteria,
          isDynamic: data.isDynamic ?? editingCustomerGroup.isDynamic,
        },
      },
      {
        onSuccess: () => {
          setEditingCustomerGroup(null)
        },
      }
    )
  }

  const handleBulkDelete = async () => {
    if (selectedCustomerGroups.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedCustomerGroups.length}개의 고객 그룹을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return

    for (const customerGroupId of selectedCustomerGroups) {
      await deleteCustomerGroup.mutateAsync(customerGroupId)
    }
    setSelectedCustomerGroups([])
  }

  const handleBulkAction = async (actionType: string) => {
    if (selectedCustomerGroups.length === 0) {
      toast.error("선택된 고객 그룹이 없습니다.")
      return
    }

    if (actionType === "delete") {
      await handleBulkDelete()
    }
  }

  // const _openBulkActionModal = (type: "delete") => {
  //   if (selectedCustomerGroups.length === 0) {
  //     toast.error("선택된 고객 그룹이 없습니다.")
  //     return
  //   }
  //   setBulkActionType(type)
  //   setShowBulkActionModal(true)
  // }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setSearchQuery(searchInput)
    }
  }

  // const _clearFilters = () => {
  //   setSearchInput("")
  //   setSearchQuery("")
  // }

  const toggleCustomerGroupSelection = useCallback((customerGroupId: string) => {
    setSelectedCustomerGroups((prev) =>
      prev.includes(customerGroupId)
        ? prev.filter((id) => id !== customerGroupId)
        : [...prev, customerGroupId]
    )
  }, [])

  const toggleAllCustomerGroups = useCallback((customerGroupIds: string[]) => {
    setSelectedCustomerGroups((prev) =>
      prev.length === customerGroupIds.length ? [] : customerGroupIds
    )
  }, [])

  const handleAddMembers = useCallback((customerGroup: CustomerGroup) => {
    setAddingMembersToGroup(customerGroup)
    setShowAddMembersDialog(true)
  }, [])

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters - 워크스페이스 필터 제거됨 */}
      <CustomerGroupFilters />

      {/* Customer Groups Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">고객 그룹 관리</CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              고객 그룹 생성
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="고객 그룹명으로 검색..."
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
          {selectedCustomerGroups.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedCustomerGroups.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
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

          {/* Single Group Quick Actions */}
          {selectedCustomerGroups.length === 1 && (
            <div className="flex items-center gap-4 mb-6 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700 font-medium">1개 그룹 선택됨</div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // Find the selected group
                    // const _group = selectedCustomerGroups[0]
                    // This will be implemented by passing the full customer group object
                    // For now, we can skip this as we have per-row buttons
                  }}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  고객 추가
                </Button>
              </div>
            </div>
          )}

          {/* Customer Groups Table with Pagination */}
          <CustomerGroupsTableWithPagination
            searchQuery={searchQuery}
            selectedCustomerGroups={selectedCustomerGroups}
            onToggleCustomerGroup={toggleCustomerGroupSelection}
            onToggleAll={toggleAllCustomerGroups}
            onEditCustomerGroup={setEditingCustomerGroup}
            onAddMembers={handleAddMembers}
          />
        </CardContent>
      </Card>

      {/* Create Customer Group Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">고객 그룹 생성</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <CustomerGroupForm
              isEdit={false}
              onSave={handleCreateCustomerGroup}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Group Dialog */}
      <Dialog open={!!editingCustomerGroup} onOpenChange={() => setEditingCustomerGroup(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">고객 그룹 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingCustomerGroup && (
              <CustomerGroupForm
                customerGroup={editingCustomerGroup}
                isEdit={true}
                onSave={handleUpdateCustomerGroup}
                onCancel={() => setEditingCustomerGroup(null)}
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
        customerGroupCount={selectedCustomerGroups.length}
        actionType={bulkActionType}
      />

      {/* Add Members Dialog */}
      <AddMembersDialog
        isOpen={showAddMembersDialog}
        onClose={() => {
          setShowAddMembersDialog(false)
          setAddingMembersToGroup(null)
        }}
        customerGroup={addingMembersToGroup}
        onSuccess={() => {
          // Optionally refresh the customer groups list
          toast.success("고객이 그룹에 추가되었습니다.")
        }}
      />
    </div>
  )
}
