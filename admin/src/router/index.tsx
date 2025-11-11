import { lazy } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"

// Layouts - 즉시 로드 (모든 페이지에서 필요)
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"
// 로그인 페이지만 즉시 로드 (첫 진입점)
import LoginPage from "../pages/LoginPage"

// 모든 페이지 - Lazy Loading (성능 최적화)
const ChatbotPage = lazy(() => import("../pages/ChatbotPage"))
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"))
const RepliedEmailsPage = lazy(() => import("../pages/email-replies/EmailRepliesPage"))
const LeadsPage = lazy(() => import("../pages/leads"))
const SequencesPage = lazy(() => import("../pages/sequences"))
const CreateCampaignPage = lazy(() => import("../pages/sequences/CreateCampaignPage"))
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

function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
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
        path: "login",
        element: <LoginPage />,
      },
      {
        path: "/",
        element: (
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/chatbot" replace />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          // {
          //   path: "campaigns",
          //   element: <CampaignsPage />,
          // },
          {
            path: "leads",
            element: <LeadsPage />,
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
            element: <CreateCampaignPage />,
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
        ],
      },
    ],
  },
])
