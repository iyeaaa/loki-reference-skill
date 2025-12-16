import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

type User = {
  id: string
  username: string
  email: string
}

type WorkspaceFiltersProps = {
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
            <span className="w-16 font-medium text-gray-700 text-sm dark:text-gray-300">상태</span>
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

          {/* Owner Filter */}
          <div className="flex items-start gap-4">
            <span className="w-16 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              소유자
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onOwnerChange}
                options={users.map((user) => ({
                  value: user.id,
                  label: user.username,
                  sublabel: user.email,
                }))}
                placeholder="소유자를 선택하세요..."
                searchPlaceholder="사용자명 또는 이메일로 검색..."
                value={selectedOwners}
              />
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
              {selectedOwners.map((ownerId) => {
                const owner = users.find((u) => u.id === ownerId)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={ownerId}
                  >
                    소유자: {owner?.username || ownerId}
                    <button
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      onClick={() => onOwnerChange(selectedOwners.filter((o) => o !== ownerId))}
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
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
