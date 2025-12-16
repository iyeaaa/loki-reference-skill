import { X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

type Workspace = {
  id: string
  name: string
}

type EmailTemplateFiltersProps = {
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
            <span className="w-24 font-medium text-gray-700 text-sm dark:text-gray-300">
              {t("emailTemplates.filter.sharedStatus")}
            </span>
            <div className="flex flex-wrap gap-3">
              {sharedStatuses.map((status) => (
                <div className="flex items-center space-x-2" key={status.value}>
                  <Checkbox
                    checked={selectedSharedStatuses.includes(status.value)}
                    id={`shared-${status.value}`}
                    onCheckedChange={() => toggleSharedStatus(status.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`shared-${status.value}`}
                  >
                    {status.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Category Filter */}
          <div className="flex items-start gap-4">
            <span className="w-24 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              {t("emailTemplates.filter.categoryLabel")}
            </span>
            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap gap-3">
                {categoryOptions.map((category) => (
                  <div className="flex items-center space-x-2" key={category.value}>
                    <Checkbox
                      checked={selectedCategories.includes(category.value)}
                      id={`category-${category.value}`}
                      onCheckedChange={() => toggleCategory(category.value)}
                    />
                    <label
                      className="cursor-pointer select-none text-sm"
                      htmlFor={`category-${category.value}`}
                    >
                      {category.label}
                    </label>
                  </div>
                ))}
              </div>
              <div className="flex max-w-md gap-2">
                <Input
                  className="text-sm"
                  onChange={(e) => setCustomCategory(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      addCustomCategory()
                    }
                  }}
                  placeholder={t("emailTemplates.filter.customCategoryPlaceholder")}
                  value={customCategory}
                />
                <Button
                  disabled={!customCategory}
                  onClick={addCustomCategory}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("emailTemplates.filter.add")}
                </Button>
              </div>
            </div>
          </div>

          {/* Workspace Filter */}
          <div className="flex items-start gap-4">
            <span className="w-24 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              {t("emailTemplates.filter.workspace")}
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText={t("emailTemplates.filter.noResults")}
                onValueChange={onWorkspaceChange}
                options={workspaces.map((ws) => ({
                  value: ws.id,
                  label: ws.name,
                }))}
                placeholder={t("emailTemplates.filter.workspacePlaceholder")}
                searchPlaceholder={t("emailTemplates.filter.workspaceSearchPlaceholder")}
                value={selectedWorkspaces}
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedSharedStatuses.map((status) => {
                const statusLabel = sharedStatuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={status}
                  >
                    {t("emailTemplates.filter.sharedLabel")}: {statusLabel}
                    <button
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      onClick={() => toggleSharedStatus(status)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
              {selectedCategories.map((category) => {
                const categoryLabel =
                  categoryOptions.find((c) => c.value === category)?.label || category
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-green-800 text-xs dark:bg-green-900/30 dark:text-green-300"
                    key={category}
                  >
                    {t("emailTemplates.filter.categoryLabel")}: {categoryLabel}
                    <button
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                      onClick={() => toggleCategory(category)}
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
                    {t("emailTemplates.filter.workspaceLabel")}: {ws?.name || wsId}
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
            </div>
          </div>
        )}

        {/* Clear Filters Button at Bottom */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <Button className="text-xs" onClick={onClearFilters} size="sm" variant="ghost">
              <X className="mr-1 h-3 w-3" />
              {t("emailTemplates.filter.clearFilters")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
