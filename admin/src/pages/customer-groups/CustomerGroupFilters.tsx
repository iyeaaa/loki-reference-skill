import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

interface Workspace {
  id: string
  name: string
  description: string | null
}

interface CustomerGroupFiltersProps {
  selectedWorkspaces: string[]
  workspaces: Workspace[]
  onWorkspaceChange: (workspaces: string[]) => void
  onClearFilters: () => void
}

export function CustomerGroupFilters({
  selectedWorkspaces,
  workspaces,
  onWorkspaceChange,
  onClearFilters,
}: CustomerGroupFiltersProps) {
  const hasActiveFilters = selectedWorkspaces.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
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
                  sublabel: workspace.description || undefined,
                }))}
                value={selectedWorkspaces}
                onValueChange={onWorkspaceChange}
                placeholder="워크스페이스를 선택하세요..."
                searchPlaceholder="워크스페이스명으로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
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
