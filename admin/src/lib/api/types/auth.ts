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
}

export interface AuthUser {
  id: string
  username: string
  email: string
  userRole: string
  isActive: boolean
  departmentId?: string
  employeeId?: string
  profilePicture?: string | null
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
  departmentName?: string
  departmentCode?: string
  trialStatus?: {
    isTrialActive: boolean
    daysRemaining: number
    trialEndDate: string
  }
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

export interface UpdateProfileRequest {
  username: string
  email: string
  employeeId?: string
  profilePicture?: string | null
}

export interface UpdateProfileResponse {
  user: AuthUser
}
