import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import type { JobStatus } from "@/lib/api/types/bullmq-test"

interface JobFiltersProps {
  selectedStatuses: JobStatus[]
  onStatusChange: (statuses: JobStatus[]) => void
  onClearFilters: () => void
}

export function JobFilters({ selectedStatuses, onStatusChange, onClearFilters }: JobFiltersProps) {
  const statuses: { value: JobStatus; label: string; color: string }[] = [
    {
      value: "waiting",
      label: "대기중",
      color: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
    },
    {
      value: "active",
      label: "처리중",
      color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300",
    },
    {
      value: "completed",
      label: "완료",
      color: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    },
    {
      value: "failed",
      label: "실패",
      color: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
    },
    {
      value: "delayed",
      label: "지연",
      color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300",
    },
  ]

  const toggleStatus = (status: JobStatus) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const hasActiveFilters = selectedStatuses.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">상태</span>
            <div className="flex flex-wrap gap-3">
              {statuses.map((status) => (
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
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const statusInfo = statuses.find((s) => s.value === status)
                return (
                  <span
                    key={status}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${statusInfo?.color}`}
                  >
                    {statusInfo?.label}
                    <button
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className="ml-1 hover:opacity-70"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
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
