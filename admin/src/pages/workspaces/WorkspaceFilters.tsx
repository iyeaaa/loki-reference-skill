import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

interface User {
  id: string
  username: string
  email: string
}

interface WorkspaceFiltersProps {
  selectedStatuses: string[]
  selectedOwners: string[]
  users: User[]
  onStatusChange: (statuses: string[]) => void
  onOwnerChange: (owners: string[]) => void
  onClearFilters: () => void
}

export function WorkspaceFilters({
  selectedStatuses,
  selectedOwners,
  users,
  onStatusChange,
  onOwnerChange,
  onClearFilters,
}: WorkspaceFiltersProps) {
  const statuses = [
    { value: "active", label: "활성" },
    { value: "inactive", label: "비활성" },
  ]

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const hasActiveFilters = selectedStatuses.length > 0 || selectedOwners.length > 0

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

          {/* Owner Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 pt-2">
              소유자
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={users.map((user) => ({
                  value: user.id,
                  label: user.username,
                  sublabel: user.email,
                }))}
                value={selectedOwners}
                onValueChange={onOwnerChange}
                placeholder="소유자를 선택하세요..."
                searchPlaceholder="사용자명 또는 이메일로 검색..."
                emptyText="검색 결과가 없습니다."
              />
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
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    상태: {statusLabel}
                    <button
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedOwners.map((ownerId) => {
                const owner = users.find((u) => u.id === ownerId)
                return (
                  <span
                    key={ownerId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    소유자: {owner?.username || ownerId}
                    <button
                      type="button"
                      onClick={() => onOwnerChange(selectedOwners.filter((o) => o !== ownerId))}
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
