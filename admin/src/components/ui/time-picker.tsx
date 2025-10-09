import { Clock } from "lucide-react"
import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface TimePickerProps {
  value: { hour: number; minute: number }
  onChange: (value: { hour: number; minute: number }) => void
  className?: string
}

export function TimePicker({ value, onChange, className }: TimePickerProps) {
  const hourId = useId()
  const minuteId = useId()
  const [open, setOpen] = useState(false)
  const [tempHour, setTempHour] = useState(value.hour)
  const [tempMinute, setTempMinute] = useState(value.minute)

  const formatTime = (hour: number, minute: number) => {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`
  }

  const handleApply = () => {
    onChange({ hour: tempHour, minute: tempMinute })
    setOpen(false)
  }

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!Number.isNaN(val) && val >= 0 && val <= 23) {
      setTempHour(val)
    } else if (e.target.value === "") {
      setTempHour(0)
    }
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10)
    if (!Number.isNaN(val) && val >= 0 && val <= 59) {
      setTempMinute(val)
    } else if (e.target.value === "") {
      setTempMinute(0)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
        <div className="p-4 space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">시간 선택</p>
            <div className="flex items-center gap-3">
              {/* 시간 선택 */}
              <div className="space-y-1">
                <label htmlFor={hourId} className="text-xs text-muted-foreground">
                  시
                </label>
                <div className="flex flex-col gap-2">
                  <Input
                    id={hourId}
                    type="number"
                    min="0"
                    max="23"
                    value={tempHour}
                    onChange={handleHourChange}
                    className="w-20 text-center"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => setTempHour((prev) => (prev + 1) % 24)}
                    >
                      +
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => setTempHour((prev) => (prev - 1 + 24) % 24)}
                    >
                      −
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-2xl font-bold mt-6">:</div>

              {/* 분 선택 */}
              <div className="space-y-1">
                <label htmlFor={minuteId} className="text-xs text-muted-foreground">
                  분
                </label>
                <div className="flex flex-col gap-2">
                  <Input
                    id={minuteId}
                    type="number"
                    min="0"
                    max="59"
                    value={tempMinute}
                    onChange={handleMinuteChange}
                    className="w-20 text-center"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => setTempMinute((prev) => (prev + 1) % 60)}
                    >
                      +
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-7 p-0"
                      onClick={() => setTempMinute((prev) => (prev - 1 + 60) % 60)}
                    >
                      −
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 미리보기 */}
          <div className="rounded-md bg-muted p-2 text-center">
            <p className="text-sm text-muted-foreground">선택된 시간</p>
            <p className="text-2xl font-bold">{formatTime(tempHour, tempMinute)}</p>
          </div>

          {/* 버튼 */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              취소
            </Button>
            <Button type="button" className="flex-1" onClick={handleApply}>
              적용
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
