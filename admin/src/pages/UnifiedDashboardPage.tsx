import { lazy, Suspense, useEffect, useMemo } from "react"
import { PageSkeleton } from "@/components/PageSkeleton"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { useAuth } from "@/lib/auth-provider"

// Lazy load the dashboard page and layout
const AppDashboardPage = lazy(() => import("./app/AppDashboardPage"))
const DashboardLayout = lazy(() => import("../layouts/DashboardLayout"))

/**
 * Unified Dashboard Page
 * - 온보딩 미완료: 로그아웃 후 /auth로 리다이렉트
 * - 온보딩 완료: 대시보드 표시
 * - 캠페인 콜아웃은 DashboardLayout에서 전역적으로 관리
 */
export default function UnifiedDashboardPage() {
  const { logout } = useAuth()

  // Get current user
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

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

  // Logout and redirect to /auth if onboarding not complete
  useEffect(() => {
    if (workspacesLoading || onboardingLoading) {
      return
    }

    // If no workspace or onboarding not complete, logout and redirect to /auth
    if (!(workspaceId && isOnboardingComplete)) {
      logout()
    }
  }, [workspaceId, isOnboardingComplete, workspacesLoading, onboardingLoading, logout])

  // Show loading while checking
  if (workspacesLoading || onboardingLoading) {
    return <PageSkeleton />
  }

  // If onboarding not complete, show nothing (will redirect)
  if (!isOnboardingComplete) {
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
