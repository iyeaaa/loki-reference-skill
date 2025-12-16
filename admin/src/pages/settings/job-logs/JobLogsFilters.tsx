import { X } from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import type { JobLogStatus } from "@/lib/api/types/job-log"

type JobLogsFiltersProps = {
  selectedStatuses: JobLogStatus[]
  selectedQueues: string[]
  dateRange: { start?: string; end?: string }
  queues: string[]
  onStatusChange: (statuses: JobLogStatus[]) => void
  onQueueChange: (queues: string[]) => void
  onDateRangeChange: (range: { start?: string; end?: string }) => void
  onClearFilters: () => void
}

const JOB_STATUSES: { value: JobLogStatus; label: string; color: string }[] = [
  { value: "waiting", label: "대기중", color: "yellow" },
  { value: "active", label: "처리중", color: "blue" },
  { value: "completed", label: "완료", color: "green" },
  { value: "failed", label: "실패", color: "red" },
  { value: "delayed", label: "지연", color: "orange" },
  { value: "stalled", label: "정지", color: "gray" },
]

export function JobLogsFilters({
  selectedStatuses,
  selectedQueues,
  dateRange,
  queues,
  onStatusChange,
  onQueueChange,
  onDateRangeChange,
  onClearFilters,
}: JobLogsFiltersProps) {
  const startDateId = useId()
  const endDateId = useId()

  const toggleStatus = (status: JobLogStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const hasActiveFilters =
    selectedStatuses.length > 0 || selectedQueues.length > 0 || dateRange.start || dateRange.end

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center gap-4">
            <span className="w-16 font-medium text-gray-700 text-sm dark:text-gray-300">상태</span>
            <div className="flex flex-wrap gap-3">
              {JOB_STATUSES.map((status) => (
                <div className="flex items-center space-x-2" key={status.value}>
                  <Checkbox
                    checked={selectedStatuses.includes(status.value)}
                    id={`status-${status.value}`}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`status-${status.value}`}
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Queue Filter */}
          <div className="flex items-start gap-4">
            <span className="w-16 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              Queue
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onQueueChange}
                options={queues.map((queue) => ({
                  value: queue,
                  label: queue,
                }))}
                placeholder="Queue를 선택하세요..."
                searchPlaceholder="Queue 이름으로 검색..."
                value={selectedQueues}
              />
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <span className="w-16 font-medium text-gray-700 text-sm dark:text-gray-300">기간</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label className="sr-only" htmlFor={startDateId}>
                  시작일
                </Label>
                <Input
                  className="w-48"
                  id={startDateId}
                  onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
                  type="datetime-local"
                  value={dateRange.start || ""}
                />
              </div>
              <span className="text-muted-foreground text-sm">~</span>
              <div className="flex items-center gap-2">
                <Label className="sr-only" htmlFor={endDateId}>
                  종료일
                </Label>
                <Input
                  className="w-48"
                  id={endDateId}
                  onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                  type="datetime-local"
                  value={dateRange.end || ""}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const statusInfo = JOB_STATUSES.find((s) => s.value === status)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={status}
                  >
                    상태: {statusInfo?.label || status}
                    <button
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      onClick={() => toggleStatus(status)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedQueues.map((queue) => (
                <span
                  className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-purple-800 text-xs dark:bg-purple-900/30 dark:text-purple-300"
                  key={queue}
                >
                  Queue: {queue}
                  <button
                    className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                    onClick={() => onQueueChange(selectedQueues.filter((q) => q !== queue))}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {dateRange.start && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300">
                  시작: {new Date(dateRange.start).toLocaleString("ko-KR")}
                  <button
                    className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    onClick={() => onDateRangeChange({ ...dateRange, start: undefined })}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              {dateRange.end && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300">
                  종료: {new Date(dateRange.end).toLocaleString("ko-KR")}
                  <button
                    className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    onClick={() => onDateRangeChange({ ...dateRange, end: undefined })}
                    type="button"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <Button className="text-xs" onClick={onClearFilters} size="sm" variant="ghost">
              <X className="mr-1 h-3 w-3" />
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
