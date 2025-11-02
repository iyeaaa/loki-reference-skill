import type { LucideIcon } from "lucide-react"
import { BarChart3, GitBranch, Mail, MessageSquare, Settings, UserCheck } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link, useLocation } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import type { WorkspaceOption } from "@/components/ui/workspace-selector"
import { WorkspaceSelector } from "@/components/ui/workspace-selector"
import { cn } from "@/lib/utils"

// Custom Menu Item Component
interface CustomMenuItemProps {
  title: string
  url: string
  icon: LucideIcon
  isActive: boolean
}

function CustomMenuItem({ title, url, icon: Icon, isActive }: CustomMenuItemProps) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        tooltip={title}
        isActive={isActive}
        className={cn(
          "relative h-11 px-3 py-2.5 transition-all duration-200 rounded-lg",
          isActive
            ? "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30 hover:bg-[#2563EB]/90 hover:shadow-lg hover:shadow-[#2563EB]/40"
            : "bg-transparent text-sidebar-foreground hover:bg-accent",
        )}
      >
        <Link to={url} className="flex items-center gap-3 w-full">
          <Icon
            className={cn("h-5 w-5 shrink-0", isActive ? "text-white" : "text-muted-foreground")}
          />
          <span className={cn("truncate", isActive ? "font-semibold text-white" : "font-normal")}>
            {title}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

// 메인 메뉴 아이템
const getMainMenuItems = (t: (key: string) => string) => [
  {
    title: t("sidebar.menu.dashboard"),
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: t("sidebar.menu.customerManagement"),
    url: "/leads",
    icon: UserCheck,
  },
  {
    title: t("sidebar.menu.campaign"),
    url: "/sequences",
    icon: GitBranch,
  },
  {
    title: t("sidebar.menu.reply"),
    url: "/replied-emails",
    icon: Mail,
  },
]

// AI 영업 자동화 메뉴
const getAIMenuItems = (t: (key: string) => string) => [
  {
    title: t("sidebar.menu.aiSalesAutomation"),
    url: "/chatbot",
    icon: MessageSquare,
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

  // 메뉴 아이템들 가져오기
  const mainMenuItems = getMainMenuItems(t)
  const aiMenuItems = getAIMenuItems(t)

  // "전체" 옵션을 포함한 워크스페이스 목록 생성
  const workspaceOptions: WorkspaceOption[] = [
    {
      value: "all",
      label: t("sidebar.workspace.all"),
      sublabel: t("sidebar.workspace.allSublabel"),
    },
    ...workspaces,
  ]

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center group-data-[collapsible=icon]:size-8">
                  <img
                    src="/images/rinda-logo.png"
                    alt="Rinda Logo"
                    className="size-8 object-contain rounded-xl"
                  />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{t("sidebar.title.sendGrinda")}</span>
                  <span className="truncate text-xs">{t("sidebar.subtitle.aiEmailSystem")}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 워크스페이스 선택 */}
        {!hideWorkspaceSelector && workspaceOptions.length > 0 && (
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="px-2 pb-2">
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
      <SidebarContent className="px-2">
        {/* 메뉴 */}
        <SidebarGroup className="py-0">
          <SidebarGroupLabel className="mb-2 px-2">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {aiMenuItems.map((item) => (
                <CustomMenuItem
                  key={item.title}
                  title={item.title}
                  url={item.url}
                  icon={item.icon}
                  isActive={pathname === item.url}
                />
              ))}
              {mainMenuItems.map((item) => (
                <CustomMenuItem
                  key={item.title}
                  title={item.title}
                  url={item.url}
                  icon={item.icon}
                  isActive={pathname === item.url}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-2">
        <SidebarMenu className="gap-1.5">
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("sidebar.menu.settings")}
              isActive={pathname === "/settings"}
              className={cn(
                "relative h-11 px-3 py-2.5 transition-all duration-200 rounded-lg",
                pathname === "/settings"
                  ? "bg-[#2563EB] text-white shadow-md shadow-[#2563EB]/30 hover:bg-[#2563EB]/90 hover:shadow-lg hover:shadow-[#2563EB]/40"
                  : "bg-transparent text-sidebar-foreground hover:bg-accent",
              )}
            >
              <Link to="/settings" className="flex items-center gap-3 w-full">
                <Settings
                  className={cn(
                    "h-5 w-5 shrink-0",
                    pathname === "/settings" ? "text-white" : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "truncate",
                    pathname === "/settings" ? "font-semibold text-white" : "font-normal",
                  )}
                >
                  {t("sidebar.menu.settings")}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="px-2 py-1">
              <LanguageSwitcher />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
