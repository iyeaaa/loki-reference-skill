import { Building2, LogOut } from "lucide-react"
import { Suspense } from "react"
import { useTranslation } from "react-i18next"
import { NavLink, Outlet, useLocation } from "react-router-dom"
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
import { useAuth } from "@/lib/auth-provider"

function AppContent() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const { state } = useSidebar()
  const location = useLocation()

  const isCollapsed = state === "collapsed"

  const getPageName = (pathname: string) => {
    switch (pathname) {
      case "/app":
        return t("app.companyInfo.title", "Company Information")
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
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip={t("app.sidebar.companyInfo", "Company Information")}
              >
                <NavLink
                  to="/app"
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
                  onClick={logout}
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
              onClick={logout}
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
            <Suspense fallback={<PageSkeleton />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </>
  )
}

export default function AppLayout() {
  return (
    <div className="h-screen flex overflow-hidden bg-background">
      <TooltipProvider>
        <SidebarProvider defaultOpen={false}>
          <AppContent />
        </SidebarProvider>
      </TooltipProvider>
    </div>
  )
}
