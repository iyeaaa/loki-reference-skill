import { format } from "date-fns"
import { ko } from "date-fns/locale"
import { Calendar as CalendarIcon, Search, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SEARCHABLE_LEAD_FIELDS } from "@/lib/api/types/lead-filters"
import type { SearchToken } from "@/lib/utils/search-tokens"
import { createToken, formatTokenDisplay } from "@/lib/utils/search-tokens"

interface AdvancedSearchInputProps {
  tokens: SearchToken[]
  onChange: (tokens: SearchToken[]) => void
  placeholder?: string
}

export function AdvancedSearchInput({
  tokens,
  onChange,
  placeholder = "필드 선택 후 값을 입력한 뒤, Enter 키를 눌러 검색하세요. (예: @회사명:그린다)",
}: AdvancedSearchInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [showFieldSelector, setShowFieldSelector] = useState(false)
  const [selectedField, setSelectedField] = useState<string | null>(null)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [currentDateField, setCurrentDateField] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const fieldRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Handle field selection
  const handleFieldSelect = useCallback((field: string) => {
    setSelectedField(field)
    const fieldConfig = SEARCHABLE_LEAD_FIELDS.find((f) => f.field === field)
    const fieldLabel = fieldConfig?.label || field

    // If it's a date field, show date picker instead
    if (fieldConfig?.type === "date") {
      setCurrentDateField(field)
      setShowDatePicker(true)
      setShowFieldSelector(false)
      setDateRange({}) // Reset date range
    } else {
      const newValue = `@${fieldLabel}:`
      setInputValue(newValue)
      setShowFieldSelector(false)
      // Focus input after selection and move cursor to end
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus()
          inputRef.current.setSelectionRange(newValue.length, newValue.length)
        }
      }, 0)
    }
  }, [])

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)

    // If user types @, show field selector
    if (value === "@" || value.endsWith(" @")) {
      setShowFieldSelector(true)
      setHighlightedIndex(0)
    }

    // If user deletes the @ prefix, reset selected field
    if (selectedField && !value.includes("@")) {
      setSelectedField(null)
    }
  }

  // Handle token creation
  const createTokenFromInput = useCallback(() => {
    if (!inputValue.trim()) return

    // Extract field and value from input (no space after colon required)
    const match = inputValue.match(/@([^:]+):(.+)/)
    if (!match) return

    const [, fieldLabel, value] = match
    if (!value.trim()) return

    // Find field by label
    const fieldConfig = SEARCHABLE_LEAD_FIELDS.find((f) => f.label === fieldLabel.trim())
    if (!fieldConfig) return

    // Create token
    const newToken = createToken(fieldConfig.field, value.trim())
    onChange([...tokens, newToken])

    // Reset input and state
    setInputValue("")
    setSelectedField(null)

    // Re-focus input for next search
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 0)
  }, [inputValue, tokens, onChange])

  // Handle date range confirmation
  const handleDateRangeConfirm = useCallback(() => {
    if (!currentDateField) return

    const fieldConfig = SEARCHABLE_LEAD_FIELDS.find((f) => f.field === currentDateField)
    if (!fieldConfig) return

    // Skip if no dates selected
    if (!dateRange.from && !dateRange.to) {
      // Don't create a filter if no dates selected
      setShowDatePicker(false)
      setCurrentDateField(null)
      setDateRange({})
      return
    }

    // Create token with proper operator and value for backend
    let newToken: SearchToken

    if (dateRange.from && dateRange.to) {
      // Both dates selected - use "between" operator
      const displayValue = `${format(dateRange.from, "yyyy-MM-dd", { locale: ko })} ~ ${format(dateRange.to, "yyyy-MM-dd", { locale: ko })}`
      newToken = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        field: currentDateField,
        fieldLabel: fieldConfig.label,
        operator: "between",
        value: JSON.stringify({
          from: format(dateRange.from, "yyyy-MM-dd"),
          to: format(dateRange.to, "yyyy-MM-dd"),
        }),
        displayValue,
      }
    } else if (dateRange.from) {
      // Only start date - use "gte" (greater than or equal)
      const displayValue = `${format(dateRange.from, "yyyy-MM-dd", { locale: ko })} ~`
      newToken = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        field: currentDateField,
        fieldLabel: fieldConfig.label,
        operator: "gte",
        value: format(dateRange.from, "yyyy-MM-dd"),
        displayValue,
      }
    } else if (dateRange.to) {
      // Only end date - use "lte" (less than or equal)
      const displayValue = `~ ${format(dateRange.to, "yyyy-MM-dd", { locale: ko })}`
      newToken = {
        id: `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        field: currentDateField,
        fieldLabel: fieldConfig.label,
        operator: "lte",
        value: format(dateRange.to, "yyyy-MM-dd"),
        displayValue,
      }
    } else {
      // This shouldn't happen but just in case
      return
    }

    onChange([...tokens, newToken])

    // Reset state
    setShowDatePicker(false)
    setCurrentDateField(null)
    setDateRange({})
    setInputValue("")

    // Re-focus input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }, 0)
  }, [currentDateField, dateRange, tokens, onChange])

  // No automatic token conversion - only manual via Enter key

  // Scroll highlighted item into view
  useEffect(() => {
    if (showFieldSelector && fieldRefs.current[highlightedIndex]) {
      fieldRefs.current[highlightedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      })
    }
  }, [highlightedIndex, showFieldSelector])

  // Handle key down
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // If field selector is showing, handle navigation
    if (showFieldSelector) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < SEARCHABLE_LEAD_FIELDS.length - 1 ? prev + 1 : prev))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === "Enter") {
        e.preventDefault()
        // Select the highlighted field
        const selectedFieldConfig = SEARCHABLE_LEAD_FIELDS[highlightedIndex]
        if (selectedFieldConfig) {
          handleFieldSelect(selectedFieldConfig.field)
        }
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowFieldSelector(false)
        setHighlightedIndex(0)
      }
    } else {
      // Normal input mode
      if (e.key === "Enter") {
        e.preventDefault()
        createTokenFromInput()
      } else if (e.key === "Backspace" && !inputValue) {
        // Delete last token if input is empty
        if (tokens.length > 0) {
          onChange(tokens.slice(0, -1))
        }
      } else if (e.key === "Escape") {
        setSelectedField(null)
        setInputValue("")
      }
    }
  }

  // Handle token removal
  const removeToken = useCallback(
    (tokenId: string) => {
      onChange(tokens.filter((t) => t.id !== tokenId))
    },
    [tokens, onChange],
  )

  // Handle focus
  const handleFocus = () => {
    // Show field selector when input is empty or only has whitespace
    if (!inputValue.trim()) {
      setShowFieldSelector(true)
      setHighlightedIndex(0)
      setSelectedField(null)
    }
  }

  // Handle click
  const handleClick = () => {
    // Show field selector when input is empty
    if (!inputValue.trim()) {
      setShowFieldSelector(true)
      setHighlightedIndex(0)
      setSelectedField(null)
    }
  }

  // Close field selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowFieldSelector(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="space-y-3">
      <div className="relative">
        {/* Search input container */}
        <div className="flex items-center gap-2 min-h-[42px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />

          {/* Tokens */}
          <div className="flex items-center gap-1 flex-wrap flex-1">
            {tokens.map((token) => (
              <Badge
                key={token.id}
                variant="secondary"
                className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50"
              >
                <span className="text-xs font-medium">{formatTokenDisplay(token)}</span>
                <button
                  type="button"
                  onClick={() => removeToken(token.id)}
                  className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}

            {/* Input field */}
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onClick={handleClick}
              placeholder={tokens.length === 0 ? placeholder : ""}
              className="flex-1 min-w-[200px] bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </div>

          {/* Clear all button */}
          {tokens.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange([])}
              className="h-6 px-2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Field selector dropdown */}
        {showFieldSelector && (
          <div className="absolute top-full left-0 right-0 mt-1 z-50">
            <div className="rounded-md border border-input bg-background shadow-lg">
              <div className="p-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  검색할 필드를 선택하세요:
                </p>
                <div className="max-h-[300px] overflow-y-auto">
                  <div className="grid grid-cols-2 gap-1">
                    {SEARCHABLE_LEAD_FIELDS.map((field, index) => (
                      <button
                        key={field.field}
                        ref={(el) => {
                          fieldRefs.current[index] = el
                        }}
                        type="button"
                        onClick={() => handleFieldSelect(field.field)}
                        onMouseEnter={() => setHighlightedIndex(index)}
                        className={`px-3 py-2 text-sm text-left rounded-sm transition-colors border border-border ${
                          index === highlightedIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        }`}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active filters display */}
      {tokens.length > 0 && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{tokens.length}개의 검색 조건이 적용되었습니다.</span>
        </div>
      )}

      {/* Date Range Picker */}
      {showDatePicker && currentDateField && (
        <div className="mt-3 p-4 border border-input rounded-md bg-background">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium">
              {SEARCHABLE_LEAD_FIELDS.find((f) => f.field === currentDateField)?.label} 범위 선택
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowDatePicker(false)
                setCurrentDateField(null)
                setDateRange({})
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* From Date */}
            <div className="space-y-2">
              <div className="text-sm font-medium">시작일</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      format(dateRange.from, "yyyy년 MM월 dd일", { locale: ko })
                    ) : (
                      <span className="text-muted-foreground">무한대</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange((prev) => ({ ...prev, from: date }))}
                    initialFocus
                    locale={ko}
                  />
                  {dateRange.from && (
                    <div className="p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange((prev) => ({ ...prev, from: undefined }))}
                        className="w-full"
                      >
                        초기화
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
            <div className="space-y-2">
              <div className="text-sm font-medium">종료일</div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.to ? (
                      format(dateRange.to, "yyyy년 MM월 dd일", { locale: ko })
                    ) : (
                      <span className="text-muted-foreground">무한대</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange((prev) => ({ ...prev, to: date }))}
                    initialFocus
                    locale={ko}
                  />
                  {dateRange.to && (
                    <div className="p-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setDateRange((prev) => ({ ...prev, to: undefined }))}
                        className="w-full"
                      >
                        초기화
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDatePicker(false)
                setCurrentDateField(null)
                setDateRange({})
              }}
            >
              취소
            </Button>
            <Button onClick={handleDateRangeConfirm}>적용</Button>
          </div>
        </div>
      )}
    </div>
  )
}
