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
interface PermissionGateProps {
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
interface AdminOnlyProps {
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">접근 권한 없음</h1>
        <p className="text-gray-600 mb-8">
          이 페이지에 접근할 권한이 없습니다.
          <br />
          관리자에게 문의하세요.
        </p>
        <a
          href="/dashboard"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
        >
          대시보드로 돌아가기
        </a>
      </div>
    </div>
  )
}
