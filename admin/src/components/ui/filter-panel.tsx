import { Filter, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Badge } from "./badge"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Input } from "./input"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./sheet"

export interface FilterConfig {
  sentiment: string[]
  category: string[]
  priority: string[]
  search: string
}

interface FilterPanelProps {
  onFilterChange?: (filters: FilterConfig) => void
  className?: string
  placeholder?: string
}

const SENTIMENT_OPTIONS = [
  { value: "positive", label: "Positive" },
  { value: "negative", label: "Negative" },
  { value: "neutral", label: "Neutral" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "unclassified", label: "Unclassified" },
]

const CATEGORY_OPTIONS = [
  { value: "meeting_request", label: "Meeting Request" },
  { value: "question", label: "Question" },
  { value: "auto", label: "Auto" },
  { value: "other", label: "Other" },
]

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

// FilterContent component moved outside to avoid nested component definition
const FilterContent = ({
  sentimentOptions,
  categoryOptions,
  priorityOptions,
  selectedSentiment,
  selectedCategory,
  selectedPriority,
  onToggleFilter,
  activeFilterCount,
  onClearAll,
}: {
  sentimentOptions: typeof SENTIMENT_OPTIONS
  categoryOptions: typeof CATEGORY_OPTIONS
  priorityOptions: typeof PRIORITY_OPTIONS
  selectedSentiment: string[]
  selectedCategory: string[]
  selectedPriority: string[]
  onToggleFilter: (type: "sentiment" | "category" | "priority", value: string) => void
  activeFilterCount: number
  onClearAll: () => void
}) => (
  <div className="space-y-4">
    {/* Sentiment Filter */}
    <div>
      <h4 className="text-sm font-medium mb-2">Sentiment</h4>
      <div className="space-y-1">
        {sentimentOptions.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded-md"
          >
            <input
              type="checkbox"
              checked={selectedSentiment.includes(option.value)}
              onChange={() => onToggleFilter("sentiment", option.value)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </div>

    {/* Category Filter */}
    <div>
      <h4 className="text-sm font-medium mb-2">Category</h4>
      <div className="space-y-1">
        {categoryOptions.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded-md"
          >
            <input
              type="checkbox"
              checked={selectedCategory.includes(option.value)}
              onChange={() => onToggleFilter("category", option.value)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </div>

    {/* Priority Filter */}
    <div>
      <h4 className="text-sm font-medium mb-2">Priority</h4>
      <div className="space-y-1">
        {priorityOptions.map((option) => (
          <label
            key={option.value}
            className="flex items-center gap-2 cursor-pointer hover:bg-accent p-2 rounded-md"
          >
            <input
              type="checkbox"
              checked={selectedPriority.includes(option.value)}
              onChange={() => onToggleFilter("priority", option.value)}
              className="rounded border-gray-300"
            />
            <span className="text-sm">{option.label}</span>
          </label>
        ))}
      </div>
    </div>

    {/* Clear All Button */}
    {activeFilterCount > 0 && (
      <Button variant="outline" size="sm" onClick={onClearAll} className="w-full">
        Clear All Filters
      </Button>
    )}
  </div>
)

export function FilterPanel({
  onFilterChange,
  className,
  placeholder = "Search...",
}: FilterPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(false)

  // Initialize from URL
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "")
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [selectedSentiment, setSelectedSentiment] = useState<string[]>(
    searchParams.get("sentiment")?.split(",").filter(Boolean) || [],
  )
  const [selectedCategory, setSelectedCategory] = useState<string[]>(
    searchParams.get("category")?.split(",").filter(Boolean) || [],
  )
  const [selectedPriority, setSelectedPriority] = useState<string[]>(
    searchParams.get("priority")?.split(",").filter(Boolean) || [],
  )

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

  // Calculate active filter count
  const activeFilterCount =
    selectedSentiment.length +
    selectedCategory.length +
    selectedPriority.length +
    (searchQuery ? 1 : 0)

  // Auto-apply filters when they change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set("search", searchQuery)
    if (selectedSentiment.length > 0) params.set("sentiment", selectedSentiment.join(","))
    if (selectedCategory.length > 0) params.set("category", selectedCategory.join(","))
    if (selectedPriority.length > 0) params.set("priority", selectedPriority.join(","))

    setSearchParams(params, { replace: true })

    if (onFilterChange) {
      onFilterChange({
        search: searchQuery,
        sentiment: selectedSentiment,
        category: selectedCategory,
        priority: selectedPriority,
      })
    }
  }, [
    searchQuery,
    selectedSentiment,
    selectedCategory,
    selectedPriority,
    setSearchParams,
    onFilterChange,
  ])

  // Clear all filters
  const clearAllFilters = () => {
    setSearchInput("")
    setSearchQuery("")
    setSelectedSentiment([])
    setSelectedCategory([])
    setSelectedPriority([])
    setSearchParams(new URLSearchParams(), { replace: true })

    if (onFilterChange) {
      onFilterChange({
        search: "",
        sentiment: [],
        category: [],
        priority: [],
      })
    }
  }

  // Remove individual filter chip
  const removeFilter = (type: "sentiment" | "category" | "priority", value: string) => {
    switch (type) {
      case "sentiment":
        setSelectedSentiment((prev) => prev.filter((v) => v !== value))
        break
      case "category":
        setSelectedCategory((prev) => prev.filter((v) => v !== value))
        break
      case "priority":
        setSelectedPriority((prev) => prev.filter((v) => v !== value))
        break
    }
  }

  // Toggle filter selection
  const toggleFilter = (type: "sentiment" | "category" | "priority", value: string) => {
    switch (type) {
      case "sentiment":
        setSelectedSentiment((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
        )
        break
      case "category":
        setSelectedCategory((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
        )
        break
      case "priority":
        setSelectedPriority((prev) =>
          prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
        )
        break
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search and Filter Row */}
      <div className="flex gap-2">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearchQuery(searchInput)
              }
              if (e.key === "Escape") {
                setSearchInput("")
                setSearchQuery("")
              }
            }}
            className="pl-9 pr-9"
            aria-label="Search"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("")
                setSearchQuery("")
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Button - Desktop Dropdown */}
        {!isMobile ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "relative flex-shrink-0",
                  activeFilterCount > 0 && "border-primary text-primary",
                )}
                aria-label="Open filters"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 max-h-[500px] overflow-y-auto">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Sentiment */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-0">
                  Sentiment
                </DropdownMenuLabel>
                {SENTIMENT_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={selectedSentiment.includes(option.value)}
                    onCheckedChange={() => toggleFilter("sentiment", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              {/* Category */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-0">
                  Category
                </DropdownMenuLabel>
                {CATEGORY_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={selectedCategory.includes(option.value)}
                    onCheckedChange={() => toggleFilter("category", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              {/* Priority */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="text-xs text-muted-foreground px-0">
                  Priority
                </DropdownMenuLabel>
                {PRIORITY_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    key={option.value}
                    checked={selectedPriority.includes(option.value)}
                    onCheckedChange={() => toggleFilter("priority", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="w-full justify-center"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          /* Filter Button - Mobile Sheet */
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  "relative flex-shrink-0",
                  activeFilterCount > 0 && "border-primary text-primary",
                )}
                aria-label="Open filters"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterContent
                  sentimentOptions={SENTIMENT_OPTIONS}
                  categoryOptions={CATEGORY_OPTIONS}
                  priorityOptions={PRIORITY_OPTIONS}
                  selectedSentiment={selectedSentiment}
                  selectedCategory={selectedCategory}
                  selectedPriority={selectedPriority}
                  onToggleFilter={toggleFilter}
                  activeFilterCount={activeFilterCount}
                  onClearAll={clearAllFilters}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Search: {searchQuery}
              <button
                type="button"
                onClick={() => {
                  setSearchInput("")
                  setSearchQuery("")
                }}
                className="ml-1 hover:bg-accent rounded-full"
                aria-label="Remove search filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedSentiment.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {SENTIMENT_OPTIONS.find((o) => o.value === value)?.label}
              <button
                type="button"
                onClick={() => removeFilter("sentiment", value)}
                className="ml-1 hover:bg-accent rounded-full"
                aria-label={`Remove ${value} sentiment filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedCategory.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {CATEGORY_OPTIONS.find((o) => o.value === value)?.label}
              <button
                type="button"
                onClick={() => removeFilter("category", value)}
                className="ml-1 hover:bg-accent rounded-full"
                aria-label={`Remove ${value} category filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedPriority.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {PRIORITY_OPTIONS.find((o) => o.value === value)?.label}
              <button
                type="button"
                onClick={() => removeFilter("priority", value)}
                className="ml-1 hover:bg-accent rounded-full"
                aria-label={`Remove ${value} priority filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-6 px-2 text-xs">
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}
