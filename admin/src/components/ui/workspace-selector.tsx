"use client"

import { Building2, Check, ChevronsUpDown } from "lucide-react"
import * as React from "react"
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

export interface WorkspaceOption {
  value: string
  label: string
  sublabel?: string
}

interface WorkspaceSelectorProps {
  options: WorkspaceOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  maxHeight?: number
}

export function WorkspaceSelector({
  options,
  value,
  onValueChange,
  placeholder = "워크스페이스 선택...",
  searchPlaceholder = "워크스페이스 검색...",
  emptyText = "검색 결과가 없습니다.",
  className,
  disabled = false,
  maxHeight = 300,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return options

    const searchLower = searchValue.toLowerCase()
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        option.sublabel?.toLowerCase().includes(searchLower)
    )
  }, [options, searchValue])

  const handleSelect = (optionValue: string) => {
    onValueChange?.(optionValue)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("justify-between min-w-[200px]", className)}
          disabled={disabled}
        >
          <div className="flex items-center gap-2 flex-1 text-left">
            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
            {selectedOption ? (
              <div className="flex-1 truncate">
                <span className="font-medium">
                  {selectedOption.label}
                  {selectedOption.sublabel && (
                    <span className="text-muted-foreground text-xs ml-1">
                      ({selectedOption.sublabel})
                    </span>
                  )}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 bg-white dark:bg-gray-950 border" align="start">
        <Command shouldFilter={false} className="bg-white dark:bg-gray-950">
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <ScrollArea className={`h-[${maxHeight}px]`}>
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label, option.sublabel || ""]}
                    onSelect={() => handleSelect(option.value)}
                    className="cursor-pointer"
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === option.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1">
                      <span className="font-medium">
                        {option.label}
                        {option.sublabel && (
                          <span className="text-muted-foreground text-xs ml-1">
                            ({option.sublabel})
                          </span>
                        )}
                      </span>
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
