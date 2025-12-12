import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-provider"

interface ProtectedRouteProps {
  children: React.ReactNode
}

/**
 * Basic protected route - just checks if user is logged in
 * Used for routes accessible by any authenticated user
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  return <>{children}</>
}

/**
 * User protected route - checks if user is logged in (by user id)
 * Used for AppLayout routes: /dashboard, /company, /app/redirect
 * Does NOT check role - any logged in user can access
 */
export function UserProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()
  console.log("USER", user)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user?.id) {
    return <Navigate to="/trial?from=logout" replace />
  }

  return <>{children}</>
}

/**
 * Admin protected route - checks if user is logged in AND has admin role
 * Used for DashboardLayout routes: /leads, /sequences, /settings, etc.
 * If user is not admin, logs them out
 */
export function AdminProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, logout } = useAuth()
  console.log("USER", user)

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth?from=logout" replace />
  }

  // If user is not admin, logout and redirect
  if (user.userRole !== "admin") {
    logout()
    return null
  }

  return <>{children}</>
}
