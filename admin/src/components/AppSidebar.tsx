import { BarChart3, FileText, GitBranch, Mail, Settings, UserCheck } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
import { LanguageToggle } from "@/components/LanguageToggle"
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
const customerMenuItems = [
  {
    title: "고객 모니터링",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "고객 관리",
    url: "/leads",
    icon: UserCheck,
  },
  {
    title: "팔로우업 시퀀스 관리",
    url: "/sequences",
    icon: GitBranch,
  },
  {
    title: "이메일 템플릿 관리",
    url: "/email-templates",
    icon: FileText,
  },
  {
    title: "답장 관리",
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
  const location = useLocation()
  const pathname = location.pathname

  // "전체" 옵션을 포함한 워크스페이스 목록 생성
  const workspaceOptions: WorkspaceOption[] = [
    { value: "all", label: "전체", sublabel: "모든 워크스페이스 보기" },
    ...workspaces,
  ]

  // 선택된 워크스페이스의 이름 가져오기
  const selectedWorkspaceData = workspaceOptions.find((w) => w.value === selectedWorkspace)
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
        {!hideWorkspaceSelector && workspaceOptions.length > 0 && (
          <div className="group-data-[collapsible=icon]:hidden">
            <div className="flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-sidebar-foreground/70">
              워크스페이스 선택
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
            <span className={hideWorkspaceSelector ? "" : "ml-1"}>고객 관리</span>
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
            <SidebarMenuButton asChild tooltip="설정" isActive={pathname === "/settings"}>
              <Link to="/settings">
                <Settings />
                <span>설정</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <div className="px-2 py-1">
              <LanguageToggle />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
