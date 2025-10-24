import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit,
  Trash2,
  Users,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useDeleteLead, useLeads } from "@/lib/api/hooks/leads"
import type { Lead, LeadStatus, LeadsParams } from "@/lib/api/types/lead"
import { formatRelativeTime } from "@/lib/date-utils"

interface LeadsTableWithPaginationProps {
  searchQuery: string
  searchType?: "all" | "company" | "country" | "email" | "website" | "industry" | "category"
  selectedStatuses: string[]
  selectedBusinessTypes: string[]
  selectedCountries: string[]
  selectedCities: string[]
  selectedCustomerGroup: string
  selectedLeads: string[]
  onToggleLead: (leadId: string) => void
  onToggleAll: (leadIds: string[]) => void
  onEditLead: (lead: Lead) => void
  onManageGroups: (lead: Lead) => void
  onLeadsDataChange?: (leads: Lead[]) => void
  isSelectAllMode?: boolean
  allLeadsSelected?: boolean
  onToggleSelectAll?: () => void
}

export function LeadsTableWithPagination({
  searchQuery,
  searchType = "all",
  selectedStatuses,
  // selectedBusinessTypes,
  // selectedCountries,
  // selectedCities,
  selectedCustomerGroup,
  selectedLeads,
  onToggleLead,
  onToggleAll,
  onEditLead,
  onManageGroups,
  onLeadsDataChange,
  isSelectAllMode = false,
  allLeadsSelected = false,
  onToggleSelectAll,
}: LeadsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )

  // 정렬 상태 관리
  const [sortField, setSortField] = useState<string>("createdAt")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  const limit = 10

  // localStorage 변경 감지
  useEffect(() => {
    const interval = setInterval(() => {
      const workspace = localStorage.getItem("selectedWorkspace") || "all"
      if (workspace !== currentWorkspace) {
        setCurrentWorkspace(workspace)
        setCurrentPage(1) // 워크스페이스 변경 시 첫 페이지로
      }
    }, 100)

    return () => clearInterval(interval)
  }, [currentWorkspace])

  const workspaceFilter = currentWorkspace === "all" ? undefined : [currentWorkspace]

  // Build params for API call
  const params: LeadsParams = {
    page: currentPage,
    limit: limit,
    leadStatus:
      selectedStatuses.length === 1
        ? (selectedStatuses[0] as LeadStatus)
        : selectedStatuses.length > 0
          ? "all"
          : undefined,
    search: searchQuery || undefined,
    searchType: searchType,
    workspaceIds: workspaceFilter,
    customerGroupId: selectedCustomerGroup || undefined,
  }

  // Use React Query hook for fetching leads
  const { data: leadsData, isFetching } = useLeads(params)
  const rawLeads = leadsData?.leads || []
  const totalPages = leadsData?.totalPages || 1
  const total = leadsData?.total || 0

  // 클라이언트 사이드 정렬
  const leads = useMemo(() => {
    if (!rawLeads.length) return rawLeads

    return [...rawLeads].sort((a, b) => {
      let aValue: string | number
      let bValue: string | number

      switch (sortField) {
        case "companyName":
          aValue = a.companyName || a.foundCompanyName || ""
          bValue = b.companyName || b.foundCompanyName || ""
          break
        case "websiteUrl":
          aValue = a.websiteUrl || ""
          bValue = b.websiteUrl || ""
          break
        case "description":
          aValue = a.description || ""
          bValue = b.description || ""
          break
        case "leadStatus":
          aValue = a.leadStatus
          bValue = b.leadStatus
          break
        case "businessType":
          aValue = a.businessType || ""
          bValue = b.businessType || ""
          break
        case "country":
          aValue = a.country || ""
          bValue = b.country || ""
          break
        case "city":
          aValue = a.city || ""
          bValue = b.city || ""
          break
        case "foundedYear":
          aValue = a.foundedYear || 0
          bValue = b.foundedYear || 0
          break
        case "employeeCount": {
          // 직원수를 숫자로 변환하여 정렬
          const aEmployeeCount = a.employeeCount || ""
          const bEmployeeCount = b.employeeCount || ""
          aValue = parseInt(aEmployeeCount.replace(/\D/g, ""), 10) || 0
          bValue = parseInt(bEmployeeCount.replace(/\D/g, ""), 10) || 0
          break
        }
        case "phone": {
          // 전화번호 (첫 번째 전화번호로 정렬)
          const aPhone =
            (a.contacts || []).find((c) => c.contactType === "phone")?.contactValue || ""
          const bPhone =
            (b.contacts || []).find((c) => c.contactType === "phone")?.contactValue || ""
          aValue = aPhone
          bValue = bPhone
          break
        }
        case "email": {
          // 이메일 (첫 번째 이메일로 정렬)
          const aEmail =
            (a.contacts || []).find((c) => c.contactType === "email")?.contactValue || ""
          const bEmail =
            (b.contacts || []).find((c) => c.contactType === "email")?.contactValue || ""
          aValue = aEmail
          bValue = bEmail
          break
        }
        case "facebook": {
          // Facebook URL (첫 번째 Facebook URL로 정렬)
          const aFacebook = (a.socialMedia || []).find((s) => s.platform === "facebook")?.url || ""
          const bFacebook = (b.socialMedia || []).find((s) => s.platform === "facebook")?.url || ""
          aValue = aFacebook
          bValue = bFacebook
          break
        }
        case "instagram": {
          // Instagram URL (첫 번째 Instagram URL로 정렬)
          const aInstagram =
            (a.socialMedia || []).find((s) => s.platform === "instagram")?.url || ""
          const bInstagram =
            (b.socialMedia || []).find((s) => s.platform === "instagram")?.url || ""
          aValue = aInstagram
          bValue = bInstagram
          break
        }
        case "twitter": {
          // Twitter URL (첫 번째 Twitter URL로 정렬)
          const aTwitter = (a.socialMedia || []).find((s) => s.platform === "twitter")?.url || ""
          const bTwitter = (b.socialMedia || []).find((s) => s.platform === "twitter")?.url || ""
          aValue = aTwitter
          bValue = bTwitter
          break
        }
        case "linkedin": {
          // LinkedIn URL (첫 번째 LinkedIn URL로 정렬)
          const aLinkedin = (a.socialMedia || []).find((s) => s.platform === "linkedin")?.url || ""
          const bLinkedin = (b.socialMedia || []).find((s) => s.platform === "linkedin")?.url || ""
          aValue = aLinkedin
          bValue = bLinkedin
          break
        }
        case "products": {
          // 제품 (첫 번째 제품명으로 정렬)
          const aProduct = (a.products || [])[0]?.productName || ""
          const bProduct = (b.products || [])[0]?.productName || ""
          aValue = aProduct
          bValue = bProduct
          break
        }
        case "businessSectors": {
          // 산업 부문 (첫 번째 산업 부문으로 정렬)
          const aSector = (a.businessSectors || [])[0]?.sectorName || ""
          const bSector = (b.businessSectors || [])[0]?.sectorName || ""
          aValue = aSector
          bValue = bSector
          break
        }
        case "productCategories": {
          // 제품 카테고리 (첫 번째 제품 카테고리로 정렬)
          const aCategory = (a.productCategories || [])[0]?.categoryName || ""
          const bCategory = (b.productCategories || [])[0]?.categoryName || ""
          aValue = aCategory
          bValue = bCategory
          break
        }
        case "industryTypes": {
          // 산업 카테고리 (첫 번째 산업 카테고리로 정렬)
          const aIndustry = (a.industryTypes || [])[0]?.industryName || ""
          const bIndustry = (b.industryTypes || [])[0]?.industryName || ""
          aValue = aIndustry
          bValue = bIndustry
          break
        }
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      // 문자열 비교
      if (typeof aValue === "string" && typeof bValue === "string") {
        const comparison = aValue.localeCompare(bValue, "ko", {
          numeric: true,
        })
        return sortOrder === "asc" ? comparison : -comparison
      }

      // 숫자 비교
      if (typeof aValue === "number" && typeof bValue === "number") {
        return sortOrder === "asc" ? aValue - bValue : bValue - aValue
      }

      return 0
    })
  }, [rawLeads, sortField, sortOrder])

  // Delete mutation
  const deleteLead = useDeleteLead()

  console.log("leads", leads)

  // 리드 데이터가 변경될 때마다 부모에게 알림
  useEffect(() => {
    if (onLeadsDataChange && leads.length > 0) {
      onLeadsDataChange(leads)
    }
  }, [leads, onLeadsDataChange])

  const getStatusText = (status: LeadStatus) => {
    const statusMap: Record<LeadStatus, string> = {
      new: "신규",
      contacted: "연락됨",
      qualified: "적격",
      unqualified: "부적격",
      converted: "전환됨",
      lost: "실패",
      unsubscribed: "구독취소",
    }
    return statusMap[status] || status
  }

  const getStatusBadgeVariant = (status: LeadStatus) => {
    switch (status) {
      case "new":
        return "default"
      case "contacted":
        return "secondary"
      case "qualified":
        return "outline"
      case "converted":
        return "default"
      default:
        return "outline"
    }
  }

  const handleToggleAll = useCallback(() => {
    if (isSelectAllMode && onToggleSelectAll) {
      // 전체 선택 모드에서는 헤더 체크박스가 전체 선택/해제를 담당
      onToggleSelectAll()
    } else {
      // 일반 모드에서는 현재 페이지의 모든 리드 선택/해제
      onToggleAll(leads.map((l) => l.id))
    }
  }, [leads, onToggleAll, isSelectAllMode, onToggleSelectAll])

  // 정렬 핸들러
  const handleSort = useCallback(
    (field: string) => {
      if (sortField === field) {
        // 같은 필드 클릭 시 정렬 순서 변경
        setSortOrder(sortOrder === "asc" ? "desc" : "asc")
      } else {
        // 다른 필드 클릭 시 해당 필드로 정렬 (기본 desc)
        setSortField(field)
        setSortOrder("desc")
      }
      // 클라이언트 사이드 정렬이므로 페이지 이동 불필요
    },
    [sortField, sortOrder],
  )

  // 정렬 아이콘 렌더링 함수
  const renderSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-4 w-4 text-blue-500" />
    ) : (
      <ArrowDown className="h-4 w-4 text-blue-500" />
    )
  }

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    setPageInputValue(page.toString())
  }

  const handlePageInputChange = (value: string) => {
    setPageInputValue(value)
  }

  const handlePageInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const page = parseInt(pageInputValue, 10)
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page)
      } else {
        setPageInputValue(currentPage.toString())
      }
    }
  }

  const handlePageInputBlur = () => {
    const page = parseInt(pageInputValue, 10)
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page)
    } else {
      setPageInputValue(currentPage.toString())
    }
  }

  const getPageNumbers = () => {
    const maxVisiblePages = 5
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1)
    }

    const pages = []
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i)
    }
    return pages
  }

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success("클립보드에 복사되었습니다")
    } catch (error) {
      console.error("Failed to copy:", error)
      toast.error("복사에 실패했습니다")
    }
  }

  const handleDeleteLead = (leadId: string, leadName: string) => {
    setLeadToDelete({ id: leadId, name: leadName })
    setDeleteConfirmOpen(true)
  }

  const confirmDelete = () => {
    if (leadToDelete) {
      deleteLead.mutate(leadToDelete.id)
      setLeadToDelete(null)
    }
  }

  return (
    <>
      {/* Leads Table */}
      <div className="rounded-md border">
        <div
          className="overflow-x-auto overflow-y-visible"
          style={{
            scrollbarGutter: "stable",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <table className="w-full" style={{ tableLayout: "auto" }}>
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th
                  className="sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  <Checkbox
                    checked={
                      isSelectAllMode
                        ? allLeadsSelected
                        : leads.length > 0 && selectedLeads.length === leads.length
                    }
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "180px" }}
                  onClick={() => handleSort("companyName")}
                >
                  <div className="flex items-center gap-1">
                    회사명
                    {renderSortIcon("companyName")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "120px" }}
                  onClick={() => handleSort("contactName")}
                >
                  <div className="flex items-center gap-1">
                    담당자명
                    {renderSortIcon("contactName")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "220px" }}
                  onClick={() => handleSort("websiteUrl")}
                >
                  <div className="flex items-center gap-1">
                    웹사이트
                    {renderSortIcon("websiteUrl")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "250px" }}
                  onClick={() => handleSort("description")}
                >
                  <div className="flex items-center gap-1">
                    회사 설명
                    {renderSortIcon("description")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "100px" }}
                  onClick={() => handleSort("leadStatus")}
                >
                  <div className="flex items-center gap-1">
                    상태
                    {renderSortIcon("leadStatus")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "120px" }}
                  onClick={() => handleSort("businessType")}
                >
                  <div className="flex items-center gap-1">
                    업종
                    {renderSortIcon("businessType")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "100px" }}
                  onClick={() => handleSort("country")}
                >
                  <div className="flex items-center gap-1">
                    국가
                    {renderSortIcon("country")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "100px" }}
                  onClick={() => handleSort("city")}
                >
                  <div className="flex items-center gap-1">
                    도시
                    {renderSortIcon("city")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "100px" }}
                  onClick={() => handleSort("foundedYear")}
                >
                  <div className="flex items-center gap-1">
                    설립년도
                    {renderSortIcon("foundedYear")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "100px" }}
                  onClick={() => handleSort("employeeCount")}
                >
                  <div className="flex items-center gap-1">
                    직원수
                    {renderSortIcon("employeeCount")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "140px" }}
                  onClick={() => handleSort("phone")}
                >
                  <div className="flex items-center gap-1">
                    전화번호
                    {renderSortIcon("phone")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "180px" }}
                  onClick={() => handleSort("email")}
                >
                  <div className="flex items-center gap-1">
                    이메일
                    {renderSortIcon("email")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("facebook")}
                >
                  <div className="flex items-center gap-1">
                    Facebook
                    {renderSortIcon("facebook")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("instagram")}
                >
                  <div className="flex items-center gap-1">
                    Instagram
                    {renderSortIcon("instagram")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("twitter")}
                >
                  <div className="flex items-center gap-1">
                    Twitter
                    {renderSortIcon("twitter")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("linkedin")}
                >
                  <div className="flex items-center gap-1">
                    LinkedIn
                    {renderSortIcon("linkedin")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("products")}
                >
                  <div className="flex items-center gap-1">
                    제품
                    {renderSortIcon("products")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("businessSectors")}
                >
                  <div className="flex items-center gap-1">
                    산업 부문
                    {renderSortIcon("businessSectors")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("productCategories")}
                >
                  <div className="flex items-center gap-1">
                    제품 카테고리
                    {renderSortIcon("productCategories")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "150px" }}
                  onClick={() => handleSort("industryTypes")}
                >
                  <div className="flex items-center gap-1">
                    산업 카테고리
                    {renderSortIcon("industryTypes")}
                  </div>
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 select-none"
                  style={{ minWidth: "120px" }}
                  onClick={() => handleSort("createdAt")}
                >
                  <div className="flex items-center gap-1">
                    생성일
                    {renderSortIcon("createdAt")}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {leads.map((lead) => (
                <ContextMenu key={lead.id}>
                  <ContextMenuTrigger asChild>
                    <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group/row relative">
                      {/* 1. Checkbox */}
                      <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-700">
                        <Checkbox
                          checked={
                            isSelectAllMode
                              ? allLeadsSelected || selectedLeads.includes(lead.id)
                              : selectedLeads.includes(lead.id)
                          }
                          onCheckedChange={() => onToggleLead(lead.id)}
                        />
                      </td>

                      {/* 2. 회사명 (companyName) */}
                      <td className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.companyName || lead.foundCompanyName ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="cursor-default line-clamp-3 max-w-[180px]"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {lead.companyName || lead.foundCompanyName}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="whitespace-pre-wrap">
                                    {lead.companyName || lead.foundCompanyName}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  lead.companyName || lead.foundCompanyName || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 3. 담당자명 (contactName) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.contactName ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="cursor-default line-clamp-2 max-w-[120px]"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {lead.contactName}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="whitespace-pre-wrap">{lead.contactName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.contactName || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 4. 웹사이트 (websiteUrl) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.websiteUrl ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <a
                                    href={lead.websiteUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block max-w-[220px]"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {lead.websiteUrl}
                                  </a>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="break-all">{lead.websiteUrl}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.websiteUrl || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 4. 회사 설명 (description) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.description ? (
                          <>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className="cursor-default max-w-[250px]"
                                    style={{
                                      display: "-webkit-box",
                                      WebkitLineClamp: 3,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                    }}
                                  >
                                    {lead.description}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md">
                                  <p className="whitespace-pre-wrap">{lead.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.description || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 5. 상태 (leadStatus) */}
                      <td className="p-2 whitespace-nowrap text-sm">
                        <Badge variant={getStatusBadgeVariant(lead.leadStatus)} className="text-xs">
                          {getStatusText(lead.leadStatus)}
                        </Badge>
                      </td>

                      {/* 6. 업종 (businessType) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.businessType ? (
                          <>
                            <div
                              className="cursor-default max-w-[120px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.businessType}
                            >
                              {lead.businessType}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.businessType || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 7. 국가 (country) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.country ? (
                          <>
                            <div className="cursor-default" title={lead.country}>
                              {lead.country}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.country || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 8. 도시 (city) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.city ? (
                          <>
                            <div className="cursor-default" title={lead.city}>
                              {lead.city}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.city || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 9. 설립년도 (foundedYear) */}
                      <td className="p-2 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">
                        {lead.foundedYear || "-"}
                      </td>

                      {/* 10. 직원수 (employeeCount) */}
                      <td className="p-2 text-sm text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.employeeCount ? (
                          <>
                            <div className="cursor-default" title={lead.employeeCount}>
                              {lead.employeeCount}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(lead.employeeCount || "")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 11. 전화번호 (contacts - phone) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.contacts &&
                        lead.contacts.filter((c) => c.contactType === "phone").length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[140px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.contacts
                                .filter((c) => c.contactType === "phone")
                                .map((c) => c.contactValue)
                                .join(", ")}
                            >
                              {lead.contacts
                                .filter((c) => c.contactType === "phone")
                                .map((c) => c.contactValue)
                                .join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.contacts || [])
                                    .filter((c) => c.contactType === "phone")
                                    .map((c) => c.contactValue)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 12. 이메일 (contacts - email) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.contacts &&
                        lead.contacts.filter((c) => c.contactType === "email").length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[180px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.contacts
                                .filter((c) => c.contactType === "email")
                                .map((c) => c.contactValue)
                                .join(", ")}
                            >
                              {lead.contacts
                                .filter((c) => c.contactType === "email")
                                .map((c) => c.contactValue)
                                .join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.contacts || [])
                                    .filter((c) => c.contactType === "email")
                                    .map((c) => c.contactValue)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 13. Facebook */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.socialMedia &&
                        lead.socialMedia.filter((s) => s.platform === "facebook").length > 0 ? (
                          <>
                            <div className="max-w-[150px]">
                              {lead.socialMedia
                                .filter((s) => s.platform === "facebook")
                                .map((social, index) => (
                                  <a
                                    key={social.id || index}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block truncate"
                                    title={social.username || social.url}
                                  >
                                    {social.username || social.url}
                                  </a>
                                ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.socialMedia || [])
                                    .filter((s) => s.platform === "facebook")
                                    .map((s) => s.url)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 14. Instagram */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.socialMedia &&
                        lead.socialMedia.filter((s) => s.platform === "instagram").length > 0 ? (
                          <>
                            <div className="max-w-[150px]">
                              {lead.socialMedia
                                .filter((s) => s.platform === "instagram")
                                .map((social, index) => (
                                  <a
                                    key={social.id || index}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block truncate"
                                    title={social.username || social.url}
                                  >
                                    {social.username || social.url}
                                  </a>
                                ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.socialMedia || [])
                                    .filter((s) => s.platform === "instagram")
                                    .map((s) => s.url)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 15. Twitter */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.socialMedia &&
                        lead.socialMedia.filter((s) => s.platform === "twitter").length > 0 ? (
                          <>
                            <div className="max-w-[150px]">
                              {lead.socialMedia
                                .filter((s) => s.platform === "twitter")
                                .map((social, index) => (
                                  <a
                                    key={social.id || index}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block truncate"
                                    title={social.username || social.url}
                                  >
                                    {social.username || social.url}
                                  </a>
                                ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.socialMedia || [])
                                    .filter((s) => s.platform === "twitter")
                                    .map((s) => s.url)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 16. LinkedIn */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.socialMedia &&
                        lead.socialMedia.filter((s) => s.platform === "linkedin").length > 0 ? (
                          <>
                            <div className="max-w-[150px]">
                              {lead.socialMedia
                                .filter((s) => s.platform === "linkedin")
                                .map((social, index) => (
                                  <a
                                    key={social.id || index}
                                    href={social.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline block truncate"
                                    title={social.username || social.url}
                                  >
                                    {social.username || social.url}
                                  </a>
                                ))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.socialMedia || [])
                                    .filter((s) => s.platform === "linkedin")
                                    .map((s) => s.url)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          <span>-</span>
                        )}
                      </td>

                      {/* 17. 제품 (products) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.products && lead.products.length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[150px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.products.map((p) => p.productName).join(", ")}
                            >
                              {lead.products.map((p) => p.productName).join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.products || []).map((p) => p.productName).join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 18. 산업 부문 (businessSectors) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.businessSectors && lead.businessSectors.length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[150px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.businessSectors.map((s) => s.sectorName).join(", ")}
                            >
                              {lead.businessSectors.map((s) => s.sectorName).join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.businessSectors || [])
                                    .map((s) => s.sectorName)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 19. 제품 카테고리 (productCategories) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.productCategories && lead.productCategories.length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[150px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.productCategories.map((c) => c.categoryName).join(", ")}
                            >
                              {lead.productCategories.map((c) => c.categoryName).join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.productCategories || [])
                                    .map((c) => c.categoryName)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 20. 산업 카테고리 (industryTypes) */}
                      <td className="p-2 text-xs text-gray-900 dark:text-gray-100 group/cell relative">
                        {lead.industryTypes && lead.industryTypes.length > 0 ? (
                          <>
                            <div
                              className="cursor-default max-w-[150px]"
                              style={{
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                              title={lead.industryTypes.map((i) => i.industryName).join(", ")}
                            >
                              {lead.industryTypes.map((i) => i.industryName).join(", ")}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover/cell:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCopyToClipboard(
                                  (lead.industryTypes || [])
                                    .map((i) => i.industryName)
                                    .join(", ") || "",
                                )
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 21. 생성일 (createdAt) */}
                      <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {formatRelativeTime(lead.createdAt)}
                      </td>
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem onClick={() => onEditLead(lead)} className="cursor-pointer">
                      <Edit className="mr-2 h-4 w-4" />
                      리드 편집
                    </ContextMenuItem>
                    <ContextMenuItem
                      onClick={() => onManageGroups(lead)}
                      className="cursor-pointer"
                    >
                      <Users className="mr-2 h-4 w-4" />
                      그룹 관리
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onClick={() =>
                        handleDeleteLead(
                          lead.id,
                          lead.companyName || lead.foundCompanyName || "이름 없음",
                        )
                      }
                      className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      리드 삭제
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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
            onClick={() => handlePageChange(1)}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            처음
          </Button>

          {/* Previous Page */}
          <Button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            <ChevronLeft className="h-4 w-4" />
            이전
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              key={page}
              onClick={() => handlePageChange(page)}
              disabled={isFetching}
              variant={page === currentPage ? "default" : "outline"}
              size="sm"
              className="px-3 min-w-[40px]"
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages || isFetching}
            variant="outline"
            size="sm"
            className="px-3"
          >
            다음
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            onClick={() => handlePageChange(totalPages)}
            disabled={currentPage >= totalPages || isFetching}
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
            onChange={(e) => handlePageInputChange(e.target.value)}
            onKeyDown={handlePageInputKeyDown}
            onBlur={handlePageInputBlur}
            className="w-20 h-8 text-sm text-center"
            disabled={isFetching}
          />
          <span className="text-sm text-muted-foreground">/ {totalPages || 1}</span>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="리드 삭제"
        description={`"${
          leadToDelete?.name || ""
        }" 리드를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.`}
        confirmText="삭제"
        cancelText="취소"
        onConfirm={confirmDelete}
        variant="destructive"
      />
    </>
  )
}
