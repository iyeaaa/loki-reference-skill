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
 * - 온보딩 미완료: /company로 리다이렉트
 * - 온보딩 완료: 대시보드 표시
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

  // Get user's workspace
  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(userId, !!userId)
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
    if (workspacesLoading || onboardingLoading) return

    // If no workspace or onboarding not complete, redirect to /company
    if (!workspaceId || !isOnboardingComplete) {
      navigate("/company", { replace: true })
    }
  }, [workspaceId, isOnboardingComplete, workspacesLoading, onboardingLoading, navigate])

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
