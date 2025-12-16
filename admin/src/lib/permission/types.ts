/**
 * Permission Types
 *
 * 권한 시스템에서 사용되는 타입 정의
 */

import type { IamAction, IamResource } from "@/lib/constants/iam-resources"

/**
 * IAM 권한 (리소스 + 액션)
 */
export type IamPermission = {
  resource: IamResource
  action: IamAction
}

/**
 * 라우트/메뉴 권한 타입
 * - IamPermission: 해당 IAM 권한 보유자만 접근 가능
 * - "public": 모든 인증된 사용자 접근 가능
 * - "admin-only": Admin만 접근 가능 (기본값)
 */
export type RoutePermission = IamPermission | "public" | "admin-only"

/**
 * 권한 컨텍스트 타입
 */
export type PermissionContextType = {
  // 현재 워크스페이스 ID
  workspaceId: string | null
  setWorkspaceId: (id: string | null) => void

  // 권한 정보
  isAdmin: boolean
  roles: Array<{ id: string; name: string; priority: number }>
  memberId: string | null

  // 권한 체크 함수들
  hasPermission: (resource: IamResource, action: IamAction) => boolean
  checkPermissionAsync: (resource: IamResource, action: IamAction) => Promise<boolean>

  // 로딩 상태
  isLoading: boolean
  isError: boolean

  // 권한 새로고침
  refetchPermissions: () => void
}

/**
 * API 응답: 권한 체크 결과
 */
export type PermissionCheckResponse = {
  hasPermission: boolean
}

/**
 * API 응답: 내 권한 정보
 */
export type MyPermissionsResponse = {
  memberId: string | null
  permissions: Array<{ resource: string; action: string }>
  roles: Array<{ id: string; name: string; priority: number }>
  isAdmin: boolean
}
