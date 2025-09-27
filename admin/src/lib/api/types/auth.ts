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
  department_id: string
  employee_id: string
}

export interface AuthUser {
  id: string
  username: string
  email: string
  user_role: string
  is_active: boolean
  department_id: string
  employee_id: string
  created_at: string
  updated_at: string
  last_login_at?: string
  department_name?: string
  department_code?: string
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
