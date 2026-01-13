import { ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Mail, Search } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { CompanyAvatar } from "@/components/CompanyAvatar"
import { CountryFlag } from "@/components/CountryFlag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"

type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
  contactName?: string
  description?: string
  employeeCount?: string
  businessType?: string
  websiteUrl?: string
}

type LeadsSectionProps = {
  leads: Lead[]
  selectedLeadIds: string[]
  toggleLead: (id: string) => void
  toggleAllLeads: () => void
  onLeadClick: (lead: Lead) => void
  isKorean: boolean
}

export function LeadsSection({
  leads,
  selectedLeadIds,
  toggleLead,
  toggleAllLeads,
  onLeadClick,
  isKorean,
}: LeadsSectionProps) {
  const [leadSearchQuery, setLeadSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "card">("table")
  const [currentPage, setCurrentPage] = useState(1)

  // Different page size for different view modes
  const LEADS_PER_PAGE = viewMode === "card" ? 9 : 10

  // Get size label
  const getSizeLabel = (employeeCount?: string) => {
    if (!employeeCount) {
      return null
    }
    const count = employeeCount.toLowerCase()
    if (count.includes("1000") || count === "enterprise") {
      return isKorean ? "대기업" : "Enterprise"
    }
    if (count.includes("250") || count === "large") {
      return isKorean ? "대기업" : "Large"
    }
    if (count.includes("50") || count === "medium") {
      return isKorean ? "중기업" : "Medium"
    }
    if (count.includes("10") || count === "small") {
      return isKorean ? "소기업" : "Small"
    }
    return employeeCount
  }

  // Filtered leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearchQuery.trim()) {
      return leads
    }
    const query = leadSearchQuery.toLowerCase()
    return leads.filter(
      (lead) =>
        lead.companyName?.toLowerCase().includes(query) ||
        lead.email?.toLowerCase().includes(query) ||
        lead.country?.toLowerCase().includes(query),
    )
  }, [leads, leadSearchQuery])

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE)
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * LEADS_PER_PAGE
    return filteredLeads.slice(startIndex, startIndex + LEADS_PER_PAGE)
  }, [filteredLeads, currentPage, LEADS_PER_PAGE])

  // Reset to page 1 when search or view mode changes
  useEffect(() => {
    if (leadSearchQuery || viewMode) {
      setCurrentPage(1)
    }
  }, [leadSearchQuery, viewMode])

  // Leads without email
  const leadsWithoutEmail = useMemo(() => leads.filter((l) => !l.email), [leads])

  // Selected count
  const selectedCount = selectedLeadIds.filter((id) =>
    leads.find((l) => l.id === id && l.email),
  ).length

  return (
    <Card className="h-full border-0 bg-white shadow-gray-200/50 shadow-lg">
      <CardContent className="p-6">
        {/* Header with view toggle */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">{isKorean ? "연락할 바이어" : "Buyers to contact"}</h3>
            <p className="text-gray-500 text-sm">
              {isKorean
                ? `${selectedCount}명 선택됨 / 전체 ${leads.length}명`
                : `${selectedCount} selected / ${leads.length} total`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup
              onValueChange={(value) => {
                if (value) {
                  setViewMode(value as "table" | "card")
                }
              }}
              type="single"
              value={viewMode}
            >
              <ToggleGroupItem aria-label="테이블 뷰" size="sm" value="table">
                <LayoutList className="h-4 w-4" />
              </ToggleGroupItem>
              <ToggleGroupItem aria-label="카드 뷰" size="sm" value="card">
                <LayoutGrid className="h-4 w-4" />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Search & Actions */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-gray-400" />
            <Input
              className="pl-9"
              onChange={(e) => setLeadSearchQuery(e.target.value)}
              placeholder={isKorean ? "회사명, 이메일 검색..." : "Search company, email..."}
              value={leadSearchQuery}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={toggleAllLeads} size="sm" variant="outline">
              {selectedLeadIds.length === leads.length
                ? isKorean
                  ? "전체 해제"
                  : "Deselect all"
                : isKorean
                  ? "전체 선택"
                  : "Select all"}
            </Button>
          </div>
        </div>

        {/* Leads without email warning */}
        {leadsWithoutEmail.length > 0 && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-amber-800 text-sm">
              {isKorean
                ? `${leadsWithoutEmail.length}명은 이메일이 없어 발송에서 제외됩니다`
                : `${leadsWithoutEmail.length} leads without email will be excluded`}
            </p>
          </div>
        )}

        {/* TABLE VIEW */}
        {viewMode === "table" && (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/80">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedLeadIds.length === leads.length && leads.length > 0}
                      onCheckedChange={toggleAllLeads}
                    />
                  </TableHead>
                  <TableHead className="w-[150px]">{isKorean ? "회사명" : "Company"}</TableHead>
                  <TableHead className="w-[250px]">{isKorean ? "설명" : "Description"}</TableHead>
                  <TableHead className="w-[140px]">{isKorean ? "이메일" : "Email"}</TableHead>
                  <TableHead className="w-[60px]">{isKorean ? "국가" : "Country"}</TableHead>
                  <TableHead className="w-[100px]">{isKorean ? "업종" : "Industry"}</TableHead>
                  <TableHead className="w-[90px]">{isKorean ? "규모" : "Size"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id)
                  const hasEmail = !!lead.email

                  return (
                    <TableRow
                      className={`cursor-pointer transition-colors ${isSelected ? "bg-blue-50/50" : ""} ${hasEmail ? "hover:bg-gray-50" : "opacity-50"}`}
                      key={lead.id}
                      onClick={() => hasEmail && onLeadClick(lead)}
                    >
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          disabled={!hasEmail}
                          onCheckedChange={() => hasEmail && toggleLead(lead.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell className="max-w-[150px] font-medium">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <CompanyAvatar
                            companyName={lead.companyName}
                            size="sm"
                            websiteUrl={lead.websiteUrl}
                          />
                          <span className="truncate">{lead.companyName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <p className="truncate text-gray-600 text-sm">
                          {lead.description || <span className="text-gray-400 italic">-</span>}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="truncate text-gray-600 text-sm">
                          {lead.email || (
                            <span className="text-gray-400 italic">
                              {isKorean ? "없음" : "N/A"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="w-[60px]">
                        <CountryFlag countryName={lead.country} size="lg" />
                      </TableCell>
                      <TableCell className="max-w-[100px]">
                        <div className="truncate text-gray-600 text-sm">
                          {lead.businessType || lead.industry || "-"}
                        </div>
                      </TableCell>
                      <TableCell className="w-[90px]">
                        {getSizeLabel(lead.employeeCount) ? (
                          <Badge className="text-xs" variant="secondary">
                            {getSizeLabel(lead.employeeCount)}
                          </Badge>
                        ) : (
                          <span className="text-gray-400 text-sm">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* CARD VIEW */}
        {viewMode === "card" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedLeads.map((lead) => {
              const isSelected = selectedLeadIds.includes(lead.id)
              const hasEmail = !!lead.email

              return (
                <button
                  className={`group relative flex min-h-[140px] flex-col rounded-xl border-2 p-4 text-left transition-all duration-200 ${
                    isSelected
                      ? "border-blue-400 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-blue-100 shadow-md"
                      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md"
                  } ${hasEmail ? "cursor-pointer" : "opacity-50"}`}
                  disabled={!hasEmail}
                  key={lead.id}
                  onClick={() => {
                    if (hasEmail) {
                      onLeadClick(lead)
                    }
                  }}
                  type="button"
                >
                  {/* Selection checkbox */}
                  <button
                    aria-label={isSelected ? "선택 해제" : "선택"}
                    className="absolute top-3 left-3"
                    disabled={!hasEmail}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (hasEmail) {
                        toggleLead(lead.id)
                      }
                    }}
                    type="button"
                  >
                    <Checkbox checked={isSelected} disabled={!hasEmail} />
                  </button>

                  {/* Company Name with Avatar */}
                  <div className="mb-1 flex items-center gap-2 pr-2 pl-7">
                    <CompanyAvatar
                      companyName={lead.companyName}
                      size="sm"
                      websiteUrl={lead.websiteUrl}
                    />
                    <h4 className="truncate font-semibold text-gray-900 text-sm">
                      {lead.companyName}
                    </h4>
                  </div>

                  {/* Business Type */}
                  {(lead.businessType || lead.industry) && (
                    <p className="mb-2 truncate pl-7 text-gray-500 text-xs">
                      {lead.businessType || lead.industry}
                    </p>
                  )}

                  <div className="flex-1" />

                  {/* Info */}
                  <div className="space-y-1 pl-7">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 shrink-0 text-gray-400" />
                      <span className="truncate text-gray-600 text-xs">
                        {lead.email || (isKorean ? "이메일 없음" : "No email")}
                      </span>
                    </div>
                    {lead.country && (
                      <div className="flex items-center gap-1.5">
                        <CountryFlag countryName={lead.country} size="sm" />
                        <span className="text-gray-500 text-xs">{lead.country}</span>
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <p className="text-gray-500 text-sm">
              {isKorean
                ? `${filteredLeads.length}개 바이어 중 ${(currentPage - 1) * LEADS_PER_PAGE + 1}-${Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} 표시`
                : `Showing ${(currentPage - 1) * LEADS_PER_PAGE + 1}-${Math.min(currentPage * LEADS_PER_PAGE, filteredLeads.length)} of ${filteredLeads.length} buyers`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                size="sm"
                variant="outline"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-2 text-gray-600 text-sm">
                {currentPage} / {totalPages}
              </span>
              <Button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                size="sm"
                variant="outline"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
