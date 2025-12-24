import { lazy } from "react"
import { createBrowserRouter, Navigate, useSearchParams } from "react-router-dom"
import { ProtectedRoute, UserProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"
import { PermissionProvider, RouteGuard } from "@/lib/permission"
import { getSurveyFromStorage, isValidSurveyData } from "@/store/survey"

// Layouts - 즉시 로드 (모든 페이지에서 필요)
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"
// 로그인 페이지만 즉시 로드 (첫 진입점)
import LoginPage from "../pages/LoginPage"
import NewTrialPage from "../pages/NewTrialPage"
import OnboardingPage from "../pages/onboarding"
import TrialResultPage from "../pages/TrialResultPage"

// App pages for trial users
const CompanyInformation = lazy(() => import("../pages/app/CompanyInformation"))
const UnifiedDashboardPage = lazy(() => import("../pages/UnifiedDashboardPage"))
const NylasRedirect = lazy(() =>
  import("../pages/app/NylasRedirect").then((m) => ({ default: m.NylasRedirect })),
)

// 모든 페이지 - Lazy Loading (성능 최적화)
const ChatbotPage = lazy(() => import("../pages/ChatbotPage"))
const RepliedEmailsPage = lazy(() => import("../pages/email-replies/EmailRepliesPage"))
const LeadsPage = lazy(() => import("../pages/leads"))
const LeadDiscoveryPage = lazy(() => import("../pages/lead-discovery"))
const SequencesPage = lazy(() => import("../pages/sequences"))
const CreateSequencePage = lazy(() => import("../pages/sequences/CreateCampaignPage"))
const SequenceEditPage = lazy(() => import("../pages/sequences/SequenceEditPage"))
const SettingsPage = lazy(() => import("../pages/settings"))

// 부가 페이지 - Lazy Loading
const CustomerGroupsPage = lazy(() => import("../pages/customer-groups"))
const EmailSendTestPage = lazy(() => import("../pages/email-send-test"))
const EmailTemplatesPage = lazy(() => import("../pages/email-templates"))
const SequenceDesigner = lazy(() => import("../pages/sequences/designer/SequenceDesigner"))
const UsersPage = lazy(() => import("../pages/users/UsersPage"))
const WorkspacesPage = lazy(() => import("../pages/workspaces"))
const TailwindTestPage = lazy(() => import("../pages/tailwind-test/TailwindTestPage"))
const LeadImportPage = lazy(() => import("../pages/lead-import"))
const BulkEmailCSVPage = lazy(() => import("../pages/bulk-email-csv"))
const FilterComponentsTest = lazy(() => import("../pages/test/FilterComponentsTest"))

// IAM Pages
const PoliciesPage = lazy(() =>
  import("../pages/iam/PoliciesPage").then((m) => ({ default: m.default })),
)
const RolesPage = lazy(() => import("../pages/iam/RolesPage").then((m) => ({ default: m.default })))

// Activity Logs
const ActivityLogsPage = lazy(() => import("../pages/activity-logs"))

// Billing Pages
const ProductsPage = lazy(() =>
  import("../pages/billing/ProductsPage").then((m) => ({ default: m.default })),
)
const PlansPage = lazy(() =>
  import("../pages/billing/PlansPage").then((m) => ({ default: m.default })),
)
const SubscriptionsPage = lazy(() =>
  import("../pages/billing/SubscriptionsPage").then((m) => ({ default: m.default })),
)
const SSETestPage = lazy(() =>
  import("../pages/settings/SSETestPage").then((m) => ({ default: m.SSETestPage })),
)
const BullMQTestPage = lazy(() =>
  import("../pages/settings/BullMQTestPage").then((m) => ({ default: m.BullMQTestPage })),
)
const SpinnerTestPage = lazy(() => import("../pages/settings/SpinnerTestPage"))
const WebDataExtraction = lazy(() => import("../pages/settings/WebDataExtraction"))
const WebsetPage = lazy(() => import("../pages/webset"))
const WebsetCriteriaPage = lazy(() => import("../pages/webset/criteria"))
const WebsetDetailPage = lazy(() => import("../pages/websets/[id]"))
const GeminiSearchPage = lazy(() => import("../pages/gemini-search/GeminiSearchPage"))
const BigQuerySearchPage = lazy(() => import("../pages/bigquery-search/BigQuerySearchPage"))
const AnalyticsDashboardPage = lazy(() => import("../pages/dashboard/DashboardV2Page"))

function AuthWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PermissionProvider>{children}</PermissionProvider>
    </AuthProvider>
  )
}

