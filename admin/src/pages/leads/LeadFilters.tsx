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

interface LeadFiltersProps {
  selectedStatuses: string[]
  selectedBusinessTypes: string[]
  selectedCountries: string[]
  selectedCities: string[]
  selectedCreatedBy: string[]
  users: User[]
  onStatusChange: (statuses: string[]) => void
  onBusinessTypeChange: (businessTypes: string[]) => void
  onCountryChange: (countries: string[]) => void
  onCityChange: (cities: string[]) => void
  onCreatedByChange: (createdBy: string[]) => void
  onClearFilters: () => void
}

export function LeadFilters({
  selectedStatuses,
  selectedBusinessTypes,
  selectedCountries,
  selectedCities,
  selectedCreatedBy,
  users,
  onStatusChange,
  onBusinessTypeChange,
  onCountryChange,
  onCityChange,
  onCreatedByChange,
  onClearFilters,
}: LeadFiltersProps) {
  const statuses = [
    { value: "new", label: "신규" },
    { value: "contacted", label: "연락됨" },
    { value: "qualified", label: "적격" },
    { value: "unqualified", label: "부적격" },
    { value: "converted", label: "전환됨" },
    { value: "lost", label: "실패" },
    { value: "unsubscribed", label: "구독취소" },
  ]

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const hasActiveFilters =
    selectedStatuses.length > 0 ||
    selectedBusinessTypes.length > 0 ||
    selectedCountries.length > 0 ||
    selectedCities.length > 0 ||
    selectedCreatedBy.length > 0

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

          {/* Created By Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 pt-2">
              생성자
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={users.map((user) => ({
                  value: user.id,
                  label: user.username,
                  sublabel: user.email,
                }))}
                value={selectedCreatedBy}
                onValueChange={onCreatedByChange}
                placeholder="생성자를 선택하세요..."
                searchPlaceholder="이름 또는 이메일로 검색..."
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
              {selectedBusinessTypes.map((businessType) => (
                <span
                  key={businessType}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                >
                  업종: {businessType}
                  <button
                    type="button"
                    onClick={() =>
                      onBusinessTypeChange(
                        selectedBusinessTypes.filter((bt) => bt !== businessType),
                      )
                    }
                    className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedCountries.map((country) => (
                <span
                  key={country}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                >
                  국가: {country}
                  <button
                    type="button"
                    onClick={() => onCountryChange(selectedCountries.filter((c) => c !== country))}
                    className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedCities.map((city) => (
                <span
                  key={city}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 text-xs rounded-full"
                >
                  도시: {city}
                  <button
                    type="button"
                    onClick={() => onCityChange(selectedCities.filter((c) => c !== city))}
                    className="ml-1 hover:text-orange-600 dark:hover:text-orange-200"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {selectedCreatedBy.map((userId) => {
                const user = users.find((u) => u.id === userId)
                return (
                  <span
                    key={userId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 text-xs rounded-full"
                  >
                    생성자: {user?.username || userId}
                    <button
                      type="button"
                      onClick={() =>
                        onCreatedByChange(selectedCreatedBy.filter((id) => id !== userId))
                      }
                      className="ml-1 hover:text-teal-600 dark:hover:text-teal-200"
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
