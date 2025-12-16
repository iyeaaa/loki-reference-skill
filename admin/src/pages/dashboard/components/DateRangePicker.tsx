import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { useState } from "react"
import type { DateRange } from "react-day-picker"
import toast from "react-hot-toast"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

export type DateRangeValue = {
  from: Date
  to: Date
  preset?: string
}

type DateRangePickerProps = {
  value?: DateRangeValue
  onChange: (value: DateRangeValue) => void
  className?: string
}

const presets = [
  {
    id: "today",
    getValue: () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return { from: today, to: new Date() }
    },
  },
  {
    id: "yesterday",
    getValue: () => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(0, 0, 0, 0)
      const yesterdayEnd = new Date(yesterday)
      yesterdayEnd.setHours(23, 59, 59, 999)
      return { from: yesterday, to: yesterdayEnd }
    },
  },
  {
    id: "last7days",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 6)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    },
  },
  {
    id: "last30days",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 29)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    },
  },
  {
    id: "last90days",
    getValue: () => {
      const to = new Date()
      const from = new Date()
      from.setDate(from.getDate() - 89)
      from.setHours(0, 0, 0, 0)
      return { from, to }
    },
  },
] as const

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined,
  )

  const presetTranslations = {
    today: t("dashboard.preset.today"),
    yesterday: t("dashboard.preset.yesterday"),
    last7days: t("dashboard.preset.last7days"),
    last30days: t("dashboard.preset.last30days"),
    last90days: t("dashboard.preset.last90days"),
  } as const

  const maxPeriodDay = 365

  const canSelectDateRange = (range: DateRange) => {
    const from = range?.from
    const to = range?.to
    if (!(from && to) || to < from) {
      return false
    }
    const diffTime = to.getTime() - from.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= maxPeriodDay
  }

  const handlePresetSelect = (preset: (typeof presets)[number]) => {
    const range = preset.getValue()
    setDateRange(range)
    onChange({ ...range, preset: preset.id })
    setOpen(false)
  }

  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    if (range?.from && range?.to && canSelectDateRange(range)) {
      onChange({ from: range.from, to: range.to })
    } else {
      toast.error(t("dashboard.preset.maxPeriodExceeded", { maxDays: maxPeriodDay }))
      setDateRange(undefined)
    }
  }

  const displayText = value
    ? value.preset
      ? presetTranslations[value.preset as keyof typeof presetTranslations] ||
        `${format(value.from, "yyyy-MM-dd")} - ${format(value.to, "yyyy-MM-dd")}`
      : `${format(value.from, "yyyy-MM-dd")} - ${format(value.to, "yyyy-MM-dd")}`
    : t("dashboard.preset.selectPeriod")

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
          variant="outline"
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="flex flex-col space-y-1 border-r p-3">
            <div className="mb-2 font-medium text-sm">{t("dashboard.preset.title")}</div>
            <Separator className="border-t" />
            <ScrollArea className="h-[250px]">
              <div className="flex flex-col">
                {presets.map((preset) => (
                  <Button
                    className={cn(
                      "w-full justify-start",
                      value?.preset === preset.id && "bg-accent",
                    )}
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset)}
                    size="sm"
                    variant="ghost"
                  >
                    {presetTranslations[preset.id as keyof typeof presetTranslations]}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Calendar */}
          <div className="p-3">
            <Calendar
              defaultMonth={dateRange?.from}
              disabled={(date) => date > new Date(new Date().setHours(0, 0, 0, 0))}
              mode="range"
              numberOfMonths={2}
              onSelect={handleDateRangeSelect}
              selected={dateRange}
              showOutsideDays={false}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
