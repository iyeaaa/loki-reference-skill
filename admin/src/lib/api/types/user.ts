// User Management API Types (aligned with database schema)

export type UserRole = "super_admin" | "admin" | "paying_user" | "user"

export interface Language {
  id: string
  code: string
  name: string
  nativeName: string
  isActive: boolean
}

export interface LanguageInfo {
  id: string
  code: string
  name: string
  nativeName: string
  isActive: boolean
}

export interface Department {
  id: string
  name: string
  code: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Aligned with database schema and Go handlers
export interface User {
  id: string
  username: string
  email: string
  userRole: UserRole
  isActive: boolean
  departmentId: string
  employeeId: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  departmentName: string
  departmentCode: string
  editLanguages?: LanguageInfo[]
  reviewLanguages?: LanguageInfo[]
}

export interface UserStats {
  total: number
  active: number
  inactive: number
  byRole: {
    admin: number
    user: number
    internalReviewer: number
    externalReviewer: number
  }
}

// Aligned with Go handler request structures
export interface CreateUserRequest {
  username: string
  email: string
  password: string
  userRole: UserRole
  isActive?: boolean
  departmentId: string
  employeeId: string
  editLanguages?: string[]
  reviewLanguages?: string[]
}

export interface UpdateUserRequest {
  username: string
  email: string
  userRole: UserRole
  isActive?: boolean
  departmentId: string
  employeeId: string
  editLanguages?: string[]
  reviewLanguages?: string[]
}

export interface ChangePasswordRequest {
  newPassword: string
}

export interface BulkUpdateStatusRequest {
  userIds: string[]
  isActive: boolean
}

export interface BulkUpdateRoleRequest {
  userIds: string[]
  userRole: UserRole
}

export interface BulkUpdateLanguagesRequest {
  userIds: string[]
  editLanguages?: string[]
  reviewLanguages?: string[]
}

// API Response Types (aligned with Go handlers)
export interface UsersResponse {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
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
  departmentIds?: string[] // Department IDs for filtering
  search?: string
}
