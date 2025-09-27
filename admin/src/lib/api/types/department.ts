// ========================================
// Department Types
// ========================================

export interface Department {
  id: string
  name: string
  code: string
  parent_id?: string | null
  description?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DepartmentCreateRequest {
  name: string
  code: string
  parent_id?: string | null
  description?: string | null
  is_active?: boolean
}

export interface DepartmentUpdateRequest {
  name?: string
  code?: string
  parent_id?: string | null
  description?: string | null
  is_active?: boolean
}

export interface DepartmentsResponse {
  departments: Department[]
  total?: number
}
