import { format } from "date-fns"
import { useId, useState } from "react"
import type { DateRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

interface ColumnFilterDateProps {
  field: string
  onFilterChange: (filter: ColumnFilter | null) => void
  initialFilter?: ColumnFilter
  operators?: FilterOperator[]
}

/**
 * Date filter component with date range picker and preset ranges
 * Supports: equals, gt, lt, gte, lte, between operators
 */
export function ColumnFilterDate({
  field,
  onFilterChange,
  initialFilter,
  operators = ["equals", "gt", "lt", "gte", "lte", "between"],
}: ColumnFilterDateProps) {
  const operatorId = useId()
  const [operator, setOperator] = useState<FilterOperator>(initialFilter?.operator || "between")

  // Initialize date range from initial filter
  const getInitialRange = (): DateRange | undefined => {
    if (!initialFilter?.value) return undefined

    if (typeof initialFilter.value === "object" && initialFilter.value !== null) {
      const range = initialFilter.value as { from?: string; to?: string }
      return {
        from: range.from ? new Date(range.from) : undefined,
        to: range.to ? new Date(range.to) : undefined,
      }
    }

    if (typeof initialFilter.value === "string") {
      const date = new Date(initialFilter.value)
      return { from: date, to: date }
    }

    return undefined
  }

  const [dateRange, setDateRange] = useState<DateRange | undefined>(getInitialRange())

  const isBetweenOperator = operator === "between"

  // Quick preset functions
  const setToday = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    setDateRange({ from: today, to: today })
  }

  const setLast7Days = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const sevenDaysAgo = new Date(today)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    setDateRange({ from: sevenDaysAgo, to: today })
  }

  const setLast30Days = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    setDateRange({ from: thirtyDaysAgo, to: today })
  }

  const setThisMonth = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    setDateRange({ from: firstDay, to: lastDay })
  }

  const setLastMonth = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastDay = new Date(today.getFullYear(), today.getMonth(), 0)
    setDateRange({ from: firstDay, to: lastDay })
  }

  const handleApply = () => {
    if (!dateRange?.from) {
      onFilterChange(null)
      return
    }

    if (isBetweenOperator) {
      // For between operator, require both dates
      if (!dateRange.to) {
        onFilterChange(null)
        return
      }

      const filter: ColumnFilter = {
        field,
        operator,
        value: {
          from: format(dateRange.from, "yyyy-MM-dd"),
          to: format(dateRange.to, "yyyy-MM-dd"),
        },
      }
      onFilterChange(filter)
    } else {
      // For single date operators (gt, lt, gte, lte, equals)
      const filter: ColumnFilter = {
        field,
        operator,
        value: format(dateRange.from, "yyyy-MM-dd"),
      }
      onFilterChange(filter)
    }
  }

  const handleClear = () => {
    setDateRange(undefined)
    onFilterChange(null)
  }

  return (
    <div className="flex flex-col w-fit">
      <div
        className={
          isBetweenOperator ? "max-w-[min(680px,90vw)] space-y-3 p-4" : "w-auto space-y-3 p-4"
        }
      >
        {/* Operator Selection */}
        <div className="space-y-2">
          <Label htmlFor={operatorId} className="text-xs">
            Operator
          </Label>
          <Select value={operator} onValueChange={(val) => setOperator(val as FilterOperator)}>
            <SelectTrigger id={operatorId} className="w-full max-w-[280px] h-8 text-sm">
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

        {/* Quick Select Presets */}
        {isBetweenOperator && (
          <div className="space-y-2">
            <Label className="text-xs">Quick Select</Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={setToday}
                type="button"
                className="h-7 text-xs px-2"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setLast7Days}
                type="button"
                className="h-7 text-xs px-2"
              >
                Last 7d
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setLast30Days}
                type="button"
                className="h-7 text-xs px-2"
              >
                Last 30d
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setThisMonth}
                type="button"
                className="h-7 text-xs px-2"
              >
                This Month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={setLastMonth}
                type="button"
                className="h-7 text-xs px-2"
              >
                Last Month
              </Button>
            </div>
          </div>
        )}

        {/* Calendar */}
        <div className="space-y-2">
          <Label className="text-xs">
            {isBetweenOperator ? "Select Date Range" : "Select Date"}
          </Label>
          {isBetweenOperator ? (
            <div className="overflow-x-auto">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                numberOfMonths={2}
                className="rounded-md border scale-90 origin-top-left"
              />
            </div>
          ) : (
            <Calendar
              mode="single"
              selected={dateRange?.from}
              onSelect={(date) => setDateRange(date ? { from: date, to: date } : undefined)}
              numberOfMonths={1}
              className="rounded-md border"
            />
          )}
        </div>

        {/* Selected Date Display */}
        {dateRange?.from && (
          <div className="space-y-1 text-xs">
            <div className="font-medium">Selected:</div>
            <div className="text-muted-foreground">
              {isBetweenOperator ? (
                <>
                  {format(dateRange.from, "PPP")}
                  {dateRange.to && ` - ${format(dateRange.to, "PPP")}`}
                </>
              ) : (
                format(dateRange.from, "PPP")
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons - Fixed at bottom */}
      <div className="flex justify-end gap-2 px-4 py-3 border-t bg-background">
        <Button variant="outline" size="sm" onClick={handleClear}>
          Clear
        </Button>
        <Button size="sm" onClick={handleApply}>
          Apply
        </Button>
      </div>
    </div>
  )
}
