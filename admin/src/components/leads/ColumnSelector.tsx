import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAvailableToAdd } from "@/lib/column-visibility"

interface ColumnSelectorProps {
  visibleColumns: string[]
  onAddColumn: (columnId: string) => void
}

export function ColumnSelector({ visibleColumns, onAddColumn }: ColumnSelectorProps) {
  const availableColumns = getAvailableToAdd(visibleColumns)

  if (availableColumns.length === 0) {
    return null
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="space-y-1">
          <h4 className="text-sm font-medium leading-none mb-3">컬럼 추가</h4>
          <div className="space-y-1">
            {availableColumns.map((column) => (
              <button
                key={column.id}
                onClick={() => onAddColumn(column.id)}
                className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                type="button"
              >
                {column.label}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
