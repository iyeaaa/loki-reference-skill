import { BarChart3, ClipboardList, Notebook, Settings, Users } from "lucide-react"
import { Link, useLocation } from "react-router-dom"
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

const menuItems = [
  {
    title: "Rinda Expert",
    url: "/dashboard",
    icon: BarChart3,
  },
  {
    title: "유저 관리",
    url: "/users",
    icon: Users,
  },
  {
    title: "게시판 테스트",
    url: "/bulletin",
    icon: ClipboardList,
  },
  {
    title: "Email Sequence",
    url: "/email-sequence",
    icon: ClipboardList,
  },
  {
    title: "주소록",
    url: "/address-book",
    icon: Notebook,
  },
]

export function AppSidebar() {
  const location = useLocation()
  const pathname = location.pathname

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
                  <span className="truncate font-semibold">Rinda Expert</span>
                  <span className="truncate text-xs">AI 이메일 자동화 시스템</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
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
