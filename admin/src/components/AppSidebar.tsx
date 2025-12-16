import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import {
  BarChart3,
  Compass,
  // Database, // TODO: BigQuery Search 기능 완성 후 주석 해제
  GitBranch,
  Home,
  Mail,
  MessageSquare,
  // Search, // TODO: Webset 기능 완성 후 주석 해제
  Settings,
  // Sparkles, // TODO: Gemini Search 기능 완성 후 주석 해제
  UserCheck,
} from "lucide-react"
import { Fragment, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { WorkspaceOption } from "@/components/ui/workspace-selector"
import { WorkspaceSelector } from "@/components/ui/workspace-selector"
import { iconRotateVariants, shouldReduceMotion } from "@/lib/animations"
import {
  IAM_ACTIONS,
  IAM_RESOURCES,
  type IamAction,
  type IamResource,
} from "@/lib/constants/iam-resources"
import { usePermissions } from "@/lib/permission"
import { cn } from "@/lib/utils"

// Custom Menu Item Component
interface CustomMenuItemProps {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean
}

function CustomMenuItem({ title, url, icon: Icon, isActive }: CustomMenuItemProps) {
  const reducedMotion = shouldReduceMotion()

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={title}
        isActive={isActive}
        className={cn(
          "relative h-11 px-3 py-2.5 transition-all duration-200 rounded-lg group",
          isActive
            ? "bg-[#2563EB] text-white shadow-sm hover:bg-[#2563EB]/95"
            : "bg-transparent text-sidebar-foreground hover:bg-accent/50",
        )}
      >
        <Link to={url} className="flex items-center gap-3 w-full">
          {reducedMotion ? (
            <Icon
              className={cn(
                "h-5 w-5 shrink-0 transition-transform group-hover:scale-105",
                isActive ? "text-white" : "text-muted-foreground",
              )}
            />
          ) : (
            <motion.div variants={iconRotateVariants} initial="rest" whileHover="hover">
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-white" : "text-muted-foreground",
                )}
              />
            </motion.div>
          )}
          <span
            className={cn(
              "truncate text-sm group-data-[collapsible=icon]:hidden",
              isActive ? "font-medium text-white" : "font-normal",
            )}
          >
            {title}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// 메뉴 아이템 인터페이스 (권한 정보 포함)
interface MenuItem {
  title: string
  url: string
  icon: LucideIcon
  /**
   * 권한 설정:
   * - { resource, action }: 해당 권한 보유자만 접근 가능
   * - "public": 모든 인증된 사용자 접근 가능
   * - 미설정(undefined): Admin만 접근 가능 (기본값 = 보안 우선)
   */
  permission?: { resource: IamResource; action: IamAction } | "public"
}

/**
 * 메인 메뉴 아이템 - Natural sales workflow order
 *
 * 권한 매핑 (AWS IAM 스타일):
 * - "public": 모든 인증된 사용자 접근 가능
 * - { resource, action }: 해당 권한 보유자만 접근 가능
 *
 * Resource/Action 매핑:
 * - 홈: public
 * - 분석: analytics:read
 * - 고객 탐색: leads:discovery:read
 * - 고객 관리: leads:list
 * - 캠페인: sequences:list
 * - 인박스: emails:list
 * - Rinda GPT: ai:chatbot:execute
 */
const getMainMenuItems = (t: (key: string) => string): MenuItem[] => [
  {
    title: t("sidebar.menu.home"),
    url: "/dashboard",
    icon: Home,
    permission: "public",
  },
  {
    title: t("sidebar.menu.leadDiscovery"),
    url: "/lead-discovery",
    icon: Compass,
    permission: { resource: IAM_RESOURCES.LEADS_DISCOVERY, action: IAM_ACTIONS.READ },
  },
  {
    title: t("sidebar.menu.customerManagement"),
    url: "/leads",
    icon: UserCheck,
    permission: { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },
  },
  {
    title: t("sidebar.menu.campaign"),
    url: "/sequences",
    icon: GitBranch,
    permission: { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },
  },
  {
    title: t("sidebar.menu.reply"),
    url: "/replied-emails",
    icon: Mail,
    permission: { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.LIST },
  },
  {
    title: t("sidebar.menu.analytics"),
    url: "/analytics",
    icon: BarChart3,
    permission: { resource: IAM_RESOURCES.ANALYTICS, action: IAM_ACTIONS.READ },
  },
  // {
  //   title: t("sidebar.menu.geminiSearch"),
  //   url: "/gemini-search",
  //   icon: Sparkles,
  //   permission: "public", // 모든 인증된 사용자
  // },
  // {
  //   title: t("sidebar.menu.webset"),
  //   url: "/websets",
  //   icon: Search,
  //   permission: "public",
  // },
  // TODO: BigQuery Search 기능 완성 후 주석 해제
  // {
  //   title: t("sidebar.menu.bigquerySearch"),
  //   url: "/bigquery-search",
  //   icon: Database,
  //   permission: "public",
  // },
  {
    title: t("sidebar.menu.aiSalesAutomation"),
    url: "/chatbot",
    icon: MessageSquare,
    permission: { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },
  },
]

