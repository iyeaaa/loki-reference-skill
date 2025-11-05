import { useQueryClient } from "@tanstack/react-query"
import {
  Download,
  Edit2,
  FileText,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { AdvancedSearchInput } from "@/components/search/AdvancedSearchInput"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  useDownloadSelectedLeadsCSV,
  useUpdateLead,
} from "@/lib/api/hooks/leads"
import { useAllUsers } from "@/lib/api/hooks/users"
import { customerGroupsApi } from "@/lib/api/services/customer-groups"
import { leadsApi } from "@/lib/api/services/leads"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { CreateCustomerGroupRequest, CustomerGroup } from "@/lib/api/types/customer-group"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type { Workspace } from "@/lib/api/types/workspace"
import {
  generateCSVTemplate,
  generateXLSXTemplate,
  type LeadCSVData,
  parseCSV,
  parseXLSX,
  validateCSVData,
} from "@/lib/csv-utils"
import { analyzeCSVLeadsForGroupName } from "@/lib/utils/csv-lead-analyzer"
import { generateGroupName } from "@/lib/utils/group-name-generator"
import type { SearchToken } from "@/lib/utils/search-tokens"
import { tokensToFilters } from "@/lib/utils/search-tokens"
import { BulkActionModal } from "./BulkActionModal"
import { CreateGroupModal } from "./CreateGroupModal"
import { GroupEditModal } from "./GroupEditModal"
import { LeadForm } from "./LeadForm"
import { LeadGroupManagementModal } from "./LeadGroupManagementModal"
import { LeadsTableWithPagination } from "./LeadsTableWithPagination"
import { SequenceLaunchModal } from "./SequenceLaunchModal"

