import { createContext, type ReactNode, useContext, useEffect, useState } from "react"

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check for existing auth token on mount
    const token = localStorage.getItem("authToken")
    const userData = localStorage.getItem("user")

    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
      } catch {
        localStorage.removeItem("authToken")
        localStorage.removeItem("user")
      }
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
