// ========================================
// Auth Types
// ========================================

export type LoginRequest = {
  email: string
  password: string
}

export type SignupRequest = {
  username: string
  email: string
  password: string
}

export type AuthUser = {
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

export type AuthResponse = {
  token: string
  user: AuthUser
}

export type SignupResponse = {
  message: string
  user: {
    id: string
    username: string
    email: string
  }
}

export type UpdateProfileRequest = {
  username: string
  email: string
  employeeId?: string
  profilePicture?: string | null
}

export type UpdateProfileResponse = {
  user: AuthUser
}