export default function LeadsPage() {
  const { t } = useTranslation()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    return localStorage.getItem("selectedWorkspace") || "all"
  })
  const [searchTokens, setSearchTokens] = useState<SearchToken[]>([])
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState<string>("")

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [showBulkActionModal, setShowBulkActionModal] = useState(false)
  const [bulkActionType, setBulkActionType] = useState<
    "status" | "businessType" | "copyToGroup" | null
  >(null)
  const [isSelectAllMode, setIsSelectAllMode] = useState(false)
  const [allLeadsSelected, setAllLeadsSelected] = useState(false)

  // 통합 Sheet 상태
  const [showAddLeadSheet, setShowAddLeadSheet] = useState(false)
  const [addLeadStep, setAddLeadStep] = useState<1 | 2 | 3>(1) // 1: 선택, 2: 입력, 3: 미리보기
  const [addLeadMode, setAddLeadMode] = useState<"upload" | "manual" | null>(null)
  const [previewLeadData, setPreviewLeadData] = useState<Lead | null>(null)

  // CSV 업로드 관련 상태
  const [showCSVUpload, setShowCSVUpload] = useState(false)
  const [csvData, setCsvData] = useState<LeadCSVData[] | null>(null)
  const [csvFileName, setCsvFileName] = useState("")
  const [csvFileSize, setCsvFileSize] = useState(0)
  const [isProcessingCSV, setIsProcessingCSV] = useState(false)
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [isUploadingLeads, setIsUploadingLeads] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // CSV 업로드용 그룹 선택 상태
  const [groupName, setGroupName] = useState("")
  const [groupDescription, setGroupDescription] = useState("")
  const [isNewGroup, setIsNewGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState("")
  const [isAutoGeneratedGroupName, setIsAutoGeneratedGroupName] = useState(false)
  const [isGeneratingGroupName, setIsGeneratingGroupName] = useState(false)

  const [selectedGroupForNewLead, setSelectedGroupForNewLead] = useState("")

  // 그룹 편집/삭제 관련 상태
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null)
  const [showGroupEditModal, setShowGroupEditModal] = useState(false)

  // 리드 그룹 관리 관련 상태
  const [managingLeadGroups, setManagingLeadGroups] = useState<Lead | null>(null)
  const [showLeadGroupModal, setShowLeadGroupModal] = useState(false)
  const [leadCurrentGroups, setLeadCurrentGroups] = useState<CustomerGroup[]>([])

  // 현재 로드된 리드 데이터 저장
  const [currentLeadsData, setCurrentLeadsData] = useState<Lead[]>([])
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0)

  // 페이지 크기 상태
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem("leadsPageSize")
    return saved ? parseInt(saved, 10) : 100
  })

  // 확인 다이얼로그 상태
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [groupDeleteConfirmOpen, setGroupDeleteConfirmOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<CustomerGroup | null>(null)

  // 시퀀스 발송 모달 상태
  const [showSequenceLaunchModal, setShowSequenceLaunchModal] = useState(false)
  const [sequenceLaunchGroup, setSequenceLaunchGroup] = useState<CustomerGroup | null>(null)

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
  const downloadSelectedLeadsCSV = useDownloadSelectedLeadsCSV()
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

  // 사용자 데이터 가져오기 (필요시 사용)
  useAllUsers()

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

  // Convert search tokens to column filters
  const columnFilters = useMemo(() => {
    return tokensToFilters(searchTokens)
  }, [searchTokens])

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
    if (selectedLeads.length === 0 && !allLeadsSelected) return
    setBulkDeleteConfirmOpen(true)
  }

  const confirmBulkDelete = async () => {
    if (allLeadsSelected) {
      // 전체 선택된 경우 - 서버에서 모든 리드를 가져와서 삭제
      try {
        const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id
        if (!workspaceId) {
          toast.error("워크스페이스를 선택해주세요.")
          return
        }

        // 모든 리드를 가져오기 위해 큰 limit 값 사용
        const allLeadsResponse = await leadsApi.list({
          page: 1,
          limit: 10000, // 충분히 큰 값
          workspaceIds: [workspaceId],
          customerGroupId: selectedCustomerGroup || undefined,
          filters: columnFilters.length > 0 ? JSON.stringify(columnFilters) : undefined,
        })

        if (allLeadsResponse.leads.length === 0) {
          toast.error("삭제할 리드 데이터가 없습니다.")
          return
        }

        // 모든 리드 삭제
        const allLeadIds = allLeadsResponse.leads.map((lead) => lead.id)
        bulkDeleteLeads.mutate(allLeadIds, {
          onSuccess: () => {
            // Hooks already handle cache invalidation
            setSelectedLeads([])
            setAllLeadsSelected(false)
            setIsSelectAllMode(false)
            toast.success(`전체 ${allLeadIds.length}개의 리드가 삭제되었습니다.`)
          },
        })
      } catch (error) {
        console.error("전체 리드 삭제 오류:", error)
        toast.error("전체 리드 삭제 중 오류가 발생했습니다.")
      }
    } else {
      // 개별 선택된 경우
      bulkDeleteLeads.mutate(selectedLeads, {
        onSuccess: () => {
          // Hooks already handle cache invalidation
          setSelectedLeads([])
          setAllLeadsSelected(false)
          setIsSelectAllMode(false)
        },
      })
    }
  }

  const handleBulkAction = async (actionType: string, value: string | string[]) => {
    if (selectedLeads.length === 0 && !allLeadsSelected) {
      toast.error("선택된 리드가 없습니다.")
      return
    }

    let leadIdsToProcess = selectedLeads

    // 전체 선택 모드인 경우 서버에서 모든 리드 가져오기
    if (allLeadsSelected) {
      try {
        const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id
        if (!workspaceId) {
          toast.error("워크스페이스를 선택해주세요.")
          return
        }

        const allLeadsResponse = await leadsApi.list({
          page: 1,
          limit: 10000,
          workspaceIds: [workspaceId],
          customerGroupId: selectedCustomerGroup || undefined,
          filters: columnFilters.length > 0 ? JSON.stringify(columnFilters) : undefined,
        })

        if (allLeadsResponse.leads.length === 0) {
          toast.error("처리할 리드 데이터가 없습니다.")
          return
        }

        leadIdsToProcess = allLeadsResponse.leads.map((lead) => lead.id)
      } catch (error) {
        console.error("전체 리드 조회 오류:", error)
        toast.error("전체 리드 조회 중 오류가 발생했습니다.")
        return
      }
    }

    if (actionType === "status") {
      bulkUpdateStatus.mutate(
        { leadIds: leadIdsToProcess, leadStatus: value as LeadStatus },
        {
          onSuccess: () => {
            // Hooks already handle cache invalidation
            setSelectedLeads([])
            setAllLeadsSelected(false)
            setIsSelectAllMode(false)
          },
        },
      )
    } else if (actionType === "businessType") {
      bulkUpdateBusinessType.mutate(
        { leadIds: leadIdsToProcess, businessType: value as string },
        {
          onSuccess: () => {
            // Hooks already handle cache invalidation
            setSelectedLeads([])
            setAllLeadsSelected(false)
            setIsSelectAllMode(false)
          },
        },
      )
    } else if (actionType === "copyToGroup") {
      bulkAddGroupMembers.mutate(
        { groupId: value as string, leadIds: leadIdsToProcess },
        {
          onSuccess: () => {
            toast.success(`${leadIdsToProcess.length}개의 리드가 그룹에 추가되었습니다.`)
            setSelectedLeads([])
            setAllLeadsSelected(false)
            setIsSelectAllMode(false)
          },
        },
      )
    }
  }

  const openBulkActionModal = (type: "status" | "businessType" | "copyToGroup") => {
    if (selectedLeads.length === 0 && !allLeadsSelected) {
      toast.error("선택된 리드가 없습니다.")
      return
    }
    setBulkActionType(type)
    setShowBulkActionModal(true)
  }

  const toggleLeadSelection = useCallback((leadId: string) => {
    setSelectedLeads((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }, [])

  const toggleAllLeads = useCallback((leadIds: string[]) => {
    setSelectedLeads((prev) => (prev.length === leadIds.length ? [] : leadIds))
  }, [])

  // 전체 선택 모드 토글
  const toggleSelectAllMode = useCallback(() => {
    if (isSelectAllMode) {
      // 전체 선택 모드 해제
      setIsSelectAllMode(false)
      setAllLeadsSelected(false)
      setSelectedLeads([])
    } else {
      // 전체 선택 모드 활성화
      setIsSelectAllMode(true)
      setAllLeadsSelected(true)
    }
  }, [isSelectAllMode])

  // 페이지 크기 변경 핸들러
  const handlePageSizeChange = useCallback((newSize: number) => {
    if (newSize >= 1 && newSize <= 10000) {
      setPageSize(newSize)
      localStorage.setItem("leadsPageSize", String(newSize))
    }
  }, [])

  // 전체 리드 선택/해제
  const handleSelectAllLeads = useCallback(() => {
    if (allLeadsSelected) {
      setAllLeadsSelected(false)
      setSelectedLeads([])
    } else {
      setAllLeadsSelected(true)
      // 전체 선택 모드에서는 실제로는 모든 리드를 선택하는 것이므로
      // selectedLeads는 빈 배열로 두고, allLeadsSelected 상태로 관리
      setSelectedLeads([])
    }
  }, [allLeadsSelected])

  // 선택된 리드들 CSV 다운로드 핸들러
  const handleDownloadSelectedLeadsCSV = async () => {
    if (selectedLeads.length === 0 && !allLeadsSelected) {
      toast.error("다운로드할 리드를 선택해주세요.")
      return
    }

    if (allLeadsSelected) {
      // 전체 선택된 경우 - 서버에서 모든 리드를 가져와서 다운로드
      try {
        const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id
        if (!workspaceId) {
          toast.error("워크스페이스를 선택해주세요.")
          return
        }

        // 모든 리드를 가져오기 위해 큰 limit 값 사용
        const allLeadsResponse = await leadsApi.list({
          page: 1,
          limit: 10000, // 충분히 큰 값
          workspaceIds: [workspaceId],
          customerGroupId: selectedCustomerGroup || undefined,
          filters: columnFilters.length > 0 ? JSON.stringify(columnFilters) : undefined,
        })

        if (allLeadsResponse.leads.length === 0) {
          toast.error("다운로드할 리드 데이터가 없습니다.")
          return
        }

        // 모든 리드 데이터로 CSV 다운로드
        downloadSelectedLeadsCSV.mutate({
          leadIds: allLeadsResponse.leads.map((lead) => lead.id),
          leadsData: allLeadsResponse.leads,
        })
      } catch (error) {
        console.error("전체 리드 다운로드 오류:", error)
        toast.error("전체 리드 다운로드 중 오류가 발생했습니다.")
      }
    } else {
      // 개별 선택된 경우
      downloadSelectedLeadsCSV.mutate({
        leadIds: selectedLeads,
        leadsData: currentLeadsData,
      })
    }
  }

  // Auto-generate group name from CSV data
  const generateGroupNameFromCSV = useCallback(async () => {
    if (!csvData || csvData.length === 0) return

    setIsGeneratingGroupName(true)
    try {
      const template = analyzeCSVLeadsForGroupName(csvData)
      const generatedName = generateGroupName(template)
      setNewGroupName(generatedName)
      setIsAutoGeneratedGroupName(true)
    } catch (error) {
      console.error("Failed to generate group name:", error)
      // Silently fail, user can still enter name manually
    } finally {
      setIsGeneratingGroupName(false)
    }
  }, [csvData])

  // Auto-generate group name when CSV is loaded and "Create New Group" is selected
  useEffect(() => {
    if (csvData && csvData.length > 0 && isNewGroup) {
      generateGroupNameFromCSV()
    }
  }, [csvData, isNewGroup, generateGroupNameFromCSV])

  // 파일 업로드 핸들러 (CSV, XLSX 지원)
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const fileName = file.name.toLowerCase()
    const isCSV = fileName.endsWith(".csv")
    const isXLSX = fileName.endsWith(".xlsx") || fileName.endsWith(".xls")

    if (!isCSV && !isXLSX) {
      toast.error("CSV 또는 XLSX 파일만 업로드 가능합니다.")
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("파일 크기는 10MB를 초과할 수 없습니다.")
      return
    }

    setIsProcessingCSV(true)
    setCsvErrors([])

    try {
      let parsedData: LeadCSVData[]

      if (isCSV) {
        const text = await file.text()
        parsedData = parseCSV(text)
      } else {
        parsedData = await parseXLSX(file)
      }

      const validation = validateCSVData(parsedData)

      if (!validation.valid) {
        setCsvErrors(validation.errors)
        toast.error("파일에 오류가 있습니다.")
        return
      }

      // 경고가 있는 경우 표시
      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warning) => {
          console.warn(warning)
        })
      }

      setCsvData(parsedData)
      setCsvFileName(file.name)
      setCsvFileSize(file.size)
      toast.success(`${parsedData.length}개의 리드 데이터를 성공적으로 파싱했습니다.`)
    } catch (error) {
      console.error("파일 파싱 오류:", error)
      const errorMessage =
        error instanceof Error ? error.message : "파일을 읽는 중 오류가 발생했습니다."
      toast.error(errorMessage)
    } finally {
      setIsProcessingCSV(false)
    }
  }

  const handleDownloadTemplate = (format: "csv" | "xlsx") => {
    if (format === "csv") {
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
    } else {
      const blob = generateXLSXTemplate()
      const link = document.createElement("a")
      const url = URL.createObjectURL(blob)
      link.setAttribute("href", url)
      link.setAttribute("download", "leads_template.xlsx")
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleCSVUpload = async () => {
    if (!csvData || csvData.length === 0) return
    if (!isNewGroup && !groupName) return

    setIsUploadingLeads(true)
    toast.success(`${csvData.length}개의 리드를 처리 중입니다. 잠시만 기다려주세요...`)

    try {
      const workspaceId =
        selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""

      let targetGroupId = groupName

      // 새 그룹 생성인 경우
      if (isNewGroup) {
        // If no group name is provided, generate one automatically
        let finalGroupName = newGroupName.trim()
        if (!finalGroupName) {
          const template = analyzeCSVLeadsForGroupName(csvData)
          finalGroupName = generateGroupName(template)
        }

        const groupData: CreateCustomerGroupRequest = {
          workspaceId,
          name: finalGroupName,
          description: groupDescription || `CSV에서 가져온 ${csvData.length}개의 리드`,
          isDynamic: false,
        }
        const newGroup = await createCustomerGroup.mutateAsync(groupData)
        targetGroupId = newGroup.id
      }

      // 1. CSV 데이터로 리드 생성 (배치 처리) - 고객 그룹에 직접 추가
      console.log("🔍 CSV 업로드 디버깅:", {
        workspaceId,
        leadsCount: csvData.length,
        customerGroupId: targetGroupId,
        isNewGroup: isNewGroup,
        groupName: groupName,
        groupDescription: groupDescription,
      })

      // 대용량 데이터 처리를 위한 배치 처리 (10개씩으로 감소)
      const BATCH_SIZE = 10
      const totalBatches = Math.ceil(csvData.length / BATCH_SIZE)
      const MAX_RETRIES = 2

      console.log(
        `📦 배치 처리 시작: ${csvData.length}개 리드를 ${totalBatches}개 배치로 나누어 처리`,
      )

      let successCount = 0
      let errorCount = 0

      for (let i = 0; i < totalBatches; i++) {
        const start = i * BATCH_SIZE
        const end = Math.min(start + BATCH_SIZE, csvData.length)
        const batch = csvData.slice(start, end)

        console.log(`📦 배치 ${i + 1}/${totalBatches} 처리 중: ${batch.length}개 리드`)

        let batchSuccess = false
        let retryCount = 0

        // 재시도 로직
        while (!batchSuccess && retryCount <= MAX_RETRIES) {
          try {
            await leadsApi.createFromCSV({
              workspaceId,
              leads: batch,
              customerGroupId: targetGroupId,
            })
            successCount += batch.length
            batchSuccess = true
            console.log(`✅ 배치 ${i + 1} 성공: ${batch.length}개 리드 추가됨`)
          } catch (error) {
            retryCount++
            console.error(`❌ 배치 ${i + 1} 실패 (시도 ${retryCount}/${MAX_RETRIES + 1}):`, error)

            if (retryCount <= MAX_RETRIES) {
              console.log(`🔄 배치 ${i + 1} 재시도 중... (${retryCount}/${MAX_RETRIES})`)
              // 재시도 전 지연 (지수 백오프)
              await new Promise((resolve) => setTimeout(resolve, 1000 * retryCount))
            } else {
              errorCount += batch.length
              console.error(`❌ 배치 ${i + 1} 최종 실패: ${MAX_RETRIES + 1}회 시도 후 포기`)
            }
          }
        }

        // 배치 간 지연 (서버 부하 방지) - 지연 시간 증가
        if (i < totalBatches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500)) // 200ms → 500ms
        }
      }

      console.log(`📊 배치 처리 완료: 성공 ${successCount}개, 실패 ${errorCount}개`)

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

      // 더 구체적인 오류 메시지 표시
      let errorMessage = "리드 추가 중 오류가 발생했습니다."

      if (error instanceof Error) {
        if (error.message.includes("timeout")) {
          errorMessage =
            "요청 시간이 초과되었습니다. 리드 개수가 많아서 시간이 오래 걸릴 수 있습니다."
        } else if (error.message.includes("memory")) {
          errorMessage =
            "메모리 부족으로 인해 처리할 수 없습니다. 리드 개수를 줄여서 다시 시도해주세요."
        } else if (error.message.includes("database")) {
          errorMessage = "데이터베이스 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
        } else {
          errorMessage = `오류: ${error.message}`
        }
      }

      toast.error(errorMessage)
    } finally {
      setIsUploadingLeads(false)
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
    setGroupToDelete(group)
    setGroupDeleteConfirmOpen(true)
  }

  const confirmGroupDelete = () => {
    if (!groupToDelete) return

    deleteCustomerGroup.mutate(groupToDelete.id, {
      onSuccess: () => {
        // 그룹 목록 쿼리 갱신
        queryClient.invalidateQueries({
          queryKey: customerGroupKeys.all,
        })
        // 삭제된 그룹이 선택되어 있었다면 선택 해제
        if (selectedCustomerGroup === groupToDelete.id) {
          setSelectedCustomerGroup("")
        }
        setGroupToDelete(null)
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
      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-4">
          {/* 고객 그룹 선택 - 탭 형태 */}
          <div className="flex items-center justify-between mb-4">
            <Tabs
              value={selectedCustomerGroup || "all"}
              onValueChange={(value) => setSelectedCustomerGroup(value === "all" ? "" : value)}
              className="flex-1"
            >
              <TabsList className="inline-flex h-auto items-center justify-start gap-2 bg-transparent p-0 w-auto">
                <TabsTrigger
                  value="all"
                  className="text-xs h-9 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-violet-600 data-[state=active]:text-white data-[state=active]:hover:bg-violet-700"
                >
                  {t("leads.group.all")}
                  {!selectedCustomerGroup && totalLeadsCount > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">({totalLeadsCount})</span>
                  )}
                </TabsTrigger>
                {selectedWorkspaceId !== "all" &&
                  customerGroups?.map((group) => (
                    <ContextMenu key={group.id}>
                      <ContextMenuTrigger asChild>
                        <TabsTrigger
                          value={group.id}
                          className={`text-xs h-9 px-4 border border-input bg-background hover:bg-accent hover:text-accent-foreground ${selectedCustomerGroup === group.id ? "bg-violet-600 text-white hover:bg-violet-700" : ""}`}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          {group.name}
                          {group.leadCount !== undefined && (
                            <span className="ml-1.5 text-xs opacity-70">({group.leadCount})</span>
                          )}
                        </TabsTrigger>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          onClick={() => handleEditGroup(group)}
                          className="cursor-pointer"
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          {t("leads.button.editGroup")}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onClick={() => handleDeleteGroup(group)}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("leads.button.deleteGroup")}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                <CreateGroupModal
                  workspaces={workspaces}
                  selectedWorkspaceId={selectedWorkspaceId}
                  selectedLeadIds={selectedLeads}
                  currentLeadsData={currentLeadsData.map((lead: Lead) => ({
                    id: lead.id,
                    companyName: lead.companyName || "",
                  }))}
                  onSuccess={(groupId) => {
                    // 생성된 그룹을 자동으로 선택
                    setSelectedCustomerGroup(groupId)
                    // 선택된 리드들 초기화
                    setSelectedLeads([])
                  }}
                />
              </TabsList>
            </Tabs>
            {selectedWorkspaceId !== "all" && (
              <div className="flex gap-2 ml-4">
                {/* 시퀀스 이메일 발송 버튼 - 특정 그룹 선택 시에만 표시 */}
                {selectedCustomerGroup && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const group = customerGroups?.find((g) => g.id === selectedCustomerGroup)
                      if (group) {
                        setSequenceLaunchGroup(group)
                        setShowSequenceLaunchModal(true)
                      }
                    }}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    시퀀스 이메일 발송
                  </Button>
                )}
              </div>
            )}
          </div>
          {selectedWorkspaceId !== "all" && customerGroups && customerGroups.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4 bg-gray-50 rounded-md mb-4">
              {t("leads.group.noGroups")}
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            {/* 고급 검색 */}
            <div className="flex-auto">
              <AdvancedSearchInput
                tokens={searchTokens}
                onChange={setSearchTokens}
                placeholder={t("leads.search.placeholder")}
              />
            </div>
            <div className="gap-2">
              <Button
                onClick={() => {
                  setShowAddLeadSheet(true)
                  setAddLeadStep(1)
                  setAddLeadMode(null)
                  setPreviewLeadData(null)
                  setCsvData(null)
                }}
                className="transition-all duration-200 hover:scale-105 active:scale-95"
              >
                <Plus className="h-4 w-4 mr-1" />
                리드 추가
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 전체 선택 및 Bulk Actions */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              {/* 페이지 크기 설정 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{t("leads.button.pageSize")}</span>
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => handlePageSizeChange(Number(value))}
                >
                  <SelectTrigger className="w-[100px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 전체 선택 버튼 */}
              <Button
                variant={isSelectAllMode ? "default" : "outline"}
                size="sm"
                onClick={toggleSelectAllMode}
                className={isSelectAllMode ? "bg-violet-600 hover:bg-violet-700" : ""}
              >
                {isSelectAllMode
                  ? t("leads.button.exitSelectAllMode")
                  : t("leads.button.selectAllMode")}
              </Button>

              {/* 전체 선택 상태 표시 */}
              {isSelectAllMode && (
                <span className="text-sm text-muted-foreground">
                  {allLeadsSelected
                    ? t("leads.status.allLeadsSelected")
                    : t("leads.status.clickToSelectAll")}
                </span>
              )}
            </div>

            {/* 선택된 리드 액션 버튼들 */}
            {(selectedLeads.length > 0 || allLeadsSelected) && (
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">
                    {allLeadsSelected
                      ? t("leads.status.allSelected")
                      : `${selectedLeads.length}${t("leads.status.selectedCount")}`}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSelectedLeadsCSV}
                    disabled={downloadSelectedLeadsCSV.isPending}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    {downloadSelectedLeadsCSV.isPending
                      ? t("leads.button.downloading")
                      : allLeadsSelected
                        ? t("leads.button.downloadAll")
                        : t("leads.button.downloadSelected")}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => openBulkActionModal("status")}>
                    {t("leads.button.changeStatus")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openBulkActionModal("businessType")}
                  >
                    {t("leads.button.changeBusinessType")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openBulkActionModal("copyToGroup")}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    {t("leads.button.copyToGroup")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    {t("leads.button.delete")}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {/* Leads Table with Pagination */}
          <LeadsTableWithPagination
            columnFilters={columnFilters}
            selectedCustomerGroup={selectedCustomerGroup}
            selectedLeads={selectedLeads}
            onToggleLead={toggleLeadSelection}
            onToggleAll={toggleAllLeads}
            onEditLead={setEditingLead}
            onManageGroups={handleManageLeadGroups}
            onLeadsDataChange={setCurrentLeadsData}
            onTotalChange={setTotalLeadsCount}
            pageSize={pageSize}
            isSelectAllMode={isSelectAllMode}
            allLeadsSelected={allLeadsSelected}
            onToggleSelectAll={handleSelectAllLeads}
          />
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="text-xl font-semibold">
              {t("leads.dialog.createLead")}
            </DialogTitle>
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
            <DialogTitle className="text-xl font-semibold">
              {t("leads.dialog.editLead")}
            </DialogTitle>
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
        customerGroups={customerGroups}
      />

      {/* CSV Upload Dialog */}
      <Dialog open={showCSVUpload} onOpenChange={setShowCSVUpload}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-xl font-semibold">
              {t("leads.dialog.csvUpload")}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(90vh-8rem)] space-y-6">
            {/* 그룹 정보 입력 */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t("leads.group.groupInfo")}</h3>

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
                      {t("leads.group.addToExisting")}
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
                      {t("leads.group.createNew")}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!isNewGroup ? (
                  // 기존 그룹 선택
                  <div className="space-y-2">
                    <Label htmlFor={groupSelectId}>{t("leads.group.selectGroup")}</Label>
                    <Select value={groupName} onValueChange={setGroupName}>
                      <SelectTrigger id={groupSelectId}>
                        <SelectValue placeholder={t("leads.group.selectGroupPlaceholder")} />
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor={newGroupNameId}>{t("leads.group.newGroupName")}</Label>
                      {csvData && csvData.length > 0 && (
                        <div className="flex items-center gap-2">
                          {isAutoGeneratedGroupName && (
                            <Badge variant="secondary" className="text-xs">
                              자동 생성됨
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={generateGroupNameFromCSV}
                            disabled={isGeneratingGroupName}
                            className="h-6 px-2"
                            title="그룹명 재생성"
                          >
                            <RefreshCw
                              className={`h-3 w-3 ${isGeneratingGroupName ? "animate-spin" : ""}`}
                            />
                          </Button>
                        </div>
                      )}
                    </div>
                    <Input
                      id={newGroupNameId}
                      value={newGroupName}
                      onChange={(e) => {
                        setNewGroupName(e.target.value)
                        setIsAutoGeneratedGroupName(false)
                      }}
                      disabled={isGeneratingGroupName}
                      placeholder={
                        isGeneratingGroupName
                          ? "그룹명 생성 중..."
                          : t("leads.group.newGroupNamePlaceholder")
                      }
                    />
                    {isAutoGeneratedGroupName && (
                      <p className="text-xs text-muted-foreground">
                        업로드된 리드 데이터를 기반으로 자동 생성된 이름입니다. 원하시면 직접 수정할
                        수 있습니다.
                      </p>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor={groupDescriptionId}>{t("leads.group.groupDescription")}</Label>
                  <Input
                    id={groupDescriptionId}
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder={t("leads.group.groupDescriptionPlaceholder")}
                  />
                </div>
              </div>
            </div>

            {/* 파일 업로드 섹션 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">{t("leads.file.upload")} (CSV/XLSX)</h3>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate("csv")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t("leads.button.csvTemplate")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownloadTemplate("xlsx")}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {t("leads.button.xlsxTemplate")}
                  </Button>
                </div>
              </div>

              {/* 필수 필드 안내 */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                      !
                    </div>
                    <div className="space-y-2">
                      <h4 className="font-medium text-blue-900">
                        {t("leads.file.requiredFields")}
                      </h4>
                      <div className="text-sm text-blue-800">
                        <p className="mb-2">
                          <strong>{t("leads.file.requiredFieldsDescription")}</strong>
                        </p>
                        <p className="mb-2">
                          <strong>{t("leads.file.optionalFields")}</strong>
                        </p>
                        <p className="text-xs text-blue-600">💡 {t("leads.file.templateTip")}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!csvData ? (
                <Card>
                  <CardContent className="pt-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <div className="space-y-2">
                        <h4 className="text-lg font-medium">{t("leads.file.upload")}</h4>
                        <p className="text-sm text-muted-foreground">
                          {t("leads.file.uploadDescription")}
                        </p>
                        <div className="pt-4">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isProcessingCSV}
                          >
                            {isProcessingCSV
                              ? t("leads.button.processing")
                              : t("leads.button.selectFile")}
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
                        <Badge variant="secondary">
                          {csvData.length}
                          {t("leads.file.leadsCount")}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {t("leads.file.parsingComplete")}
                        </span>
                      </div>

                      {csvErrors.length > 0 && (
                        <Alert>
                          <AlertDescription>
                            <div className="space-y-1">
                              <p className="font-medium">{t("leads.error.fixErrors")}</p>
                              <ul className="list-disc list-inside space-y-1">
                                {csvErrors.map((error) => (
                                  <li key={error} className="text-sm">
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
                          <p className="font-medium mb-2">{t("leads.file.preview")}</p>
                          <div className="space-y-1">
                            {csvData.slice(0, 5).map((lead, index) => (
                              <div
                                key={`${lead.companyName}-${lead.primaryEmail}-${index}`}
                                className="p-2 bg-gray-50 rounded text-xs"
                              >
                                {lead.companyName} - {lead.primaryEmail || t("leads.file.noEmail")}
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
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCSVUpload(false)}>
                {t("leads.button.cancel")}
              </Button>
              <Button
                onClick={handleCSVUpload}
                disabled={
                  isUploadingLeads ||
                  !csvData ||
                  csvErrors.length > 0 ||
                  (!isNewGroup && !groupName)
                }
              >
                {isUploadingLeads ? t("leads.button.processing") : t("leads.button.addLead")}
              </Button>
            </div>
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

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        open={bulkDeleteConfirmOpen}
        onOpenChange={setBulkDeleteConfirmOpen}
        title={t("leads.dialog.bulkDelete")}
        description={
          allLeadsSelected
            ? t("leads.dialog.bulkDeleteDescription.all")
            : t("leads.dialog.bulkDeleteDescription.selected", {
                count: selectedLeads.length,
              })
        }
        confirmText={t("leads.button.delete")}
        cancelText={t("leads.button.cancel")}
        onConfirm={confirmBulkDelete}
        variant="destructive"
      />

      {/* Group Delete Confirmation Dialog */}
      <ConfirmDialog
        open={groupDeleteConfirmOpen}
        onOpenChange={setGroupDeleteConfirmOpen}
        title={t("leads.dialog.deleteGroup")}
        description={t("leads.dialog.deleteGroupDescription", {
          groupName: groupToDelete?.name || "",
        })}
        confirmText={t("leads.button.delete")}
        cancelText={t("leads.button.cancel")}
        onConfirm={confirmGroupDelete}
        variant="destructive"
      />

      {/* Sequence Launch Modal */}
      <SequenceLaunchModal
        isOpen={showSequenceLaunchModal}
        onClose={() => {
          setShowSequenceLaunchModal(false)
          setSequenceLaunchGroup(null)
        }}
        customerGroup={sequenceLaunchGroup}
        workspaceId={selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""}
      />

      {/* Add Lead Sheet - 통합 리드 추가 Sheet */}
      <Sheet
        open={showAddLeadSheet}
        onOpenChange={(open) => {
          setShowAddLeadSheet(open)
          if (!open) {
            // Sheet 닫을 때 초기화
            setAddLeadStep(1)
            setAddLeadMode(null)
            setPreviewLeadData(null)
            setCsvData(null)
            setCsvFileName("")
            setCsvFileSize(0)
            setCsvErrors([])
            setGroupName("")
            setGroupDescription("")
            setIsNewGroup(false)
            setNewGroupName("")
          }
        }}
      >
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="animate-in fade-in slide-in-from-top-2 duration-300">
            <SheetTitle>리드 추가</SheetTitle>
            <SheetDescription>
              {addLeadStep === 1 && "리드를 추가할 방법을 선택하세요."}
              {addLeadStep === 2 &&
                addLeadMode === "upload" &&
                "CSV 또는 XLSX 파일을 업로드하세요."}
              {addLeadStep === 2 && addLeadMode === "manual" && "리드 정보를 입력하세요."}
              {addLeadStep === 3 && "추가할 리드 정보를 확인하세요."}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Step 1: 방식 선택 */}
            {addLeadStep === 1 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="grid gap-4">
                  <Card
                    className="cursor-pointer hover:border-violet-500 hover:bg-violet-50/50 transition-all hover:scale-[1.02] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500"
                    onClick={() => {
                      setAddLeadMode("upload")
                      setAddLeadStep(2)
                      // 선택된 고객 그룹이 있다면 기본값으로 설정
                      if (selectedCustomerGroup) {
                        setGroupName(selectedCustomerGroup)
                        setIsNewGroup(false)
                      } else {
                        setIsNewGroup(true)
                      }
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-100 rounded-lg transition-transform group-hover:scale-110">
                          <Upload className="h-6 w-6 text-violet-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">CSV/XLSX 파일 업로드</h3>
                          <p className="text-sm text-muted-foreground">
                            여러 리드를 한 번에 추가할 수 있습니다
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  <Card
                    className="cursor-pointer hover:border-violet-500 hover:bg-violet-50/50 transition-all hover:scale-[1.02] hover:shadow-md animate-in fade-in slide-in-from-bottom-2 duration-500 delay-75"
                    onClick={() => {
                      setAddLeadMode("manual")
                      setAddLeadStep(2)
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg transition-transform group-hover:scale-110">
                          <Plus className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold">수동으로 리드 생성 (임시)</h3>
                          <p className="text-sm text-muted-foreground">
                            개별 리드 정보를 직접 입력합니다
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </div>
              </div>
            )}

            {/* Step 2: 데이터 입력 - CSV 업로드 */}
            {addLeadStep === 2 && addLeadMode === "upload" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* 그룹 정보 입력 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">{t("leads.group.groupInfo")}</h3>

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
                          {t("leads.group.addToExisting")}
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
                          {t("leads.group.createNew")}
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {!isNewGroup ? (
                      // 기존 그룹 선택
                      <div className="space-y-2">
                        <Label htmlFor={groupSelectId}>{t("leads.group.selectGroup")}</Label>
                        <Select value={groupName} onValueChange={setGroupName}>
                          <SelectTrigger id={groupSelectId}>
                            <SelectValue placeholder={t("leads.group.selectGroupPlaceholder")} />
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
                        <div className="flex items-center justify-between">
                          <Label htmlFor={newGroupNameId}>{t("leads.group.newGroupName")}</Label>
                          {csvData && csvData.length > 0 && (
                            <div className="flex items-center gap-2">
                              {isAutoGeneratedGroupName && (
                                <Badge variant="secondary" className="text-xs">
                                  자동 생성됨
                                </Badge>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={generateGroupNameFromCSV}
                                disabled={isGeneratingGroupName}
                                className="h-6 px-2"
                                title="그룹명 재생성"
                              >
                                <RefreshCw
                                  className={`h-3 w-3 ${isGeneratingGroupName ? "animate-spin" : ""}`}
                                />
                              </Button>
                            </div>
                          )}
                        </div>
                        <Input
                          id={newGroupNameId}
                          value={newGroupName}
                          onChange={(e) => {
                            setNewGroupName(e.target.value)
                            setIsAutoGeneratedGroupName(false)
                          }}
                          disabled={isGeneratingGroupName}
                          placeholder={
                            isGeneratingGroupName
                              ? "그룹명 생성 중..."
                              : t("leads.group.newGroupNamePlaceholder")
                          }
                        />
                        {isAutoGeneratedGroupName && (
                          <p className="text-xs text-muted-foreground">
                            업로드된 리드 데이터를 기반으로 자동 생성된 이름입니다. 원하시면 직접
                            수정할 수 있습니다.
                          </p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={groupDescriptionId}>
                        {t("leads.group.groupDescription")}
                      </Label>
                      <Input
                        id={groupDescriptionId}
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        placeholder={t("leads.group.groupDescriptionPlaceholder")}
                      />
                    </div>
                  </div>
                </div>

                {/* 파일 업로드 섹션 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{t("leads.file.upload")} (CSV/XLSX)</h3>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate("csv")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t("leads.button.csvTemplate")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadTemplate("xlsx")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t("leads.button.xlsxTemplate")}
                      </Button>
                    </div>
                  </div>

                  {/* 필수 필드 안내 */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          !
                        </div>
                        <div className="space-y-2">
                          <h4 className="font-medium text-blue-900">
                            {t("leads.file.requiredFields")}
                          </h4>
                          <div className="text-sm text-blue-800">
                            <p className="mb-2">
                              <strong>{t("leads.file.requiredFieldsDescription")}</strong>
                            </p>
                            <p className="mb-2">
                              <strong>{t("leads.file.optionalFields")}</strong>
                            </p>
                            <p className="text-xs text-blue-600">
                              💡 {t("leads.file.templateTip")}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {!csvData ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                          <div className="space-y-2">
                            <h4 className="text-lg font-medium">{t("leads.file.upload")}</h4>
                            <p className="text-sm text-muted-foreground">
                              {t("leads.file.uploadDescription")}
                            </p>
                            <div className="pt-4">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isProcessingCSV}
                              >
                                {isProcessingCSV
                                  ? t("leads.button.processing")
                                  : t("leads.button.selectFile")}
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
                            <Badge variant="secondary">
                              {csvData.length}
                              {t("leads.file.leadsCount")}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {t("leads.file.parsingComplete")}
                            </span>
                          </div>

                          {csvErrors.length > 0 && (
                            <Alert>
                              <AlertDescription>
                                <div className="space-y-1">
                                  <p className="font-medium">{t("leads.error.fixErrors")}</p>
                                  <ul className="list-disc list-inside space-y-1">
                                    {csvErrors.map((error) => (
                                      <li key={error} className="text-sm">
                                        {error}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: 데이터 입력 - 수동 생성 */}
            {addLeadStep === 2 && addLeadMode === "manual" && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                <LeadForm
                  isEdit={false}
                  workspaceId={
                    selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id
                  }
                  customerGroups={customerGroups || []}
                  selectedGroup={selectedGroupForNewLead}
                  onGroupChange={(value) =>
                    setSelectedGroupForNewLead(value === "none" ? "" : value)
                  }
                  onSave={(leadData) => {
                    setPreviewLeadData(leadData as Lead)
                    setAddLeadStep(3)
                  }}
                  onCancel={() => {
                    setAddLeadStep(1)
                    setAddLeadMode(null)
                  }}
                  submitButtonText="다음"
                  cancelButtonText="이전"
                />
              </div>
            )}

            {/* Step 3: 미리보기 */}
            {addLeadStep === 3 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                {addLeadMode === "upload" && csvData ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">업로드할 리드 미리보기</h3>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                총 {csvData.length}개의 리드를 추가할 예정입니다
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {isNewGroup
                                  ? `새 그룹 "${newGroupName || "자동 생성"}"에 추가됩니다`
                                  : `기존 그룹에 추가됩니다`}
                              </p>
                            </div>
                          </div>

                          <div className="max-h-96 overflow-y-auto space-y-2">
                            {csvData.slice(0, 10).map((lead, index) => (
                              <div
                                key={`${lead.companyName}-${lead.primaryEmail}-${index}`}
                                className="p-3 bg-gray-50 rounded-lg text-sm animate-in fade-in slide-in-from-left-2 duration-300"
                                style={{ animationDelay: `${index * 50}ms` }}
                              >
                                <div className="font-medium">{lead.companyName}</div>
                                <div className="text-muted-foreground text-xs">
                                  {lead.primaryEmail || t("leads.file.noEmail")} •{" "}
                                  {lead.contactName || "이름 없음"}
                                </div>
                              </div>
                            ))}
                            {csvData.length > 10 && (
                              <p className="text-sm text-muted-foreground text-center py-2 animate-in fade-in duration-300 delay-500">
                                ... 외 {csvData.length - 10}개
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  previewLeadData && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-medium animate-in fade-in duration-300">
                        추가할 리드 정보
                      </h3>
                      <Card className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <CardContent className="pt-4 space-y-4">
                          {/* 기본 정보 */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2 text-violet-600">
                              기본 정보
                            </h4>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div className="space-y-1">
                                <span className="text-muted-foreground">회사명</span>
                                <p className="font-medium">{previewLeadData.companyName || "-"}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">담당자</span>
                                <p className="font-medium">{previewLeadData.contactName || "-"}</p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">웹사이트</span>
                                <p className="font-medium break-all">
                                  {previewLeadData.websiteUrl || "-"}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <span className="text-muted-foreground">업종</span>
                                <p className="font-medium">{previewLeadData.businessType || "-"}</p>
                              </div>
                            </div>
                          </div>

                          {/* 위치 정보 */}
                          {(previewLeadData.country ||
                            previewLeadData.city ||
                            previewLeadData.address) && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold mb-2 text-violet-600">
                                위치 정보
                              </h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {previewLeadData.country && (
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground">국가</span>
                                    <p className="font-medium">{previewLeadData.country}</p>
                                  </div>
                                )}
                                {previewLeadData.city && (
                                  <div className="space-y-1">
                                    <span className="text-muted-foreground">도시</span>
                                    <p className="font-medium">{previewLeadData.city}</p>
                                  </div>
                                )}
                                {previewLeadData.address && (
                                  <div className="space-y-1 col-span-2">
                                    <span className="text-muted-foreground">주소</span>
                                    <p className="font-medium">{previewLeadData.address}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 연락처 정보 */}
                          {previewLeadData.contacts && previewLeadData.contacts.length > 0 && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold mb-2 text-violet-600">
                                연락처 정보
                              </h4>
                              <div className="space-y-2">
                                {previewLeadData.contacts.map((contact, index) => (
                                  <div
                                    key={`${contact.contactType}-${contact.contactValue}-${index}`}
                                    className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                                  >
                                    <Badge variant="outline" className="text-xs">
                                      {contact.contactType}
                                    </Badge>
                                    <span className="font-medium">{contact.contactValue}</span>
                                    {contact.contactName && (
                                      <span className="text-muted-foreground">
                                        ({contact.contactName})
                                      </span>
                                    )}
                                    {contact.isPrimary && (
                                      <Badge variant="secondary" className="text-xs">
                                        주 연락처
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 소셜 미디어 */}
                          {previewLeadData.socialMedia &&
                            previewLeadData.socialMedia.length > 0 && (
                              <div className="border-t pt-4">
                                <h4 className="text-sm font-semibold mb-2 text-violet-600">
                                  소셜 미디어
                                </h4>
                                <div className="space-y-2">
                                  {previewLeadData.socialMedia.map((social, index) => (
                                    <div
                                      key={`${social.platform}-${social.url}-${index}`}
                                      className="flex items-center gap-2 text-sm p-2 bg-gray-50 rounded"
                                    >
                                      <Badge variant="outline" className="text-xs">
                                        {social.platform}
                                      </Badge>
                                      <span className="font-medium break-all">{social.url}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                          {/* 추가 정보 */}
                          {(previewLeadData.description || previewLeadData.notes) && (
                            <div className="border-t pt-4">
                              <h4 className="text-sm font-semibold mb-2 text-violet-600">
                                추가 정보
                              </h4>
                              {previewLeadData.description && (
                                <div className="space-y-1 mb-3">
                                  <span className="text-sm text-muted-foreground">설명</span>
                                  <p className="text-sm bg-gray-50 p-2 rounded">
                                    {previewLeadData.description}
                                  </p>
                                </div>
                              )}
                              {previewLeadData.notes && (
                                <div className="space-y-1">
                                  <span className="text-sm text-muted-foreground">메모</span>
                                  <p className="text-sm bg-gray-50 p-2 rounded">
                                    {previewLeadData.notes}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )
                )}
              </div>
            )}
          </div>

          <SheetFooter className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
            {addLeadStep === 1 && (
              <Button
                variant="outline"
                onClick={() => setShowAddLeadSheet(false)}
                className="transition-all duration-200 hover:scale-105 active:scale-95"
              >
                취소
              </Button>
            )}

            {addLeadStep === 2 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddLeadStep(1)
                    setAddLeadMode(null)
                    setCsvData(null)
                  }}
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  이전
                </Button>
                {addLeadMode === "upload" && (
                  <Button
                    onClick={() => {
                      if (csvData && csvData.length > 0) {
                        setAddLeadStep(3)
                      }
                    }}
                    disabled={
                      !csvData ||
                      csvErrors.length > 0 ||
                      (!isNewGroup && !groupName) ||
                      (isNewGroup && !newGroupName.trim())
                    }
                    className="transition-all duration-200 hover:scale-105 active:scale-95"
                  >
                    다음
                  </Button>
                )}
              </>
            )}

            {addLeadStep === 3 && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddLeadStep(2)
                    setPreviewLeadData(null)
                  }}
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  이전
                </Button>
                <Button
                  onClick={async () => {
                    if (addLeadMode === "upload") {
                      await handleCSVUpload()
                      setShowAddLeadSheet(false)
                    } else if (previewLeadData) {
                      await handleCreateLead(previewLeadData)
                      setShowAddLeadSheet(false)
                    }
                  }}
                  disabled={isUploadingLeads || createLead.isPending}
                  className="transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {isUploadingLeads || createLead.isPending ? "처리 중..." : "리드 추가"}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
