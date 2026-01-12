import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { authApi } from "./api/services/auth"

type User = {
  id: string
  email: string
  username?: string
  userRole?: string
  isActive?: boolean
  updatedAt?: string
  createdAt?: string
  trialStatus?: {
    isTrialActive: boolean
    daysRemaining: number
    trialEndDate: string
  }
}

type AuthContextType = {
  user: User | null
  isLoading: boolean
  login: (emailOrToken: string, passwordOrUser?: string | User, isOAuth?: boolean) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const HEARTBEAT_DATE_KEY = "lastHeartbeatDate"

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const userData = localStorage.getItem("user")

    console.log("[AuthProvider] Mount - token:", !!token, "userData:", !!userData)

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)

        // Send heartbeat once per day (on app mount only)
        const today = new Date().toISOString().split("T")[0]
        const lastHeartbeat = localStorage.getItem(HEARTBEAT_DATE_KEY)

        console.log(
          "[AuthProvider] Heartbeat check - today:",
          today,
          "lastHeartbeat:",
          lastHeartbeat,
        )

        if (lastHeartbeat !== today) {
          console.log("[AuthProvider] Sending heartbeat...")
          authApi
            .heartbeat()
            .then((response) => {
              console.log("[AuthProvider] Heartbeat success:", response)
              localStorage.setItem(HEARTBEAT_DATE_KEY, today)
            })
            .catch((error) => {
              console.error("[AuthProvider] Heartbeat failed:", error)
            })
        } else {
          console.log("[AuthProvider] Heartbeat skipped - already sent today")
        }
      } catch (error) {
        console.error("[AuthProvider] Parse error:", error)
        localStorage.removeItem("authToken")
        localStorage.removeItem("user")
      }
    } else {
      console.log("[AuthProvider] No token or userData - skipping heartbeat")
    }
    setIsLoading(false)
  }, [])

  const login = async (emailOrToken: string, passwordOrUser?: string | User, isOAuth?: boolean) => {
    if (isOAuth && typeof passwordOrUser === "object") {
      // OAuth login - emailOrToken is actually the token, passwordOrUser is the user object
      localStorage.setItem("authToken", emailOrToken)
      localStorage.setItem("user", JSON.stringify(passwordOrUser))
      setUser(passwordOrUser)
    } else {
      // Regular login - would need to call login API here
      // For now, just handle the OAuth case
      throw new Error("Regular login not implemented in this context")
    }
  }

  const logout = () => {
    // 진입점 확인: /trial에서 로그인했으면 /trial로 복귀
    const entryPoint = sessionStorage.getItem("auth_entry_point")
    console.log("[AuthProvider] logout - entryPoint:", entryPoint)

    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
    // Clear Jotai survey data to prevent stale data for next user
    localStorage.removeItem("rinda_survey_data")

    // Clear onboarding-related session storage
    sessionStorage.removeItem("onboarding_sequence")
    sessionStorage.removeItem("onboarding_leads")
    sessionStorage.removeItem("onboarding_company_info")
    sessionStorage.removeItem("onboarding_customer_group_id")
    sessionStorage.removeItem("auth_entry_point")

    setUser(null)

    // 진입점 기반 리다이렉트: trial에서 들어왔으면 /trial로, 아니면 /auth로
    const redirectPath = entryPoint === "trial" ? "/trial?from=logout" : "/auth"
    console.log("[AuthProvider] logout - redirecting to:", redirectPath)
    window.location.href = redirectPath
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
