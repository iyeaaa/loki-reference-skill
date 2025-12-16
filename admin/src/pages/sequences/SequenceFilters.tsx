import { X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"

type SequenceFiltersProps = {
  selectedStatuses: string[]
  onStatusChange: (statuses: string[]) => void
  onClearFilters: () => void
}

export function SequenceFilters({
  selectedStatuses,
  onStatusChange,
  onClearFilters,
}: SequenceFiltersProps) {
  const { t } = useTranslation()
  const statuses = [
    { value: "draft", label: t("sequences.table.status.draft") },
    { value: "generating", label: t("sequences.table.status.generating") },
    { value: "active", label: t("sequences.table.status.active") },
    { value: "paused", label: t("sequences.table.status.paused") },
    { value: "archived", label: t("sequences.table.status.archived") },
    { value: "no_response", label: t("sequences.table.status.noResponse") },
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
            <span className="w-24 font-medium text-gray-700 text-sm dark:text-gray-300">
              {t("sequences.filter.status")}
            </span>
            <div className="flex flex-wrap gap-3">
              {statuses.map((status) => (
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
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedStatuses.map((status) => {
                const statusLabel = statuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={status}
                  >
                    {t("sequences.filter.statusLabel")}: {statusLabel}
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
            </div>
          </div>
        )}

        {/* Clear Filters Button at Bottom */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <Button className="text-xs" onClick={onClearFilters} size="sm" variant="ghost">
              <X className="mr-1 h-3 w-3" />
              {t("sequences.filter.clearFilters")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
