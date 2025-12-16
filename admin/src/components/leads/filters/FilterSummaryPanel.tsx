import { ChevronDownIcon, ChevronUpIcon, FilterIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { ColumnFilter } from "@/lib/api/types/lead-filters"
import { OPERATOR_LABELS } from "@/lib/api/types/lead-filters"

type FilterSummaryPanelProps = {
  filters: ColumnFilter[]
  onRemoveFilter: (index: number) => void
  onClearAll: () => void
}

/**
 * Panel displaying all active filters as removable chips
 * Shows filter count, individual filters with remove buttons, and clear all action
 */
export function FilterSummaryPanel({
  filters,
  onRemoveFilter,
  onClearAll,
}: FilterSummaryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  if (filters.length === 0) {
    return null
  }

  const formatFilterValue = (filter: ColumnFilter): string => {
    if (filter.value === null || filter.value === undefined) {
      return ""
    }

    if (Array.isArray(filter.value)) {
      return filter.value.join(", ")
    }

    if (typeof filter.value === "object") {
      // Handle range values (number or date)
      if ("min" in filter.value && "max" in filter.value) {
        return `${filter.value.min} - ${filter.value.max}`
      }
      if ("from" in filter.value && "to" in filter.value) {
        return `${filter.value.from} - ${filter.value.to}`
      }
    }

    return String(filter.value)
  }

  const formatFieldName = (field: string): string => {
    // Convert camelCase to Title Case with spaces
    return field
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b p-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Active Filters</span>
          <Badge className="ml-1" variant="secondary">
            {filters.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button className="h-8 text-xs" onClick={onClearAll} size="sm" variant="ghost">
            Clear All
          </Button>
          <Button
            aria-label={isCollapsed ? "Expand filters" : "Collapse filters"}
            className="h-8 w-8 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
            size="sm"
            variant="ghost"
          >
            {isCollapsed ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronUpIcon className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Filter Chips */}
      {!isCollapsed && (
        <div className="p-3">
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, index) => (
              <div
                className="inline-flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm"
                key={`${filter.field}-${index}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">
                    {formatFieldName(filter.field)}
                  </span>
                  <span className="text-muted-foreground">
                    {OPERATOR_LABELS[filter.operator].toLowerCase()}
                  </span>
                  {formatFilterValue(filter) && (
                    <span className="font-medium text-foreground">{formatFilterValue(filter)}</span>
                  )}
                </div>
                <Button
                  aria-label={`Remove filter for ${filter.field}`}
                  className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => onRemoveFilter(index)}
                  size="sm"
                  variant="ghost"
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
