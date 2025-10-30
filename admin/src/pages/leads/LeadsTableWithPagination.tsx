import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Edit, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { FilterSummaryPanel } from "@/components/leads/filters/FilterSummaryPanel"
import { leadsColumns } from "@/components/leads/LeadsTableColumns"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Input } from "@/components/ui/input"
import { useDeleteLead, useLeads } from "@/lib/api/hooks/leads"
import type { Lead, LeadStatus, LeadsParams } from "@/lib/api/types/lead"
import type { ColumnFilter } from "@/lib/api/types/lead-filters"

interface LeadsTableWithPaginationProps {
  searchQuery: string
  searchType?: "all" | "company" | "country" | "email" | "website" | "industry" | "category"
  selectedStatuses: string[]
  selectedBusinessTypes: string[]
  selectedCountries: string[]
  selectedCities: string[]
  selectedCreatedBy: string[]
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
  selectedCreatedBy,
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
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageInputValue, setPageInputValue] = useState("1")
  const limit = 10

  // Workspace state
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Filter state for column filters
  const [activeColumnFilters, setActiveColumnFilters] = useState<ColumnFilter[]>([])

  // Delete dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  // localStorage change detection
  useEffect(() => {
    const interval = setInterval(() => {
      const workspace = localStorage.getItem("selectedWorkspace") || "all"
      if (workspace !== currentWorkspace) {
        setCurrentWorkspace(workspace)
        setCurrentPage(1)
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
    createdByIds: selectedCreatedBy.length > 0 ? selectedCreatedBy : undefined,
    // Add sorting from TanStack Table
    sortField: sorting[0]?.id,
    sortOrder: sorting[0]?.desc ? "desc" : "asc",
    // Add column filters
    filters: activeColumnFilters.length > 0 ? JSON.stringify(activeColumnFilters) : undefined,
  }

  // Fetch leads
  const { data: leadsData, isFetching } = useLeads(params)
  const leads = leadsData?.leads || []
  const totalPages = leadsData?.totalPages || 1
  const total = leadsData?.total || 0

  // Delete mutation
  const deleteLead = useDeleteLead()

  // Notify parent of data changes
  useEffect(() => {
    if (onLeadsDataChange && leads.length > 0) {
      onLeadsDataChange(leads)
    }
  }, [leads, onLeadsDataChange])

  // Sync row selection with parent component
  useEffect(() => {
    const newSelection: RowSelectionState = {}
    leads.forEach((lead, index) => {
      if (selectedLeads.includes(lead.id)) {
        newSelection[index] = true
      }
    })
    setRowSelection(newSelection)
  }, [selectedLeads, leads])

  // Toggle all handler
  const handleToggleAll = useCallback(() => {
    if (isSelectAllMode && onToggleSelectAll) {
      onToggleSelectAll()
    } else {
      onToggleAll(leads.map((l) => l.id))
    }
  }, [leads, onToggleAll, isSelectAllMode, onToggleSelectAll])

  // Initialize TanStack Table
  const table = useReactTable({
    data: leads,
    columns: leadsColumns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    meta: {
      onToggleLead,
      onToggleAll: handleToggleAll,
      isSelectAllMode,
      allLeadsSelected,
      selectedLeads,
      // Filter support
      columnFilters: activeColumnFilters,
      setColumnFilters: setActiveColumnFilters,
      customerGroupId: selectedCustomerGroup || undefined,
      workspaceId: currentWorkspace !== "all" ? currentWorkspace : undefined,
    },
  })

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

  // Filter handlers
  const handleRemoveFilter = (index: number) => {
    setActiveColumnFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const handleClearAllFilters = () => {
    setActiveColumnFilters([])
  }

  return (
    <>
      {/* Filter Summary Panel */}
      {activeColumnFilters.length > 0 && (
        <div className="mb-4">
          <FilterSummaryPanel
            filters={activeColumnFilters}
            onRemoveFilter={handleRemoveFilter}
            onClearAll={handleClearAllFilters}
          />
        </div>
      )}

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
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className={
                        header.id === "select"
                          ? "sticky left-0 z-10 p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-700"
                          : "p-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                      }
                      style={
                        header.id === "select"
                          ? { width: "1%", whiteSpace: "nowrap" }
                          : { minWidth: "120px" }
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {table.getRowModel().rows.map((row) => {
                const lead = row.original
                return (
                  <ContextMenu key={row.id}>
                    <ContextMenuTrigger asChild>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group/row relative">
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            className={
                              cell.column.id === "select"
                                ? "sticky left-0 z-10 p-2 whitespace-nowrap text-sm bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-700"
                                : "p-2 text-sm text-gray-900 dark:text-gray-100"
                            }
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
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
                )
              })}
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
