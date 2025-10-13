import { useQueryClient } from "@tanstack/react-query"
import { Download, Edit2, FileText, Plus, Search, Trash2, Upload, Users, X } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import toast from "react-hot-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  customerGroupKeys,
  useBulkAddGroupMembers,
  useBulkRemoveGroupMembers,
  useCreateCustomerGroup,
  useCustomerGroupsByWorkspace,
  useDeleteCustomerGroup,
  useUpdateCustomerGroup,
} from "@/lib/api/hooks/customer-groups"
import {
  leadKeys,
  useBulkDeleteLeads,
  useBulkUpdateLeadBusinessType,
  useBulkUpdateLeadStatus,
  useCreateLead,
  useUpdateLead,
} from "@/lib/api/hooks/leads"
import { customerGroupsApi } from "@/lib/api/services/customer-groups"
import { leadsApi } from "@/lib/api/services/leads"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { CreateCustomerGroupRequest, CustomerGroup } from "@/lib/api/types/customer-group"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type { Workspace } from "@/lib/api/types/workspace"
import { generateCSVTemplate, type LeadCSVData, parseCSV, validateCSVData } from "@/lib/csv-utils"
import { BulkActionModal } from "./BulkActionModal"
import { GroupEditModal } from "./GroupEditModal"
import { LeadForm } from "./LeadForm"
import { LeadGroupManagementModal } from "./LeadGroupManagementModal"
import { LeadsTableWithPagination } from "./LeadsTableWithPagination"

