import { User } from "lucide-react"
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { AppSidebar } from "@/components/AppSidebar"
import { NotificationBell } from "@/components/NotificationBell"
import { PageSkeleton, TableSkeleton } from "@/components/PageSkeleton"
import { getUserDisplayTier, UserTierBadge } from "@/components/UserTierBadge"
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
import { useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useSequence } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { dispatchWorkspaceChange } from "@/lib/hooks/useWorkspace"
import { CampaignResumeCallout } from "@/pages/app/components/CampaignResumeCallout"

type DashboardContentProps = {
  children?: React.ReactNode
}

// localStorage에서 user 데이터를 한 번만 파싱 (렌더링 외부)
const getCachedLocalStorageUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}")
  } catch {
    return {}
  }
}

function DashboardContent({ children }: DashboardContentProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const pageName = getPageName(pathname, t)
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>(
    () => localStorage.getItem("selectedWorkspace") || "all",
  )
  const { state } = useSidebar()
  const params = useParams()
  const [searchParams] = useSearchParams()

  // Use React Query to get current user (auto-updates when profile changes)
  const { data: currentUserData } = useCurrentUser()

  // localStorage user를 ref로 캐싱 (매 렌더링마다 파싱 방지)
  const localStorageUserRef = useRef(getCachedLocalStorageUser())

  // 경로별로 적절한 스켈레톤 반환 (useCallback으로 안정화)
  const getSkeletonForRoute = useCallback((path: string) => {
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
  }, [])

  // 현재 로그인한 유저의 ID 가져오기 (fallback to cached localStorage)
  // useMemo로 안정적인 참조 유지
  const currentUser = useMemo(
    () => currentUserData || localStorageUserRef.current,
    [currentUserData],
  )
  const userId = currentUser?.id || ""

  // 유저의 trial 상태 확인
  const isTrialUser = Boolean(currentUser?.trialStatus?.isTrialActive)

  // 유저가 소유하거나 멤버인 워크스페이스 목록 가져오기
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // 온보딩 진행 상황 가져오기 (캠페인 콜아웃 표시용)
  const { data: onboardingProgress, refetch: refetchOnboardingProgress } = useOnboardingProgress(
    workspaceId,
    !!workspaceId && isTrialUser,
  )
  const sequenceId = onboardingProgress?.generatedSequenceId || ""
  const { data: sequence, refetch: refetchSequence } = useSequence(
    sequenceId,
    !!sequenceId && isTrialUser,
  )

  // 캠페인 콜아웃 표시 조건:
  // - Trial 사용자만
  // - 온보딩 완료됨
  // - 시퀀스가 있고 아직 활성화되지 않음 (draft 또는 ready 상태)
  const shouldShowCampaignCallout = useMemo(() => {
    if (!isTrialUser) {
      return false
    }
    if (!onboardingProgress?.completedAt) {
      return false
    }
    if (!sequence?.id) {
      return false
    }
    // 시퀀스가 draft 또는 ready 상태일 때만 표시 (활성화되지 않은 경우)
    return sequence.status === "draft" || sequence.status === "ready"
  }, [isTrialUser, onboardingProgress, sequence])

  // Workspace를 WorkspaceOption으로 변환 (메모이제이션으로 무한 루프 방지)
  const workspaces: WorkspaceOption[] = useMemo(
    () =>
      userWorkspaces?.map((ws) => ({
        value: ws.id,
        label: ws.name,
        sublabel: ws.description || "",
      })) || [],
    [userWorkspaces],
  )

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

    // 같은 탭의 다른 컴포넌트에 워크스페이스 변경 알림
    dispatchWorkspaceChange()
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
              <>
                <WorkspaceSelector
                  className="mr-2"
                  compact
                  onValueChange={setSelectedWorkspace}
                  options={workspaceOptions}
                  value={selectedWorkspace}
                />
                {(() => {
                  const tier = getUserDisplayTier(currentUser)
                  return tier ? <UserTierBadge className="mr-2" size="sm" tier={tier} /> : null
                })()}
              </>
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
                workspaceId={selectedWorkspace !== "all" ? selectedWorkspace : undefined}
              />
            )}

            {/* Profile Button - Navigate to Settings */}
            <button
              className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gray-200 transition-colors hover:bg-gray-300"
              onClick={() => navigate("/settings")}
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
            {/* 캠페인 활성화 콜아웃 - 모든 페이지에서 표시 (온보딩 중 제외) */}
            {shouldShowCampaignCallout &&
              sequenceId &&
              !params.step &&
              !searchParams.get("step") && (
                <div className="mb-4">
                  <CampaignResumeCallout
                    onComplete={() => {
                      refetchSequence()
                      refetchOnboardingProgress()
                    }}
                    sequenceId={sequenceId}
                  />
                </div>
              )}
            <Suspense fallback={getSkeletonForRoute(pathname)}>{children || <Outlet />}</Suspense>
          </div>
        </main>
      </div>
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
