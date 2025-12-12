import { Building2, Home, LogOut } from "lucide-react"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { LanguageSwitcher } from "@/components/LanguageSwitcher"
import { PageSkeleton } from "@/components/PageSkeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { useAuth } from "@/lib/auth-provider"

interface AppContentProps {
  children?: React.ReactNode
}

function AppContent({ children }: AppContentProps) {
  const { t } = useTranslation()
  const { logout, user } = useAuth()
  const { state } = useSidebar()
  const location = useLocation()
  const navigate = useNavigate()

  const isCollapsed = state === "collapsed"

  // Get user's workspaces to find the workspace ID
  const { data: userWorkspaces } = useUserWorkspaces(user?.id || "", !!user?.id)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Check if user has an email account connected
  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(
    workspaceId,
    user?.id || "",
    !!workspaceId && !!user?.id,
  )

  // Show Home tab only if user has an email account connected
  const hasEmailAccount = !!emailAccount

  // Custom logout handler - clears auth and navigates to trial page
  const handleLogout = () => {
    logout()
    navigate("/trial?from=logout")
  }

  const getPageName = (pathname: string) => {
    switch (pathname) {
      case "/company":
        return t("app.companyInfo.title", "Company Information")
      case "/dashboard":
        return t("app.dashboard.title", "Home")
      default:
        return t("app.companyInfo.title", "Company Information")
    }
  }

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b">
          <div className="flex items-center p-4">
            <span className="font-bold text-lg">{isCollapsed ? "R" : "RINDA"}</span>
          </div>
        </SidebarHeader>

        <SidebarContent className="p-2">
          <SidebarMenu>
            {hasEmailAccount && (
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t("app.sidebar.home", "Home")}>
                  <NavLink
                    to="/dashboard"
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                      }`
                    }
                  >
                    <Home className="h-4 w-4 shrink-0" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {t("app.sidebar.home", "Home")}
                    </span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t("app.sidebar.companyInfo", "Company Information")}
              >
                <NavLink
                  to="/company"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`
                  }
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">
                    {t("app.sidebar.companyInfo", "Company Information")}
                  </span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t p-2 space-y-1">
          <LanguageSwitcher className="w-full" />
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="w-full justify-center h-10 px-2 hover:bg-accent"
                >
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" align="center">
                {t("app.sidebar.logout", "Logout")}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="w-full justify-start h-10 px-3 py-2 hover:bg-accent"
            >
              <LogOut className="h-4 w-4 text-muted-foreground mr-3 shrink-0" />
              <span>{t("app.sidebar.logout", "Logout")}</span>
            </Button>
          )}
        </SidebarFooter>
      </Sidebar>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12 z-50">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>{getPageName(location.pathname)}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="p-4">
            <Suspense fallback={<PageSkeleton />}>{children || <Outlet />}</Suspense>
          </div>
        </main>
      </div>
    </>
  )
}

interface AppLayoutProps {
  children?: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <AppContent>{children}</AppContent>
        </SidebarProvider>
      </TooltipProvider>
    </div>
  )
}
