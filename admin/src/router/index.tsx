import { createBrowserRouter } from "react-router-dom"
import { ProtectedRoute } from "@/components/ProtectedRoute"
import { AuthProvider } from "@/lib/auth-provider"
import DashboardLayout from "../layouts/DashboardLayout"
import RootLayout from "../layouts/RootLayout"
import DashboardPage from "../pages/dashboard/DashboardPage"
import LoginPage from "../pages/LoginPage"
import LeadsPage from "../pages/leads"
import RepliedEmailsPage from "../pages/replied-emails"
import SequencesPage from "../pages/sequences"
import UsersPage from "../pages/users/UsersPage"

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
            path: "users",
            element: <UsersPage />,
          },
          {
            path: "sequences",
            element: <SequencesPage />,
          },
          {
            path: "leads",
            element: <LeadsPage />,
          },
          {
            path: "replied-emails",
            element: <RepliedEmailsPage />,
          },
        ],
      },
    ],
  },
])
