import { motion } from "framer-motion"
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
import { iconRotateVariants, shouldReduceMotion } from "@/lib/animations"
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
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
      >
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
      </motion.div>
    </SidebarMenuItem>
  )
}

// 메인 메뉴 아이템 - Natural sales workflow order
const getMainMenuItems = (t: (key: string) => string) => [
  {
    title: t("sidebar.menu.aiSalesAutomation"),
    url: "/chatbot",
    icon: MessageSquare,
  },
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
          <SidebarGroupLabel className="mb-3 px-2 text-xs font-bold text-muted-foreground uppercase tracking-wide">
            MENU
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5 group-data-[collapsible=icon]:gap-8 group-data-[collapsible=icon]:items-center">
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
            isActive={pathname === "/settings"}
          />
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
