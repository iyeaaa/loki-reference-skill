import { Filter, Search, X } from "lucide-react"
import { useEffect, useId, useState } from "react"
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

export type FilterConfig = {
  sentiment: string[]
  category: string[]
  priority: string[]
  search: string
  dateFrom?: string
  dateTo?: string
}

type FilterPanelProps = {
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
  dateFrom,
  dateTo,
  onToggleFilter,
  onDateChange,
  activeFilterCount,
  onClearAll,
}: {
  sentimentOptions: typeof SENTIMENT_OPTIONS
  categoryOptions: typeof CATEGORY_OPTIONS
  priorityOptions: typeof PRIORITY_OPTIONS
  selectedSentiment: string[]
  selectedCategory: string[]
  selectedPriority: string[]
  dateFrom: string
  dateTo: string
  onToggleFilter: (type: "sentiment" | "category" | "priority", value: string) => void
  onDateChange: (type: "from" | "to", value: string) => void
  activeFilterCount: number
  onClearAll: () => void
}) => {
  const dateFromId = useId()
  const dateToId = useId()

  return (
    <div className="space-y-4">
      {/* Sentiment Filter */}
      <div>
        <h4 className="mb-2 font-medium text-sm">Sentiment</h4>
        <div className="space-y-1">
          {sentimentOptions.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent"
              key={option.value}
            >
              <input
                checked={selectedSentiment.includes(option.value)}
                className="rounded border-gray-300"
                onChange={() => onToggleFilter("sentiment", option.value)}
                type="checkbox"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Category Filter */}
      <div>
        <h4 className="mb-2 font-medium text-sm">Category</h4>
        <div className="space-y-1">
          {categoryOptions.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent"
              key={option.value}
            >
              <input
                checked={selectedCategory.includes(option.value)}
                className="rounded border-gray-300"
                onChange={() => onToggleFilter("category", option.value)}
                type="checkbox"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Priority Filter */}
      <div>
        <h4 className="mb-2 font-medium text-sm">Priority</h4>
        <div className="space-y-1">
          {priorityOptions.map((option) => (
            <label
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-accent"
              key={option.value}
            >
              <input
                checked={selectedPriority.includes(option.value)}
                className="rounded border-gray-300"
                onChange={() => onToggleFilter("priority", option.value)}
                type="checkbox"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div>
        <h4 className="mb-2 font-medium text-sm">Date Range</h4>
        <div className="space-y-2">
          <div>
            <label className="text-muted-foreground text-xs" htmlFor={dateFromId}>
              From
            </label>
            <Input
              className="h-8 text-sm"
              id={dateFromId}
              onChange={(e) => onDateChange("from", e.target.value)}
              type="date"
              value={dateFrom}
            />
          </div>
          <div>
            <label className="text-muted-foreground text-xs" htmlFor={dateToId}>
              To
            </label>
            <Input
              className="h-8 text-sm"
              id={dateToId}
              onChange={(e) => onDateChange("to", e.target.value)}
              type="date"
              value={dateTo}
            />
          </div>
        </div>
      </div>

      {/* Clear All Button */}
      {activeFilterCount > 0 && (
        <Button className="w-full" onClick={onClearAll} size="sm" variant="outline">
          Clear All Filters
        </Button>
      )}
    </div>
  )
}

export function FilterPanel({
  onFilterChange,
  className,
  placeholder = "Search...",
}: FilterPanelProps) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [isMobile, setIsMobile] = useState(false)
  const dateFromDropdownId = useId()
  const dateToDropdownId = useId()

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
  const [dateFrom, setDateFrom] = useState(searchParams.get("dateFrom") || "")
  const [dateTo, setDateTo] = useState(searchParams.get("dateTo") || "")

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
    (searchQuery ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  // Auto-apply filters when they change
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) {
      params.set("search", searchQuery)
    }
    if (selectedSentiment.length > 0) {
      params.set("sentiment", selectedSentiment.join(","))
    }
    if (selectedCategory.length > 0) {
      params.set("category", selectedCategory.join(","))
    }
    if (selectedPriority.length > 0) {
      params.set("priority", selectedPriority.join(","))
    }
    if (dateFrom) {
      params.set("dateFrom", dateFrom)
    }
    if (dateTo) {
      params.set("dateTo", dateTo)
    }

    setSearchParams(params, { replace: true })

    if (onFilterChange) {
      onFilterChange({
        search: searchQuery,
        sentiment: selectedSentiment,
        category: selectedCategory,
        priority: selectedPriority,
        dateFrom,
        dateTo,
      })
    }
  }, [
    searchQuery,
    selectedSentiment,
    selectedCategory,
    selectedPriority,
    dateFrom,
    dateTo,
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
    setDateFrom("")
    setDateTo("")
    setSearchParams(new URLSearchParams(), { replace: true })

    if (onFilterChange) {
      onFilterChange({
        search: "",
        sentiment: [],
        category: [],
        priority: [],
        dateFrom: "",
        dateTo: "",
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
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Search"
            className="pr-9 pl-9"
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
            placeholder={placeholder}
            value={searchInput}
          />
          {searchInput && (
            <button
              aria-label="Clear search"
              className="-translate-y-1/2 absolute top-1/2 right-3 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchInput("")
                setSearchQuery("")
              }}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Filter Button - Desktop Dropdown */}
        {isMobile ? (
          /* Filter Button - Mobile Sheet */
          <Sheet>
            <SheetTrigger asChild>
              <Button
                aria-label="Open filters"
                className={cn(
                  "relative flex-shrink-0",
                  activeFilterCount > 0 && "border-primary text-primary",
                )}
                size="icon"
                variant="outline"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[300px] sm:w-[400px]" side="right">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterContent
                  activeFilterCount={activeFilterCount}
                  categoryOptions={CATEGORY_OPTIONS}
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onClearAll={clearAllFilters}
                  onDateChange={(type, value) => {
                    if (type === "from") {
                      setDateFrom(value)
                    } else {
                      setDateTo(value)
                    }
                  }}
                  onToggleFilter={toggleFilter}
                  priorityOptions={PRIORITY_OPTIONS}
                  selectedCategory={selectedCategory}
                  selectedPriority={selectedPriority}
                  selectedSentiment={selectedSentiment}
                  sentimentOptions={SENTIMENT_OPTIONS}
                />
              </div>
            </SheetContent>
          </Sheet>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Open filters"
                className={cn(
                  "relative flex-shrink-0",
                  activeFilterCount > 0 && "border-primary text-primary",
                )}
                size="icon"
                variant="outline"
              >
                <Filter className="h-4 w-4" />
                {activeFilterCount > 0 && (
                  <span className="-top-1 -right-1 absolute flex h-5 w-5 items-center justify-center rounded-full bg-primary font-medium text-[10px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[500px] w-64 overflow-y-auto">
              <DropdownMenuLabel>Filters</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {/* Sentiment */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="px-0 text-muted-foreground text-xs">
                  Sentiment
                </DropdownMenuLabel>
                {SENTIMENT_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    checked={selectedSentiment.includes(option.value)}
                    key={option.value}
                    onCheckedChange={() => toggleFilter("sentiment", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              {/* Category */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="px-0 text-muted-foreground text-xs">
                  Category
                </DropdownMenuLabel>
                {CATEGORY_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    checked={selectedCategory.includes(option.value)}
                    key={option.value}
                    onCheckedChange={() => toggleFilter("category", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              {/* Priority */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="px-0 text-muted-foreground text-xs">
                  Priority
                </DropdownMenuLabel>
                {PRIORITY_OPTIONS.map((option) => (
                  <DropdownMenuCheckboxItem
                    checked={selectedPriority.includes(option.value)}
                    key={option.value}
                    onCheckedChange={() => toggleFilter("priority", option.value)}
                  >
                    {option.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>

              <DropdownMenuSeparator />

              {/* Date Range */}
              <div className="px-2 py-2">
                <DropdownMenuLabel className="px-0 text-muted-foreground text-xs">
                  Date Range
                </DropdownMenuLabel>
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="text-muted-foreground text-xs" htmlFor={dateFromDropdownId}>
                      From
                    </label>
                    <Input
                      className="h-8 text-sm"
                      id={dateFromDropdownId}
                      onChange={(e) => setDateFrom(e.target.value)}
                      type="date"
                      value={dateFrom}
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground text-xs" htmlFor={dateToDropdownId}>
                      To
                    </label>
                    <Input
                      className="h-8 text-sm"
                      id={dateToDropdownId}
                      onChange={(e) => setDateTo(e.target.value)}
                      type="date"
                      value={dateTo}
                    />
                  </div>
                </div>
              </div>

              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-2 py-2">
                    <Button
                      className="w-full justify-center"
                      onClick={clearAllFilters}
                      size="sm"
                      variant="ghost"
                    >
                      Clear All Filters
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge className="gap-1" variant="secondary">
              Search: {searchQuery}
              <button
                aria-label="Remove search filter"
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => {
                  setSearchInput("")
                  setSearchQuery("")
                }}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {selectedSentiment.map((value) => (
            <Badge className="gap-1" key={value} variant="secondary">
              {SENTIMENT_OPTIONS.find((o) => o.value === value)?.label}
              <button
                aria-label={`Remove ${value} sentiment filter`}
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => removeFilter("sentiment", value)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedCategory.map((value) => (
            <Badge className="gap-1" key={value} variant="secondary">
              {CATEGORY_OPTIONS.find((o) => o.value === value)?.label}
              <button
                aria-label={`Remove ${value} category filter`}
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => removeFilter("category", value)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedPriority.map((value) => (
            <Badge className="gap-1" key={value} variant="secondary">
              {PRIORITY_OPTIONS.find((o) => o.value === value)?.label}
              <button
                aria-label={`Remove ${value} priority filter`}
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => removeFilter("priority", value)}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {dateFrom && (
            <Badge className="gap-1" variant="secondary">
              From: {dateFrom}
              <button
                aria-label="Remove date from filter"
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => setDateFrom("")}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dateTo && (
            <Badge className="gap-1" variant="secondary">
              To: {dateTo}
              <button
                aria-label="Remove date to filter"
                className="ml-1 rounded-full hover:bg-accent"
                onClick={() => setDateTo("")}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          <Button className="h-6 px-2 text-xs" onClick={clearAllFilters} size="sm" variant="ghost">
            Clear All
          </Button>
        </div>
      )}
    </div>
  )
}
