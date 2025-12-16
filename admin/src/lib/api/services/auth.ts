import { apiFetch, removeToken, setToken } from "@/lib/api/client"
import type {
  AuthResponse,
  AuthUser,
  LoginRequest,
  SignupRequest,
  SignupResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "../types"
export const authApi = {
  login: (credentials: LoginRequest) =>
    apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    }),

  signup: (data: SignupRequest) =>
    apiFetch<SignupResponse>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  verify: () =>
    apiFetch<{ user: AuthUser }>("/api/v1/auth/verify", {
      method: "POST",
    }),

  refresh: () =>
    apiFetch<{ token: string }>("/api/v1/auth/refresh", {
      method: "POST",
    }),

  logout: () => {
    removeToken()
    localStorage.removeItem("user")
  },

  storeAuthData: (token: string, user: AuthUser) => {
    setToken(token)
    localStorage.setItem("user", JSON.stringify(user))
  },

  getStoredUser: (): AuthUser | null => {
    const userStr = localStorage.getItem("user")
    if (!userStr) {
      return null
    }
    try {
      return JSON.parse(userStr) as AuthUser
    } catch {
      return null
    }
  },

  updateProfile: (data: UpdateProfileRequest) =>
    apiFetch<UpdateProfileResponse>("/api/v1/auth/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  // Google OAuth methods
  getGoogleAuthUrl: () =>
    apiFetch<{ authUrl: string }>("/api/v1/auth/google", {
      method: "GET",
    }),

  googleCallback: (code: string) =>
    apiFetch<AuthResponse>("/api/v1/auth/google/callback", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  verifyGoogleToken: (idToken: string) =>
    apiFetch<AuthResponse>("/api/v1/auth/google/verify", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  // Account deletion methods
  checkDeletionEligibility: () =>
    apiFetch<{
      canDelete: boolean
      ownedWorkspaces: Array<{
        id: string
        name: string
        memberCount: number
        requiresTransfer: boolean
      }>
      workspacesRequiringTransfer: Array<{ id: string; name: string; memberCount: number }>
      workspacesToBeDeleted: Array<{ id: string; name: string }>
    }>("/api/v1/auth/account/deletion-check"),

  deleteAccount: () =>
    apiFetch<{
      message: string
      deletedWorkspaces?: Array<{ id: string; name: string }>
    }>("/api/v1/auth/account", {
      method: "DELETE",
    }),
}
