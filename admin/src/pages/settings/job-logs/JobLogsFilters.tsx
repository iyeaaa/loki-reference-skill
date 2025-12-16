import { X } from "lucide-react"
import { useId } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import type { JobLogStatus } from "@/lib/api/types/job-log"

interface JobLogsFiltersProps {
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">상태</span>
            <div className="flex flex-wrap gap-3">
              {JOB_STATUSES.map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`status-${status.value}`}
                    checked={selectedStatuses.includes(status.value)}
                    onCheckedChange={() => toggleStatus(status.value)}
                  />
                  <label
                    htmlFor={`status-${status.value}`}
                    className="text-sm select-none cursor-pointer"
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Queue Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 pt-2">
              Queue
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={queues.map((queue) => ({
                  value: queue,
                  label: queue,
                }))}
                value={selectedQueues}
                onValueChange={onQueueChange}
                placeholder="Queue를 선택하세요..."
                searchPlaceholder="Queue 이름으로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">기간</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={startDateId} className="sr-only">
                  시작일
                </Label>
                <Input
                  id={startDateId}
                  type="datetime-local"
                  value={dateRange.start || ""}
                  onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
                  className="w-48"
                />
              </div>
              <span className="text-sm text-muted-foreground">~</span>
              <div className="flex items-center gap-2">
                <Label htmlFor={endDateId} className="sr-only">
                  종료일
                </Label>
                <Input
                  id={endDateId}
                  type="datetime-local"
                  value={dateRange.end || ""}
                  onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                  className="w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const statusInfo = JOB_STATUSES.find((s) => s.value === status)
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    상태: {statusInfo?.label || status}
                    <button
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedQueues.map((queue) => (
                <span
                  key={queue}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                >
                  Queue: {queue}
                  <button
                    type="button"
                    onClick={() => onQueueChange(selectedQueues.filter((q) => q !== queue))}
                    className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {dateRange.start && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
                  시작: {new Date(dateRange.start).toLocaleString("ko-KR")}
                  <button
                    type="button"
                    onClick={() => onDateRangeChange({ ...dateRange, start: undefined })}
                    className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
              {dateRange.end && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full">
                  종료: {new Date(dateRange.end).toLocaleString("ko-KR")}
                  <button
                    type="button"
                    onClick={() => onDateRangeChange({ ...dateRange, end: undefined })}
                    className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs">
              <X className="w-3 h-3 mr-1" />
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
