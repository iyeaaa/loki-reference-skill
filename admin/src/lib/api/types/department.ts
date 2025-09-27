// ========================================
// Department Types
// ========================================

export interface Department {
  id: string
  name: string
  code: string
  parentId?: string | null
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface DepartmentCreateRequest {
  name: string
  code: string
  parentId?: string | null
  description?: string | null
  isActive?: boolean
}

export interface DepartmentUpdateRequest {
  name?: string
  code?: string
  parentId?: string | null
  description?: string | null
  isActive?: boolean
}

export interface DepartmentsResponse {
  departments: Department[]
  total?: number
}
