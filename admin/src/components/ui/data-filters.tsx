import { Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

// ============================================================================
// Types
// ============================================================================

export interface FilterOption {
  value: string
  label: string
  sublabel?: string
}

export interface CheckboxFilterConfig {
  type: "checkbox"
  key: string
  label: string
  options: FilterOption[]
}

export interface MultiSelectFilterConfig {
  type: "multiselect"
  key: string
  label: string
  options: FilterOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}

export interface DateRangeFilterConfig {
  type: "daterange"
  key: string
  label: string
}

export type FilterConfig = CheckboxFilterConfig | MultiSelectFilterConfig | DateRangeFilterConfig

export interface FilterValues {
  [key: string]: string[] | { start?: string; end?: string }
}

export interface DataFiltersProps {
  filters: FilterConfig[]
  values: FilterValues
  onChange: (key: string, value: string[] | { start?: string; end?: string }) => void
  onClear: () => void
}

// ============================================================================
// DataFilters Component
// ============================================================================

export function DataFilters({ filters, values, onChange, onClear }: DataFiltersProps) {
  const hasActiveFilters = Object.values(values).some((v) =>
    Array.isArray(v) ? v.length > 0 : v?.start || v?.end,
  )

  const getActiveFilterTags = () => {
    const tags: { key: string; value: string; label: string; filterLabel: string }[] = []

    for (const filter of filters) {
      const filterValue = values[filter.key]

      if (filter.type === "checkbox" || filter.type === "multiselect") {
        const selectedValues = filterValue as string[] | undefined
        if (selectedValues && selectedValues.length > 0) {
          for (const val of selectedValues) {
            const option = filter.options.find((opt) => opt.value === val)
            tags.push({
              key: filter.key,
              value: val,
              label: option?.label || val,
              filterLabel: filter.label,
            })
          }
        }
      }
    }

    return tags
  }

  const removeFilterValue = (key: string, value: string) => {
    const currentValues = values[key] as string[] | undefined
    if (currentValues) {
      onChange(
        key,
        currentValues.filter((v) => v !== value),
      )
    }
  }

  const toggleCheckbox = (filterKey: string, value: string) => {
    const currentValues = (values[filterKey] as string[]) || []
    if (currentValues.includes(value)) {
      onChange(
        filterKey,
        currentValues.filter((v) => v !== value),
      )
    } else {
      onChange(filterKey, [...currentValues, value])
    }
  }

  const activeTags = getActiveFilterTags()

  const getColorClass = (index: number) => {
    const colors = [
      "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
      "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
      "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
      "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300",
      "bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300",
    ]
    return colors[index % colors.length]
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {filters.map((filter) => {
            if (filter.type === "checkbox") {
              return (
                <div key={filter.key} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0">
                    {filter.label}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {filter.options.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`${filter.key}-${option.value}`}
                          checked={((values[filter.key] as string[]) || []).includes(option.value)}
                          onCheckedChange={() => toggleCheckbox(filter.key, option.value)}
                        />
                        <label
                          htmlFor={`${filter.key}-${option.value}`}
                          className="text-sm select-none cursor-pointer"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            if (filter.type === "multiselect") {
              return (
                <div key={filter.key} className="flex items-start gap-4">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 shrink-0 pt-2">
                    {filter.label}
                  </span>
                  <div className="flex-1 max-w-md">
                    <MultiSelectCombobox
                      options={filter.options}
                      value={(values[filter.key] as string[]) || []}
                      onValueChange={(newValues) => onChange(filter.key, newValues)}
                      placeholder={filter.placeholder || `${filter.label} 선택...`}
                      searchPlaceholder={filter.searchPlaceholder || "검색..."}
                      emptyText={filter.emptyText || "검색 결과가 없습니다."}
                    />
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>

        {/* Active Filter Tags */}
        {activeTags.length > 0 && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag) => {
                const tagFilterIndex = filters.findIndex((f) => f.key === tag.key)
                return (
                  <span
                    key={`${tag.key}-${tag.value}`}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getColorClass(tagFilterIndex)}`}
                  >
                    {tag.filterLabel}: {tag.label}
                    <button
                      type="button"
                      onClick={() => removeFilterValue(tag.key, tag.value)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" onClick={onClear} className="text-xs">
              <X className="w-3 h-3 mr-1" />
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// SearchInput Component
// ============================================================================

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  onSearch?: (value: string) => void
  placeholder?: string
  debounceMs?: number
  className?: string
}

export function SearchInput({
  value,
  onChange,
  onSearch,
  placeholder = "검색...",
  debounceMs = 300,
  className = "",
}: SearchInputProps) {
  const [localValue, setLocalValue] = useState(value)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue)
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [localValue, debounceMs, onChange, value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onChange(localValue)
      onSearch?.(localValue)
    }
  }

  const handleClear = () => {
    setLocalValue("")
    onChange("")
    onSearch?.("")
  }

  return (
    <div className={`relative w-full md:w-[400px] ${className}`}>
      <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder={placeholder}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        className="pl-10 pr-10 w-full"
      />
      {localValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}

// ============================================================================
// useFilters Hook
// ============================================================================

export interface UseFiltersOptions {
  initialValues?: FilterValues
  onFilterChange?: (values: FilterValues) => void
}

export function useFilters(options: UseFiltersOptions = {}) {
  const [filterValues, setFilterValues] = useState<FilterValues>(options.initialValues || {})
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const updateFilter = (key: string, value: string[] | { start?: string; end?: string }) => {
    const newValues = { ...filterValues, [key]: value }
    setFilterValues(newValues)
    setCurrentPage(1) // Reset to first page on filter change
    options.onFilterChange?.(newValues)
  }

  const clearFilters = () => {
    setFilterValues({})
    setSearchQuery("")
    setCurrentPage(1)
    options.onFilterChange?.({})
  }

  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  return {
    filterValues,
    searchQuery,
    currentPage,
    updateFilter,
    clearFilters,
    handleSearch,
    handlePageChange,
    setSearchQuery: handleSearch,
    setCurrentPage: handlePageChange,
  }
}
