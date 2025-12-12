import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import { ACTION_TYPES, ENTITY_TYPES } from "@/lib/api/types/activity-log"

interface Workspace {
  id: string
  name: string
}

interface User {
  id: string
  username: string
  email: string
}

interface ActivityLogsFiltersProps {
  selectedEntityTypes: string[]
  selectedActions: string[]
  selectedWorkspaces: string[]
  selectedUsers: string[]
  workspaces: Workspace[]
  users: User[]
  onEntityTypeChange: (entityTypes: string[]) => void
  onActionChange: (actions: string[]) => void
  onWorkspaceChange: (workspaces: string[]) => void
  onUserChange: (users: string[]) => void
  onClearFilters: () => void
}

export function ActivityLogsFilters({
  selectedEntityTypes,
  selectedActions,
  selectedWorkspaces,
  selectedUsers,
  workspaces,
  users,
  onEntityTypeChange,
  onActionChange,
  onWorkspaceChange,
  onUserChange,
  onClearFilters,
}: ActivityLogsFiltersProps) {
  const toggleEntityType = (entityType: string) => {
    if (selectedEntityTypes.includes(entityType)) {
      onEntityTypeChange(selectedEntityTypes.filter((e) => e !== entityType))
    } else {
      onEntityTypeChange([...selectedEntityTypes, entityType])
    }
  }

  const toggleAction = (action: string) => {
    if (selectedActions.includes(action)) {
      onActionChange(selectedActions.filter((a) => a !== action))
    } else {
      onActionChange([...selectedActions, action])
    }
  }

  const hasActiveFilters =
    selectedEntityTypes.length > 0 ||
    selectedActions.length > 0 ||
    selectedWorkspaces.length > 0 ||
    selectedUsers.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Entity Type Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">
              엔티티
            </span>
            <div className="flex flex-wrap gap-3">
              {ENTITY_TYPES.map((entityType) => (
                <div key={entityType.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`entity-${entityType.value}`}
                    checked={selectedEntityTypes.includes(entityType.value)}
                    onCheckedChange={() => toggleEntityType(entityType.value)}
                  />
                  <label
                    htmlFor={`entity-${entityType.value}`}
                    className="text-sm select-none cursor-pointer"
                  >
                    {entityType.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20">액션</span>
            <div className="flex flex-wrap gap-3">
              {ACTION_TYPES.map((action) => (
                <div key={action.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`action-${action.value}`}
                    checked={selectedActions.includes(action.value)}
                    onCheckedChange={() => toggleAction(action.value)}
                  />
                  <label
                    htmlFor={`action-${action.value}`}
                    className="text-sm select-none cursor-pointer"
                  >
                    {action.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 pt-2">
              워크스페이스
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={workspaces.map((ws) => ({
                  value: ws.id,
                  label: ws.name,
                }))}
                value={selectedWorkspaces}
                onValueChange={onWorkspaceChange}
                placeholder="워크스페이스를 선택하세요..."
                searchPlaceholder="워크스페이스 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>

          {/* User Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-20 pt-2">
              사용자
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={users.map((user) => ({
                  value: user.id,
                  label: user.username,
                  sublabel: user.email,
                }))}
                value={selectedUsers}
                onValueChange={onUserChange}
                placeholder="사용자를 선택하세요..."
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
              {selectedEntityTypes.map((entityType) => {
                const label = ENTITY_TYPES.find((e) => e.value === entityType)?.label || entityType
                return (
                  <span
                    key={entityType}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    엔티티: {label}
                    <button
                      type="button"
                      onClick={() => toggleEntityType(entityType)}
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedActions.map((action) => {
                const label = ACTION_TYPES.find((a) => a.value === action)?.label || action
                return (
                  <span
                    key={action}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    액션: {label}
                    <button
                      type="button"
                      onClick={() => toggleAction(action)}
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedWorkspaces.map((wsId) => {
                const ws = workspaces.find((w) => w.id === wsId)
                return (
                  <span
                    key={wsId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                  >
                    워크스페이스: {ws?.name || wsId}
                    <button
                      type="button"
                      onClick={() =>
                        onWorkspaceChange(selectedWorkspaces.filter((w) => w !== wsId))
                      }
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedUsers.map((userId) => {
                const user = users.find((u) => u.id === userId)
                return (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded-full"
                  >
                    사용자: {user?.username || userId}
                    <button
                      type="button"
                      onClick={() => onUserChange(selectedUsers.filter((u) => u !== userId))}
                      className="ml-1 hover:text-orange-600 dark:hover:text-orange-200"
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
