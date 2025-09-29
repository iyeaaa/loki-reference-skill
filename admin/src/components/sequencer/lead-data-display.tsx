"use client"

import { Search } from "lucide-react"
import { useMemo } from "react"
import { Input } from "@/components/ui/input"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Lead } from "../../lib/atoms"

// Lead 타입 확장
interface EnhancedLead extends Lead {
  industryType?: string
  productCategory?: string
  country?: string
  description?: string
  website?: string
}

interface LeadDataDisplayProps {
  leads: EnhancedLead[]
  searchTerm: string
  onSearchChange: (value: string) => void
  filterBy: "all" | "company" | "email"
  onFilterChange: (value: "all" | "company" | "email") => void
  currentPage: number
  onPageChange: (page: number) => void
  itemsPerPage: number
  onItemsPerPageChange: (count: number) => void
}

export function LeadDataDisplay({
  leads,
  searchTerm,
  onSearchChange,
  filterBy,
  onFilterChange,
  currentPage,
  onPageChange,
  itemsPerPage,
  onItemsPerPageChange,
}: LeadDataDisplayProps) {
  // 검색 및 필터링된 리드
  const filteredLeads = useMemo(() => {
    if (!searchTerm) return leads

    const term = searchTerm.toLowerCase()
    return leads.filter((lead) => {
      if (filterBy === "company") {
        return lead.company.toLowerCase().includes(term)
      } else if (filterBy === "email") {
        return lead.email.toLowerCase().includes(term)
      } else {
        return (
          lead.company.toLowerCase().includes(term) ||
          lead.email.toLowerCase().includes(term) ||
          lead.description?.toLowerCase().includes(term) ||
          lead.industryType?.toLowerCase().includes(term) ||
          lead.country?.toLowerCase().includes(term) ||
          lead.website?.toLowerCase().includes(term)
        )
      }
    })
  }, [leads, searchTerm, filterBy])

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / itemsPerPage))
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredLeads.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredLeads, currentPage, itemsPerPage])

  if (leads.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">리드 데이터가 없습니다.</div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">리드 데이터 ({filteredLeads.length}개)</div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Select
              value={filterBy}
              onValueChange={(value: "all" | "company" | "email") => onFilterChange(value)}
            >
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="company">회사명</SelectItem>
                <SelectItem value="email">이메일</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-8 w-[200px]"
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <Select
            value={itemsPerPage.toString()}
            onValueChange={(value) => onItemsPerPageChange(Number(value))}
          >
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue placeholder="페이지당 항목" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5개</SelectItem>
              <SelectItem value="10">10개</SelectItem>
              <SelectItem value="20">20개</SelectItem>
              <SelectItem value="50">50개</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-2 py-1 text-left min-w-[120px]">회사명</th>
              <th className="px-2 py-1 text-left min-w-[80px]">산업</th>
              <th className="px-2 py-1 text-left min-w-[80px]">국가</th>
              <th className="px-2 py-1 text-left min-w-[200px]">설명</th>
              <th className="px-2 py-1 text-left min-w-[150px]">이메일</th>
              <th className="px-2 py-1 text-left min-w-[100px]">웹사이트</th>
            </tr>
          </thead>
          <tbody>
            {paginatedLeads.map((lead) => (
              <tr key={lead.id} className="border-t hover:bg-muted/30">
                <td className="px-2 py-1 font-medium">{lead.company}</td>
                <td className="px-2 py-1 text-muted-foreground text-xs">
                  {lead.industryType && <div>{lead.industryType}</div>}
                  {lead.productCategory && (
                    <div className="text-xs opacity-70">{lead.productCategory}</div>
                  )}
                </td>
                <td className="px-2 py-1 text-muted-foreground text-xs">{lead.country || "-"}</td>
                <td className="px-2 py-1 text-muted-foreground text-xs">
                  {lead.description || "-"}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{lead.email}</td>
                <td className="px-2 py-1 text-muted-foreground text-xs">
                  {lead.website ? (
                    <a
                      href={
                        lead.website.startsWith("http") ? lead.website : `https://${lead.website}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {lead.website}
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredLeads.length > 0 && (
        <div className="flex justify-between items-center mt-2">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  className={
                    currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }
                />
              </PaginationItem>

              {/* First page */}
              {currentPage > 2 && (
                <PaginationItem>
                  <PaginationLink onClick={() => onPageChange(1)}>1</PaginationLink>
                </PaginationItem>
              )}

              {/* Ellipsis */}
              {currentPage > 3 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Previous page */}
              {currentPage > 1 && (
                <PaginationItem>
                  <PaginationLink onClick={() => onPageChange(currentPage - 1)}>
                    {currentPage - 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* Current page */}
              <PaginationItem>
                <PaginationLink isActive>{currentPage}</PaginationLink>
              </PaginationItem>

              {/* Next page */}
              {currentPage < totalPages && (
                <PaginationItem>
                  <PaginationLink onClick={() => onPageChange(currentPage + 1)}>
                    {currentPage + 1}
                  </PaginationLink>
                </PaginationItem>
              )}

              {/* Ellipsis */}
              {currentPage < totalPages - 2 && (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              )}

              {/* Last page */}
              {currentPage < totalPages - 1 && (
                <PaginationItem>
                  <PaginationLink onClick={() => onPageChange(totalPages)}>
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              )}

              <PaginationItem>
                <PaginationNext
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  className={
                    currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}
