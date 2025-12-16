import { Check, ChevronsUpDown, X } from "lucide-react"
import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

export type MultiSelectOption = {
  value: string
  label: string
  sublabel?: string
}

type MultiSelectComboboxProps = {
  options: MultiSelectOption[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  maxHeight?: number
}

export function MultiSelectCombobox({
  options,
  value = [],
  onValueChange,
  placeholder = "선택하세요...",
  searchPlaceholder = "검색...",
  emptyText = "검색 결과가 없습니다.",
  className,
  disabled = false,
  maxHeight = 300,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOptions = options.filter((option) => value.includes(option.value))

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) {
      return options
    }

    const searchLower = searchValue.toLowerCase()
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        option.sublabel?.toLowerCase().includes(searchLower),
    )
  }, [options, searchValue])

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue]
    onValueChange?.(newValue)
  }

  const handleRemove = (optionValue: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    onValueChange?.(value.filter((v) => v !== optionValue))
  }

  const handleClear = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    onValueChange?.([])
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn("h-auto min-h-10 w-full justify-between", className)}
          disabled={disabled}
          role="combobox"
          variant="outline"
        >
          <div className="flex flex-1 flex-wrap gap-1">
            {selectedOptions.length > 0 ? (
              selectedOptions.length <= 3 ? (
                selectedOptions.map((option) => (
                  <Badge className="mr-1" key={option.value} variant="outline">
                    {option.label}
                    {/* biome-ignore lint/a11y/useSemanticElements: Avoiding nested button elements */}
                    <span
                      aria-label={`Remove ${option.label}`}
                      className="ml-1 inline-flex cursor-pointer items-center rounded-full border-0 bg-transparent p-0 outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      onClick={(e) => handleRemove(option.value, e)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault()
                          handleRemove(option.value, e)
                        }
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </span>
                  </Badge>
                ))
              ) : (
                <Badge className="mr-1" variant="outline">
                  {selectedOptions.length}개 선택됨
                  {/* biome-ignore lint/a11y/useSemanticElements: Avoiding nested button elements */}
                  <span
                    aria-label="Clear all selections"
                    className="ml-1 inline-flex cursor-pointer items-center rounded-full border-0 bg-transparent p-0 outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    onClick={handleClear}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        handleClear(e)
                      }
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </span>
                </Badge>
              )
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-full border bg-white p-0 dark:bg-gray-950">
        <Command className="bg-white dark:bg-gray-950" shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchValue}
            placeholder={searchPlaceholder}
            value={searchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <ScrollArea className={`h-[${maxHeight}px]`}>
              <CommandGroup>
                {filteredOptions.length > 0 && (
                  <CommandItem
                    className="font-semibold"
                    onSelect={() => {
                      if (value.length === filteredOptions.length) {
                        onValueChange?.([])
                      } else {
                        onValueChange?.(filteredOptions.map((o) => o.value))
                      }
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.length === filteredOptions.length ? "opacity-100" : "opacity-0",
                      )}
                    />
                    전체 선택 ({filteredOptions.length}개)
                  </CommandItem>
                )}
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    keywords={[option.label, option.sublabel || ""]}
                    onSelect={() => handleSelect(option.value)}
                    value={option.value}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.includes(option.value) ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span>{option.label}</span>
                        {option.sublabel && (
                          <span className="text-muted-foreground text-xs">({option.sublabel})</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
