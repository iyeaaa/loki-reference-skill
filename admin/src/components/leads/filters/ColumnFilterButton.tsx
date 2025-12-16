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

type ColumnFilterButtonProps = {
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
    // Always close dialog after filter change (including clear)
    setIsOpen(false)
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
          return <div className="p-4 text-destructive text-sm">Configuration error</div>
        }
        return (
          <ColumnFilterSelect
            {...commonProps}
            customerGroupId={customerGroupId}
            loadOptions={filterConfig.loadOptions}
            workspaceId={workspaceId}
          />
        )

      case "number":
        return <ColumnFilterNumber {...commonProps} />

      case "date":
        return <ColumnFilterDate {...commonProps} />

      default:
        return (
          <div className="p-4 text-muted-foreground text-sm">
            Filter not available for this column type
          </div>
        )
    }
  }

  // Use Dialog for all filter types to ensure buttons are always visible
  return (
    <Dialog onOpenChange={setIsOpen} open={isOpen}>
      <DialogTrigger asChild>
        <Button
          aria-label={`Filter ${field}`}
          className="relative h-8 w-8 p-0"
          size="sm"
          variant="ghost"
        >
          <FilterIcon
            className={hasActiveFilter ? "h-4 w-4 text-primary" : "h-4 w-4 text-muted-foreground"}
          />
          {hasActiveFilter && (
            <Badge
              className="-top-1 -right-1 absolute flex h-4 w-4 items-center justify-center p-0 text-[10px]"
              variant="default"
            >
              1
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-fit gap-0 p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Filter {field}</DialogTitle>
        </DialogHeader>
        {renderFilterComponent()}
      </DialogContent>
    </Dialog>
  )
}
