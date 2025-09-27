import { User } from "lucide-react"
import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { ProfileCard } from "@/components/ProfileCard"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"

const getPageName = (pathname: string) => {
  switch (pathname) {
    case "/dashboard":
      return "시스템 모니터링"
    case "/users":
      return "유저 관리"
    case "/translations":
      return "번역 관리"
    case "/settings":
      return "설정"
    default:
      return "Overview"
  }
}

export default function DashboardLayout() {
  const location = useLocation()
  const pathname = location.pathname
  const pageName = getPageName(pathname)
  const [showProfileCard, setShowProfileCard] = useState(false)

  return (
    <div className="h-screen flex overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50">
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
                    <BreadcrumbLink href="/dashboard">Rinda Expert</BreadcrumbLink>
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
            <div className="h-full p-4">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Profile Card - positioned at the top level for global access */}
        <ProfileCard
          isOpen={showProfileCard}
          onClose={() => setShowProfileCard(false)}
          user={{
            name: JSON.parse(localStorage.getItem("user") || "{}")?.username || "Admin",
            email: JSON.parse(localStorage.getItem("user") || "{}")?.email || "",
            image: null,
            user_role: JSON.parse(localStorage.getItem("user") || "{}")?.user_role || "user",
            department_name:
              JSON.parse(localStorage.getItem("user") || "{}")?.department_name || null,
            employee_id: JSON.parse(localStorage.getItem("user") || "{}")?.employee_id || null,
          }}
          isAdmin={JSON.parse(localStorage.getItem("user") || "{}")?.user_role === "admin"}
          onAdminClick={() => {
            setShowProfileCard(false)
            // Already in admin panel
          }}
          onLogout={() => {
            setShowProfileCard(false)
            localStorage.removeItem("authToken")
            localStorage.removeItem("user")
            window.location.href = "/login"
          }}
        />
      </SidebarProvider>
    </div>
  )
}
