import { useQueryClient } from "@tanstack/react-query"
import { Download, Edit2, Loader2, Plus, Send, Sparkles, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AddLeadSheet } from "@/components/leads/AddLeadSheet"
import { MissingEmailAlertModal } from "@/components/leads/MissingEmailAlertModal"
import { AdvancedSearchInput } from "@/components/search/AdvancedSearchInput"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  customerGroupKeys,
  useBulkAddGroupMembers,
  useBulkRemoveGroupMembers,
  useCreateCustomerGroup,
  useCustomerGroup,
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
import { contactEnrichmentApi } from "@/lib/api/services/contact-enrichment"
import { customerGroupsApi } from "@/lib/api/services/customer-groups"
import { leadsApi } from "@/lib/api/services/leads"
import { sequencesApi } from "@/lib/api/services/sequences"
import { workspacesApi } from "@/lib/api/services/workspaces"
import type { CustomerGroup } from "@/lib/api/types/customer-group"
import type { Lead, LeadStatus } from "@/lib/api/types/lead"
import type { Workspace } from "@/lib/api/types/workspace"
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
  const [searchParams] = useSearchParams()
  const groupId = searchParams.get("groupId")
  const navigate = useNavigate()
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )
  const [searchTokens, setSearchTokens] = useState<SearchToken[]>([])
  const [selectedCustomerGroup, setSelectedCustomerGroup] = useState<string>(groupId || "")

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

  // 수동 리드 생성 시 선택된 그룹
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
    return saved ? Number.parseInt(saved, 10) : 100
  })

  // 확인 다이얼로그 상태
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const [groupDeleteConfirmOpen, setGroupDeleteConfirmOpen] = useState(false)
  const [groupToDelete, setGroupToDelete] = useState<CustomerGroup | null>(null)

  // 시퀀스 발송 모달 상태
  const [showSequenceLaunchModal, setShowSequenceLaunchModal] = useState(false)
  const [sequenceLaunchGroup, setSequenceLaunchGroup] = useState<CustomerGroup | null>(null)

  // Contact Enrichment 상태
  const [enrichingLeadIds, setEnrichingLeadIds] = useState<Set<string>>(new Set())
  const [failedEnrichmentLeadIds, setFailedEnrichmentLeadIds] = useState<Set<string>>(new Set())
  const [showMissingEmailAlert, setShowMissingEmailAlert] = useState(false)
  const [leadsWithoutEmail, setLeadsWithoutEmail] = useState<
    Array<{ id: string; companyName: string | null; hasEmail: boolean }>
  >([])
  const [pendingCampaignAction, setPendingCampaignAction] = useState<{
    targetGroupId: string
    targetGroupName: string
  } | null>(null)

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

  // 선택된 고객 그룹 정보 가져오기 (다른 워크스페이스의 그룹일 수 있음)
  const selectedGroup = customerGroups?.find((g) => g.id === selectedCustomerGroup)
  const { data: selectedGroupDetail } = useCustomerGroup(
    selectedCustomerGroup,
    !!selectedCustomerGroup && !selectedGroup,
  )

  // 선택된 그룹의 워크스페이스 ID (현재 워크스페이스에 없는 그룹일 수 있음)
  const selectedGroupWorkspaceId = selectedGroup?.workspaceId || selectedGroupDetail?.workspaceId

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

  // URL의 groupId 파라미터가 변경되면 selectedCustomerGroup 업데이트
  useEffect(() => {
    if (groupId) {
      setSelectedCustomerGroup(groupId)
    }
  }, [groupId])

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
  const columnFilters = useMemo(() => tokensToFilters(searchTokens), [searchTokens])

  const handleCreateLead = async (leadData: unknown) => {
    createLead.mutate(leadData as Lead, {
      onSuccess: () => {
        // Hooks already handle cache invalidation
        setShowCreateDialog(false)
      },
    })
  }

  const handleUpdateLead = async (leadData: unknown) => {
    if (!editingLead) {
      return
    }
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
    if (selectedLeads.length === 0 && !allLeadsSelected) {
      return
    }
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
          limit: 10_000, // 충분히 큰 값
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
          limit: 10_000,
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
    if (newSize >= 1 && newSize <= 10_000) {
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
          limit: 10_000, // 충분히 큰 값
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
          isDynamic: editingGroup?.isDynamic ?? false,
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
    if (!groupToDelete) {
      return
    }

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

  // Contact Enrichment 실행 함수
  const handleEnrichLeads = async (leadIds: string[], options?: { onComplete?: () => void }) => {
    if (leadIds.length === 0) {
      toast.error("보강할 리드를 선택해주세요.")
      return
    }

    // 1. 로딩 상태 시작 & 이전 실패 상태 초기화
    setEnrichingLeadIds(new Set(leadIds))
    setFailedEnrichmentLeadIds(new Set())

    try {
      // 2. SSE 연결하여 백그라운드 Enrichment 실행
      const params = new URLSearchParams()
      params.append("leadIds", leadIds.join(","))

      const eventSource = new EventSource(
        `/api/v1/contact-enrichment/enrich-leads?${params.toString()}`,
      )

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          if (data.type === "progress" && data.completedLeadId) {
            // 완료된 리드는 로딩 상태에서 제거
            setEnrichingLeadIds((prev) => {
              const next = new Set(prev)
              next.delete(data.completedLeadId)
              return next
            })

            // 실패한 리드는 실패 상태에 추가 (이메일을 찾지 못한 경우)
            if (data.result && !data.result.success) {
              setFailedEnrichmentLeadIds((prev) => {
                const next = new Set(prev)
                next.add(data.completedLeadId)
                return next
              })
            }
          }

          if (data.type === "complete") {
            // 3. React Query 캐시 무효화 → 자동으로 새 이메일 표시
            queryClient.invalidateQueries({ queryKey: leadKeys.lists() })

            // 4. 토스트 알림 (성공 시에만)
            const { stats } = data
            if (stats.success > 0) {
              toast.success(`${stats.success}개 리드에서 이메일을 찾았어요!`)
            }

            eventSource.close()
            setEnrichingLeadIds(new Set())

            // onComplete 콜백 실행
            options?.onComplete?.()
          }

          if (data.type === "error") {
            // 오류는 조용히 처리 (토스트 없음)
            eventSource.close()
            setEnrichingLeadIds(new Set())
          }
        } catch (parseError) {
          console.error("Failed to parse SSE data:", parseError)
        }
      }

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error)
        // 오류는 조용히 처리 (토스트 없음)
        eventSource.close()
        setEnrichingLeadIds(new Set())
      }
    } catch (error) {
      console.error("Failed to start enrichment:", error)
      // 오류는 조용히 처리 (토스트 없음)
      setEnrichingLeadIds(new Set())
    }
  }

  // 정보 보강 버튼 클릭 핸들러 (전체 선택 모드 지원)
  const handleEnrichButtonClick = async () => {
    try {
      const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id

      if (!workspaceId) {
        toast.error(t("leads.error.noWorkspaceSelected"))
        return
      }

      let targetLeadIds: string[] = []

      if (allLeadsSelected) {
        // 전체 선택 모드 - 모든 리드를 가져옴
        const allLeadsResponse = await leadsApi.list({
          page: 1,
          limit: 10_000,
          workspaceIds: [workspaceId],
          customerGroupId: selectedCustomerGroup || undefined,
          filters: columnFilters.length > 0 ? JSON.stringify(columnFilters) : undefined,
        })
        targetLeadIds = allLeadsResponse.leads.map((lead) => lead.id)
      } else if (selectedLeads.length > 0) {
        targetLeadIds = selectedLeads
      } else {
        toast.error("보강할 리드를 선택해주세요.")
        return
      }

      // 이메일 없는 리드만 필터링하여 enrichment 실행
      const emailStatus = await contactEnrichmentApi.checkEmailStatus(targetLeadIds)
      const leadsToEnrich = emailStatus.leads.filter((l) => !l.hasEmail).map((l) => l.id)

      if (leadsToEnrich.length === 0) {
        toast.success("모든 리드에 이미 이메일이 있어요!")
        return
      }

      await handleEnrichLeads(leadsToEnrich)
    } catch (error) {
      console.error("Failed to start enrichment:", error)
      toast.error("정보 보강을 시작하지 못했습니다.")
    }
  }

  // 이메일 없는 리드만 Enrichment 후 캠페인 생성 진행
  const handleEnrichAndCreateCampaign = async () => {
    setShowMissingEmailAlert(false)

    if (!pendingCampaignAction) {
      return
    }

    // 이메일 없는 리드들만 Enrichment 실행
    const leadIdsToEnrich = leadsWithoutEmail.filter((l) => !l.hasEmail).map((l) => l.id)

    if (leadIdsToEnrich.length > 0) {
      await handleEnrichLeads(leadIdsToEnrich, {
        onComplete: () => {
          // 완료 후 캠페인 생성 진행
          proceedWithCampaignCreation(
            pendingCampaignAction.targetGroupId,
            pendingCampaignAction.targetGroupName,
          )
        },
      })
    } else {
      // 이미 모든 리드에 이메일이 있음
      proceedWithCampaignCreation(
        pendingCampaignAction.targetGroupId,
        pendingCampaignAction.targetGroupName,
      )
    }
  }

  // 이메일 있는 리드만으로 캠페인 생성 진행
  const handleProceedWithValidLeads = async () => {
    setShowMissingEmailAlert(false)

    if (!pendingCampaignAction) {
      return
    }

    proceedWithCampaignCreation(
      pendingCampaignAction.targetGroupId,
      pendingCampaignAction.targetGroupName,
    )
  }

  // 캠페인 생성 실제 진행
  const proceedWithCampaignCreation = async (targetGroupId: string, targetGroupName: string) => {
    try {
      const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id

      if (!workspaceId) {
        toast.error(t("leads.error.noWorkspaceSelected"))
        return
      }

      // Create more descriptive campaign name based on context
      let campaignName: string
      let campaignDescription: string

      if (selectedCustomerGroup && allLeadsSelected) {
        campaignName = `${targetGroupName} - 캠페인`
        campaignDescription = `${targetGroupName} 전체 리드를 위한 캠페인`
      } else if (selectedCustomerGroup && selectedLeads.length > 0) {
        const group = customerGroups?.find((g) => g.id === selectedCustomerGroup)
        const baseGroupName = group?.name || "Group"
        campaignName = `${baseGroupName} (선택 ${selectedLeads.length}명) - 캠페인`
        campaignDescription = `${baseGroupName}에서 선택된 ${selectedLeads.length}명의 리드를 위한 캠페인`
      } else if (!selectedCustomerGroup && allLeadsSelected) {
        const totalCount = totalLeadsCount || 0
        campaignName = `전체 리드 (${totalCount}명) - 캠페인`
        campaignDescription = `전체 ${totalCount}명의 리드를 위한 캠페인`
      } else {
        campaignName = `선택된 리드 (${selectedLeads.length}명) - 캠페인`
        campaignDescription = `선택된 ${selectedLeads.length}명의 리드를 위한 캠페인`
      }

      const newSequence = await sequencesApi.create({
        workspaceId,
        name: campaignName,
        description: campaignDescription,
        status: "draft",
        customerGroupId: targetGroupId,
      })

      await new Promise((resolve) => setTimeout(resolve, 100))
      navigate(`/sequences/create?id=${newSequence.id}`)
    } catch (error) {
      console.error("Failed to create campaign:", error)
      toast.error("캠페인 생성 중 오류가 발생했습니다.")
    }
  }

  // Handle Create New Campaign button click
  const handleCreateCampaign = async () => {
    try {
      const workspaceId = selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id

      if (!workspaceId) {
        toast.error(t("leads.error.noWorkspaceSelected"))
        return
      }

      // 대상 리드 ID 목록 결정
      let targetLeadIds: string[] = []

      if (allLeadsSelected) {
        // 전체 선택 모드 - 모든 리드를 가져옴
        const allLeadsResponse = await leadsApi.list({
          page: 1,
          limit: 10_000,
          workspaceIds: [workspaceId],
          customerGroupId: selectedCustomerGroup || undefined,
          filters: columnFilters.length > 0 ? JSON.stringify(columnFilters) : undefined,
        })
        targetLeadIds = allLeadsResponse.leads.map((lead) => lead.id)
      } else if (selectedLeads.length > 0) {
        targetLeadIds = selectedLeads
      } else {
        toast.error("리드를 선택하거나 전체 선택 모드를 활성화해주세요.")
        return
      }

      // 이메일 상태 확인
      const emailStatus = await contactEnrichmentApi.checkEmailStatus(targetLeadIds)

      let targetGroupId: string
      let targetGroupName: string

      // Case 1: In "Group A", Select All Leads mode
      if (selectedCustomerGroup && allLeadsSelected) {
        targetGroupId = selectedCustomerGroup
        const group = customerGroups?.find((g) => g.id === selectedCustomerGroup)
        targetGroupName = group?.name || "Group"
      }
      // Case 2: In "Group A", Some leads selected
      else if (selectedCustomerGroup && selectedLeads.length > 0) {
        const group = customerGroups?.find((g) => g.id === selectedCustomerGroup)
        const baseGroupName = group?.name || "Group"

        // Find next available number for group name
        let counter = 1
        let newGroupName = `${baseGroupName} (${counter})`
        while (customerGroups?.some((g) => g.name === newGroupName)) {
          counter++
          newGroupName = `${baseGroupName} (${counter})`
        }

        // Create new group with selected leads
        const newGroup = await createCustomerGroup.mutateAsync({
          workspaceId,
          name: newGroupName,
          description: `${baseGroupName}에서 선택된 ${selectedLeads.length}개의 리드`,
          isDynamic: false,
        })

        // Add selected leads to the new group
        await bulkAddGroupMembers.mutateAsync({
          groupId: newGroup.id,
          leadIds: selectedLeads,
        })

        targetGroupId = newGroup.id
        targetGroupName = newGroupName
        toast.success(`새 그룹 "${newGroupName}"이 생성되었습니다.`)
      }
      // Case 3: In "All", Select All Leads mode
      else if (!selectedCustomerGroup && allLeadsSelected) {
        // Create "All Leads" group
        const newGroup = await createCustomerGroup.mutateAsync({
          workspaceId,
          name: "All Leads",
          description: `전체 ${targetLeadIds.length}개의 리드`,
          isDynamic: false,
        })

        // Add all leads to the group
        await bulkAddGroupMembers.mutateAsync({
          groupId: newGroup.id,
          leadIds: targetLeadIds,
        })

        targetGroupId = newGroup.id
        targetGroupName = "All Leads"
        toast.success('새 그룹 "All Leads"가 생성되었습니다.')
      }
      // Case 4: In "All", Some leads selected
      else if (!selectedCustomerGroup && selectedLeads.length > 0) {
        let counter = 1
        let newGroupName = `All Leads (${counter})`
        while (customerGroups?.some((g) => g.name === newGroupName)) {
          counter++
          newGroupName = `All Leads (${counter})`
        }

        // Create new group with selected leads
        const newGroup = await createCustomerGroup.mutateAsync({
          workspaceId,
          name: newGroupName,
          description: `선택된 ${selectedLeads.length}개의 리드`,
          isDynamic: false,
        })

        // Add selected leads to the new group
        await bulkAddGroupMembers.mutateAsync({
          groupId: newGroup.id,
          leadIds: selectedLeads,
        })

        targetGroupId = newGroup.id
        targetGroupName = newGroupName
        toast.success(`새 그룹 "${newGroupName}"이 생성되었습니다.`)
      } else {
        toast.error("리드를 선택하거나 전체 선택 모드를 활성화해주세요.")
        return
      }

      // Refresh customer groups
      await queryClient.invalidateQueries({
        queryKey: customerGroupKeys.all,
      })

      // 이메일 없는 리드가 있으면 알림 모달 표시
      if (emailStatus.withoutEmail > 0) {
        setLeadsWithoutEmail(emailStatus.leads)
        setPendingCampaignAction({ targetGroupId, targetGroupName })
        setShowMissingEmailAlert(true)
        return
      }

      // 모든 리드에 이메일이 있으면 바로 캠페인 생성 진행
      await proceedWithCampaignCreation(targetGroupId, targetGroupName)
    } catch (error) {
      console.error("Failed to create campaign:", error)
      toast.error("캠페인 생성 중 오류가 발생했습니다.")
    }
  }

  return (
    <div className="h-full space-y-6 overflow-y-auto">
      {/* Leads Table */}
      <Card>
        <CardHeader className="pb-4">
          {/* 고객 그룹 선택 - 탭 형태 */}
          <div className="mb-4 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
            <Tabs
              className="min-w-0 flex-1"
              onValueChange={(value) => setSelectedCustomerGroup(value === "all" ? "" : value)}
              value={selectedCustomerGroup || "all"}
            >
              <TabsList className="inline-flex h-auto w-full flex-wrap items-center justify-start gap-2 bg-transparent p-0 lg:w-auto">
                <TabsTrigger
                  className="h-9 border border-input bg-background px-4 text-xs hover:bg-accent hover:text-accent-foreground data-[state=active]:bg-blue-600 data-[state=active]:text-white data-[state=active]:hover:bg-blue-700 data-[state=active]:hover:text-white"
                  value="all"
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
                          className={`h-9 border border-input bg-background px-4 text-xs hover:bg-accent hover:text-accent-foreground ${
                            selectedCustomerGroup === group.id
                              ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white"
                              : ""
                          }`}
                          value={group.id}
                        >
                          <Users className="mr-1 h-3 w-3" />
                          {group.name}
                          {group.leadCount !== undefined && (
                            <span className="ml-1.5 text-xs opacity-70">({group.leadCount})</span>
                          )}
                        </TabsTrigger>
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          className="cursor-pointer"
                          onClick={() => handleEditGroup(group)}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          {t("leads.button.editGroup")}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950"
                          onClick={() => handleDeleteGroup(group)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("leads.button.deleteGroup")}
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                <CreateGroupModal
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
                  selectedLeadIds={selectedLeads}
                  selectedWorkspaceId={selectedWorkspaceId}
                  workspaces={workspaces}
                />
              </TabsList>
            </Tabs>
          </div>
          {selectedWorkspaceId !== "all" && customerGroups && customerGroups.length === 0 && (
            <div className="mb-4 rounded-md bg-gray-50 py-4 text-center text-muted-foreground text-sm">
              {t("leads.group.noGroups")}
            </div>
          )}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {/* 고급 검색 */}
            <div className="min-w-0 flex-1">
              <AdvancedSearchInput
                onChange={setSearchTokens}
                placeholder={t("leads.search.placeholder")}
                tokens={searchTokens}
              />
            </div>
            <div className="flex-shrink-0">
              <Button
                className="w-full transition-all duration-200 hover:scale-105 active:scale-95 sm:w-auto"
                onClick={() => setShowAddLeadSheet(true)}
              >
                <Plus className="mr-1 h-4 w-4" />
                {/* 리드 추가 */}
                {t("leads.button.addLead")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* 전체 선택 및 Bulk Actions */}
          <div className="mb-6 space-y-3">
            {/* 한 줄에 모든 컨트롤 표시 */}
            <div className="flex flex-wrap items-center gap-2">
              {/* 페이지 크기 설정 */}
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-muted-foreground text-sm">
                  {t("leads.button.pageSize")}
                </span>
                <Select
                  onValueChange={(value) => handlePageSizeChange(Number(value))}
                  value={String(pageSize)}
                >
                  <SelectTrigger className="h-9 w-[100px]">
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
                className={
                  isSelectAllMode ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : ""
                }
                onClick={toggleSelectAllMode}
                size="sm"
                variant={isSelectAllMode ? "default" : "outline"}
              >
                {isSelectAllMode
                  ? t("leads.button.exitSelectAllMode")
                  : t("leads.button.selectAllMode")}
              </Button>

              {/* 정보 보강 버튼 */}
              <Button
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
                disabled={
                  (selectedLeads.length === 0 && !allLeadsSelected) || enrichingLeadIds.size > 0
                }
                onClick={handleEnrichButtonClick}
                size="sm"
              >
                {enrichingLeadIds.size > 0 ? (
                  <>
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    <span className="hidden lg:inline">정보 보강 중...</span>
                    <span className="lg:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" />
                    <span className="hidden lg:inline">정보 보강</span>
                    <span className="lg:hidden">Enrich</span>
                  </>
                )}
              </Button>

              {/* 캠페인 생성 버튼 - 하이라이트 */}
              <Button
                className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg"
                disabled={selectedLeads.length === 0 && !allLeadsSelected}
                onClick={handleCreateCampaign}
                size="sm"
                variant="default"
              >
                <Send className="mr-1 h-4 w-4" />
                <span className="hidden lg:inline">{t("leads.button.createCampaign")}</span>
                <span className="lg:hidden">Campaign</span>
              </Button>

              {/* 액션 버튼들 */}
              <Button
                disabled={
                  downloadSelectedLeadsCSV.isPending ||
                  (selectedLeads.length === 0 && !allLeadsSelected)
                }
                onClick={handleDownloadSelectedLeadsCSV}
                size="sm"
                variant="outline"
              >
                <Download className="mr-1 h-4 w-4" />
                <span className="hidden lg:inline">
                  {downloadSelectedLeadsCSV.isPending
                    ? t("leads.button.downloading")
                    : allLeadsSelected
                      ? t("leads.button.downloadAll")
                      : t("leads.button.downloadSelected")}
                </span>
                <span className="lg:hidden">
                  {downloadSelectedLeadsCSV.isPending ? "..." : "Download"}
                </span>
              </Button>
              <Button
                disabled={selectedLeads.length === 0 && !allLeadsSelected}
                onClick={() => openBulkActionModal("status")}
                size="sm"
                variant="outline"
              >
                <span className="hidden lg:inline">{t("leads.button.changeStatus")}</span>
                <span className="lg:hidden">Status</span>
              </Button>
              <Button
                disabled={selectedLeads.length === 0 && !allLeadsSelected}
                onClick={() => openBulkActionModal("businessType")}
                size="sm"
                variant="outline"
              >
                <span className="hidden lg:inline">{t("leads.button.changeBusinessType")}</span>
                <span className="lg:hidden">Type</span>
              </Button>
              <Button
                disabled={selectedLeads.length === 0 && !allLeadsSelected}
                onClick={() => openBulkActionModal("copyToGroup")}
                size="sm"
                variant="outline"
              >
                <Users className="mr-1 h-4 w-4" />
                <span className="hidden lg:inline">{t("leads.button.copyToGroup")}</span>
                <span className="lg:hidden">Copy</span>
              </Button>
              <Button
                className="text-red-600 hover:bg-red-50 hover:text-red-700 disabled:text-gray-400 disabled:hover:bg-transparent disabled:hover:text-gray-400"
                disabled={selectedLeads.length === 0 && !allLeadsSelected}
                onClick={handleBulkDelete}
                size="sm"
                variant="outline"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                <span className="hidden lg:inline">{t("leads.button.delete")}</span>
                <span className="lg:hidden">Delete</span>
              </Button>
            </div>

            {/* 선택 상태 표시 (별도 줄) */}
            {(isSelectAllMode || selectedLeads.length > 0 || allLeadsSelected) && (
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                {isSelectAllMode && (
                  <span>
                    {allLeadsSelected
                      ? t("leads.status.allLeadsSelected")
                      : t("leads.status.clickToSelectAll")}
                  </span>
                )}
                {(selectedLeads.length > 0 || allLeadsSelected) && !isSelectAllMode && (
                  <span className="font-medium">
                    {allLeadsSelected
                      ? t("leads.status.allSelected")
                      : `${selectedLeads.length}${t("leads.status.selectedCount")}`}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Leads Table with Pagination */}
          <LeadsTableWithPagination
            allLeadsSelected={allLeadsSelected}
            columnFilters={columnFilters}
            enrichingLeadIds={enrichingLeadIds}
            failedEnrichmentLeadIds={failedEnrichmentLeadIds}
            isSelectAllMode={isSelectAllMode}
            onEditLead={setEditingLead}
            onLeadsDataChange={setCurrentLeadsData}
            onManageGroups={handleManageLeadGroups}
            onToggleAll={toggleAllLeads}
            onToggleLead={toggleLeadSelection}
            onToggleSelectAll={handleSelectAllLeads}
            onTotalChange={setTotalLeadsCount}
            pageSize={pageSize}
            selectedCustomerGroup={selectedCustomerGroup}
            selectedGroupWorkspaceId={selectedGroupWorkspaceId}
            selectedLeads={selectedLeads}
          />
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog onOpenChange={setShowCreateDialog} open={showCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              {t("leads.dialog.createLead")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            <LeadForm
              customerGroups={customerGroups || []}
              isEdit={false}
              onCancel={() => setShowCreateDialog(false)}
              onGroupChange={(value) => setSelectedGroupForNewLead(value === "none" ? "" : value)}
              onSave={handleCreateLead}
              selectedGroup={selectedGroupForNewLead}
              workspaceId={selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog onOpenChange={() => setEditingLead(null)} open={!!editingLead}>
        <DialogContent className="max-h-[90vh] max-w-3xl">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="font-semibold text-xl">
              {t("leads.dialog.editLead")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[calc(90vh-8rem)] overflow-y-auto px-1">
            {editingLead && (
              <LeadForm
                isEdit={true}
                lead={editingLead}
                onCancel={() => setEditingLead(null)}
                onSave={handleUpdateLead}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Action Modal */}
      <BulkActionModal
        actionType={bulkActionType}
        currentWorkspaceId={selectedWorkspaceId}
        customerGroups={customerGroups}
        isOpen={showBulkActionModal}
        leadCount={selectedLeads.length}
        onClose={() => {
          setShowBulkActionModal(false)
          setBulkActionType(null)
        }}
        onConfirm={handleBulkAction}
        workspaces={workspaces}
      />

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
        availableGroups={customerGroups || []}
        currentGroups={leadCurrentGroups}
        isOpen={showLeadGroupModal}
        lead={managingLeadGroups}
        onClose={() => {
          setShowLeadGroupModal(false)
          setManagingLeadGroups(null)
          setLeadCurrentGroups([])
        }}
        onSave={handleSaveLeadGroups}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmDialog
        cancelText={t("leads.button.cancel")}
        confirmText={t("leads.button.delete")}
        description={
          allLeadsSelected
            ? t("leads.dialog.bulkDeleteDescription.all")
            : t("leads.dialog.bulkDeleteDescription.selected", {
                count: selectedLeads.length,
              })
        }
        onConfirm={confirmBulkDelete}
        onOpenChange={setBulkDeleteConfirmOpen}
        open={bulkDeleteConfirmOpen}
        title={t("leads.dialog.bulkDelete")}
        variant="destructive"
      />

      {/* Group Delete Confirmation Dialog */}
      <ConfirmDialog
        cancelText={t("leads.button.cancel")}
        confirmText={t("leads.button.delete")}
        description={t("leads.dialog.deleteGroupDescription", {
          groupName: groupToDelete?.name || "",
        })}
        onConfirm={confirmGroupDelete}
        onOpenChange={setGroupDeleteConfirmOpen}
        open={groupDeleteConfirmOpen}
        title={t("leads.dialog.deleteGroup")}
        variant="destructive"
      />

      {/* Sequence Launch Modal */}
      <SequenceLaunchModal
        customerGroup={sequenceLaunchGroup}
        isOpen={showSequenceLaunchModal}
        onClose={() => {
          setShowSequenceLaunchModal(false)
          setSequenceLaunchGroup(null)
        }}
        workspaceId={selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""}
      />

      {/* Add Lead Sheet - 통합 리드 추가 Sheet */}
      <AddLeadSheet
        customerGroups={customerGroups || []}
        onOpenChange={setShowAddLeadSheet}
        open={showAddLeadSheet}
        selectedCustomerGroupId={selectedCustomerGroup || undefined}
        workspaceId={selectedWorkspaceId !== "all" ? selectedWorkspaceId : workspaces[0]?.id || ""}
      />

      {/* Missing Email Alert Modal */}
      <MissingEmailAlertModal
        isOpen={showMissingEmailAlert}
        leadsWithoutEmail={leadsWithoutEmail}
        onClose={() => {
          setShowMissingEmailAlert(false)
          setPendingCampaignAction(null)
        }}
        onEnrichFirst={handleEnrichAndCreateCampaign}
        onProceedWithValid={handleProceedWithValidLeads}
      />
    </div>
  )
}
