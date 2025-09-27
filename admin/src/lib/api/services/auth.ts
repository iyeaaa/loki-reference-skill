import { apiFetch, removeToken, setToken } from "@/lib/api/client"
import type { AuthResponse, AuthUser, LoginRequest, SignupRequest, SignupResponse } from "../types"
export const authApi = {
  login: (credentials: LoginRequest) => {
    return apiFetch<AuthResponse>("/api/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    })
  },

  signup: (data: SignupRequest) => {
    return apiFetch<SignupResponse>("/api/v1/auth/signup", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  verify: () => {
    return apiFetch<{ user: AuthUser }>("/api/v1/auth/verify", {
      method: "POST",
    })
  },

  refresh: () => {
    return apiFetch<{ token: string }>("/api/v1/auth/refresh", {
      method: "POST",
    })
  },

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
    if (!userStr) return null
    try {
      return JSON.parse(userStr) as AuthUser
    } catch {
      return null
    }
  },
}
