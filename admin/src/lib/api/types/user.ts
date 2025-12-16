// User Management API Types (aligned with database schema)

export type UserRole = "user" | "admin"

export type Language = {
  id: string
  code: string
  name: string
  nativeName: string
  isActive: boolean
}

export type LanguageInfo = {
  id: string
  code: string
  name: string
  nativeName: string
  isActive: boolean
}

export type Department = {
  id: string
  name: string
  code: string
  description?: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// Aligned with database schema and Go handlers
export type User = {
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

export type UserStats = {
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
export type CreateUserRequest = {
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

export type UpdateUserRequest = {
  username: string
  email: string
  userRole: UserRole
  isActive?: boolean
  departmentId: string
  employeeId: string
  editLanguages?: string[]
  reviewLanguages?: string[]
}

export type ChangePasswordRequest = {
  newPassword: string
}

export type BulkUpdateStatusRequest = {
  userIds: string[]
  isActive: boolean
}

export type BulkUpdateRoleRequest = {
  userIds: string[]
  userRole: UserRole
}

export type BulkUpdateLanguagesRequest = {
  userIds: string[]
  editLanguages?: string[]
  reviewLanguages?: string[]
}

// API Response Types (aligned with Go handlers)
export type UsersResponse = {
  users: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type DepartmentsApiResponse = {
  departments: Department[]
}

export type LanguagesApiResponse = {
  languages: Language[]
}

export type BulkUpdateResponse = {
  message: string
  updated: number
  total: number
}

// API Params Types (aligned with Go handlers)
export type UsersParams = {
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
