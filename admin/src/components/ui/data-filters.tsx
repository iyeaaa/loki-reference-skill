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

export type FilterOption = {
  value: string
  label: string
  sublabel?: string
}

export type CheckboxFilterConfig = {
  type: "checkbox"
  key: string
  label: string
  options: FilterOption[]
}

export type MultiSelectFilterConfig = {
  type: "multiselect"
  key: string
  label: string
  options: FilterOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
}

export type DateRangeFilterConfig = {
  type: "daterange"
  key: string
  label: string
}

export type FilterConfig = CheckboxFilterConfig | MultiSelectFilterConfig | DateRangeFilterConfig

export type FilterValues = {
  [key: string]: string[] | { start?: string; end?: string }
}

export type DataFiltersProps = {
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
                <div className="flex items-center gap-4" key={filter.key}>
                  <span className="w-20 shrink-0 font-medium text-gray-700 text-sm dark:text-gray-300">
                    {filter.label}
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {filter.options.map((option) => (
                      <div className="flex items-center space-x-2" key={option.value}>
                        <Checkbox
                          checked={((values[filter.key] as string[]) || []).includes(option.value)}
                          id={`${filter.key}-${option.value}`}
                          onCheckedChange={() => toggleCheckbox(filter.key, option.value)}
                        />
                        <label
                          className="cursor-pointer select-none text-sm"
                          htmlFor={`${filter.key}-${option.value}`}
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
                <div className="flex items-start gap-4" key={filter.key}>
                  <span className="w-20 shrink-0 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
                    {filter.label}
                  </span>
                  <div className="max-w-md flex-1">
                    <MultiSelectCombobox
                      emptyText={filter.emptyText || "검색 결과가 없습니다."}
                      onValueChange={(newValues) => onChange(filter.key, newValues)}
                      options={filter.options}
                      placeholder={filter.placeholder || `${filter.label} 선택...`}
                      searchPlaceholder={filter.searchPlaceholder || "검색..."}
                      value={(values[filter.key] as string[]) || []}
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
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {activeTags.map((tag) => {
                const tagFilterIndex = filters.findIndex((f) => f.key === tag.key)
                return (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${getColorClass(tagFilterIndex)}`}
                    key={`${tag.key}-${tag.value}`}
                  >
                    {tag.filterLabel}: {tag.label}
                    <button
                      className="ml-1 hover:opacity-70"
                      onClick={() => removeFilterValue(tag.key, tag.value)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <Button className="text-xs" onClick={onClear} size="sm" variant="ghost">
              <X className="mr-1 h-3 w-3" />
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

export type SearchInputProps = {
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
      <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
      <Input
        className="w-full pr-10 pl-10"
        onChange={(e) => setLocalValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        value={localValue}
      />
      {localValue && (
        <button
          className="absolute top-2.5 right-3 text-gray-400 hover:text-gray-600"
          onClick={handleClear}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

// ============================================================================
// useFilters Hook
// ============================================================================

export type UseFiltersOptions = {
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
