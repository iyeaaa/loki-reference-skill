/**
 * RouteGuard Component
 *
 * 라우트 권한 보호 컴포넌트
 * ROUTE_PERMISSIONS에 정의된 권한을 자동으로 적용
 */

import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/lib/auth-provider"
import type { IamAction, IamResource } from "@/lib/constants/iam-resources"
import { useHasPermission } from "./hooks"
import { usePermissions } from "./PermissionProvider"
import type { RoutePermission } from "./types"
import {
  getRoutePermission,
  isAdminOnlyPermission,
  isIamPermission,
  isPublicPermission,
} from "./utils"

/**
 * RouteGuard - 자동 권한 체크 컴포넌트
 *
 * ROUTE_PERMISSIONS에 정의된 권한을 자동으로 적용합니다.
 * - 등록되지 않은 라우트: Admin만 접근 가능 (보안 우선)
 * - "public": 모든 인증된 사용자 접근 가능
 * - "admin-only": Admin만 접근 가능
 * - { resource, action }: 해당 IAM 권한 보유자만 접근 가능
 */
interface RouteGuardProps {
  children: React.ReactNode
  /** 권한을 직접 지정 (ROUTE_PERMISSIONS보다 우선) */
  permission?: RoutePermission
  fallbackPath?: string
}

export function RouteGuard({
  children,
  permission: explicitPermission,
  fallbackPath = "/dashboard",
}: RouteGuardProps) {
  const { user, isLoading: authLoading } = useAuth()
  const { isLoading: permLoading, isAdmin } = usePermissions()
  const location = useLocation()

  // 권한 결정: 명시적 지정 > ROUTE_PERMISSIONS > "admin-only"
  const permission = explicitPermission ?? getRoutePermission(location.pathname)

  // useHasPermission은 조건부 호출 불가 → 항상 호출 후 결과 사용
  const iamPermission = isIamPermission(permission)
    ? permission
    : { resource: "" as IamResource, action: "" as IamAction }
  const hasIamPermission = useHasPermission(iamPermission.resource, iamPermission.action)

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

  // "public" - 모든 인증된 사용자 접근 가능
  if (isPublicPermission(permission)) {
    return <>{children}</>
  }

  // "admin-only" - Admin만 접근 가능
  if (isAdminOnlyPermission(permission)) {
    console.warn(`Permission denied (admin-only): ${location.pathname}`)
    return <Navigate to={fallbackPath} replace />
  }

  // IAM 권한 체크
  if (!hasIamPermission) {
    console.warn(`Permission denied: ${iamPermission.resource}:${iamPermission.action}`)
    return <Navigate to={fallbackPath} replace />
  }

  return <>{children}</>
}
