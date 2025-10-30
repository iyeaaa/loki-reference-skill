import type { Column } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from "lucide-react"
import type { ColumnFilter, ColumnFilterConfig } from "@/lib/api/types/lead-filters"
import { ColumnFilterButton } from "./filters/ColumnFilterButton"

interface FilterableColumnHeaderProps<TData> {
  column: Column<TData, unknown>
  title: string
  filterConfig?: ColumnFilterConfig
  currentFilter?: ColumnFilter
  onFilterChange?: (filter: ColumnFilter | null) => void
  workspaceId?: string
  customerGroupId?: string
}

/**
 * Reusable column header component with integrated filter button and sort indicator
 * Similar to Google Sheets column headers
 */
export function FilterableColumnHeader<TData>({
  column,
  title,
  filterConfig,
  currentFilter,
  onFilterChange,
  workspaceId,
  customerGroupId,
}: FilterableColumnHeaderProps<TData>) {
  const isSorted = column.getIsSorted()
  const canSort = column.getCanSort()

  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      {/* Column Title with Sort */}
      {canSort ? (
        <button
          type="button"
          className="flex items-center gap-1.5 cursor-pointer select-none hover:text-foreground/80 flex-1 min-w-0 text-left border-0 bg-transparent p-0"
          onClick={column.getToggleSortingHandler()}
        >
          <span className="truncate">{title}</span>
          {/* Sort Indicators */}
          <span className="flex-shrink-0">
            {isSorted === "asc" && <ArrowUpIcon className="h-3.5 w-3.5" />}
            {isSorted === "desc" && <ArrowDownIcon className="h-3.5 w-3.5" />}
            {!isSorted && <ChevronsUpDownIcon className="h-3.5 w-3.5 opacity-40" />}
          </span>
        </button>
      ) : (
        <div className="flex-1 min-w-0">
          <span className="truncate">{title}</span>
        </div>
      )}

      {/* Filter Button */}
      {filterConfig && onFilterChange && (
        <span className="flex-shrink-0">
          <ColumnFilterButton
            field={column.id}
            filterConfig={filterConfig}
            currentFilter={currentFilter}
            onFilterChange={onFilterChange}
            customerGroupId={customerGroupId}
            workspaceId={workspaceId}
          />
        </span>
      )}
    </div>
  )
}