export default function LeadsPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    return localStorage.getItem("selectedWorkspace") || "all"
  })
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedStatuses, _setSelectedStatuses] = useState<string[]>([])
  const [selectedBusinessTypes, _setSelectedBusinessTypes] = useState<string[]>([])
  const [selectedCountries, _setSelectedCountries] = useState<string[]>([])
  const [selectedCities, _setSelectedCities] = useState<string[]>([])
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState<string>("")

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<"status" | "businessType" | null>(null)

  // CSV 업로드 관련 상태
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [csvData, setCsvData] = useState<LeadCSVData[] | null>(null)
  const [csvFileName, setCsvFileName] = useState("")
  const [csvFileSize, setCsvFileSize] = useState(0)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV 업로드용 그룹 선택 상태
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [isNewGroup, setIsNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")

  const [selectedGroupForNewLead, setSelectedGroupForNewLead] = useState("")

  // 그룹 편집/삭제 관련 상태
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)

  // 리드 그룹 관리 관련 상태
  const [managingLeadGroups, setManagingLeadGroups] = useState<Lead | null>(null)
  const [showLeadGroupModal, setShowLeadGroupModal] = useState(false)
  const [leadCurrentGroups, setLeadCurrentGroups] = useState<CustomerGroup[]>([])

  // Generate unique IDs for form elements
  const existingGroupId = useId()
  const newGroupId = useId()
  const groupSelectId = useId()
  const newGroupNameId = useId()
  const groupDescriptionId = useId()

  const queryClient = useQueryClient()
  const createLead = useCreateLead()
  const updateLead = useUpdateLead()
  // const _deleteLead = useDeleteLead()
  const bulkUpdateStatus = useBulkUpdateLeadStatus()
  const bulkUpdateBusinessType = useBulkUpdateLeadBusinessType()
  const bulkDeleteLeads = useBulkDeleteLeads()
  const createCustomerGroup = useCreateCustomerGroup()
  const updateCustomerGroup = useUpdateCustomerGroup()
  const deleteCustomerGroup = useDeleteCustomerGroup()
  const bulkAddGroupMembers = useBulkAddGroupMembers()
  const bulkRemoveGroupMembers = useBulkRemoveGroupMembers()

  // 고객 그룹 데이터 가져오기
  const { data: customerGroups } = useCustomerGroupsByWorkspace(
    selectedWorkspaceId !== "all" ? selectedWorkspaceId : "",
    selectedWorkspaceId !== "all",
  )

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
        // Hooks already handle cache invalidation
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
          // Hooks already handle cache invalidation
          setEditingLead(null)
        },
      },
    )
  }

  const handleBulkDelete = async () => {
    if (selectedLeads.length === 0) return

    if (
      !confirm(
        `선택한 ${selectedLeads.length}개의 리드를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`,
      )
    )
      return

    bulkDeleteLeads.mutate(selectedLeads, {
      onSuccess: () => {
        // Hooks already handle cache invalidation
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
            // Hooks already handle cache invalidation
            setSelectedLeads([])
          },
        },
      )
    } else if (actionType === "businessType") {
      bulkUpdateBusinessType.mutate(
        { leadIds: selectedLeads, businessType: value as string },
        {
          onSuccess: () => {
            // Hooks already handle cache invalidation
            setSelectedLeads([])
          },
        },
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

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }, [])

  const toggleAllLeads = useCallback((leadIds: string[]) => {
    setSelectedLeads((prev) => (prev.length === leadIds.length ? [] : leadIds))
  }, [])

  // CSV 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("CSV 파일만 업로드 가능합니다.")
      return
    }

    setIsProcessingCSV(true)
    setCsvErrors([])

    try {
      const text = await file.text()
      const parsedData = parseCSV(text)
      const validation = validateCSVData(parsedData)

      if (!validation.valid) {
        setCsvErrors(validation.errors)
        toast.error("CSV 파일에 오류가 있습니다.")
        return
      }

      setCsvData(parsedData)
      setCsvFileName(file.name)
      setCsvFileSize(file.size)
      toast.success(`${parsedData.length}개의 리드 데이터를 성공적으로 파싱했습니다.`)
    } catch (error) {
      console.error("CSV 파싱 오류:", error)
      toast.error("CSV 파일을 읽는 중 오류가 발생했습니다.")
    } finally {
      setIsProcessingCSV(false)
    }
  }

  const handleDownloadTemplate = () => {
    const template = generateCSVTemplate()
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", "leads_template.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleCSVUpload = async () => {
    if (!csvData || csvData.length === 0) return
    if (!isNewGroup && !groupName) return
    if (isNewGroup && !newGroupName.trim()) return

    try {
      const workspaceId =
        selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""

      let targetGroupId = groupName

      // 새 그룹 생성인 경우
      if (isNewGroup) {
        const groupData: CreateCustomerGroupRequest = {
          workspaceId,
          name: newGroupName,
          description: groupDescription || `CSV에서 가져온 ${csvData.length}개의 리드`,
          isDynamic: false,
        }
        const newGroup = await createCustomerGroup.mutateAsync(groupData)
        targetGroupId = newGroup.id
      }

      // 1. CSV 데이터로 리드 생성
      const createdLeads = await leadsApi.createFromCSV({
        workspaceId,
        leads: csvData,
      })

      // 2. 생성된 리드들을 선택된 그룹에 추가
      const leadIds = createdLeads.leads.map((lead) => lead.id)
      await customerGroupsApi.bulkAddMembers(targetGroupId, leadIds)

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: leadKeys.lists(),
      })
      await queryClient.invalidateQueries({
        queryKey: customerGroupKeys.all,
      })

      toast.success(
        `${csvData.length}개의 리드가 ${
          isNewGroup ? "새로 생성된 그룹" : "선택된 그룹"
        }에 성공적으로 추가되었습니다.`,
      )
      setShowCSVUpload(false)
      setCsvData(null)
      setGroupName("")
      setGroupDescription("")
      setIsNewGroup(false)
      setNewGroupName("")
    } catch (error) {
      console.error("CSV 업로드 오류:", error)
      toast.error("리드 추가 중 오류가 발생했습니다.")
    }
  }

  // 그룹 편집 핸들러
  const handleEditGroup = (group: CustomerGroup) => {
    setEditingGroup(group)
    setShowGroupEditModal(true)
  }

  const handleSaveGroupEdit = async (groupId: string, name: string, description: string) => {
    updateCustomerGroup.mutate(
      {
        groupId,
        data: {
          name,
          description,
          isDynamic: editingGroup?.isDynamic || false,
        },
      },
      {
        onSuccess: () => {
          // 그룹 목록 및 상세 정보 쿼리 갱신
          queryClient.invalidateQueries({
            queryKey: customerGroupKeys.all,
          })
          setShowGroupEditModal(false)
          setEditingGroup(null)
        },
      },
    )
  }

  // 그룹 삭제 핸들러
  const handleDeleteGroup = async (group: CustomerGroup) => {
    if (!confirm(`"${group.name}" 그룹을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`)) {
      return
    }
    deleteCustomerGroup.mutate(group.id, {
      onSuccess: () => {
        // 그룹 목록 쿼리 갱신
        queryClient.invalidateQueries({
          queryKey: customerGroupKeys.all,
        })
        // 삭제된 그룹이 선택되어 있었다면 선택 해제
        if (selectedCustomerGroup === group.id) {
          setSelectedCustomerGroup("")
        }
      },
    })
  }

  // 리드 그룹 관리 핸들러
  const handleManageLeadGroups = async (lead: Lead) => {
    try {
      // 현재 리드가 속한 그룹들을 가져옴
      const groups = await customerGroupsApi.getLeadGroups(lead.id)
      setLeadCurrentGroups(groups)
      setManagingLeadGroups(lead)
      setShowLeadGroupModal(true)
    } catch (error) {
      console.error("Failed to fetch lead groups:", error)
      toast.error("리드 그룹 정보를 가져오는데 실패했습니다.")
    }
  }

  const handleSaveLeadGroups = async (
    leadId: string,
    groupsToAdd: string[],
    groupsToRemove: string[],
  ) => {
    try {
      // 그룹에서 제거
      for (const groupId of groupsToRemove) {
        await bulkRemoveGroupMembers.mutateAsync({
          groupId,
          leadIds: [leadId],
        })
      }

      // 그룹에 추가
      for (const groupId of groupsToAdd) {
        await bulkAddGroupMembers.mutateAsync({
          groupId,
          leadIds: [leadId],
        })
      }

      // Refresh data
      await queryClient.invalidateQueries({
        queryKey: customerGroupKeys.all,
      })

      toast.success("리드 그룹이 업데이트되었습니다.")
    } catch (error) {
      console.error("Failed to update lead groups:", error)
      toast.error("리드 그룹 업데이트에 실패했습니다.")
      throw error
    }
  }

  return (
    <div className="space-y-6 h-full overflow-y-auto">
      {/* <LeadFilters
        selectedStatuses={selectedStatuses}
        selectedBusinessTypes={selectedBusinessTypes}
        selectedCountries={selectedCountries}
        selectedCities={selectedCities}
        onStatusChange={setSelectedStatuses}
        onBusinessTypeChange={setSelectedBusinessTypes}
        onCountryChange={setSelectedCountries}
        onCityChange={setSelectedCities}
        onClearFilters={clearFilters}
      /> */}

      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">리드 관리</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // 선택된 고객 그룹이 있다면 기본값으로 설정
                  if (selectedCustomerGroup) {
                    setGroupName(selectedCustomerGroup)
                    setIsNewGroup(false)
                  } else {
                    setIsNewGroup(true)
                  }
                  setNewGroupName("")
                  setGroupDescription("")
                  setShowCSVUpload(true)
                }}
              >
                <Upload className="h-4 w-4 mr-1" />
                CSV 업로드
              </Button>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />
                리드 생성
              </Button>
            </div>
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

          {/* 고객 그룹 선택 */}
          {selectedWorkspaceId !== "all" && customerGroups && customerGroups.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">고객 그룹 필터</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCustomerGroup("")}
                  className={`text-xs ${
                    selectedCustomerGroup === ""
                      ? "bg-violet-500/10 border-violet-500 text-violet-500 font-medium"
                      : "hover:bg-violet-500/5 hover:border-violet-500/50"
                  }`}
                >
                  전체
                </Button>
                {customerGroups.map((group) => (
                  <div key={group.id} className="inline-flex items-center gap-1 group/item">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedCustomerGroup(group.id)}
                      className={`text-xs relative ${
                        selectedCustomerGroup === group.id
                          ? "bg-violet-500/10 border-violet-500 text-violet-500 font-medium"
                          : "hover:bg-violet-500/5 hover:border-violet-500/50"
                      }`}
                    >
                      <Users
                        className={`h-3 w-3 mr-1 ${
                          selectedCustomerGroup === group.id ? "text-violet-500" : ""
                        }`}
                      />
                      {group.name}
                      {group.leadCount !== undefined && (
                        <span className="ml-1.5 text-xs opacity-70">({group.leadCount})</span>
                      )}
                    </Button>
                    <div className="opacity-0 group-hover/item:opacity-100 transition-opacity flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                        className="h-8 w-8 p-0 flex items-center justify-center hover:bg-blue-50 hover:text-blue-600"
                        title="편집"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteGroup(group)}
                        className="h-8 w-8 p-0 flex items-center justify-center hover:bg-red-50 hover:text-red-600"
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
            selectedCustomerGroup={selectedCustomerGroup}
            selectedLeads={selectedLeads}
            onToggleLead={toggleLeadSelection}
            onToggleAll={toggleAllLeads}
            onEditLead={setEditingLead}
            onManageGroups={handleManageLeadGroups}
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
              workspaceId={selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id}
              customerGroups={customerGroups || []}
              selectedGroup={selectedGroupForNewLead}
              onGroupChange={(value) => setSelectedGroupForNewLead(value === "none" ? "" : value)}
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

      {/* CSV Upload Dialog */}
      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">CSV 파일로 리드 추가</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] space-y-6">
            {/* 그룹 정보 입력 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">고객 그룹 정보</h3>

              {/* 그룹 생성 방식 선택 */}
              <div className="space-y-3">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={existingGroupId}
                      name="groupType"
                      checked={!isNewGroup}
                      onChange={() => setIsNewGroup(false)}
                      className="h-4 w-4 text-violet-600"
                    />
                    <Label htmlFor={existingGroupId} className="text-sm font-medium">
                      기존 그룹에 추가
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={newGroupId}
                      name="groupType"
                      checked={isNewGroup}
                      onChange={() => setIsNewGroup(true)}
                      className="h-4 w-4 text-violet-600"
                    />
                    <Label htmlFor={newGroupId} className="text-sm font-medium">
                      새 그룹 생성
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isNewGroup ? (
                  // 기존 그룹 선택
                  <div className="space-y-2">
                    <Label htmlFor={groupSelectId}>그룹 선택 *</Label>
                    <Select value={groupName} onValueChange={setGroupName}>
                      <SelectTrigger id={groupSelectId}>
                        <SelectValue placeholder="그룹을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {customerGroups?.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  // 새 그룹 이름 입력
                  <div className="space-y-2">
                    <Label htmlFor={newGroupNameId}>새 그룹 이름 *</Label>
                    <Input
                      id={newGroupNameId}
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="새 그룹 이름을 입력하세요"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={groupDescriptionId}>그룹 설명</Label>
                  <Input
                    id={groupDescriptionId}
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder="그룹에 대한 설명"
                  />
                </div>
              </div>
            </div>

            {/* CSV 업로드 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">CSV 파일 업로드</h3>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  템플릿 다운로드
                </Button>
              </div>

              {!csvData ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <div className="space-y-2">
                        <h4 className="text-lg font-medium">CSV 파일 업로드</h4>
                        <p className="text-sm text-muted-foreground">
                          리드 데이터가 포함된 CSV 파일을 업로드하여 그룹에 자동으로 추가하세요
                        </p>
                        <div className="pt-4">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessingCSV}
                          >
                            {isProcessingCSV ? "처리 중..." : "CSV 파일 선택"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium">{csvFileName}</p>
                          <p className="text-sm text-muted-foreground">
                            {(csvFileSize / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCsvData(null)
                          setCsvFileName("")
                          setCsvFileSize(0)
                          setCsvErrors([])
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{csvData.length}개 리드</Badge>
                        <span className="text-sm text-muted-foreground">파싱 완료</span>
                      </div>

                      {csvErrors.length > 0 && (
                        <Alert>
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium">다음 오류를 수정해주세요:</p>
                              <ul className="list-disc list-inside space-y-1">
                                {csvErrors.map((error, index) => (
                                  <li key={index} className="text-sm">
                                    {error}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="max-h-40 overflow-y-auto">
                        <div className="text-sm text-muted-foreground">
                          <p className="font-medium mb-2">미리보기 (처음 5개):</p>
                          <div className="space-y-1">
                            {csvData.slice(0, 5).map((lead, index) => (
                              <div key={index} className="p-2 bg-gray-50 rounded text-xs">
                                {lead.companyName} - {lead.primaryEmail || "이메일 없음"}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowCSVUpload(false)}>
              취소
            </Button>
            <Button
              onClick={handleCSVUpload}
              disabled={
                !csvData ||
                csvErrors.length > 0 ||
                (!isNewGroup && !groupName) ||
                (isNewGroup && !newGroupName.trim())
              }
            >
              리드 추가
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Edit Modal */}
      <GroupEditModal
        group={editingGroup}
        isOpen={showGroupEditModal}
        onClose={() => {
          setShowGroupEditModal(false)
          setEditingGroup(null)
        }}
        onSave={handleSaveGroupEdit}
      />

      {/* Lead Group Management Modal */}
      <LeadGroupManagementModal
        lead={managingLeadGroups}
        isOpen={showLeadGroupModal}
        onClose={() => {
          setShowLeadGroupModal(false)
          setManagingLeadGroups(null)
          setLeadCurrentGroups([])
        }}
        availableGroups={customerGroups || []}
        currentGroups={leadCurrentGroups}
        onSave={handleSaveLeadGroups}
      />
    </div>
  )
}
