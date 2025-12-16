import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"
import { ACTION_TYPES, ENTITY_TYPES } from "@/lib/api/types/activity-log"

type Workspace = {
  id: string
  name: string
}

type User = {
  id: string
  username: string
  email: string
}

type ActivityLogsFiltersProps = {
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
            <span className="w-20 font-medium text-gray-700 text-sm dark:text-gray-300">
              엔티티
            </span>
            <div className="flex flex-wrap gap-3">
              {ENTITY_TYPES.map((entityType) => (
                <div className="flex items-center space-x-2" key={entityType.value}>
                  <Checkbox
                    checked={selectedEntityTypes.includes(entityType.value)}
                    id={`entity-${entityType.value}`}
                    onCheckedChange={() => toggleEntityType(entityType.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`entity-${entityType.value}`}
                  >
                    {entityType.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Action Filter */}
          <div className="flex items-center gap-4">
            <span className="w-20 font-medium text-gray-700 text-sm dark:text-gray-300">액션</span>
            <div className="flex flex-wrap gap-3">
              {ACTION_TYPES.map((action) => (
                <div className="flex items-center space-x-2" key={action.value}>
                  <Checkbox
                    checked={selectedActions.includes(action.value)}
                    id={`action-${action.value}`}
                    onCheckedChange={() => toggleAction(action.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`action-${action.value}`}
                  >
                    {action.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="w-20 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              워크스페이스
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onWorkspaceChange}
                options={workspaces.map((ws) => ({
                  value: ws.id,
                  label: ws.name,
                }))}
                placeholder="워크스페이스를 선택하세요..."
                searchPlaceholder="워크스페이스 검색..."
                value={selectedWorkspaces}
              />
            </div>
          </div>

          {/* User Filter */}
          <div className="flex items-start gap-4">
            <span className="w-20 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              사용자
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onUserChange}
                options={users.map((user) => ({
                  value: user.id,
                  label: user.username,
                  sublabel: user.email,
                }))}
                placeholder="사용자를 선택하세요..."
                searchPlaceholder="사용자명 또는 이메일로 검색..."
                value={selectedUsers}
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedEntityTypes.map((entityType) => {
                const label = ENTITY_TYPES.find((e) => e.value === entityType)?.label || entityType
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={entityType}
                  >
                    엔티티: {label}
                    <button
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      onClick={() => toggleEntityType(entityType)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedActions.map((action) => {
                const label = ACTION_TYPES.find((a) => a.value === action)?.label || action
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300"
                    key={action}
                  >
                    액션: {label}
                    <button
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                      onClick={() => toggleAction(action)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedWorkspaces.map((wsId) => {
                const ws = workspaces.find((w) => w.id === wsId)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-purple-800 text-xs dark:bg-purple-900/30 dark:text-purple-300"
                    key={wsId}
                  >
                    워크스페이스: {ws?.name || wsId}
                    <button
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                      onClick={() =>
                        onWorkspaceChange(selectedWorkspaces.filter((w) => w !== wsId))
                      }
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedUsers.map((userId) => {
                const user = users.find((u) => u.id === userId)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-1 text-orange-800 text-xs dark:bg-orange-900/30 dark:text-orange-300"
                    key={userId}
                  >
                    사용자: {user?.username || userId}
                    <button
                      className="ml-1 hover:text-orange-600 dark:hover:text-orange-200"
                      onClick={() => onUserChange(selectedUsers.filter((u) => u !== userId))}
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
