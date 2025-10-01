import { createBrowserRouter } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"
import CampaignsPage from "../pages/campaigns"
import CustomerGroupsPage from "../pages/customer-groups"
import DashboardPage from "../pages/dashboard/DashboardPage"
import EmailSendTestPage from "../pages/email-send-test"
import EmailTemplatesPage from "../pages/email-templates"
import LoginPage from "../pages/LoginPage"
import LeadsPage from "../pages/leads"
import RepliedEmailsPage from "../pages/replied-emails"
import SequencesPage from "../pages/sequences"
import SequenceDesigner from "../pages/sequences/designer/SequenceDesigner"
import SettingsPage from "../pages/settings"
import UsersPage from "../pages/users/UsersPage"
import WorkspacesPage from "../pages/workspaces"

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
        ],
      },
    ],
  },
])