interface AppSidebarProps {
  workspaces?: WorkspaceOption[]
  selectedWorkspace?: string
  onWorkspaceChange?: (value: string) => void
  hideWorkspaceSelector?: boolean
}

export function AppSidebar({
  workspaces = [],
  selectedWorkspace = "",
  onWorkspaceChange,
  hideWorkspaceSelector = false,
}: AppSidebarProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const pathname = location.pathname

  // 권한 컨텍스트
  const { isAdmin, hasPermission, isLoading: permissionLoading } = usePermissions()

  // 현재 로그인한 유저 정보
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")

  // 메뉴 아이템들 가져오기
  const allMenuItems = getMainMenuItems(t)

  // 권한에 따라 메뉴 필터링
  const mainMenuItems = useMemo(() => {
    // 권한 로딩 중이면 빈 배열 (깜박임 방지)
    if (permissionLoading) return []

    // Admin은 모든 메뉴 표시
    if (isAdmin) {
      return allMenuItems
    }

    // 권한에 따라 필터링
    const filteredItems = allMenuItems.filter((item) => {
      // "public"이면 모든 인증된 사용자 접근 가능
      if (item.permission === "public") return true

      // permission이 없으면(undefined) Admin만 접근 가능 → 일반 사용자는 숨김
      if (!item.permission) return false

      // 권한 체크
      return hasPermission(item.permission.resource, item.permission.action)
    })

    return filteredItems
  }, [allMenuItems, isAdmin, hasPermission, permissionLoading])
  const isTrialUser = currentUser?.trialStatus?.isTrialActive || false

  // "전체" 옵션을 포함한 워크스페이스 목록 생성
  // Trial 사용자의 경우 "전체" 옵션을 숨김
  const workspaceOptions: WorkspaceOption[] = isTrialUser
    ? [...workspaces]
    : [
        {
          value: "all",
          label: t("sidebar.workspace.all"),
          sublabel: t("sidebar.workspace.allSublabel"),
        },
        ...workspaces,
      ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border pb-3 group-data-[collapsible=icon]:pb-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="hover:bg-transparent">
              <Link to="/dashboard">
                <div className="flex aspect-square size-10 items-center justify-center group-data-[collapsible=icon]:size-8">
                  <img
                    src="/images/rinda-logo.png"
                    alt="Rinda Logo"
                    className="size-10 object-contain rounded-xl group-data-[collapsible=icon]:size-8"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-bold text-base">
                    {t("sidebar.title.sendGrinda")}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t("sidebar.subtitle.aiEmailSystem")}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 워크스페이스 선택 */}
        {!hideWorkspaceSelector && workspaceOptions.length > 0 && (
          <div className="group-data-[collapsible=icon]:hidden mt-3">
            <div className="px-2">
              <WorkspaceSelector
                options={workspaceOptions}
                value={selectedWorkspace}
                onValueChange={onWorkspaceChange}
                className="w-full"
              />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-8">
        {/* Main Menu Section - Natural workflow order */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-8 group-data-[collapsible=icon]:items-center">
              {mainMenuItems.map((item, index) => (
                <Fragment key={item.title}>
                  <CustomMenuItem
                    title={item.title}
                    url={item.url}
                    icon={item.icon}
                    isActive={pathname === item.url}
                  />
                  {/* 대시보드(첫번째) 밑에 구분선 */}
                  {index === 0 && (
                    <div className="my-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden" />
                  )}
                  {/* Rinda GPT(마지막) 위에 구분선 */}
                  {index === mainMenuItems.length - 2 && (
                    <div className="my-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden" />
                  )}
                </Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border px-3 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-8">
        {/* Language and Settings */}
        <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-8 group-data-[collapsible=icon]:items-center">
          <SidebarMenuItem>
            <LanguageSwitcher className="w-full" />
          </SidebarMenuItem>
          <CustomMenuItem
            title={t("sidebar.menu.settings")}
            url="/settings"
            icon={Settings}
            isActive={pathname === "/settings" || pathname === "/company"}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
