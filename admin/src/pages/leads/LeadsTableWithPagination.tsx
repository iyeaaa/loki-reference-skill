import { ChevronLeft, ChevronRight, Edit } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
}: LeadsTableWithPaginationProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all"
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
                  style={{ minWidth: "150px" }}
                >
                  회사명
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "200px" }}
                >
                  웹사이트
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "100px" }}
                >
                  업종
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  상태
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
                  style={{ minWidth: "120px" }}
                >
                  전화번호
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "150px" }}
                >
                  이메일
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  Facebook
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  Instagram
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  Twitter
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ minWidth: "120px" }}
                >
                  LinkedIn
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  리드점수
                </th>
                <th
                  className="p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  생성일
                </th>
                <th
                  className="sticky right-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                  style={{ width: "1%", whiteSpace: "nowrap" }}
                >
                  편집
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Checkbox
                      checked={selectedLeads.includes(lead.id)}
                      onCheckedChange={() => onToggleLead(lead.id)}
                    />
                  </td>
                  <td
                    className="p-2 text-sm font-medium text-gray-900 dark:text-gray-100"
                    title={lead.companyName || lead.foundCompanyName || "-"}
                    style={{
                      maxWidth: "200px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lead.companyName || lead.foundCompanyName || "-"}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={lead.websiteUrl || lead.finalUrl || "-"}
                    style={{
                      maxWidth: "300px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lead.websiteUrl || lead.finalUrl || "-"}
                  </td>
                  <td
                    className="p-2 text-sm text-gray-900 dark:text-gray-100"
                    title={lead.businessType || "-"}
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {lead.businessType || "-"}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm">
                    <Badge variant={getStatusBadgeVariant(lead.leadStatus)} className="text-xs">
                      {getStatusText(lead.leadStatus)}
                    </Badge>
                  </td>
                  <td className="p-2 text-sm text-gray-900 dark:text-gray-100">
                    {lead.country || ""}
                  </td>
                  <td className="p-2 text-sm text-gray-900 dark:text-gray-100">
                    {lead.city || ""}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.contacts
                      ?.filter((c) => c.contactType === "phone")
                      .map((contact) => (
                        <div
                          key={contact.id}
                          className="truncate max-w-[120px]"
                          title={contact.contactValue}
                        >
                          {contact.contactValue}
                        </div>
                      ))}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.contacts
                      ?.filter((c) => c.contactType === "email")
                      .map((contact) => (
                        <div
                          key={contact.id}
                          className="truncate max-w-[150px]"
                          title={contact.contactValue}
                        >
                          {contact.contactValue}
                        </div>
                      ))}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.socialMedia
                      ?.filter((s) => s.platform === "facebook")
                      .map((social) => (
                        <a
                          key={social.id}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[120px] block"
                          title={social.url}
                        >
                          {social.username || social.url}
                        </a>
                      ))}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.socialMedia
                      ?.filter((s) => s.platform === "instagram")
                      .map((social) => (
                        <a
                          key={social.id}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[120px] block"
                          title={social.url}
                        >
                          {social.username || social.url}
                        </a>
                      ))}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.socialMedia
                      ?.filter((s) => s.platform === "twitter")
                      .map((social) => (
                        <a
                          key={social.id}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[120px] block"
                          title={social.url}
                        >
                          {social.username || social.url}
                        </a>
                      ))}
                  </td>
                  <td className="p-2 text-xs text-gray-900 dark:text-gray-100">
                    {lead.socialMedia
                      ?.filter((s) => s.platform === "linkedin")
                      .map((social) => (
                        <a
                          key={social.id}
                          href={social.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline truncate max-w-[120px] block"
                          title={social.url}
                        >
                          {social.username || social.url}
                        </a>
                      ))}
                  </td>
                  <td className="p-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 text-center">
                    {lead.leadScore || ""}
                  </td>
                  <td className="p-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {formatRelativeTime(lead.createdAt)}
                  </td>
                  <td className="sticky right-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditLead(lead)}
                      className="text-xs h-8 px-3"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
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
