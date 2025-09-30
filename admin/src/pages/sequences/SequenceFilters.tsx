import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

interface SequenceFiltersProps {
  selectedStatuses: string[]
  onStatusChange: (statuses: string[]) => void
  onClearFilters: () => void
}

export function SequenceFilters({
  selectedStatuses,
  onStatusChange,
  onClearFilters,
}: SequenceFiltersProps) {
  const statuses = [
    { value: "draft", label: "초안" },
    { value: "active", label: "활성" },
    { value: "paused", label: "일시정지" },
    { value: "archived", label: "보관됨" },
  ]

  const toggleStatus = (status: string) => {
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">상태</span>
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
                const statusLabel = statuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    상태: {statusLabel}
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
            </div>
          </div>
        )}

        {/* Clear Filters Button at Bottom */}
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
