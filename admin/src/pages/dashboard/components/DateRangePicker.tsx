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

export interface DateRangeValue {
  from: Date
  to: Date
  preset?: string
}

interface DateRangePickerProps {
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
    id: "thisMonth",
    getValue: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return { from, to: new Date() }
    },
  },
  {
    id: "lastMonth",
    getValue: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to = new Date(now.getFullYear(), now.getMonth(), 0)
      to.setHours(23, 59, 59, 999)
      return { from, to }
    },
  },
  {
    id: "thisWeek",
    getValue: () => {
      const now = new Date()
      const from = new Date(now)
      // 일요일로 설정 (0 = 일요일)
      from.setDate(from.getDate() - from.getDay())
      from.setHours(0, 0, 0, 0)
      return { from, to: new Date() }
    },
  },
  {
    id: "lastWeek",
    getValue: () => {
      const now = new Date()
      // 지난주 일요일
      const from = new Date(now)
      from.setDate(from.getDate() - from.getDay() - 7)
      from.setHours(0, 0, 0, 0)
      // 지난주 토요일
      const to = new Date(from)
      to.setDate(to.getDate() + 6)
      to.setHours(23, 59, 59, 999)
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
  {
    id: "thisQuarter",
    getValue: () => {
      const now = new Date()
      const currentQuarter = Math.floor(now.getMonth() / 3)
      const from = new Date(now.getFullYear(), currentQuarter * 3, 1)
      return { from, to: new Date() }
    },
  },
  {
    id: "thisYear",
    getValue: () => {
      const now = new Date()
      const from = new Date(now.getFullYear(), 0, 1)
      return { from, to: new Date() }
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
    thisMonth: t("dashboard.preset.thisMonth"),
    lastMonth: t("dashboard.preset.lastMonth"),
    thisWeek: t("dashboard.preset.thisWeek"),
    lastWeek: t("dashboard.preset.lastWeek"),
    last90days: t("dashboard.preset.last90days"),
    thisQuarter: t("dashboard.preset.thisQuarter"),
    thisYear: t("dashboard.preset.thisYear"),
  } as const

  const maxPeriodDay = 365

  const canSelectDateRange = (range: DateRange) => {
    const from = range?.from
    const to = range?.to
    if (!from || !to || to < from) return false
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-3 space-y-1 flex flex-col">
            <div className="text-sm font-medium mb-2">{t("dashboard.preset.title")}</div>
            <Separator className="border-t" />
            <ScrollArea className="h-[250px]">
              <div className="flex flex-col">
                {presets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "w-full justify-start",
                      value?.preset === preset.id && "bg-accent",
                    )}
                    onClick={() => handlePresetSelect(preset)}
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
              mode="range"
              selected={dateRange}
              onSelect={handleDateRangeSelect}
              numberOfMonths={2}
              defaultMonth={dateRange?.from}
              showOutsideDays={false}
              disabled={(date) => date > new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
