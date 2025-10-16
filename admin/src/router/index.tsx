import { lazy } from "react"
import { createBrowserRouter } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"

// Layouts - 즉시 로드 (모든 페이지에서 필요)
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"

// Pages - Lazy Loading
const LoginPage = lazy(() => import("../pages/LoginPage"))
const DashboardPage = lazy(() => import("../pages/dashboard/DashboardPage"))
const CampaignsPage = lazy(() => import("../pages/campaigns"))
const CustomerGroupsPage = lazy(() => import("../pages/customer-groups"))
const EmailSendTestPage = lazy(() => import("../pages/email-send-test"))
const EmailTemplatesPage = lazy(() => import("../pages/email-templates"))
const LeadsPage = lazy(() => import("../pages/leads"))
const RepliedEmailsPage = lazy(() => import("../pages/email-replies/EmailRepliesPage"))
const SequencesPage = lazy(() => import("../pages/sequences"))
const SequenceDesigner = lazy(() => import("../pages/sequences/designer/SequenceDesigner"))
const SettingsPage = lazy(() => import("../pages/settings"))
const UsersPage = lazy(() => import("../pages/users/UsersPage"))
const WorkspacesPage = lazy(() => import("../pages/workspaces"))
const TailwindTestPage = lazy(() => import("../pages/tailwind-test/TailwindTestPage"))
const LeadImportPage = lazy(() => import("../pages/lead-import"))
const BulkEmailCSVPage = lazy(() => import("../pages/bulk-email-csv"))

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
            element: <DashboardPage />,
          },
          {
            path: "dashboard",
            element: <DashboardPage />,
          },
          {
            path: "campaigns",
            element: <CampaignsPage />,
          },
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
            path: "tailwind-test",
            element: <TailwindTestPage />,
          },
        ],
      },
    ],
  },
])
