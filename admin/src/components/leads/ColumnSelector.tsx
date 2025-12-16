import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAvailableToAdd } from "@/lib/column-visibility"

type ColumnSelectorProps = {
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
          className="h-8 w-8 p-0 hover:bg-gray-100 dark:hover:bg-gray-700"
          size="sm"
          variant="ghost"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56">
        <div className="space-y-1">
          <h4 className="mb-3 font-medium text-sm leading-none">컬럼 추가</h4>
          <div className="space-y-1">
            {availableColumns.map((column) => (
              <button
                className="w-full rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                key={column.id}
                onClick={() => onAddColumn(column.id)}
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