// Redirect /login to /auth preserving search params
function LoginRedirect() {
  const [searchParams] = useSearchParams()
  const search = searchParams.toString()
  return <Navigate replace to={`/auth${search ? `?${search}` : ""}`} />
}

/**
 * Trial 페이지 라우팅 로직 (Hydration-safe)
 *
 * 우선순위:
 * 1. OAuth callback (code/error param) → NewTrialPage (로그인 처리)
 * 2. 로그아웃에서 온 경우 → NewTrialPage
 * 3. Survey 완료된 경우 → NewTrialPage (로그인 대기)
 * 4. Survey 미완료 → /trial/survey/1 리다이렉트
 *
 * 핵심: Jotai hydration 문제를 피하기 위해 직접 localStorage 접근
 */
function TrialRedirect() {
  const [searchParams] = useSearchParams()

  // Hydration-safe: 직접 localStorage에서 읽기 (Jotai atom 대신)
  const surveyData = getSurveyFromStorage()
  const hasSurveyData = isValidSurveyData(surveyData)

  const isFromLogout = searchParams.get("from") === "logout"
  const isOAuthCallback = searchParams.has("code")
  const hasError = searchParams.has("error")

  // 1. OAuth callback → always show NewTrialPage
  if (isOAuthCallback || hasError) {
    return <NewTrialPage />
  }

  // 2. User logged out → show login page
  if (isFromLogout) {
    return <NewTrialPage />
  }

  // 3. Survey completed → show login page
  if (hasSurveyData) {
    return <NewTrialPage />
  }

  // 4. No survey data → redirect to survey
  return <Navigate replace to="/trial/survey/1" />
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthWrapper>
        <RootLayout />
      </AuthWrapper>
    ),
    children: [
      // /auth route is development-only (use /trial in production)
      ...(import.meta.env.DEV
        ? [{ path: "auth", element: <LoginPage /> }]
        : [{ path: "trial", element: <TrialRedirect /> }]),
      {
        path: "login",
        element: <LoginRedirect />,
      },
      {
        path: "trial",
        element: <TrialRedirect />,
      },
      {
        path: "trial/survey",
        element: <Navigate replace to="/trial/survey/1" />,
      },
      {
        path: "trial/survey/:step",
        element: <OnboardingPage />,
      },
      {
        path: "trial/result",
        element: <TrialResultPage />,
      },
      {
        path: "onboarding",
        element: <Navigate replace to="/trial/survey/1" />,
      },
      // Standalone dashboard route - layout is inside UnifiedDashboardPage based on user role
      {
        path: "dashboard",
        element: (
          <ProtectedRoute>
            <UnifiedDashboardPage />
          </ProtectedRoute>
        ),
      },
      // Trial user routes (UserProtectedRoute with DashboardLayout)
      {
        path: "company",
        element: (
          <UserProtectedRoute>
            <DashboardLayout>
              <CompanyInformation />
            </DashboardLayout>
          </UserProtectedRoute>
        ),
      },
      {
        path: "app/redirect",
        element: (
          <UserProtectedRoute>
            <DashboardLayout>
              <NylasRedirect />
            </DashboardLayout>
          </UserProtectedRoute>
        ),
      },
      // Backward compatibility redirects
      {
        path: "app",
        element: <Navigate replace to="/company" />,
      },
      {
        path: "app/dashboard",
        element: <Navigate replace to="/dashboard" />,
      },
      // DashboardLayout routes - RouteGuard가 ROUTE_PERMISSIONS 기반으로 자동 권한 체크
      // 등록되지 않은 라우트는 Admin만 접근 가능 (보안 우선)
      {
        path: "/",
        element: (
          <RouteGuard>
            <DashboardLayout />
          </RouteGuard>
        ),
        children: [
          {
            index: true,
            element: <Navigate replace to="/dashboard" />,
          },
          {
            path: "analytics",
            element: (
              <RouteGuard>
                <AnalyticsDashboardPage />
              </RouteGuard>
            ),
          },
          {
            path: "leads",
            element: (
              <RouteGuard>
                <LeadsPage />
              </RouteGuard>
            ),
          },
          {
            path: "lead-discovery",
            element: (
              <RouteGuard>
                <LeadDiscoveryPage />
              </RouteGuard>
            ),
          },
          {
            path: "customer-groups",
            element: (
              <RouteGuard>
                <CustomerGroupsPage />
              </RouteGuard>
            ),
          },
          {
            path: "sequences",
            element: (
              <RouteGuard>
                <SequencesPage />
              </RouteGuard>
            ),
          },
          {
            path: "sequences/create",
            element: (
              <RouteGuard>
                <CreateSequencePage />
              </RouteGuard>
            ),
          },
          {
            path: "sequences/edit",
            element: (
              <RouteGuard>
                <SequenceEditPage />
              </RouteGuard>
            ),
          },
          {
            path: "sequences/:id/designer",
            element: (
              <RouteGuard>
                <SequenceDesigner />
              </RouteGuard>
            ),
          },
          {
            path: "email-templates",
            element: (
              <RouteGuard>
                <EmailTemplatesPage />
              </RouteGuard>
            ),
          },
          {
            path: "replied-emails",
            element: (
              <RouteGuard>
                <RepliedEmailsPage />
              </RouteGuard>
            ),
          },
          {
            path: "replied-emails/:emailId",
            element: (
              <RouteGuard>
                <RepliedEmailsPage />
              </RouteGuard>
            ),
          },
          {
            path: "workspaces",
            element: (
              <RouteGuard>
                <WorkspacesPage />
              </RouteGuard>
            ),
          },
          {
            path: "users",
            element: (
              <RouteGuard>
                <UsersPage />
              </RouteGuard>
            ),
          },
          {
            path: "activity-logs",
            element: (
              <RouteGuard>
                <ActivityLogsPage />
              </RouteGuard>
            ),
          },
          {
            path: "email-send-test",
            element: (
              <RouteGuard>
                <EmailSendTestPage />
              </RouteGuard>
            ),
          },
          {
            path: "settings",
            element: (
              <RouteGuard>
                <SettingsPage />
              </RouteGuard>
            ),
          },
          {
            path: "lead-import",
            element: (
              <RouteGuard>
                <LeadImportPage />
              </RouteGuard>
            ),
          },
          {
            path: "bulk-email-csv",
            element: (
              <RouteGuard>
                <BulkEmailCSVPage />
              </RouteGuard>
            ),
          },
          {
            path: "chatbot",
            element: (
              <RouteGuard>
                <ChatbotPage />
              </RouteGuard>
            ),
          },
          {
            path: "tailwind-test",
            element: (
              <RouteGuard>
                <TailwindTestPage />
              </RouteGuard>
            ),
          },
          {
            path: "test/filters",
            element: (
              <RouteGuard>
                <FilterComponentsTest />
              </RouteGuard>
            ),
          },
          {
            path: "test/sse",
            element: (
              <RouteGuard>
                <SSETestPage />
              </RouteGuard>
            ),
          },
          {
            path: "test/bullmq",
            element: (
              <RouteGuard>
                <BullMQTestPage />
              </RouteGuard>
            ),
          },
          {
            path: "settings/spinner-test",
            element: (
              <RouteGuard>
                <SpinnerTestPage />
              </RouteGuard>
            ),
          },
          {
            path: "settings/web-extraction",
            element: (
              <RouteGuard>
                <WebDataExtraction />
              </RouteGuard>
            ),
          },
          {
            path: "websets",
            element: (
              <RouteGuard>
                <WebsetPage />
              </RouteGuard>
            ),
          },
          {
            path: "websets/criteria",
            element: (
              <RouteGuard>
                <WebsetCriteriaPage />
              </RouteGuard>
            ),
          },
          {
            path: "websets/:id",
            element: (
              <RouteGuard>
                <WebsetDetailPage />
              </RouteGuard>
            ),
          },
          {
            path: "gemini-search",
            element: (
              <RouteGuard>
                <GeminiSearchPage />
              </RouteGuard>
            ),
          },
          {
            path: "bigquery-search",
            element: (
              <RouteGuard>
                <BigQuerySearchPage />
              </RouteGuard>
            ),
          },
          // IAM Routes
          {
            path: "iam/policies",
            element: (
              <RouteGuard>
                <PoliciesPage />
              </RouteGuard>
            ),
          },
          {
            path: "iam/roles",
            element: (
              <RouteGuard>
                <RolesPage />
              </RouteGuard>
            ),
          },
          // Billing Routes
          {
            path: "billing/products",
            element: (
              <RouteGuard>
                <ProductsPage />
              </RouteGuard>
            ),
          },
          {
            path: "billing/plans",
            element: (
              <RouteGuard>
                <PlansPage />
              </RouteGuard>
            ),
          },
          {
            path: "billing/subscriptions",
            element: (
              <RouteGuard>
                <SubscriptionsPage />
              </RouteGuard>
            ),
          },
        ],
      },
    ],
  },
])
