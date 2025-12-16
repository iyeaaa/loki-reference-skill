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

export type WorkspaceOption = {
  value: string
  label: string
  sublabel?: string
}

type WorkspaceSelectorProps = {
  options: WorkspaceOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  maxHeight?: number
  compact?: boolean
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
  compact = false,
}: WorkspaceSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

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
    onValueChange?.(optionValue)
    setOpen(false)
    setSearchValue("")
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className={cn(
            "min-w-[200px] max-w-full justify-between overflow-hidden",
            compact ? "h-10" : "h-auto py-2",
            className,
          )}
          disabled={disabled}
          role="combobox"
          variant="outline"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-left">
            <Building2 className="h-4 w-4 shrink-0 text-[#2563EB]" />
            {selectedOption ? (
              compact ? (
                <span className="truncate font-medium text-sm">{selectedOption.label}</span>
              ) : (
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium text-sm leading-tight">
                    {selectedOption.label}
                  </span>
                  {selectedOption.sublabel && (
                    <span className="truncate text-muted-foreground text-xs leading-tight">
                      {selectedOption.sublabel}
                    </span>
                  )}
                </div>
              )
            ) : (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] border bg-white p-0 dark:bg-gray-950">
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
                {filteredOptions.map((option) => (
                  <CommandItem
                    className="cursor-pointer"
                    key={option.value}
                    keywords={[option.label, option.sublabel || ""]}
                    onSelect={() => handleSelect(option.value)}
                    value={option.value}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === option.value ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1 overflow-hidden">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.sublabel && (
                        <span className="block truncate text-muted-foreground text-xs">
                          {option.sublabel}
                        </span>
                      )}
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
