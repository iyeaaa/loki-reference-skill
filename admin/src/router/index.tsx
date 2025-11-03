import { lazy } from "react"
import { createBrowserRouter, Navigate } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"

// Layouts - 즉시 로드 (모든 페이지에서 필요)
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"
import ChatbotPage from "../pages/ChatbotPage"
import DashboardPage from "../pages/dashboard/DashboardPage"
import RepliedEmailsPage from "../pages/email-replies/EmailRepliesPage"
// 주요 페이지 - 즉시 로드 (자주 사용하는 페이지)
import LoginPage from "../pages/LoginPage"
import LeadsPage from "../pages/leads"
import SequencesPage from "../pages/sequences"
import SettingsPage from "../pages/settings"

// 부가 페이지 - Lazy Loading (덜 자주 사용하는 페이지)
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
        ],
      },
    ],
  },
])
