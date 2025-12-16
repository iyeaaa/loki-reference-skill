import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type RepliedEmailFiltersProps = {
  selectedStatuses: string[]
  onStatusChange: (statuses: string[]) => void
  onClearFilters: () => void
}

export function RepliedEmailFilters({
  selectedStatuses,
  onStatusChange,
  onClearFilters,
}: RepliedEmailFiltersProps) {
  const statuses = [
    { value: "delivered", label: "전달됨" },
    { value: "opened", label: "열림" },
    { value: "clicked", label: "클릭됨" },
    { value: "replied", label: "답장됨" },
    { value: "bounced", label: "반송됨" },
    { value: "failed", label: "실패" },
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
          {/* <div className="flex items-center gap-4">
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
          </div> */}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const statusLabel = statuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300"
                    key={status}
                  >
                    상태: {statusLabel}
                    <button
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                      onClick={() => toggleStatus(status)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
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
