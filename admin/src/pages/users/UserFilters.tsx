import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

type Department = {
  id: string
  name: string
  code: string
}

type UserFiltersProps = {
  selectedRoles: string[]
  selectedStatuses: string[]
  selectedDepartments: string[]
  departments: Department[]
  onRoleChange: (roles: string[]) => void
  onStatusChange: (statuses: string[]) => void
  onDepartmentChange: (departments: string[]) => void
  onClearFilters: () => void
}

export function UserFilters({
  selectedRoles,
  selectedStatuses,
  selectedDepartments,
  departments,
  onRoleChange,
  onStatusChange,
  onDepartmentChange,
  onClearFilters,
}: UserFiltersProps) {
  const roles = [
    { value: "admin", label: "관리자" },
    { value: "user", label: "사용자" },
  ]

  const statuses = [
    { value: "active", label: "활성" },
    { value: "inactive", label: "비활성" },
  ]

  const toggleRole = (role: string) => {
    if (selectedRoles.includes(role)) {
      onRoleChange(selectedRoles.filter((r) => r !== role))
    } else {
      onRoleChange([...selectedRoles, role])
    }
  }

  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status))
    } else {
      onStatusChange([...selectedStatuses, status])
    }
  }

  const hasActiveFilters =
    selectedRoles.length > 0 || selectedStatuses.length > 0 || selectedDepartments.length > 0

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Role Filter */}
          <div className="flex items-center gap-4">
            <span className="w-16 font-medium text-gray-700 text-sm dark:text-gray-300">역할</span>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <div className="flex items-center space-x-2" key={role.value}>
                  <Checkbox
                    checked={selectedRoles.includes(role.value)}
                    id={`role-${role.value}`}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <label
                    className="cursor-pointer select-none text-sm"
                    htmlFor={`role-${role.value}`}
                  >
                    {role.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

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

          {/* Department Filter */}
          <div className="flex items-start gap-4">
            <span className="w-16 pt-2 font-medium text-gray-700 text-sm dark:text-gray-300">
              부서
            </span>
            <div className="max-w-md flex-1">
              <MultiSelectCombobox
                emptyText="검색 결과가 없습니다."
                onValueChange={onDepartmentChange}
                options={departments.map((dept) => ({
                  value: dept.id,
                  label: dept.name,
                  sublabel: dept.code,
                }))}
                placeholder="부서를 선택하세요..."
                searchPlaceholder="부서명 또는 코드로 검색..."
                value={selectedDepartments}
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 border-gray-200 border-t pt-3 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedRoles.map((role) => {
                const roleLabel = roles.find((r) => r.value === role)?.label || role
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-blue-800 text-xs dark:bg-blue-900/30 dark:text-blue-300"
                    key={role}
                  >
                    역할: {roleLabel}
                    <button
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                      onClick={() => toggleRole(role)}
                      type="button"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )
              })}
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
              {selectedDepartments.map((deptId) => {
                const dept = departments.find((d) => d.id === deptId)
                return (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-1 text-purple-800 text-xs dark:bg-purple-900/30 dark:text-purple-300"
                    key={deptId}
                  >
                    부서: {dept?.name || deptId}
                    <button
                      className="ml-1 hover:text-purple-600 dark:hover:text-purple-200"
                      onClick={() =>
                        onDepartmentChange(selectedDepartments.filter((d) => d !== deptId))
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
              필터 초기화
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
