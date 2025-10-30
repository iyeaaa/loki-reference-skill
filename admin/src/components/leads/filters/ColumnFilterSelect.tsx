import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ColumnFilter, FilterOperator } from "@/lib/api/types/lead-filters"
import { OPERATOR_LABELS } from "@/lib/api/types/lead-filters"

interface FilterOption {
  value: string
  label: string
  count?: number
}

interface ColumnFilterSelectProps {
  field: string
  onFilterChange: (filter: ColumnFilter | null) => void
  initialFilter?: ColumnFilter
  loadOptions: (context?: {
    customerGroupId?: string
    workspaceId?: string
  }) => Promise<FilterOption[]>
  operators?: FilterOperator[]
  customerGroupId?: string
  workspaceId?: string
}

/**
 * Multi-select filter component with search and checkboxes
 * Supports: in, notIn operators
 */
export function ColumnFilterSelect({
  field,
  onFilterChange,
  initialFilter,
  loadOptions,
  operators = ["in", "notIn"],
  customerGroupId,
  workspaceId,
}: ColumnFilterSelectProps) {
  const operatorId = useId()
  const searchId = useId()
  const [operator, setOperator] = useState<FilterOperator>(initialFilter?.operator || "in")
  const [options, setOptions] = useState<FilterOption[]>([])
  const [selectedValues, setSelectedValues] = useState<string[]>(
    Array.isArray(initialFilter?.value) ? initialFilter.value : [],
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load options on mount
  useEffect(() => {
    const fetchOptions = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await loadOptions({ customerGroupId, workspaceId })
        setOptions(data)
      } catch (err) {
        setError("Failed to load options")
        console.error("Failed to load filter options:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchOptions()
  }, [loadOptions, customerGroupId, workspaceId])

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleToggle = (value: string) => {
    setSelectedValues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    )
  }

  const handleSelectAll = () => {
    setSelectedValues(filteredOptions.map((opt) => opt.value))
  }

  const handleDeselectAll = () => {
    setSelectedValues([])
  }

  const handleApply = () => {
    if (selectedValues.length === 0) {
      onFilterChange(null)
      return
    }

    const filter: ColumnFilter = {
      field,
      operator,
      value: selectedValues,
    }

    onFilterChange(filter)
  }

  const handleClear = () => {
    setSelectedValues([])
    onFilterChange(null)
  }

  return (
    <div className="w-[350px] space-y-4 p-4">
      {/* Operator Selection */}
      <div className="space-y-2">
        <Label htmlFor={operatorId}>Operator</Label>
        <Select value={operator} onValueChange={(val) => setOperator(val as FilterOperator)}>
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

      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor={searchId}>Search</Label>
        <Input
          id={searchId}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter options..."
          autoFocus
        />
      </div>

      {/* Select/Deselect All Buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSelectAll}
          disabled={isLoading || filteredOptions.length === 0}
          className="flex-1"
        >
          Select All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDeselectAll}
          disabled={isLoading || selectedValues.length === 0}
          className="flex-1"
        >
          Deselect All
        </Button>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading options...</div>
        )}

        {error && <div className="py-4 text-center text-sm text-destructive">{error}</div>}

        {!isLoading && !error && filteredOptions.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">No options found</div>
        )}

        {!isLoading && !error && filteredOptions.length > 0 && (
          <ScrollArea className="h-[200px] rounded-md border p-2">
            <div className="space-y-2">
              {filteredOptions.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                >
                  <Checkbox
                    id={`option-${option.value}`}
                    checked={selectedValues.includes(option.value)}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <label
                    htmlFor={`option-${option.value}`}
                    className="flex flex-1 cursor-pointer items-center justify-between text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <span className="text-muted-foreground">({option.count})</span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Selected Count and Action Buttons */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-sm text-muted-foreground">{selectedValues.length} selected</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleClear}>
            Clear
          </Button>
          <Button size="sm" onClick={handleApply}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
