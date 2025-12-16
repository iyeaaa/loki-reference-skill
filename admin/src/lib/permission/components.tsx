/**
 * Permission Components
 *
 * 권한 기반 UI 컴포넌트
 */

import type { ReactNode } from "react"
import type { IamAction, IamResource } from "@/lib/constants/iam-resources"
import { useHasPermission, useIsAdmin } from "./hooks"

/**
 * 권한 기반 컴포넌트 표시
 * 해당 권한이 있을 때만 children을 렌더링
 */
type PermissionGateProps = {
  resource: IamResource
  action: IamAction
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({
  resource,
  action,
  children,
  fallback = null,
}: PermissionGateProps) {
  const hasAccess = useHasPermission(resource, action)

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * Admin 전용 컴포넌트
 * Admin 사용자에게만 children을 렌더링
 */
type AdminOnlyProps = {
  children: ReactNode
  fallback?: ReactNode
}

export function AdminOnly({ children, fallback = null }: AdminOnlyProps) {
  const isAdmin = useIsAdmin()

  if (!isAdmin) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

/**
 * 권한 없음 페이지
 */
export function NoPermissionPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="mb-4 font-bold text-4xl text-gray-900">접근 권한 없음</h1>
        <p className="mb-8 text-gray-600">
          이 페이지에 접근할 권한이 없습니다.
          <br />
          관리자에게 문의하세요.
        </p>
        <a
          className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-indigo-700"
          href="/dashboard"
        >
          대시보드로 돌아가기
        </a>
      </div>
    </div>
  )
}
