/**
 * Permission Utilities
 *
 * 권한 체크 관련 유틸리티 함수
 */

import { ADMIN_ROLES, ROUTE_PERMISSIONS } from "./constants"
import type { IamPermission, RoutePermission } from "./types"

/**
 * 라우트 권한 조회
 * 등록되지 않은 라우트는 "admin-only" 반환 (보안 우선)
 */
export function getRoutePermission(path: string): RoutePermission {
  // 정확한 매칭 먼저 시도
  if (ROUTE_PERMISSIONS[path]) {
    return ROUTE_PERMISSIONS[path]
  }

  // 동적 라우트 패턴 매칭 (예: /sequences/:id/designer)
  for (const [pattern, permission] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pattern.includes(":")) {
      const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, "[^/]+")}$`)
      if (regex.test(path)) {
        return permission
      }
    }
  }

  // 등록되지 않은 라우트는 Admin만 접근 가능 (보안 우선)
  return "admin-only"
}

/**
 * 사용자 역할이 Admin인지 확인
 */
export function isAdminRole(userRole?: string): boolean {
  if (!userRole) return false
  return ADMIN_ROLES.includes(userRole as (typeof ADMIN_ROLES)[number])
}

/**
 * 권한이 IAM 권한인지 확인 (type guard)
 */
export function isIamPermission(permission: RoutePermission): permission is IamPermission {
  return typeof permission === "object" && "resource" in permission && "action" in permission
}

/**
 * 권한이 public인지 확인
 */
export function isPublicPermission(permission: RoutePermission): permission is "public" {
  return permission === "public"
}

/**
 * 권한이 admin-only인지 확인
 */
export function isAdminOnlyPermission(permission: RoutePermission): permission is "admin-only" {
  return permission === "admin-only"
}
