import {
  type ColumnFiltersState,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Edit, Trash2, Users } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
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
import { useDeleteLead, useLeads } from "@/lib/api/hooks/leads"
import type { Lead, LeadsParams } from "@/lib/api/types/lead"
import type { ColumnFilter } from "@/lib/api/types/lead-filters"
import {
  addColumn,
  getColumnOrder,
  getVisibleColumns,
  removeColumn,
  reorderColumns,
} from "@/lib/column-visibility"

type LeadsTableWithPaginationProps = {
  columnFilters: ColumnFilter[]
  selectedCustomerGroup: string
  selectedLeads: string[]
  onToggleLead: (leadId: string) => void
  onToggleAll: (leadIds: string[]) => void
  onEditLead: (lead: Lead) => void
  onManageGroups: (lead: Lead) => void
  onLeadsDataChange?: (leads: Lead[]) => void
  onTotalChange?: (total: number) => void
  pageSize?: number
  isSelectAllMode?: boolean
  allLeadsSelected?: boolean
  onToggleSelectAll?: () => void
  selectedGroupWorkspaceId?: string
}

export function LeadsTableWithPagination({
  columnFilters: propsColumnFilters,
  selectedCustomerGroup,
  selectedLeads,
  onToggleLead,
  onToggleAll,
  onEditLead,
  onManageGroups,
  onLeadsDataChange,
  onTotalChange,
  pageSize: propsPageSize,
  isSelectAllMode = false,
  allLeadsSelected = false,
  onToggleSelectAll,
  selectedGroupWorkspaceId,
}: LeadsTableWithPaginationProps) {
  const { t } = useTranslation()

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = propsPageSize || 100
  const limit = pageSize

  // Workspace state
  const [currentWorkspace, setCurrentWorkspace] = useState(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => getVisibleColumns())
  const [columnOrder, setColumnOrder] = useState<string[]>(() => getColumnOrder())

  // Column sizing state - auto-calculate initially, then restore from localStorage
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    const saved = localStorage.getItem("leadsColumnSizing")
    return saved ? JSON.parse(saved) : {}
  })
  const [isInitialAutoSize, setIsInitialAutoSize] = useState(() => {
    const saved = localStorage.getItem("leadsColumnSizing")
    return !saved // If no saved sizes, we're in initial auto-size mode
  })

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

  // Ref for table element to measure content
  const tableRef = useRef<HTMLTableElement>(null)

  // Filter state for column filters
  const [activeColumnFilters, setActiveColumnFilters] = useState<ColumnFilter[]>([])

  // Delete dialog state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [leadToDelete, setLeadToDelete] = useState<{
    id: string
    name: string
  } | null>(null)

  // Constants for auto-sizing
  const MAX_COLUMN_WIDTH = 400
  const MIN_COLUMN_WIDTH = 80

  // Save column sizing to localStorage whenever it changes
  useEffect(() => {
    if (Object.keys(columnSizing).length > 0) {
      localStorage.setItem("leadsColumnSizing", JSON.stringify(columnSizing))
      setIsInitialAutoSize(false)
    }
  }, [columnSizing])

  // Auto-size function for a specific column
  const autoSizeColumn = useCallback((columnId: string) => {
    if (!tableRef.current) {
      return
    }

    const cells = tableRef.current.querySelectorAll(`[data-column-id="${columnId}"]`)
    let maxWidth = MIN_COLUMN_WIDTH

    cells.forEach((cell) => {
      const element = cell as HTMLElement
      // Create a temporary element to measure text width
      const temp = document.createElement("span")
      temp.style.visibility = "hidden"
      temp.style.position = "absolute"
      temp.style.whiteSpace = "nowrap"
      temp.style.fontSize = window.getComputedStyle(element).fontSize
      temp.style.fontFamily = window.getComputedStyle(element).fontFamily
      temp.textContent = element.textContent || ""
      document.body.appendChild(temp)
      const width = temp.offsetWidth + 32 // Add padding
      document.body.removeChild(temp)
      maxWidth = Math.max(maxWidth, width)
    })

    const finalWidth = Math.min(maxWidth, MAX_COLUMN_WIDTH)

    setColumnSizing((prev) => ({
      ...prev,
      [columnId]: finalWidth,
    }))
  }, [])

  // Auto-size all columns
  const autoSizeAllColumns = useCallback(() => {
    if (!tableRef.current) {
      return
    }

    const newSizing: ColumnSizingState = {}
    const columns = tableRef.current.querySelectorAll("th[data-column-id]")

    columns.forEach((header) => {
      const columnId = (header as HTMLElement).getAttribute("data-column-id")
      if (!columnId || columnId === "select" || columnId === "columnActions") {
        return
      }

      const cells = tableRef.current?.querySelectorAll(`[data-column-id="${columnId}"]`)
      let maxWidth = MIN_COLUMN_WIDTH

      cells?.forEach((cell) => {
        const element = cell as HTMLElement
        const temp = document.createElement("span")
        temp.style.visibility = "hidden"
        temp.style.position = "absolute"
        temp.style.whiteSpace = "nowrap"
        temp.style.fontSize = window.getComputedStyle(element).fontSize
        temp.style.fontFamily = window.getComputedStyle(element).fontFamily
        temp.textContent = element.textContent || ""
        document.body.appendChild(temp)
        const width = temp.offsetWidth + 32
        document.body.removeChild(temp)
        maxWidth = Math.max(maxWidth, width)
      })

      const finalWidth = Math.min(maxWidth, MAX_COLUMN_WIDTH)
      newSizing[columnId] = finalWidth
    })

    setColumnSizing(newSizing)
  }, [])

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

  // 워크스페이스 필터: 고객 그룹이 선택된 경우 그룹의 워크스페이스도 포함
  const workspaceFilter = useMemo(() => {
    if (currentWorkspace === "all") {
      // "all" 선택 시 고객 그룹이 선택되어 있고 그룹이 다른 워크스페이스에 있으면 그 워크스페이스 포함
      if (selectedCustomerGroup && selectedGroupWorkspaceId) {
        return
      }
      return
    }

    // 특정 워크스페이스 선택 시
    const workspaceIds = [currentWorkspace]

    // 고객 그룹이 선택되어 있고 그룹이 다른 워크스페이스에 있으면 추가
    if (
      selectedCustomerGroup &&
      selectedGroupWorkspaceId &&
      selectedGroupWorkspaceId !== currentWorkspace
    ) {
      workspaceIds.push(selectedGroupWorkspaceId)
    }

    return workspaceIds
  }, [currentWorkspace, selectedCustomerGroup, selectedGroupWorkspaceId])

  // Merge prop column filters with active column filters from table
  const mergedFilters = useMemo(
    () => [...propsColumnFilters, ...activeColumnFilters],
    [propsColumnFilters, activeColumnFilters],
  )

  // Build params for API call
  const params: LeadsParams = useMemo(
    () => ({
      page: currentPage,
      limit,
      // workspaceFilter가 undefined이면 workspaceIds를 전달하지 않음 (모든 워크스페이스 조회)
      workspaceIds: workspaceFilter,
      customerGroupId: selectedCustomerGroup || undefined,
      // Add sorting from TanStack Table
      sortField: sorting[0]?.id,
      sortOrder: sorting[0]?.desc ? "desc" : "asc",
      // Add column filters (merged from props and table state)
      filters: mergedFilters.length > 0 ? JSON.stringify(mergedFilters) : undefined,
    }),
    [currentPage, limit, workspaceFilter, selectedCustomerGroup, sorting, mergedFilters],
  )

  // Fetch leads
  const { data: leadsData, isFetching } = useLeads(params)
  const leads = leadsData?.leads || []
  const totalPages = leadsData?.totalPages || 1
  const total = leadsData?.total || 0

  // Delete mutation
  const deleteLead = useDeleteLead()

  // Auto-size on initial load if no saved sizes
  useEffect(() => {
    if (isInitialAutoSize && leads.length > 0 && tableRef.current) {
      // Wait for table to render
      const timer = setTimeout(() => {
        autoSizeAllColumns()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isInitialAutoSize, leads, autoSizeAllColumns])

  // Notify parent of data changes
  useEffect(() => {
    if (onLeadsDataChange && leads.length > 0) {
      onLeadsDataChange(leads)
    }
  }, [leads, onLeadsDataChange])

  // Notify parent of total changes
  useEffect(() => {
    if (onTotalChange) {
      onTotalChange(total)
    }
  }, [total, onTotalChange])

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

  // Column visibility handlers
  const handleAddColumn = useCallback((columnId: string) => {
    const result = addColumn(columnId)
    setVisibleColumns(result.visibleColumns)
    setColumnOrder(result.columnOrder)
  }, [])

  const handleRemoveColumn = useCallback((columnId: string) => {
    const updated = removeColumn(columnId)
    setVisibleColumns(updated)
  }, [])

  const handleReorderColumns = useCallback(
    (fromIndex: number, toIndex: number) => {
      const updated = reorderColumns(columnOrder, fromIndex, toIndex)
      setColumnOrder(updated)
    },
    [columnOrder],
  )

  // Filter and sort columns based on visibility and order
  const displayedColumns = useMemo(() => {
    // First, filter visible columns
    const visibleCols = leadsColumns.filter((col) => {
      const colId = col.id || ("accessorKey" in col ? String(col.accessorKey) : "")
      return visibleColumns.includes(colId)
    })

    // Then, sort by columnOrder
    return visibleCols.sort((a, b) => {
      const aId = a.id || ("accessorKey" in a ? String(a.accessorKey) : "")
      const bId = b.id || ("accessorKey" in b ? String(b.accessorKey) : "")
      const aIndex = columnOrder.indexOf(aId)
      const bIndex = columnOrder.indexOf(bId)

      // If not in order array, put at the end
      if (aIndex === -1) {
        return 1
      }
      if (bIndex === -1) {
        return -1
      }

      return aIndex - bIndex
    })
  }, [visibleColumns, columnOrder])

  // Initialize TanStack Table
  const table = useReactTable({
    data: leads,
    columns: displayedColumns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: totalPages,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
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
      // Column visibility
      visibleColumns,
      columnOrder,
      onAddColumn: handleAddColumn,
      onRemoveColumn: handleRemoveColumn,
      onReorderColumns: handleReorderColumns,
      // Auto-sizing
      onAutoSizeColumn: autoSizeColumn,
    },
  })

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
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

  // Drag and drop state
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null)

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    setDraggedColumnId(columnId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    e.preventDefault()

    if (!draggedColumnId || draggedColumnId === targetColumnId) {
      setDraggedColumnId(null)
      return
    }

    // Don't allow dragging select or columnActions columns
    if (
      draggedColumnId === "select" ||
      draggedColumnId === "columnActions" ||
      targetColumnId === "select" ||
      targetColumnId === "columnActions"
    ) {
      setDraggedColumnId(null)
      return
    }

    const fromIndex = columnOrder.indexOf(draggedColumnId)
    const toIndex = columnOrder.indexOf(targetColumnId)

    if (fromIndex !== -1 && toIndex !== -1) {
      handleReorderColumns(fromIndex, toIndex)
    }

    setDraggedColumnId(null)
  }

  const handleDragEnd = () => {
    setDraggedColumnId(null)
  }

  return (
    <>
      {/* Filter Summary Panel */}
      {activeColumnFilters.length > 0 && (
        <div className="mb-4">
          <FilterSummaryPanel
            filters={activeColumnFilters}
            onClearAll={handleClearAllFilters}
            onRemoveFilter={handleRemoveFilter}
          />
        </div>
      )}

      {/* Leads Table */}
      <div className="overflow-x-auto rounded-md border">
        <table
          className="border-collapse"
          ref={tableRef}
          style={{
            width: table.getTotalSize(),
          }}
        >
          <thead className="bg-gray-50 dark:bg-gray-700">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isDraggable = header.id !== "select" && header.id !== "columnActions"
                  const isDragging = draggedColumnId === header.id
                  const canResize = header.id !== "select" && header.id !== "columnActions"

                  return (
                    <th
                      className={
                        header.id === "select"
                          ? "sticky left-0 z-10 bg-gray-50 p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:bg-gray-700 dark:text-gray-400"
                          : `relative p-2 text-left font-medium text-gray-500 text-xs uppercase tracking-wider dark:text-gray-400 ${
                              isDragging ? "opacity-50" : ""
                            } ${isDraggable ? "cursor-move" : ""}`
                      }
                      data-column-id={header.id}
                      draggable={isDraggable}
                      key={header.id}
                      onDoubleClick={() => canResize && autoSizeColumn(header.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragStart={(e) => isDraggable && handleDragStart(e, header.id)}
                      onDrop={(e) => isDraggable && handleDrop(e, header.id)}
                      style={{
                        width: header.id === "select" ? 50 : header.getSize(),
                        minWidth: header.id === "select" ? 50 : MIN_COLUMN_WIDTH,
                        maxWidth: header.id === "select" ? 50 : MAX_COLUMN_WIDTH,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 overflow-hidden text-ellipsis">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                        {canResize && (
                          // biome-ignore lint/a11y/noStaticElementInteractions: Column resize handle is a standard table interaction pattern
                          <div
                            className={`absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-blue-500 ${
                              header.column.getIsResizing() ? "bg-blue-500" : ""
                            }`}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              header.getResizeHandler()(e)
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation()
                              e.preventDefault()
                              header.getResizeHandler()(e)
                            }}
                            style={{
                              transform: header.column.getIsResizing()
                                ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                                : "",
                            }}
                          />
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
            {table.getRowModel().rows.map((row) => {
              const lead = row.original
              return (
                <ContextMenu key={row.id}>
                  <ContextMenuTrigger asChild>
                    <tr className="group/row relative transition-colors hover:bg-gray-50 dark:hover:bg-gray-700">
                      {row.getVisibleCells().map((cell) => {
                        const canResize =
                          cell.column.id !== "select" && cell.column.id !== "columnActions"
                        // Get the header for this column to access resize handler
                        const header = table
                          .getHeaderGroups()[0]
                          ?.headers.find((h) => h.column.id === cell.column.id)

                        return (
                          <td
                            className={
                              cell.column.id === "select"
                                ? "sticky left-0 z-10 bg-white p-2 text-sm group-hover/row:bg-gray-50 dark:bg-gray-800 dark:group-hover/row:bg-gray-700"
                                : "relative p-2 text-gray-900 text-sm dark:text-gray-100"
                            }
                            data-column-id={cell.column.id}
                            key={cell.id}
                            style={{
                              width: cell.column.id === "select" ? 50 : cell.column.getSize(),
                              maxWidth: cell.column.id === "select" ? 50 : cell.column.getSize(),
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </div>
                            {canResize && header && (
                              // biome-ignore lint/a11y/noStaticElementInteractions: Column resize handle is a standard table interaction pattern
                              <div
                                className={`absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none bg-transparent hover:bg-blue-500 ${
                                  cell.column.getIsResizing() ? "bg-blue-500" : ""
                                }`}
                                onMouseDown={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  header.getResizeHandler()(e)
                                }}
                                onTouchStart={(e) => {
                                  e.stopPropagation()
                                  e.preventDefault()
                                  header.getResizeHandler()(e)
                                }}
                                style={{
                                  transform: cell.column.getIsResizing()
                                    ? `translateX(${table.getState().columnSizingInfo.deltaOffset ?? 0}px)`
                                    : "",
                                }}
                              />
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem className="cursor-pointer" onClick={() => onEditLead(lead)}>
                      <Edit className="mr-2 h-4 w-4" />
                      리드 편집
                    </ContextMenuItem>
                    <ContextMenuItem
                      className="cursor-pointer"
                      onClick={() => onManageGroups(lead)}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      그룹 관리
                    </ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      className="cursor-pointer text-red-600 focus:bg-red-50 focus:text-red-600 dark:focus:bg-red-950"
                      onClick={() =>
                        handleDeleteLead(
                          lead.id,
                          lead.companyName || lead.foundCompanyName || "이름 없음",
                        )
                      }
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

      {/* Pagination */}
      <div className="mt-6 space-y-4">
        {/* Pagination Controls */}
        <div className="flex items-center justify-center gap-1">
          {/* First Page */}
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(1)}
            size="sm"
            variant="outline"
          >
            {t("leads.button.firstPage")}
          </Button>

          {/* Previous Page */}
          <Button
            className="px-3"
            disabled={currentPage === 1 || isFetching}
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            size="sm"
            variant="outline"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("leads.button.previousPage")}
          </Button>

          {/* Page Numbers */}
          {getPageNumbers().map((page) => (
            <Button
              className="min-w-[40px] px-3"
              disabled={isFetching}
              key={page}
              onClick={() => handlePageChange(page)}
              size="sm"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          ))}

          {/* Next Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            size="sm"
            variant="outline"
          >
            {t("leads.button.nextPage")}
            <ChevronRight className="h-4 w-4" />
          </Button>

          {/* Last Page */}
          <Button
            className="px-3"
            disabled={currentPage >= totalPages || isFetching}
            onClick={() => handlePageChange(totalPages)}
            size="sm"
            variant="outline"
          >
            {t("leads.button.lastPage")}
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        cancelText={t("leads.button.cancel")}
        confirmText={t("leads.button.delete")}
        description={`"${leadToDelete?.name || ""}" ${t("leads.button.deleteLeadConfirm")}`}
        onConfirm={confirmDelete}
        onOpenChange={setDeleteConfirmOpen}
        open={deleteConfirmOpen}
        title={t("leads.button.deleteLead")}
        variant="destructive"
      />
    </>
  )
}
