import { User } from "lucide-react"
import { Suspense, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { NotificationBell } from "@/components/NotificationBell"
import { PageSkeleton, TableSkeleton } from "@/components/PageSkeleton"
import { ProfileCard } from "@/components/ProfileCard"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { useCurrentUser } from "@/lib/api/hooks/auth"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type DashboardContentProps = {
  children?: React.ReactNode
}

function DashboardContent({ children }: DashboardContentProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const pathname = location.pathname
  const pageName = getPageName(pathname, t)
  const [showProfileCard, setShowProfileCard] = useState(false)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )
  const { state } = useSidebar()

  // Use React Query to get current user (auto-updates when profile changes)
  const { data: currentUserData } = useCurrentUser()

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

  // 현재 로그인한 유저의 ID 가져오기 (fallback to localStorage)
  const currentUser = currentUserData || JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""

  // 유저의 trial 상태 확인
  const isTrialUser = currentUser?.trialStatus?.isTrialActive

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
  // Trial 사용자의 경우 "전체" 옵션을 숨김
  const workspaceOptions: WorkspaceOption[] = useMemo(() => {
    const baseOptions = [...workspaces]

    // Trial 사용자가 아닌 경우에만 "전체" 옵션 추가
    if (!isTrialUser) {
      baseOptions.unshift({
        value: "all",
        label: t("sidebar.workspace.all"),
        sublabel: t("sidebar.workspace.allSublabel"),
      })
    }

    return baseOptions
  }, [workspaces, t, isTrialUser])

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
    if (workspaces.length > 0) {
      // Trial 사용자가 "all"을 선택한 경우, 첫 번째 워크스페이스로 변경
      if (isTrialUser && selectedWorkspace === "all" && workspaces.length > 0) {
        setSelectedWorkspace(workspaces[0].value)
        return
      }

      // 선택된 워크스페이스가 유효하지 않은 경우
      if (selectedWorkspace !== "all") {
        const isValid = workspaces.some((ws) => ws.value === selectedWorkspace)
        if (!isValid) {
          // Trial 사용자는 첫 번째 워크스페이스로, 일반 사용자는 "all"로
          setSelectedWorkspace(isTrialUser && workspaces.length > 0 ? workspaces[0].value : "all")
        }
      }
    }
  }, [workspaces, selectedWorkspace, isTrialUser])

  return (
    <>
      <AppSidebar
        hideWorkspaceSelector={hideWorkspaceSelector}
        onWorkspaceChange={setSelectedWorkspace}
        selectedWorkspace={selectedWorkspace}
        workspaces={workspaces}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="z-50 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator className="mr-2 h-4" orientation="vertical" />
            {isSidebarCollapsed && !hideWorkspaceSelector && (
              <WorkspaceSelector
                className="mr-2"
                compact
                onValueChange={setSelectedWorkspace}
                options={workspaceOptions}
                value={selectedWorkspace}
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
          <div className="ml-auto flex items-center gap-3 px-4">
            {/* Notification Bell */}
            {userId && (
              <NotificationBell
                userId={userId}
                workspaceId={selectedWorkspace !== "all" ? selectedWorkspace : undefined}
              />
            )}

            {/* Profile Button */}
            <button
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200 transition-colors hover:bg-gray-300"
              onClick={() => setShowProfileCard(!showProfileCard)}
              type="button"
            >
              {currentUser?.profilePicture ? (
                <Avatar className="h-full w-full">
                  <AvatarImage alt="Profile" src={currentUser.profilePicture} />
                  <AvatarFallback className="bg-gray-200 text-gray-600 text-sm">
                    {currentUser?.username?.charAt(0)?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <User className="h-4 w-4 text-gray-600" />
              )}
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="h-full p-4">
            <Suspense fallback={getSkeletonForRoute(pathname)}>{children || <Outlet />}</Suspense>
          </div>
        </main>
      </div>

      {/* Profile Card - positioned at the top level for global access */}
      <ProfileCard
        isAdmin={currentUser?.userRole === "admin"}
        isOpen={showProfileCard}
        onAdminClick={() => {
          setShowProfileCard(false)
          // Already in admin panel
        }}
        onClose={() => setShowProfileCard(false)}
        onLogout={() => {
          setShowProfileCard(false)

          localStorage.removeItem("authToken")
          localStorage.removeItem("user")
          // Clear Jotai survey data to prevent stale data for next user
          localStorage.removeItem("rinda_survey_data")

          // Redirect all users to login page
          window.location.href = "/auth"
        }}
        user={{
          username: currentUser?.username || "Admin",
          email: currentUser?.email || "",
          image: currentUser?.profilePicture || null,
          userRole: currentUser?.userRole || "user",
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
    case "/gemini-search":
      return t("sidebar.menu.geminiSearch")
    case "/bigquery-search":
      return t("sidebar.menu.bigquerySearch")
    case "/lead-discovery":
      return t("layout.page.leadDiscovery")
    // IAM routes
    case "/iam/policies":
      return "정책 관리"
    case "/iam/roles":
      return "역할 관리"
    // Billing routes
    case "/billing/products":
      return "상품 관리"
    case "/billing/plans":
      return "요금제 관리"
    case "/billing/subscriptions":
      return "구독 관리"
    default:
      // Handle webset routes
      if (pathname.startsWith("/websets")) {
        return t("sidebar.menu.webset")
      }
      return "Overview"
  }
}

type DashboardLayoutProps = {
  children?: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <SidebarProvider defaultOpen={false}>
        <DashboardContent>{children}</DashboardContent>
      </SidebarProvider>
    </div>
  )
}
