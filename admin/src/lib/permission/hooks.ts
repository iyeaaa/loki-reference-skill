/**
 * Permission Hooks
 *
 * 권한 관련 React 훅
 */

import type { IamAction, IamResource } from "@/lib/constants/iam-resources"
import { usePermissions } from "./PermissionProvider"

/**
 * 특정 권한 체크 훅
 */
export function useHasPermission(resource: IamResource, action: IamAction): boolean {
  const { hasPermission, isAdmin, isLoading } = usePermissions()

  // Admin은 항상 true
  if (isAdmin) {
    return true
  }

  // 로딩 중이면 false
  if (isLoading) {
    return false
  }

  return hasPermission(resource, action)
}

/**
 * Admin 여부 체크 훅
 */
export function useIsAdmin(): boolean {
  const { isAdmin } = usePermissions()
  return isAdmin
}

/**
 * 권한 로딩 상태 훅
 */
export function usePermissionLoading(): boolean {
  const { isLoading } = usePermissions()
  return isLoading
}

/**
 * 워크스페이스 권한 정보 훅
 */
export function useWorkspacePermission() {
  const { workspaceId, isAdmin, roles, memberId, isLoading } = usePermissions()

  return {
    workspaceId,
    isAdmin,
    roles,
    memberId,
    isLoading,
  }
}
