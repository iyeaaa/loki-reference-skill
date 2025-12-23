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
import { Fragment, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { UpgradePlanModal } from "@/components/UpgradePlanModal"
import { getUserDisplayTier, UserTierBadge } from "@/components/UserTierBadge"
import { Button } from "@/components/ui/button"
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
import { useAuth } from "@/lib/auth-provider"
import {
  IAM_ACTIONS,
  IAM_RESOURCES,
  type IamAction,
  type IamResource,
} from "@/lib/constants/iam-resources"
import { usePermissions } from "@/lib/permission"
import { cn } from "@/lib/utils"

// Custom Menu Item Component
type CustomMenuItemProps = {
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
        className={cn(
          "group relative h-11 rounded-lg px-3 py-2.5 transition-all duration-200",
          isActive
            ? "bg-[#2563EB] text-white shadow-sm hover:bg-[#2563EB]/95"
            : "bg-transparent text-sidebar-foreground hover:bg-accent/50",
        )}
        isActive={isActive}
        tooltip={title}
      >
        <Link className="flex w-full items-center gap-3" to={url}>
          {reducedMotion ? (
            <Icon
              className={cn(
                "h-5 w-5 shrink-0 transition-transform group-hover:scale-105",
                isActive ? "text-white" : "text-muted-foreground",
              )}
            />
          ) : (
            <motion.div initial="rest" variants={iconRotateVariants} whileHover="hover">
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
type MenuItem = {
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

type AppSidebarProps = {
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
  const { user } = useAuth()
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false)

  // 권한 컨텍스트
  const { isAdmin, hasPermission, isLoading: permissionLoading } = usePermissions()

  // 메뉴 아이템들 가져오기
  const allMenuItems = getMainMenuItems(t)

  // 권한에 따라 메뉴 필터링
  const mainMenuItems = useMemo(() => {
    // 권한 로딩 중이면 빈 배열 (깜박임 방지)
    if (permissionLoading) {
      return []
    }

    // Admin은 모든 메뉴 표시
    if (isAdmin) {
      return allMenuItems
    }

    // 권한에 따라 필터링
    const filteredItems = allMenuItems.filter((item) => {
      // "public"이면 모든 인증된 사용자 접근 가능
      if (item.permission === "public") {
        return true
      }

      // permission이 없으면(undefined) Admin만 접근 가능 → 일반 사용자는 숨김
      if (!item.permission) {
        return false
      }

      // 권한 체크
      return hasPermission(item.permission.resource, item.permission.action)
    })

    return filteredItems
  }, [allMenuItems, isAdmin, hasPermission, permissionLoading])

  // "전체" 옵션을 포함한 워크스페이스 목록 생성
  // Admin 사용자만 "전체" 옵션 표시
  const workspaceOptions: WorkspaceOption[] = isAdmin
    ? [
        {
          value: "all",
          label: t("sidebar.workspace.all"),
          sublabel: t("sidebar.workspace.allSublabel"),
        },
        ...workspaces,
      ]
    : workspaces

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-0">
        {/* Logo row - matches main header height */}
        <div className="flex h-16 items-center border-sidebar-border border-b px-2 group-data-[collapsible=icon]:h-12">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild className="hover:bg-transparent" size="lg">
                <Link to="/dashboard">
                  <div className="flex aspect-square size-10 items-center justify-center group-data-[collapsible=icon]:size-8">
                    <img
                      alt="Rinda Logo"
                      className="size-10 rounded-xl object-contain group-data-[collapsible=icon]:size-8"
                      src="/images/rinda-logo.png"
                    />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-bold text-base">
                      {t("sidebar.title.sendGrinda")}
                    </span>
                    <span className="truncate text-muted-foreground text-xs">
                      {t("sidebar.subtitle.aiEmailSystem")}
                    </span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>

        {/* 워크스페이스 선택 */}
        {!hideWorkspaceSelector && workspaceOptions.length > 0 && (
          <div className="p-2 group-data-[collapsible=icon]:hidden">
            <WorkspaceSelector
              className="w-full"
              onValueChange={onWorkspaceChange}
              options={workspaceOptions}
              value={selectedWorkspace}
            />
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-8">
        {/* Main Menu Section - Natural workflow order */}
        <SidebarGroup className="py-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-8">
              {mainMenuItems.map((item, index) => (
                <Fragment key={item.title}>
                  <CustomMenuItem
                    icon={item.icon}
                    isActive={pathname === item.url}
                    title={item.title}
                    url={item.url}
                  />
                  {/* 대시보드(첫번째) 밑에 구분선 */}
                  {index === 0 && mainMenuItems.length > 2 && (
                    <div className="my-3 border-sidebar-border border-t group-data-[collapsible=icon]:hidden" />
                  )}
                  {/* Rinda GPT(마지막) 위에 구분선 - 메뉴가 3개 이상일 때만 */}
                  {index === mainMenuItems.length - 2 && mainMenuItems.length > 2 && (
                    <div className="my-3 border-sidebar-border border-t group-data-[collapsible=icon]:hidden" />
                  )}
                </Fragment>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-sidebar-border border-t px-3 py-4 group-data-[collapsible=icon]:px-2 group-data-[collapsible=icon]:py-4">
        {/* User info and Settings */}
        <SidebarMenu className="gap-2 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-4">
          {/* 사용자 정보 + 설정 아이콘 (펼쳐졌을 때) */}
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <div className="flex flex-col gap-0.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-sm">
                    {user?.username || t("common.user")}
                  </span>
                  {user &&
                    (() => {
                      const tier = getUserDisplayTier(user)
                      return tier ? <UserTierBadge size="sm" tier={tier} /> : null
                    })()}
                </div>
                <span className="truncate text-muted-foreground text-xs">{user?.email}</span>
              </div>
              <Link
                className={cn(
                  "ml-2 shrink-0 rounded-md p-1.5 transition-colors hover:bg-accent",
                  (pathname === "/settings" || pathname === "/company") &&
                    "bg-accent text-accent-foreground",
                )}
                to="/settings"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </SidebarMenuItem>
          {/* 업그레이드 CTA (Trial 사용자만, 펼쳐졌을 때) */}
          {user?.trialStatus?.isTrialActive && (
            <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
              <Button
                className="h-9 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700"
                onClick={() => setIsUpgradeModalOpen(true)}
                size="sm"
              >
                {t("sidebar.upgrade.button")}
              </Button>
            </SidebarMenuItem>
          )}
          {/* 설정 아이콘만 (접혔을 때) */}
          <div className="hidden group-data-[collapsible=icon]:block">
            <CustomMenuItem
              icon={Settings}
              isActive={pathname === "/settings" || pathname === "/company"}
              title={t("sidebar.menu.settings")}
              url="/settings"
            />
          </div>
        </SidebarMenu>
      </SidebarFooter>

      {/* 업그레이드 모달 */}
      <UpgradePlanModal onOpenChange={setIsUpgradeModalOpen} open={isUpgradeModalOpen} />
    </Sidebar>
  )
}
