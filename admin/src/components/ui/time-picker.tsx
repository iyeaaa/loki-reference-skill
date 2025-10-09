import { Clock } from "lucide-react"
import ReactDatePicker from "react-datepicker"
import "react-datepicker/dist/react-datepicker.css"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import "./time-picker-styles.css"

interface TimePickerProps {
  value: { hour: number; minute: number }
  onChange: (value: { hour: number; minute: number }) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  // Convert hour/minute to Date object for react-datepicker
  const timeToDate = (hour: number, minute: number): Date => {
    const date = new Date()
    date.setHours(hour, minute, 0, 0)
    return date
  }

  // Convert Date object back to hour/minute
  const dateToTime = (date: Date | null): { hour: number; minute: number } => {
    if (!date) return value
    return {
      hour: date.getHours(),
      minute: date.getMinutes(),
    }
  }

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }

  const handleTimeChange = (date: Date | null) => {
    if (date) {
      const newTime = dateToTime(date)
      onChange(newTime)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start text-left font-normal w-full", className)}
        >
          <Clock className="mr-2 h-4 w-4" />
          {formatTime(value.hour, value.minute)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-4">
          <div className="space-y-2 mb-3">
            <p className="text-sm font-medium">시간 선택</p>
          </div>
          <ReactDatePicker
            selected={timeToDate(value.hour, value.minute)}
            onChange={handleTimeChange}
            showTimeSelect
            showTimeSelectOnly
            timeIntervals={1}
            timeCaption="시간"
            dateFormat="HH:mm"
            inline
            timeFormat="HH:mm"
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
