import { User } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { PageSkeleton, TableSkeleton } from "@/components/PageSkeleton"
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
  const { t } = useTranslation()
  const location = useLocation()
  const pathname = location.pathname
  const pageName = getPageName(pathname, t)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(() => {
    return localStorage.getItem("selectedWorkspace") || "all"
  })
  const { state } = useSidebar()

  // 경로별로 적절한 스켈레톤 반환
  const getSkeletonForRoute = (path: string) => {
    // 테이블 형태의 페이지들
    const tablePages = [
      "/leads",
      "/sequences",
      "/email-templates",
      "/replied-emails",
      "/users",
      "/workspaces",
    ]
    if (tablePages.includes(path)) {
      return <TableSkeleton />
    }
    // 대시보드나 기타 페이지
    return <PageSkeleton />
  }

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
    () => [
      {
        value: "all",
        label: t("sidebar.workspace.all"),
        sublabel: t("sidebar.workspace.allSublabel"),
      },
      ...workspaces,
    ],
    [workspaces, t],
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

    // 워크스페이스 이름도 함께 저장
    if (selectedWorkspace === "all") {
      localStorage.setItem("selectedWorkspaceName", t("sidebar.workspace.all"))
    } else {
      const workspace = workspaces.find((ws) => ws.value === selectedWorkspace)
      if (workspace) {
        localStorage.setItem("selectedWorkspaceName", workspace.label)
      }
    }
  }, [selectedWorkspace, workspaces, t])

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
            <Suspense fallback={getSkeletonForRoute(pathname)}>
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

const getPageName = (pathname: string, t: (key: string) => string) => {
  switch (pathname) {
    case "/dashboard":
      return t("sidebar.menu.dashboard")
    case "/leads":
      return t("sidebar.menu.customerManagement")
    case "/customer-groups":
      return t("layout.page.customerGroupManagement")
    case "/sequences":
      return t("sidebar.menu.campaign")
    case "/email-templates":
      return t("layout.page.emailTemplateManagement")
    case "/replied-emails":
      return t("sidebar.menu.reply")
    case "/workspaces":
      return t("layout.page.workspaceManagement")
    case "/users":
      return t("layout.page.userManagement")
    case "/email-send-test":
      return t("layout.page.emailSendTest")
    case "/chatbot":
      return t("sidebar.menu.aiSalesAutomation")
    case "/settings":
      return t("sidebar.menu.settings")
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
