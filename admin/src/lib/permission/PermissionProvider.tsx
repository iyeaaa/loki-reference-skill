/**
 * Permission Provider
 *
 * 프론트엔드 권한 관리 Provider
 * - 워크스페이스별 권한 정보 관리
 * - 권한 기반 UI 제어
 * - 백엔드 권한 체크와 동기화
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import { useMyPermissions } from "@/lib/api/hooks/iam"
import { iamMyPermissionsApi } from "@/lib/api/services/iam"
import type { IamAction, IamResource } from "@/lib/constants/iam-resources"
import type { PermissionContextType } from "./types"

const PermissionContext = createContext<PermissionContextType | undefined>(undefined)

type PermissionProviderProps = {
  children: ReactNode
}

export function PermissionProvider({ children }: PermissionProviderProps) {
  // 로그인 상태 확인 (authToken 존재 여부)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(
    () => !!localStorage.getItem("authToken"),
  )

  // localStorage에서 선택된 워크스페이스 가져오기
  const [workspaceId, setWorkspaceId] = useState<string | null>(() => {
    const stored = localStorage.getItem("selectedWorkspace")
    return stored && stored !== "all" ? stored : null
  })

  // 인증 상태 변경 감지
  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem("authToken"))
    }

    window.addEventListener("storage", handleAuthChange)
    return () => window.removeEventListener("storage", handleAuthChange)
  }, [])

  // 워크스페이스 변경 시 localStorage 업데이트
  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem("selectedWorkspace")
      setWorkspaceId(stored && stored !== "all" ? stored : null)
    }

    // localStorage 변경 감지
    window.addEventListener("storage", handleStorageChange)

    // 커스텀 이벤트로 같은 탭 내 변경도 감지
    window.addEventListener("workspaceChange", handleStorageChange)

    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("workspaceChange", handleStorageChange)
    }
  }, [])

  // React Query로 권한 정보 가져오기 (로그인되고 워크스페이스가 선택된 경우에만 호출)
  const {
    data: permissionData,
    isLoading,
    isError,
    refetch: refetchPermissions,
  } = useMyPermissions(workspaceId ?? undefined, isAuthenticated)

  // 권한 정보 추출 - 항상 API 응답 기준으로 판단
  const isAdmin = permissionData?.isAdmin ?? false

  const roles = permissionData?.roles ?? []
  const memberId = permissionData?.memberId ?? null

  /**
   * 동기 권한 체크
   * Admin은 모든 권한 허용
   * permissionData에서 직접 확인
   */
  const hasPermission = useCallback(
    (resource: IamResource, action: IamAction): boolean => {
      // Admin은 모든 권한 허용
      if (isAdmin) {
        return true
      }

      // 워크스페이스가 없으면 권한 없음
      if (!workspaceId) {
        return false
      }

      // permissionData에서 권한 확인
      const permissions = permissionData?.permissions ?? []
      return permissions.some(
        (p: { resource: string; action: string }) => p.resource === resource && p.action === action,
      )
    },
    [isAdmin, workspaceId, permissionData],
  )

  /**
   * 비동기 권한 체크 (API 호출)
   * 캐시 없이 항상 최신 데이터 조회
   */
  const checkPermissionAsync = useCallback(
    async (resource: IamResource, action: IamAction): Promise<boolean> => {
      // Admin은 모든 권한 허용
      if (isAdmin) {
        return true
      }

      // 워크스페이스가 없으면 권한 없음
      if (!workspaceId) {
        return false
      }

      try {
        // API 호출 (캐시 없이 직접 호출)
        const response = await iamMyPermissionsApi.checkPermission({
          workspaceId,
          resource,
          action,
        })

        return response.hasPermission
      } catch (error) {
        console.error("Permission check failed:", error)
        return false
      }
    },
    [isAdmin, workspaceId],
  )

  // 워크스페이스 변경 핸들러
  const handleSetWorkspaceId = useCallback((id: string | null) => {
    setWorkspaceId(id)

    // 커스텀 이벤트 발생
    window.dispatchEvent(new Event("workspaceChange"))
  }, [])

  // 로딩 상태 - 항상 API 호출하므로 그대로 사용
  const effectiveIsLoading = isLoading

  // 컨텍스트 값 메모이제이션
  const contextValue = useMemo(
    () => ({
      workspaceId,
      setWorkspaceId: handleSetWorkspaceId,
      isAdmin,
      roles,
      memberId,
      hasPermission,
      checkPermissionAsync,
      isLoading: effectiveIsLoading,
      isError,
      refetchPermissions,
    }),
    [
      workspaceId,
      handleSetWorkspaceId,
      isAdmin,
      roles,
      memberId,
      hasPermission,
      checkPermissionAsync,
      effectiveIsLoading,
      isError,
      refetchPermissions,
    ],
  )

  return <PermissionContext.Provider value={contextValue}>{children}</PermissionContext.Provider>
}

/**
 * 권한 컨텍스트 사용 훅
 */
export function usePermissions() {
  const context = useContext(PermissionContext)
  if (context === undefined) {
    throw new Error("usePermissions must be used within a PermissionProvider")
  }
  return context
}
