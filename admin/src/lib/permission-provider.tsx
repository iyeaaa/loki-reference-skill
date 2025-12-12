/**
 * @deprecated 이 파일은 하위 호환성을 위해 유지됩니다.
 * 새 코드에서는 @/lib/permission을 사용하세요.
 *
 * @example
 * // 기존 (deprecated)
 * import { usePermissions, PermissionProvider } from "@/lib/permission-provider"
 *
 * // 신규 (권장)
 * import { usePermissions, PermissionProvider } from "@/lib/permission"
 */

export {
  AdminOnly,
  PermissionGate,
  PermissionProvider,
  useHasPermission,
  useIsAdmin,
  usePermissions,
} from "./permission"
