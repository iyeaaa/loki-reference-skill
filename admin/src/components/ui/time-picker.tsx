import { Clock } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: { hour: number; minute: number }
  onChange: (value: { hour: number; minute: number }) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const minutes = Array.from({ length: 60 }, (_, i) => i)

  // Ensure values are valid numbers
  const safeHour = Number.isInteger(value.hour) ? value.hour : 9
  const safeMinute = Number.isInteger(value.minute) ? value.minute : 0

  const handleHourChange = (hourStr: string) => {
    const hour = parseInt(hourStr, 10)
    onChange({ hour, minute: safeMinute })
  }

  const handleMinuteChange = (minuteStr: string) => {
    const minute = parseInt(minuteStr, 10)
    onChange({ hour: safeHour, minute })
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Hour selector */}
      <div className="flex items-center gap-2 flex-1">
        <Select value={safeHour.toString()} onValueChange={handleHourChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="시간">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {safeHour.toString().padStart(2, "0")}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {hours.map((hour) => (
              <SelectItem key={hour} value={hour.toString()}>
                {hour.toString().padStart(2, "0")}시
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">시</span>
      </div>

      {/* Separator */}
      <div className="text-lg font-medium text-muted-foreground">:</div>

      {/* Minute selector */}
      <div className="flex items-center gap-2 flex-1">
        <Select value={safeMinute.toString()} onValueChange={handleMinuteChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="분">{safeMinute.toString().padStart(2, "0")}</SelectValue>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {minutes.map((minute) => (
              <SelectItem key={minute} value={minute.toString()}>
                {minute.toString().padStart(2, "0")}분
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">분</span>
      </div>
    </div>
  )
}
