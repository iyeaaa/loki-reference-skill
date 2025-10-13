import { ChevronLeft, ChevronRight, Copy, Edit, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLeads } from "@/lib/api/hooks/leads"
import type { Lead, LeadStatus, LeadsParams } from "@/lib/api/types/lead"
import { formatRelativeTime } from "@/lib/date-utils"

interface LeadsTableWithPaginationProps {
  searchQuery: string
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
}

export function LeadsTableWithPagination({
  searchQuery,
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
}: LeadsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )

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
    workspaceIds: workspaceFilter,
    customerGroupId: selectedCustomerGroup || undefined,
  }

  // Use React Query hook for fetching leads
  const { data: leadsData, isFetching } = useLeads(params)
  const leads = leadsData?.leads || []
  const totalPages = leadsData?.totalPages || 1
  const total = leadsData?.total || 0

  console.log("leads", leads)

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
    onToggleAll(leads.map((l) => l.id))
  }, [leads, onToggleAll])

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
                    checked={leads.length > 0 && selectedLeads.length === leads.length}
                    onCheckedChange={handleToggleAll}
                  />
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "180px" }}
                >
                  회사명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "220px" }}
                >
                  웹사이트
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "250px" }}
                >
                  회사 설명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  상태
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  업종
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  국가
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  도시
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  설립년도
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  직원수
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "140px" }}
                >
                  전화번호
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "180px" }}
                >
                  이메일
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  Facebook
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  Instagram
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  Twitter
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  LinkedIn
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  제품
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  산업 부문
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  생성일
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group/row relative"
                >
                  {/* 1. Checkbox */}
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-700">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
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
                            handleCopyToClipboard(lead.companyName || lead.foundCompanyName || "")
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      "-"
                    )}
                  </td>

                  {/* 3. 웹사이트 (websiteUrl) */}
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
                              (lead.businessSectors || []).map((s) => s.sectorName).join(", ") ||
                                "",
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

                  {/* 19. 생성일 (createdAt) */}
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(lead.createdAt)}
                  </td>

                  {/* Hover Action Buttons */}
                  <td className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 transition-opacity">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditLead(lead)
                        }}
                        className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                        title="리드 편집"
                      >
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onManageGroups(lead)
                        }}
                        className="h-8 w-8 p-0 hover:bg-violet-50 hover:text-violet-600"
                        title="그룹 관리"
                      >
                        <Users className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
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
    </>
  )
}
