import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

interface Workspace {
  id: string
  name: string
}

interface EmailAccountFiltersProps {
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

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 pt-2">
              워크스페이스
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={workspaces.map((workspace) => ({
                  value: workspace.id,
                  label: workspace.name,
                }))}
                value={selectedWorkspaces}
                onValueChange={onWorkspaceChange}
                placeholder="워크스페이스를 선택하세요..."
                searchPlaceholder="워크스페이스명으로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>

          {/* Is Default Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
              기본 계정
            </span>
            <div className="flex flex-wrap gap-3">
              {isDefaultOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`isDefault-${option.value}`}
                    checked={selectedIsDefault.includes(option.value)}
                    onCheckedChange={() => toggleIsDefault(option.value)}
                  />
                  <label
                    htmlFor={`isDefault-${option.value}`}
                    className="text-sm select-none cursor-pointer"
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
              {selectedWorkspaces.map((workspaceId) => {
                const workspace = workspaces.find((w) => w.id === workspaceId)
                return (
                  <span
                    key={workspaceId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                  >
                    워크스페이스: {workspace?.name || workspaceId}
                    <button
                      type="button"
                      onClick={() =>
                        onWorkspaceChange(selectedWorkspaces.filter((w) => w !== workspaceId))
                      }
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedIsDefault.map((value) => {
                const optionLabel = isDefaultOptions.find((o) => o.value === value)?.label || value
                return (
                  <span
                    key={value}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    {optionLabel}
                    <button
                      type="button"
                      onClick={() => toggleIsDefault(value)}
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
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
