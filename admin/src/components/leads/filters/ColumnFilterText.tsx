import type React from "react"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ColumnFilter, FilterOperator } from "@/lib/api/types/lead-filters"
import { OPERATOR_LABELS } from "@/lib/api/types/lead-filters"

type ColumnFilterTextProps = {
  field: string
  onFilterChange: (filter: ColumnFilter | null) => void
  initialFilter?: ColumnFilter
  operators?: FilterOperator[]
}

/**
 * Text filter component with operator selection and debounced input
 * Supports: contains, equals, startsWith, endsWith, isEmpty, isNotEmpty
 */
export function ColumnFilterText({
  field,
  onFilterChange,
  initialFilter,
  operators = ["contains", "equals", "startsWith", "endsWith", "isEmpty", "isNotEmpty"],
}: ColumnFilterTextProps) {
  const operatorId = useId()
  const valueId = useId()

  const [operator, setOperator] = useState<FilterOperator>(initialFilter?.operator || "contains")
  const [value, setValue] = useState<string>(
    typeof initialFilter?.value === "string" ? initialFilter.value : "",
  )
  const [debouncedValue, setDebouncedValue] = useState(value)

  // Debounce value changes (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, 300)

    return () => clearTimeout(timer)
  }, [value])

  const requiresValue = !["isEmpty", "isNotEmpty"].includes(operator)

  const handleApply = () => {
    if (requiresValue && !debouncedValue.trim()) {
      // Clear filter if value is empty for operators that require value
      onFilterChange(null)
      return
    }

    const filter: ColumnFilter = {
      field,
      operator,
      value: requiresValue ? debouncedValue.trim() : null,
    }

    onFilterChange(filter)
  }

  const handleClear = () => {
    setValue("")
    setDebouncedValue("")
    onFilterChange(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply()
    }
  }

  return (
    <div className="w-[300px] space-y-4 p-4">
      <div className="space-y-2">
        <Label htmlFor={operatorId}>Operator</Label>
        <Select onValueChange={(val) => setOperator(val as FilterOperator)} value={operator}>
          <SelectTrigger id={operatorId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {OPERATOR_LABELS[op]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {requiresValue && (
        <div className="space-y-2">
          <Label htmlFor={valueId}>Value</Label>
          <Input
            autoFocus
            id={valueId}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter value..."
            type="text"
            value={value}
          />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button onClick={handleClear} size="sm" variant="outline">
          Clear
        </Button>
        <Button onClick={handleApply} size="sm">
          Apply
        </Button>
      </div>
    </div>
  )
}
