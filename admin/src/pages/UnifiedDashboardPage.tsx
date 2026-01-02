import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { PageSkeleton } from "@/components/PageSkeleton"
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useSequence } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

// Lazy load the dashboard page and layout
const AppDashboardPage = lazy(() => import("./app/AppDashboardPage"))
const DashboardLayout = lazy(() => import("../layouts/DashboardLayout"))

const DISMISS_KEY = "campaign_resume_dismissed"

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
  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Get onboarding progress
  const {
    data: onboardingProgress,
    isLoading: onboardingLoading,
    refetch: refetchOnboardingProgress,
  } = useOnboardingProgress(workspaceId, !!workspaceId)

  // Check if onboarding is complete
  const isOnboardingComplete = !!onboardingProgress?.completedAt

  // Get sequence data if it exists
  const sequenceId = onboardingProgress?.generatedSequenceId || ""
  const { data: sequence, refetch: refetchSequence } = useSequence(sequenceId, !!sequenceId)

  // Popup state - temporarily dismissed during session
  const [temporarilyDismissed, setTemporarilyDismissed] = useState(false)

  // Determine if popup should be shown
  const shouldShowPopup = useMemo(() => {
    // Don't show if onboarding not complete
    if (!onboardingProgress?.completedAt) {
      return false
    }

    // Don't show if no sequence
    if (!sequence?.id) {
      return false
    }

    // Only show if sequence is not yet activated (draft or ready status)
    if (sequence.status !== "draft" && sequence.status !== "ready") {
      return false
    }

    // Check if user dismissed the popup permanently
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (dismissed === "true") {
      return false
    }

    // Check if temporarily dismissed (during this session)
    if (temporarilyDismissed) {
      return false
    }

    return true
  }, [onboardingProgress, sequence, temporarilyDismissed])

  // Redirect to /company if onboarding not complete
  useEffect(() => {
    if (workspacesLoading || onboardingLoading) {
      return
    }

    // If no workspace or onboarding not complete, redirect to /company
    if (!(workspaceId && isOnboardingComplete)) {
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
        <AppDashboardPage
          calloutSequenceId={sequenceId}
          onCalloutComplete={() => {
            setTemporarilyDismissed(true)
            refetchSequence()
            refetchOnboardingProgress()
          }}
          onCalloutDismiss={() => {
            setTemporarilyDismissed(true)
          }}
          showCampaignCallout={shouldShowPopup && !!sequenceId}
        />
      </DashboardLayout>
    </Suspense>
  )
}
