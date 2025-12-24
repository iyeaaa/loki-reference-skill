import { createContext, type ReactNode, useContext, useEffect, useState } from "react"
import { env } from "@/lib/env"

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

const API_BASE_URL = env.VITE_API_URL || "http://localhost:3001"

/**
 * 백엔드에서 사용자 세션 유효성 확인
 * 삭제되거나 비활성화된 사용자는 null 반환
 */
async function verifyUserSession(token: string): Promise<User | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/users/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    if (response.status === 401) {
      // 사용자가 삭제되거나 비활성화됨
      return null
    }

    if (!response.ok) {
      throw new Error("Failed to verify user session")
    }

    const data = await response.json()
    return data.data as User
  } catch (error) {
    console.error("Failed to verify user session:", error)
    throw error
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing auth token on mount
    const token = localStorage.getItem("authToken")
    const userData = localStorage.getItem("user")

    if (token && userData) {
      // 토큰이 있으면 백엔드에서 사용자 유효성 확인
      verifyUserSession(token)
        .then((verifiedUser) => {
          if (verifiedUser) {
            setUser(verifiedUser)
            // 최신 정보로 localStorage 업데이트
            localStorage.setItem("user", JSON.stringify(verifiedUser))
          } else {
            // 사용자가 삭제됨 또는 비활성화됨
            localStorage.removeItem("authToken")
            localStorage.removeItem("user")
            setUser(null)
          }
        })
        .catch(() => {
          // API 호출 실패 시 기존 데이터 사용 (오프라인 등)
          try {
            const parsedUser = JSON.parse(userData)
            setUser(parsedUser)
          } catch {
            localStorage.removeItem("authToken")
            localStorage.removeItem("user")
          }
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else {
      setIsLoading(false)
    }
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
    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
    // Clear Jotai survey data to prevent stale data for next user
    localStorage.removeItem("rinda_survey_data")

    // Clear onboarding-related session storage
    sessionStorage.removeItem("onboarding_sequence")
    sessionStorage.removeItem("onboarding_leads")
    sessionStorage.removeItem("onboarding_company_info")
    sessionStorage.removeItem("onboarding_customer_group_id")

    setUser(null)

    // Redirect all users to login page
    window.location.href = "/auth"
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
