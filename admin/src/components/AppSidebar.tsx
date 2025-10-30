import { BarChart3, GitBranch, Mail, Settings, UserCheck } from "lucide-react"
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

// 워크스페이스 고객 관리
const getCustomerMenuItems = (t: (key: string) => string) => [
  {
    title: t("sidebar.menu.customerMonitoring"),
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: t("sidebar.menu.leadManagement"),
    url: "/leads",
    icon: UserCheck,
  },
  {
    title: t("sidebar.menu.followupSequenceManagement"),
    url: "/sequences",
    icon: GitBranch,
  },
  {
    title: t("sidebar.menu.replyManagement"),
    url: "/replied-emails",
    icon: Mail,
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
  const customerMenuItems = getCustomerMenuItems(t)

  // "전체" 옵션을 포함한 워크스페이스 목록 생성
  const workspaceOptions: WorkspaceOption[] = [
    {
      value: "all",
      label: t("sidebar.workspace.all"),
      sublabel: t("sidebar.workspace.allSublabel"),
    },
    ...workspaces,
  ]

  // 선택된 워크스페이스의 이름 가져오기
  const selectedWorkspaceData = workspaceOptions.find((w) => w.value === selectedWorkspace)
  const workspaceLabel = selectedWorkspaceData?.label || t("sidebar.workspace.default")

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
            <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70">
              {t("sidebar.workspace.select")}
            </div>
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
      <SidebarContent>
        {/* 워크스페이스 고객 관리 */}
        <SidebarGroup>
          <SidebarGroupLabel>
            {!hideWorkspaceSelector && <span className="font-semibold">{workspaceLabel}</span>}
            <span className={hideWorkspaceSelector ? "" : "ml-1"}>
              {t("sidebar.menu.customerManagement")}
            </span>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {customerMenuItems.map((item) => {
                const isActive = pathname === item.url
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                      className={isActive ? "bg-violet-500/10 border-r-2 border-violet-500" : ""}
                    >
                      <Link to={item.url || "#"}>
                        {item.icon && <item.icon className={isActive ? "text-violet-500" : ""} />}
                        <span className={isActive ? "text-violet-500 font-medium" : ""}>
                          {item.title}
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              tooltip={t("sidebar.menu.settings")}
              isActive={pathname === "/settings"}
            >
              <Link to="/settings">
                <Settings />
                <span>{t("sidebar.menu.settings")}</span>
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
