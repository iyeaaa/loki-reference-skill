/**
 * Protected Route Components
 *
 * 기본 인증 보호 라우트 컴포넌트들
 * 권한 기반 라우트는 @/lib/permission의 RouteGuard를 사용하세요.
 */

import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-provider"
import type { IamAction, IamResource } from "@/lib/constants/iam-resources"
import { useHasPermission, usePermissions } from "@/lib/permission"

interface ProtectedRouteProps {
  children: React.ReactNode
}

interface PermissionProtectedRouteProps {
  children: React.ReactNode
  resource: IamResource
  action: IamAction
  fallbackPath?: string
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
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
 * Used for routes: /dashboard, /company, /app/redirect
 * Does NOT check role - any logged in user can access
 */
export function UserProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
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
 * @deprecated RouteGuard를 사용하세요
 */
export function AdminProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, isLoading, logout } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/auth?from=logout" replace />
  }

  // If user is not admin, logout and redirect
  if (user.userRole !== "admin" && user.userRole !== "super_admin") {
    logout()
    return null
  }

  return <>{children}</>
}

/**
 * Permission protected route - checks IAM permissions
 * @deprecated RouteGuard를 사용하세요
 */
export function PermissionProtectedRoute({
  children,
  resource,
  action,
  fallbackPath = "/dashboard",
}: PermissionProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth()
  const { isLoading: permLoading, isAdmin } = usePermissions()
  const hasPermission = useHasPermission(resource, action)
  const location = useLocation()

  // Combined loading state
  if (authLoading || permLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  // Not logged in
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // Admin always has access
  if (isAdmin) {
    return <>{children}</>
  }

  // Check specific permission
  if (!hasPermission) {
    console.warn(`Permission denied: ${resource}:${action}`)
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}
