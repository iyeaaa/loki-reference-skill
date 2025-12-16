// ========================================
// Department Types
// ========================================

export type Department = {
  id: string
  name: string
  code: string
  parentId?: string | null
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type DepartmentCreateRequest = {
  name: string
  code: string
  parentId?: string | null
  description?: string | null
  isActive?: boolean
}

export type DepartmentUpdateRequest = {
  name?: string
  code?: string
  parentId?: string | null
  description?: string | null
  isActive?: boolean
}

export type DepartmentsResponse = {
  departments: Department[]
  total?: number
}
