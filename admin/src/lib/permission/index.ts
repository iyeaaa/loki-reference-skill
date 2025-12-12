/**
 * Permission Module
 *
 * 권한 관리 관련 모든 기능을 통합 export
 *
 * @example
 * // Provider 사용
 * import { PermissionProvider } from "@/lib/permission"
 *
 * // 훅 사용
 * import { usePermissions, useHasPermission, useIsAdmin } from "@/lib/permission"
 *
 * // 컴포넌트 사용
 * import { RouteGuard, PermissionGate, AdminOnly } from "@/lib/permission"
 *
 * // 유틸리티 사용
 * import { getRoutePermission, isAdminRole } from "@/lib/permission"
 *
 * // 상수 사용
 * import { ROUTE_PERMISSIONS, ADMIN_ROLES } from "@/lib/permission"
 *
 * // 타입 사용
 * import type { RoutePermission, IamPermission } from "@/lib/permission"
 */

// Components
export { AdminOnly, NoPermissionPage, PermissionGate } from "./components"
// Constants
export { ADMIN_ROLES, ROUTE_PERMISSIONS } from "./constants"
// Hooks
export { useHasPermission, useIsAdmin, usePermissionLoading, useWorkspacePermission } from "./hooks"
// Provider
export { PermissionProvider, usePermissions } from "./PermissionProvider"
export { RouteGuard } from "./RouteGuard"
// Types
export type {
  IamPermission,
  MyPermissionsResponse,
  PermissionCheckResponse,
  PermissionContextType,
  RoutePermission,
} from "./types"
// Utils
export {
  getRoutePermission,
  isAdminOnlyPermission,
  isAdminRole,
  isIamPermission,
  isPublicPermission,
} from "./utils"
