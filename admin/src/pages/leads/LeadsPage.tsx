import { Plus, Search, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  useBulkDeleteLeads,
  useBulkUpdateLeadBusinessType,
  useBulkUpdateLeadStatus,
  useCreateLead,
  useUpdateLead,
} from "@/lib/api/hooks/leads"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type { Workspace } from "@/lib/api/types/workspace"
import { BulkActionModal } from "./BulkActionModal"
import { LeadFilters } from "./LeadFilters"
import { LeadForm } from "./LeadForm"
import { LeadsTableWithPagination } from "./LeadsTableWithPagination"

export default function LeadsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    return localStorage.getItem("selectedWorkspace") || "all"
  })
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedBusinessTypes, setSelectedBusinessTypes] = useState<string[]>([])
  const [selectedCountries, setSelectedCountries] = useState<string[]>([])
  const [selectedCities, setSelectedCities] = useState<string[]>([])

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"status" | "businessType" | null>(null)

  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  // const _deleteLead = useDeleteLead()
  const bulkUpdateStatus = useBulkUpdateLeadStatus()
  const bulkUpdateBusinessType = useBulkUpdateLeadBusinessType()
  const bulkDeleteLeads = useBulkDeleteLeads()

  const loadWorkspaces = useCallback(async () => {
    try {
      const response = await workspacesApi.list({ limit: 100 })
      setWorkspaces(response.workspaces || [])
    } catch (error) {
      console.error("Failed to load workspaces:", error)
    }
  }, [])

  useEffect(() => {
    loadWorkspaces()
  }, [loadWorkspaces])

  // localStorage의 selectedWorkspace 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      const newWorkspaceId = localStorage.getItem("selectedWorkspace") || "all"
      setSelectedWorkspaceId(newWorkspaceId)
    }

    // storage 이벤트 리스너 추가
    window.addEventListener("storage", handleStorageChange)

    // 컴포넌트가 포커스를 받을 때마다 확인
    const intervalId = setInterval(() => {
      const currentWorkspaceId = localStorage.getItem("selectedWorkspace") || "all"
      if (currentWorkspaceId !== selectedWorkspaceId) {
        setSelectedWorkspaceId(currentWorkspaceId)
      }
    }, 500)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      clearInterval(intervalId)
    }
  }, [selectedWorkspaceId])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  const handleCreateLead = async (leadData: unknown) => {
    createLead.mutate(leadData as Lead, {
      onSuccess: () => {
        setShowCreateDialog(false)
      },
    })
  }

  const handleUpdateLead = async (leadData: unknown) => {
    if (!editingLead) return
    updateLead.mutate(
      {
        leadId: editingLead.id,
        data: leadData as Partial<Lead>,
      },
      {
        onSuccess: () => {
          setEditingLead(null)
        },
      }
    )
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedLeads.length}개의 리드를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`
      )
    )
      return

    bulkDeleteLeads.mutate(selectedLeads, {
      onSuccess: () => {
        setSelectedLeads([])
      },
    })
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedLeads.length === 0) {
      toast.error("선택된 리드가 없습니다.")
      return
    }

    if (actionType === "status") {
      bulkUpdateStatus.mutate(
        { leadIds: selectedLeads, leadStatus: value as LeadStatus },
        {
          onSuccess: () => {
            setSelectedLeads([])
          },
        }
      )
    } else if (actionType === "businessType") {
      bulkUpdateBusinessType.mutate(
        { leadIds: selectedLeads, businessType: value as string },
        {
          onSuccess: () => {
            setSelectedLeads([])
          },
        }
      )
    }
  }

  const openBulkActionModal = (type: "status" | "businessType") => {
    if (selectedLeads.length === 0) {
      toast.error("선택된 리드가 없습니다.")
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
    setSelectedBusinessTypes([])
    setSelectedCountries([])
    setSelectedCities([])
    setSearchInput("")
    setSearchQuery("")
  }

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    )
  }, [])

  const toggleAllLeads = useCallback((leadIds: string[]) => {
    setSelectedLeads((prev) => (prev.length === leadIds.length ? [] : leadIds))
  }, [])

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* Filters */}
      <LeadFilters
        selectedStatuses={selectedStatuses}
        selectedBusinessTypes={selectedBusinessTypes}
        selectedCountries={selectedCountries}
        selectedCities={selectedCities}
        onStatusChange={setSelectedStatuses}
        onBusinessTypeChange={setSelectedBusinessTypes}
        onCountryChange={setSelectedCountries}
        onCityChange={setSelectedCities}
        onClearFilters={clearFilters}
      />

      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">리드 관리</CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />
              리드 생성
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search input - positioned below title */}
          <div className="mb-4">
            <div className="relative w-full md:w-[400px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="회사명, 이메일, 웹사이트로 검색..."
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
          {selectedLeads.length > 0 && (
            <div className="flex items-center gap-4 mb-6">
              <div className="text-sm text-muted-foreground">
                <span className="font-medium">{selectedLeads.length}개 선택됨</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openBulkActionModal("status")}>
                  상태 변경
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openBulkActionModal("businessType")}
                >
                  업종 변경
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

          {/* Leads Table with Pagination */}
          <LeadsTableWithPagination
            searchQuery={searchQuery}
            selectedStatuses={selectedStatuses}
            selectedBusinessTypes={selectedBusinessTypes}
            selectedCountries={selectedCountries}
            selectedCities={selectedCities}
            selectedLeads={selectedLeads}
            onToggleLead={toggleLeadSelection}
            onToggleAll={toggleAllLeads}
            onEditLead={setEditingLead}
          />
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">리드 생성</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            <LeadForm
              isEdit={false}
              workspaceId={
                selectedWorkspaceId !== "all" 
                  ? selectedWorkspaceId 
                  : workspaces[0]?.id
              }
              onSave={handleCreateLead}
              onCancel={() => setShowCreateDialog(false)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={!!editingLead} onOpenChange={() => setEditingLead(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">리드 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] px-1">
            {editingLead && (
              <LeadForm
                lead={editingLead}
                isEdit={true}
                onSave={handleUpdateLead}
                onCancel={() => setEditingLead(null)}
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
        leadCount={selectedLeads.length}
        actionType={bulkActionType}
      />
    </div>
  )
}
