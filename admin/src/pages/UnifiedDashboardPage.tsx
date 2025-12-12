import { lazy, Suspense } from "react"
import { PageSkeleton } from "@/components/PageSkeleton"
import { useAuth } from "@/lib/auth-provider"

// Lazy load the dashboard pages
const AppDashboardPage = lazy(() => import("./app/AppDashboardPage"))
const DashboardV2Page = lazy(() => import("./dashboard/DashboardV2Page"))

// Lazy load the layouts
const AppLayout = lazy(() => import("../layouts/AppLayout"))
const DashboardLayout = lazy(() => import("../layouts/DashboardLayout"))

/**
 * Unified Dashboard Page
 * Renders different layouts and dashboard content based on user role:
 * - "user" role: AppLayout + AppDashboardPage (trial users)
 * - "admin" role: DashboardLayout + DashboardV2Page (admin users)
 */
export default function UnifiedDashboardPage() {
  const { user } = useAuth()

  // Admin users get the full dashboard with DashboardLayout
  if (user?.userRole === "admin") {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <DashboardLayout>
          <DashboardV2Page />
        </DashboardLayout>
      </Suspense>
    )
  }

  // Regular users get the simplified AppLayout with AppDashboardPage
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AppLayout>
        <AppDashboardPage />
      </AppLayout>
    </Suspense>
  )
}
