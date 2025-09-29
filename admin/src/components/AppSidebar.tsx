import {
  BarChart3,
  Building2,
  GitBranch,
  Mail,
  Settings,
  UserCheck,
  Users,
  UsersRound,
} from "lucide-react"
import { Link, useLocation } from "react-router-dom"
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
  SidebarSeparator,
} from "@/components/ui/sidebar"
import type { WorkspaceOption } from "@/components/ui/workspace-selector"
import { WorkspaceSelector } from "@/components/ui/workspace-selector"

// 워크스페이스 고객 관리
const customerMenuItems = [
  {
    title: "고객 모니터링",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "전체 고객 관리",
    url: "/leads",
    icon: UserCheck,
  },
  {
    title: "고객 그룹 관리",
    url: "/customer-groups",
    icon: UsersRound,
  },
  {
    title: "팔로우업 시퀀스 관리",
    url: "/sequences",
    icon: GitBranch,
  },
  {
    title: "답장 관리",
    url: "/replied-emails",
    icon: Mail,
  },
]

// 시스템 관리
const adminMenuItems = [
  {
    title: "워크스페이스 관리",
    url: "/workspaces",
    icon: Building2,
  },
  {
    title: "유저 관리",
    url: "/users",
    icon: Users,
  },
]

interface AppSidebarProps {
  workspaces?: WorkspaceOption[]
  selectedWorkspace?: string
  onWorkspaceChange?: (value: string) => void
}

export function AppSidebar({
  workspaces = [],
  selectedWorkspace = "",
  onWorkspaceChange,
}: AppSidebarProps) {
  const location = useLocation()
  const pathname = location.pathname

  // 선택된 워크스페이스의 이름 가져오기
  const selectedWorkspaceData = workspaces.find((w) => w.value === selectedWorkspace)
  const workspaceLabel = selectedWorkspaceData?.label || "워크스페이스"

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
                  <span className="truncate font-semibold">Send Grinda</span>
                  <span className="truncate text-xs">AI 이메일 자동화 시스템</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* 워크스페이스 선택 */}
        {workspaces.length > 0 && (
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70">
              워크스페이스 선택
            </div>
            <div className="px-2 pb-2">
              <WorkspaceSelector
                options={workspaces}
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
            <span className="font-semibold">{workspaceLabel}</span>
            <span className="ml-1">고객 관리</span>
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

        <SidebarSeparator />

        {/* 시스템 관리 */}
        <SidebarGroup>
          <SidebarGroupLabel>시스템 관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => {
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
            <SidebarMenuButton asChild tooltip="설정" isActive={pathname === "/settings"}>
              <Link to="/settings">
                <Settings />
                <span>설정</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
