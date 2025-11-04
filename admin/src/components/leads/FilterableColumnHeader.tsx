import type { Column } from "@tanstack/react-table"
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, X } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  canRemove?: boolean
  onRemove?: () => void
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
  canRemove = false,
  onRemove,
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

      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Filter Button */}
        {filterConfig && onFilterChange && (
          <ColumnFilterButton
            field={column.id}
            filterConfig={filterConfig}
            currentFilter={currentFilter}
            onFilterChange={onFilterChange}
            customerGroupId={customerGroupId}
            workspaceId={workspaceId}
          />
        )}

        {/* Remove Column Button */}
        {canRemove && onRemove && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
            onClick={(e) => {
              e.stopPropagation()
              onRemove()
            }}
          >
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-red-600 dark:hover:text-red-400" />
          </Button>
        )}
      </div>
    </div>
  )
}
