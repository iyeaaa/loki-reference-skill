import { createContext, type ReactNode, useContext, useEffect, useState } from "react"

interface User {
  id: string
  email: string
  name?: string
  username?: string
  user_role?: string
  department_name?: string | null
  employee_id?: string | null
  trialStatus?: {
    isTrialActive: boolean
    daysRemaining: number
    trialEndDate: string
  }
}

interface AuthContextType {
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
      } catch (error) {
        console.error("Failed to parse user data:", error)
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
    // Check if current user is trial user before clearing localStorage
    const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
    const isTrialUserLogout = currentUser?.trialStatus?.isTrialActive || false

    localStorage.removeItem("authToken")
    localStorage.removeItem("user")
    setUser(null)

    // Redirect trial users to trial page, others to auth page
    window.location.href = isTrialUserLogout ? "/trial" : "/auth"
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
