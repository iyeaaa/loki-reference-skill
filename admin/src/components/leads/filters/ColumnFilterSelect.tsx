import { useEffect, useId, useRef, useState } from "react"
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

type FilterOption = {
  value: string
  label: string
  count?: number
}

type ColumnFilterSelectProps = {
  field: string
  onFilterChange: (filter: ColumnFilter | null) => void
  initialFilter?: ColumnFilter
  loadOptions: (context?: {
    customerGroupId?: string
    workspaceId?: string
    signal?: AbortSignal
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

  // Use ref to store loadOptions to avoid triggering effect on every render
  const loadOptionsRef = useRef(loadOptions)

  // Update ref when loadOptions changes (though it should be stable from column config)
  useEffect(() => {
    loadOptionsRef.current = loadOptions
  }, [loadOptions])

  // Load options on mount
  useEffect(() => {
    const abortController = new AbortController()
    let isSubscribed = true

    const fetchOptions = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const data = await loadOptionsRef.current({
          customerGroupId,
          workspaceId,
          signal: abortController.signal,
        })
        // Only update state if component is still mounted
        if (isSubscribed && !abortController.signal.aborted) {
          setOptions(data)
        }
      } catch (err) {
        // Only update error state if component is still mounted and not aborted
        if (isSubscribed && !abortController.signal.aborted) {
          setError("Failed to load options")
          console.error("Failed to load filter options:", err)
        }
      } finally {
        // Only update loading state if component is still mounted
        if (isSubscribed) {
          setIsLoading(false)
        }
      }
    }

    fetchOptions()

    // Cleanup function to prevent state updates after unmount
    return () => {
      isSubscribed = false
      abortController.abort()
    }
  }, [customerGroupId, workspaceId])

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

      {/* Search Input */}
      <div className="space-y-2">
        <Label htmlFor={searchId}>Search</Label>
        <Input
          autoFocus
          id={searchId}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter options..."
          type="text"
          value={searchQuery}
        />
      </div>

      {/* Select/Deselect All Buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={isLoading || filteredOptions.length === 0}
          onClick={handleSelectAll}
          size="sm"
          variant="outline"
        >
          Select All
        </Button>
        <Button
          className="flex-1"
          disabled={isLoading || selectedValues.length === 0}
          onClick={handleDeselectAll}
          size="sm"
          variant="outline"
        >
          Deselect All
        </Button>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {isLoading && (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading options...</div>
        )}

        {error && <div className="py-4 text-center text-destructive text-sm">{error}</div>}

        {!(isLoading || error) && filteredOptions.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">No options found</div>
        )}

        {!(isLoading || error) && filteredOptions.length > 0 && (
          <ScrollArea className="h-[200px] rounded-md border p-2">
            <div className="space-y-2">
              {filteredOptions.map((option) => (
                <div
                  className="flex items-center space-x-2 rounded-sm px-2 py-1.5 hover:bg-accent"
                  key={option.value}
                >
                  <Checkbox
                    checked={selectedValues.includes(option.value)}
                    id={`option-${option.value}`}
                    onCheckedChange={() => handleToggle(option.value)}
                  />
                  <label
                    className="flex flex-1 cursor-pointer items-center justify-between font-medium text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    htmlFor={`option-${option.value}`}
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
      <div className="flex items-center justify-between border-t pt-2">
        <span className="text-muted-foreground text-sm">{selectedValues.length} selected</span>
        <div className="flex gap-2">
          <Button onClick={handleClear} size="sm" variant="outline">
            Clear
          </Button>
          <Button onClick={handleApply} size="sm">
            Apply
          </Button>
        </div>
      </div>
    </div>
  )
}
