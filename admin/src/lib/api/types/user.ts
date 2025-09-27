// User Management API Types (aligned with database schema)

export type UserRole = "admin" | "user" | "internal_reviewer" | "external_reviewer"

export interface Language {
  id: string
  code: string
  name: string
  native_name: string
  is_active: boolean
}

export interface LanguageInfo {
  id: string
  code: string
  name: string
  native_name: string
  is_active: boolean
}

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

// Aligned with database schema and Go handlers
export interface User {
  id: string
  username: string
  email: string
  user_role: UserRole
  is_active: boolean
  department_id: string
  employee_id: string
  created_at: string
  updated_at: string
  last_login_at?: string
  department_name: string
  department_code: string
  edit_languages?: LanguageInfo[]
  review_languages?: LanguageInfo[]
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  by_role: {
    admin: number
    user: number
    internal_reviewer: number
    external_reviewer: number
  }
}

// Aligned with Go handler request structures
export interface CreateUserRequest {
  username: string
  email: string
  password: string
  user_role: UserRole
  is_active?: boolean
  department_id: string
  employee_id: string
  edit_languages?: string[]
  review_languages?: string[]
}

export interface UpdateUserRequest {
  username: string
  email: string
  user_role: UserRole
  is_active?: boolean
  department_id: string
  employee_id: string
  edit_languages?: string[]
  review_languages?: string[]
}

export interface ChangePasswordRequest {
  new_password: string
}

export interface BulkUpdateStatusRequest {
  user_ids: string[]
  is_active: boolean
}

export interface BulkUpdateRoleRequest {
  user_ids: string[]
  user_role: UserRole
}

export interface BulkUpdateLanguagesRequest {
  user_ids: string[]
  edit_languages?: string[]
  review_languages?: string[]
}

// API Response Types (aligned with Go handlers)
export interface UsersResponse {
  users: User[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export interface DepartmentsApiResponse {
  departments: Department[]
}

export interface LanguagesApiResponse {
  languages: Language[]
}

export interface BulkUpdateResponse {
  message: string
  updated: number
  total: number
}

// API Params Types (aligned with Go handlers)
export interface UsersParams {
  page?: number
  limit?: number
  role?: UserRole | "all"
  roles?: string[] // Multiple roles filter
  status?: string // 'active', 'inactive', 'all'
  statuses?: string[] // Multiple statuses filter
  departments?: string[] // Multiple departments filter
  search?: string
}
