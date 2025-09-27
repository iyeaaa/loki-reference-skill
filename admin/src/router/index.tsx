import { createBrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/lib/auth-provider';
import RootLayout from '../layouts/RootLayout';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPage from '../pages/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import UsersPage from '../pages/users/UsersPage';
import BulletinBoardPage from '../pages/bulletin/BulletinBoardPage';
import EnvTestPage from '../pages/EnvTestPage';

function AuthWrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AuthWrapper><RootLayout /></AuthWrapper>,
    children: [
      {
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: '/',
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <DashboardPage />,
          },
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'users',
            element: <UsersPage />,
          },
          {
            path: 'bulletin',
            element: <BulletinBoardPage />,
          },
          {
            path: 'env-test',
            element: <EnvTestPage />,
          },
        ],
      },
    ],
  },
]);