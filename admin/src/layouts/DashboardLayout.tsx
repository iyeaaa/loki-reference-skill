import { User } from "lucide-react"
import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { ProfileCard } from "@/components/ProfileCard"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import type { WorkspaceOption } from "@/components/ui/workspace-selector"
import { WorkspaceSelector } from "@/components/ui/workspace-selector"

function DashboardContent() {
  const location = useLocation()
  const pathname = location.pathname
  const pageName = getPageName(pathname)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>("workspace1")
  const { state } = useSidebar()

  // 예시 워크스페이스 데이터
  const workspaces: WorkspaceOption[] = [
    { value: "workspace1", label: "루카스에듀테인먼트", sublabel: "lukas@tam9.me" },
    { value: "workspace2", label: "예지상사", sublabel: "yamy0612@naver.com" },
    { value: "workspace3", label: "익투스", sublabel: "ictuskorea@gmail.com" },
    { value: "workspace4", label: "리오닉스", sublabel: "rionix@kakao.com" },
    { value: "workspace5", label: "브이시드니", sublabel: "vmsydney@gmail.com" },
  ]

  const isSidebarCollapsed = state === "collapsed"

  return (
    <>
      <AppSidebar
        workspaces={workspaces}
        selectedWorkspace={selectedWorkspace}
        onWorkspaceChange={setSelectedWorkspace}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 z-50">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {isSidebarCollapsed && (
              <WorkspaceSelector
                options={workspaces}
                value={selectedWorkspace}
                onValueChange={setSelectedWorkspace}
                className="mr-2"
                compact
              />
            )}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{pageName}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto flex items-center gap-7 px-4">
            <button
              type="button"
              onClick={() => setShowProfileCard(!showProfileCard)}
              className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
            >
              <User className="h-4 w-4 text-gray-600" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
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
    </>
  )
}

const getPageName = (pathname: string) => {
  switch (pathname) {
    case "/dashboard":
      return "고객 모니터링"
    case "/leads":
      return "전체 고객 관리"
    case "/customer-groups":
      return "고객 그룹 관리"
    case "/sequences":
      return "팔로우업 시퀀스 관리"
    case "/email-templates":
      return "메일 템플릿 관리"
    case "/replied-emails":
      return "고객 답장 관리"
    case "/workspaces":
      return "워크스페이스 관리"
    case "/users":
      return "유저 관리"
    case "/settings":
      return "설정"
    default:
      return "Overview"
  }
}

export default function DashboardLayout() {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <SidebarProvider>
        <DashboardContent />
      </SidebarProvider>
    </div>
  )
}
