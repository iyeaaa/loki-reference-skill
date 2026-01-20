import { lazy, Suspense, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { PageSkeleton } from "@/components/PageSkeleton"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

// Lazy load the dashboard page and layout
const AppDashboardPage = lazy(() => import("./app/AppDashboardPage"))
const DashboardLayout = lazy(() => import("../layouts/DashboardLayout"))

/**
 * Unified Dashboard Page
 * - 온보딩 미완료: /company로 리다이렉트 (온보딩 완료 필요)
 * - 온보딩 완료: 대시보드 표시
 * - 관리자 (userRole="admin"): 온보딩 체크 건너뛰기
 * - 캠페인 콜아웃은 DashboardLayout에서 전역적으로 관리
 */
export default function UnifiedDashboardPage() {
  const navigate = useNavigate()

  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  // 관리자는 온보딩 건너뛰기
  const isAdmin = currentUser?.userRole === "admin"

  // Get user's workspace
  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Get onboarding progress
  const { data: onboardingProgress, isLoading: onboardingLoading } = useOnboardingProgress(
    workspaceId,
    !!workspaceId,
  )

  // Check if onboarding is complete
  const isOnboardingComplete = !!onboardingProgress?.completedAt

  // Redirect to /company if onboarding not complete
  useEffect(() => {
    if (workspacesLoading || onboardingLoading) {
      return
    }

    // 관리자는 온보딩 체크 건너뛰기
    if (isAdmin) {
      return
    }

    // If no workspace or onboarding not complete, redirect to /company (onboarding page)
    if (!(workspaceId && isOnboardingComplete)) {
      navigate("/company", { replace: true })
    }
  }, [workspaceId, isOnboardingComplete, workspacesLoading, onboardingLoading, isAdmin, navigate])

  // Show loading while checking
  if (workspacesLoading || onboardingLoading) {
    return <PageSkeleton />
  }

  // If onboarding not complete, show nothing (will redirect)
  // 단, 관리자는 예외
  if (!(isOnboardingComplete || isAdmin)) {
    return <PageSkeleton />
  }

  return (
    <Suspense fallback={<PageSkeleton />}>
      <DashboardLayout>
        <AppDashboardPage />
      </DashboardLayout>
    </Suspense>
  )
}
