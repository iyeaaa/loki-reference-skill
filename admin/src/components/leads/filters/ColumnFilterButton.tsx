import { FilterIcon } from "lucide-react"
import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { ColumnFilter, ColumnFilterConfig } from "@/lib/api/types/lead-filters"
import { ColumnFilterDate } from "./ColumnFilterDate"
import { ColumnFilterNumber } from "./ColumnFilterNumber"
import { ColumnFilterSelect } from "./ColumnFilterSelect"
import { ColumnFilterText } from "./ColumnFilterText"

interface ColumnFilterButtonProps {
  field: string
  filterConfig: ColumnFilterConfig
  currentFilter?: ColumnFilter
  onFilterChange: (filter: ColumnFilter | null) => void
  customerGroupId?: string
  workspaceId?: string
}

/**
 * Button component that triggers filter popover for a specific column
 * Renders the appropriate filter component based on column type
 */
export function ColumnFilterButton({
  field,
  filterConfig,
  currentFilter,
  onFilterChange,
  customerGroupId,
  workspaceId,
}: ColumnFilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false)

  const hasActiveFilter = currentFilter !== undefined && currentFilter !== null

  const handleFilterChange = (filter: ColumnFilter | null) => {
    onFilterChange(filter)
    // Close popover after applying filter
    if (filter !== null) {
      setIsOpen(false)
    }
  }

  // Render the appropriate filter component based on type
  const renderFilterComponent = () => {
    const commonProps = {
      field,
      onFilterChange: handleFilterChange,
      initialFilter: currentFilter,
      operators: filterConfig.operators,
    }

    switch (filterConfig.type) {
      case "text":
        return <ColumnFilterText {...commonProps} />

      case "select":
      case "enum":
        if (!filterConfig.loadOptions) {
          console.error(`loadOptions is required for select/enum filter on field: ${field}`)
          return <div className="p-4 text-sm text-destructive">Configuration error</div>
        }
        return (
          <ColumnFilterSelect
            {...commonProps}
            loadOptions={filterConfig.loadOptions}
            customerGroupId={customerGroupId}
            workspaceId={workspaceId}
          />
        )

      case "number":
        return <ColumnFilterNumber {...commonProps} />

      case "date":
        return <ColumnFilterDate {...commonProps} />

      default:
        return (
          <div className="p-4 text-sm text-muted-foreground">
            Filter not available for this column type
          </div>
        )
    }
  }

  // Use Dialog for all filter types to ensure buttons are always visible
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 relative"
          aria-label={`Filter ${field}`}
        >
          <FilterIcon
            className={hasActiveFilter ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"}
          />
          {hasActiveFilter && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
              1
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-fit p-0 gap-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Filter {field}</DialogTitle>
        </DialogHeader>
        {renderFilterComponent()}
      </DialogContent>
    </Dialog>
  )
}
