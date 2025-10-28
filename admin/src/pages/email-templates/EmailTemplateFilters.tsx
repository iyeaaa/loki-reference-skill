import { X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

interface Workspace {
  id: string
  name: string
}

interface EmailTemplateFiltersProps {
  selectedCategories: string[]
  selectedSharedStatuses: string[]
  selectedWorkspaces: string[]
  workspaces: Workspace[]
  onCategoryChange: (categories: string[]) => void
  onSharedStatusChange: (statuses: string[]) => void
  onWorkspaceChange: (workspaces: string[]) => void
  onClearFilters: () => void
}

export function EmailTemplateFilters({
  selectedCategories,
  selectedSharedStatuses,
  selectedWorkspaces,
  workspaces,
  onCategoryChange,
  onSharedStatusChange,
  onWorkspaceChange,
  onClearFilters,
}: EmailTemplateFiltersProps) {
  const { t } = useTranslation()
  const sharedStatuses = [
    { value: "shared", label: t("emailTemplates.filter.shared") },
    { value: "private", label: t("emailTemplates.filter.private") },
  ]

  // Common categories (can be customized)
  const categoryOptions = [
    { value: "welcome", label: t("emailTemplates.filter.category.welcome") },
    { value: "promotion", label: t("emailTemplates.filter.category.promotion") },
    { value: "transaction", label: t("emailTemplates.filter.category.transaction") },
    { value: "notification", label: t("emailTemplates.filter.category.notification") },
    { value: "newsletter", label: t("emailTemplates.filter.category.newsletter") },
  ]

  const [customCategory, setCustomCategory] = useState("")

  const toggleSharedStatus = (status: string) => {
    if (selectedSharedStatuses.includes(status)) {
      onSharedStatusChange(selectedSharedStatuses.filter((s) => s !== status))
    } else {
      onSharedStatusChange([...selectedSharedStatuses, status])
    }
  }

  const toggleCategory = (category: string) => {
    if (selectedCategories.includes(category)) {
      onCategoryChange(selectedCategories.filter((c) => c !== category))
    } else {
      onCategoryChange([...selectedCategories, category])
    }
  }

  const addCustomCategory = () => {
    if (customCategory && !selectedCategories.includes(customCategory)) {
      onCategoryChange([...selectedCategories, customCategory])
      setCustomCategory("")
    }
  }

  const hasActiveFilters =
    selectedCategories.length > 0 ||
    selectedSharedStatuses.length > 0 ||
    selectedWorkspaces.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Shared Status Filter */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24">
              {t("emailTemplates.filter.sharedStatus")}
            </span>
            <div className="flex flex-wrap gap-3">
              {sharedStatuses.map((status) => (
                <div key={status.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`shared-${status.value}`}
                    checked={selectedSharedStatuses.includes(status.value)}
                    onCheckedChange={() => toggleSharedStatus(status.value)}
                  />
                  <label
                    htmlFor={`shared-${status.value}`}
                    className="text-sm select-none cursor-pointer"
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 pt-2">
              {t("emailTemplates.filter.categoryLabel")}
            </span>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-3">
                {categoryOptions.map((category) => (
                  <div key={category.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`category-${category.value}`}
                      checked={selectedCategories.includes(category.value)}
                      onCheckedChange={() => toggleCategory(category.value)}
                    />
                    <label
                      htmlFor={`category-${category.value}`}
                      className="text-sm select-none cursor-pointer"
                    >
                      {category.label}
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 max-w-md">
                <Input
                  placeholder={t("emailTemplates.filter.customCategoryPlaceholder")}
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomCategory()
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomCategory}
                  disabled={!customCategory}
                >
                  {t("emailTemplates.filter.add")}
                </Button>
              </div>
            </div>
          </div>

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-24 pt-2">
              {t("emailTemplates.filter.workspace")}
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={workspaces.map((ws) => ({
                  value: ws.id,
                  label: ws.name,
                }))}
                value={selectedWorkspaces}
                onValueChange={onWorkspaceChange}
                placeholder={t("emailTemplates.filter.workspacePlaceholder")}
                searchPlaceholder={t("emailTemplates.filter.workspaceSearchPlaceholder")}
                emptyText={t("emailTemplates.filter.noResults")}
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedSharedStatuses.map((status) => {
                const statusLabel = sharedStatuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    {t("emailTemplates.filter.sharedLabel")}: {statusLabel}
                    <button
                      type="button"
                      onClick={() => toggleSharedStatus(status)}
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedCategories.map((category) => {
                const categoryLabel =
                  categoryOptions.find((c) => c.value === category)?.label || category
                return (
                  <span
                    key={category}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    {t("emailTemplates.filter.categoryLabel")}: {categoryLabel}
                    <button
                      type="button"
                      onClick={() => toggleCategory(category)}
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
                    {t("emailTemplates.filter.workspaceLabel")}: {ws?.name || wsId}
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
            </div>
          </div>
        )}

        {/* Clear Filters Button at Bottom */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-xs">
              <X className="w-3 h-3 mr-1" />
              {t("emailTemplates.filter.clearFilters")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
