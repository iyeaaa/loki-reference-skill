import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

type Workspace = {
  id: string
  name: string
}

type EmailAccountFiltersProps = {
  selectedStatuses: string[]
  selectedWorkspaces: string[]
  selectedIsDefault: string[]
  workspaces: Workspace[]
  onStatusChange: (statuses: string[]) => void
  onWorkspaceChange: (workspaces: string[]) => void
  onIsDefaultChange: (isDefault: string[]) => void
  onClearFilters: () => void
}

export function EmailAccountFilters({
  selectedStatuses,
  selectedWorkspaces,
  selectedIsDefault,
  workspaces,
  onStatusChange,
  onWorkspaceChange,
  onIsDefaultChange,
  onClearFilters,
}: EmailAccountFiltersProps) {
  const statuses = [
    { value: "active", label: "활성" },
    { value: "inactive", label: "비활성" },
    { value: "error", label: "오류" },
    { value: "rate_limited", label: "제한됨" },
    { value: "suspended", label: "정지됨" },
  ]

  const isDefaultOptions = [
    { value: "true", label: "기본 계정" },
    { value: "false", label: "일반 계정" },
  ]

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const toggleIsDefault = (value: string) => {
    if (selectedIsDefault.includes(value)) {
      onIsDefaultChange(selectedIsDefault.filter((v) => v !== value))
    } else {
      onIsDefaultChange([...selectedIsDefault, value])
    }
  }

  const hasActiveFilters =
    selectedStatuses.length > 0 || selectedWorkspaces.length > 0 || selectedIsDefault.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Status Filter */}
          <div className="flex items-center gap-4">
            <span className="w-24 font-medium text-gray-700 text-sm dark:text-gray-300">상태</span>
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

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="w-24 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              워크스페이스
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onWorkspaceChange}
                options={workspaces.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                }))}
                placeholder="워크스페이스를 선택하세요..."
                searchPlaceholder="워크스페이스명으로 검색..."
                value={selectedWorkspaces}
              />
            </div>
          </div>

          {/* Is Default Filter */}
          <div className="flex items-center gap-4">
            <span className="w-24 font-medium text-gray-700 text-sm dark:text-gray-300">
              기본 계정
            </span>
            <div className="flex flex-wrap gap-3">
              {isDefaultOptions.map((option) => (
                <div className="flex items-center space-x-2" key={option.value}>
                  <Checkbox
                    checked={selectedIsDefault.includes(option.value)}
                    id={`isDefault-${option.value}`}
                    onCheckedChange={() => toggleIsDefault(option.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`isDefault-${option.value}`}
                  >
                    {option.label}
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
                    상태: {statusLabel}
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
              {selectedWorkspaces.map((workspaceId) => {
                const workspace = workspaces.find((w) => w.id === workspaceId)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-purple-800 text-xs dark:bg-purple-900/30 dark:text-purple-300"
                    key={workspaceId}
                  >
                    워크스페이스: {workspace?.name || workspaceId}
                    <button
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                      onClick={() =>
                        onWorkspaceChange(selectedWorkspaces.filter((w) => w !== workspaceId))
                      }
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedIsDefault.map((value) => {
                const optionLabel = isDefaultOptions.find((o) => o.value === value)?.label || value
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300"
                    key={value}
                  >
                    {optionLabel}
                    <button
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                      onClick={() => toggleIsDefault(value)}
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
