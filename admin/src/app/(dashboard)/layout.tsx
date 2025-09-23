'use client'

import { AppSidebar } from '@/components/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Separator } from '@/components/ui/separator'
import {
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'
import { ProfileCard } from '@/components/profile-card'
import { User } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { useSession, signOut } from 'next-auth/react'

const getPageName = (pathname: string) => {
  switch (pathname) {
    case '/dashboard':
      return '시스템 모니터링'
    case '/users':
      return '유저 관리'
    case '/translations':
      return '번역 관리'
    case '/settings':
      return '설정'
    default:
      return 'Overview'
  }
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session } = useSession()
  const pathname = usePathname()
  const pageName = getPageName(pathname)
  const [showProfileCard, setShowProfileCard] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 z-50">
            <div className="flex items-center gap-2 px-4">
              <SidebarTrigger className="-ml-1" />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink href="/dashboard">NTIS AI Insight</BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{pageName}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="ml-auto px-4">
              <button
                type="button"
                onClick={() => setShowProfileCard(!showProfileCard)}
                className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
              >
                <User className="h-4 w-4 text-gray-600" />
              </button>
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <div className="h-full p-4">{children}</div>
          </main>
        </div>

        {/* Profile Card - positioned at the top level for global access */}
        <ProfileCard
          isOpen={showProfileCard}
          onClose={() => setShowProfileCard(false)}
          user={{
            name: session?.user?.username || session?.user?.name || 'Admin',
            email: session?.user?.email || '',
            image: null,
            user_role: session?.user?.user_role || 'user',
            department_name: session?.user?.department_name || null,
            employee_id: session?.user?.employee_id || null,
          }}
          isAdmin={session?.user?.user_role === 'admin'}
          onAdminClick={() => {
            setShowProfileCard(false)
            // Already in admin panel
          }}
          onLogout={async () => {
            setShowProfileCard(false)
            await signOut({ callbackUrl: '/login' })
          }}
        />
      </SidebarProvider>
    </div>
  )
}
