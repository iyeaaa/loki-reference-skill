// ========================================
// Auth Types
// ========================================

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  username: string
  email: string
  password: string
  departmentId: string
  employeeId: string
}

export interface AuthUser {
  id: string
  username: string
  email: string
  userRole: string
  isActive: boolean
  departmentId: string
  employeeId: string
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  departmentName?: string
  departmentCode?: string
}

export interface AuthResponse {
  token: string
  user: AuthUser
}

export interface SignupResponse {
  message: string
  user: {
    id: string
    username: string
    email: string
  }
}
