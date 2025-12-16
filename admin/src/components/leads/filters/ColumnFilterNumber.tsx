import { useId, useState } from "react"
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

type ColumnFilterNumberProps = {
  field: string
  onFilterChange: (filter: ColumnFilter | null) => void
  initialFilter?: ColumnFilter
  operators?: FilterOperator[]
}

/**
 * Number filter component with operator selection and range support
 * Supports: equals, notEquals, gt, lt, gte, lte, between, isEmpty, isNotEmpty
 */
export function ColumnFilterNumber({
  field,
  onFilterChange,
  initialFilter,
  operators = ["equals", "notEquals", "gt", "lt", "gte", "lte", "between", "isEmpty", "isNotEmpty"],
}: ColumnFilterNumberProps) {
  const operatorId = useId()
  const minId = useId()
  const maxId = useId()
  const valueId = useId()
  const [operator, setOperator] = useState<FilterOperator>(initialFilter?.operator || "equals")

  // Initialize values based on initial filter
  const getInitialValue = () => {
    if (!initialFilter?.value) {
      return ""
    }
    if (typeof initialFilter.value === "number") {
      return initialFilter.value.toString()
    }
    return ""
  }

  const getInitialRange = () => {
    if (!initialFilter?.value || typeof initialFilter.value !== "object") {
      return { min: "", max: "" }
    }
    const range = initialFilter.value as { min?: number; max?: number }
    return {
      min: range.min?.toString() || "",
      max: range.max?.toString() || "",
    }
  }

  const [value, setValue] = useState<string>(getInitialValue())
  const [rangeMin, setRangeMin] = useState<string>(getInitialRange().min)
  const [rangeMax, setRangeMax] = useState<string>(getInitialRange().max)

  const isBetweenOperator = operator === "between"
  const requiresValue = !["isEmpty", "isNotEmpty"].includes(operator)

  const parseNumber = (str: string): number | null => {
    if (!str.trim()) {
      return null
    }
    const num = Number(str)
    return Number.isNaN(num) ? null : num
  }

  const handleApply = () => {
    if (!requiresValue) {
      // For isEmpty/isNotEmpty operators
      const filter: ColumnFilter = {
        field,
        operator,
        value: null,
      }
      onFilterChange(filter)
      return
    }

    if (isBetweenOperator) {
      const min = parseNumber(rangeMin)
      const max = parseNumber(rangeMax)

      if (min === null || max === null) {
        // Clear filter if range values are invalid
        onFilterChange(null)
        return
      }

      if (min > max) {
        // Swap if min > max
        const filter: ColumnFilter = {
          field,
          operator,
          value: { min: max, max: min },
        }
        onFilterChange(filter)
        return
      }

      const filter: ColumnFilter = {
        field,
        operator,
        value: { min, max },
      }
      onFilterChange(filter)
    } else {
      // Single value operators
      const numValue = parseNumber(value)

      if (numValue === null) {
        // Clear filter if value is invalid
        onFilterChange(null)
        return
      }

      const filter: ColumnFilter = {
        field,
        operator,
        value: numValue,
      }
      onFilterChange(filter)
    }
  }

  const handleClear = () => {
    setValue("")
    setRangeMin("")
    setRangeMax("")
    onFilterChange(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleApply()
    }
  }

  return (
    <div className="w-[300px] space-y-4 p-4">
      {/* Operator Selection */}
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

      {/* Value Input(s) */}
      {requiresValue && (
        <div className="space-y-2">
          {isBetweenOperator ? (
            <>
              <div className="space-y-2">
                <Label htmlFor={minId}>Minimum</Label>
                <Input
                  autoFocus
                  id={minId}
                  onChange={(e) => setRangeMin(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Min value"
                  type="number"
                  value={rangeMin}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={maxId}>Maximum</Label>
                <Input
                  id={maxId}
                  onChange={(e) => setRangeMax(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Max value"
                  type="number"
                  value={rangeMax}
                />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={valueId}>Value</Label>
              <Input
                autoFocus
                id={valueId}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter number..."
                type="number"
                value={value}
              />
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
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
