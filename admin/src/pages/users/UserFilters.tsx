"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox"

interface Department {
  id: string
  name: string
  code: string
}

interface UserFiltersProps {
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
    { value: "internal_reviewer", label: "내부 검수자" },
    { value: "external_reviewer", label: "외부 검수자" },
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
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16">역할</span>
            <div className="flex flex-wrap gap-3">
              {roles.map((role) => (
                <div key={role.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`role-${role.value}`}
                    checked={selectedRoles.includes(role.value)}
                    onCheckedChange={() => toggleRole(role.value)}
                  />
                  <label
                    htmlFor={`role-${role.value}`}
                    className="text-sm select-none cursor-pointer"
                  >
                    {role.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

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

          {/* Department Filter */}
          <div className="flex items-start gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 pt-2">
              부서
            </span>
            <div className="flex-1 max-w-md">
              <MultiSelectCombobox
                options={departments.map((dept) => ({
                  value: dept.id,
                  label: dept.name,
                  sublabel: dept.code,
                }))}
                value={selectedDepartments}
                onValueChange={onDepartmentChange}
                placeholder="부서를 선택하세요..."
                searchPlaceholder="부서명 또는 코드로 검색..."
                emptyText="검색 결과가 없습니다."
              />
            </div>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="pt-3 mt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              {selectedRoles.map((role) => {
                const roleLabel = roles.find((r) => r.value === role)?.label || role
                return (
                  <span
                    key={role}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs rounded-full"
                  >
                    역할: {roleLabel}
                    <button
                      type="button"
                      onClick={() => toggleRole(role)}
                      className="ml-1 hover:text-blue-600 dark:hover:text-blue-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedStatuses.map((status) => {
                const statusLabel = statuses.find((s) => s.value === status)?.label || status
                return (
                  <span
                    key={status}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 text-xs rounded-full"
                  >
                    상태: {statusLabel}
                    <button
                      type="button"
                      onClick={() => toggleStatus(status)}
                      className="ml-1 hover:text-green-600 dark:hover:text-green-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )
              })}
              {selectedDepartments.map((deptId) => {
                const dept = departments.find((d) => d.id === deptId)
                return (
                  <span
                    key={deptId}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 text-xs rounded-full"
                  >
                    부서: {dept?.name || deptId}
                    <button
                      type="button"
                      onClick={() =>
                        onDepartmentChange(selectedDepartments.filter((d) => d !== deptId))
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
