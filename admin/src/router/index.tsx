import { lazy } from "react"
import { createBrowserRouter, Navigate, useSearchParams } from "react-router-dom"
import {
  AdminProtectedRoute,
  ProtectedRoute,
  UserProtectedRoute,
} from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"

// Layouts - 즉시 로드 (모든 페이지에서 필요)
import AppLayout from "../layouts/AppLayout"
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
const SSETestPage = lazy(() =>
  import("../pages/settings/SSETestPage").then((m) => ({ default: m.SSETestPage })),
)
const SpinnerTestPage = lazy(() => import("../pages/settings/SpinnerTestPage"))
const WebDataExtraction = lazy(() => import("../pages/settings/WebDataExtraction"))
const WebsetPage = lazy(() => import("../pages/webset"))
const WebsetCriteriaPage = lazy(() => import("../pages/webset/criteria"))
const WebsetDetailPage = lazy(() => import("../pages/websets/[id]"))
const GeminiSearchPage = lazy(() => import("../pages/gemini-search/GeminiSearchPage"))
const BigQuerySearchPage = lazy(() => import("../pages/bigquery-search/BigQuerySearchPage"))

function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

// Redirect /login to /auth preserving search params
function LoginRedirect() {
  const [searchParams] = useSearchParams()
  const search = searchParams.toString()
  return <Navigate to={`/auth${search ? `?${search}` : ""}`} replace />
}

// Redirect /trial to /trial/survey/1 if no params (except if from=logout)
function TrialRedirect() {
  const [searchParams] = useSearchParams()
  const isFromLogout = searchParams.get("from") === "logout"
  const hasParams = searchParams.toString().length > 0

  // If user logged out from AppLayout, stay on /trial (show login page)
  if (isFromLogout) {
    return <NewTrialPage />
  }

  // If no params, redirect to onboarding survey
  if (!hasParams) {
    return <Navigate to="/trial/survey/1" replace />
  }

  return <NewTrialPage />
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
      {
        path: "auth",
        element: <LoginPage />,
      },
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
        element: <Navigate to="/trial/survey/1" replace />,
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
        element: <Navigate to="/trial/survey/1" replace />,
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
      // AppLayout routes (for trial users - UserProtectedRoute)
      {
        path: "company",
        element: (
          <UserProtectedRoute>
            <AppLayout>
              <CompanyInformation />
            </AppLayout>
          </UserProtectedRoute>
        ),
      },
      {
        path: "app/redirect",
        element: (
          <UserProtectedRoute>
            <AppLayout>
              <NylasRedirect />
            </AppLayout>
          </UserProtectedRoute>
        ),
      },
      // Backward compatibility redirects
      {
        path: "app",
        element: <Navigate to="/company" replace />,
      },
      {
        path: "app/dashboard",
        element: <Navigate to="/dashboard" replace />,
      },
      // DashboardLayout routes (for admin users - AdminProtectedRoute)
      {
        path: "/",
        element: (
          <AdminProtectedRoute>
            <DashboardLayout />
          </AdminProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/dashboard" replace />,
          },
          {
            path: "leads",
            element: <LeadsPage />,
          },
          {
            path: "lead-discovery",
            element: <LeadDiscoveryPage />,
          },
          {
            path: "customer-groups",
            element: <CustomerGroupsPage />,
          },
          {
            path: "sequences",
            element: <SequencesPage />,
          },
          {
            path: "sequences/create",
            element: <CreateSequencePage />,
          },
          {
            path: "sequences/edit",
            element: <SequenceEditPage />,
          },
          {
            path: "sequences/:id/designer",
            element: <SequenceDesigner />,
          },
          {
            path: "email-templates",
            element: <EmailTemplatesPage />,
          },
          {
            path: "replied-emails",
            element: <RepliedEmailsPage />,
          },
          {
            path: "replied-emails/:emailId",
            element: <RepliedEmailsPage />,
          },
          {
            path: "workspaces",
            element: <WorkspacesPage />,
          },
          {
            path: "users",
            element: <UsersPage />,
          },
          {
            path: "email-send-test",
            element: <EmailSendTestPage />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
          },
          {
            path: "lead-import",
            element: <LeadImportPage />,
          },
          {
            path: "bulk-email-csv",
            element: <BulkEmailCSVPage />,
          },
          {
            path: "chatbot",
            element: <ChatbotPage />,
          },
          {
            path: "tailwind-test",
            element: <TailwindTestPage />,
          },
          {
            path: "test/filters",
            element: <FilterComponentsTest />,
          },
          {
            path: "test/sse",
            element: <SSETestPage />,
          },
          {
            path: "settings/spinner-test",
            element: <SpinnerTestPage />,
          },
          {
            path: "settings/web-extraction",
            element: <WebDataExtraction />,
          },
          {
            path: "websets",
            element: <WebsetPage />,
          },
          {
            path: "websets/criteria",
            element: <WebsetCriteriaPage />,
          },
          {
            path: "websets/:id",
            element: <WebsetDetailPage />,
          },
          {
            path: "gemini-search",
            element: <GeminiSearchPage />,
          },
          {
            path: "bigquery-search",
            element: <BigQuerySearchPage />,
          },
        ],
      },
    ],
  },
])
