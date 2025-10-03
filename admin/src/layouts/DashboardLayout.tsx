import { User } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
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
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

function DashboardContent() {
  const location = useLocation()
  const pathname = location.pathname
  const pageName = getPageName(pathname)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => {
    return localStorage.getItem("selectedWorkspace") || "all"
  })
  const { state } = useSidebar()

  // 현재 로그인한 유저의 ID 가져오기
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""

  // 유저가 소유하거나 멤버인 워크스페이스 목록 가져오기
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)

  // Workspace를 WorkspaceOption으로 변환
  const workspaces: WorkspaceOption[] =
    userWorkspaces?.map((ws) => ({
      value: ws.id,
      label: ws.name,
      sublabel: ws.description || "",
    })) || []

  const isSidebarCollapsed = state === "collapsed"

  // 워크스페이스 선택기를 숨길 페이지 목록
  const hideWorkspaceSelector = false

  // "전체" 옵션을 포함한 워크스페이스 목록 생성 (useMemo로 메모이제이션)
  const workspaceOptions: WorkspaceOption[] = useMemo(
    () => [{ value: "all", label: "전체", sublabel: "모든 워크스페이스 보기" }, ...workspaces],
    [workspaces],
  )

  // 디버깅: 워크스페이스 정보 확인
  useEffect(() => {
    console.log("Workspace Debug:", {
      workspaces,
      workspaceOptions,
      hideWorkspaceSelector,
      pathname,
      selectedWorkspace,
    })
  }, [workspaces, workspaceOptions, pathname, selectedWorkspace])

  // 선택된 워크스페이스를 localStorage에 저장
  useEffect(() => {
    localStorage.setItem("selectedWorkspace", selectedWorkspace)
  }, [selectedWorkspace])

  // 워크스페이스 목록이 로드되었을 때, 선택된 워크스페이스가 유효한지 확인
  useEffect(() => {
    if (workspaces.length > 0 && selectedWorkspace !== "all") {
      const isValid = workspaces.some((ws) => ws.value === selectedWorkspace)
      if (!isValid) {
        setSelectedWorkspace("all")
      }
    }
  }, [workspaces, selectedWorkspace])

  return (
    <>
      <AppSidebar
        workspaces={workspaces}
        selectedWorkspace={selectedWorkspace}
        onWorkspaceChange={setSelectedWorkspace}
        hideWorkspaceSelector={hideWorkspaceSelector}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 z-50">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            {isSidebarCollapsed && !hideWorkspaceSelector && (
              <WorkspaceSelector
                options={workspaceOptions}
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
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[400px]">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
                </div>
              }
            >
              <Outlet />
            </Suspense>
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
    case "/email-send-test":
      return "메일 발송 테스트"
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
