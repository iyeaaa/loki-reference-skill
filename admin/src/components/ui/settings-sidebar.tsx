import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Mail,
  Settings,
  Upload,
  User,
  Users,
} from "lucide-react"
import { useState } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

export interface SettingsSidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick?: () => void
  type?: "item" | "separator" | "header"
}

export interface SettingsSidebarProps {
  items?: SettingsSidebarItem[]
  activeItemId?: string
  onItemClick?: (itemId: string) => void
  className?: string
  collapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
}

const defaultItems: SettingsSidebarItem[] = [
  {
    id: "profile",
    label: "Profile",
    icon: <User className="h-4 w-4" />,
  },
  {
    id: "signature",
    label: "Signature",
    icon: <Mail className="h-4 w-4" />,
  },
  {
    id: "workspace",
    label: "Workspace",
    icon: <Settings className="h-4 w-4" />,
  },
  {
    id: "admin",
    label: "Admin",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "email-templates",
    label: "Email Templates",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "bulk-lead-import",
    label: "Bulk Lead Import",
    icon: <Upload className="h-4 w-4" />,
  },
  {
    id: "web-extraction",
    label: "Web Data Extraction",
    icon: <Globe className="h-4 w-4" />,
  },
]

export function SettingsSidebar({
  items = defaultItems,
  activeItemId,
  onItemClick,
  className,
  collapsed = false,
  onCollapsedChange,
}: SettingsSidebarProps) {
  const [internalActiveId, setInternalActiveId] = useState<string | undefined>(activeItemId)

  const handleItemClick = (itemId: string) => {
    setInternalActiveId(itemId)
    onItemClick?.(itemId)
    items.find((item) => item.id === itemId)?.onClick?.()
  }

  const currentActiveId = activeItemId ?? internalActiveId

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "bg-background border-r border-border h-full flex flex-col transition-all duration-300 relative",
          "sm:shadow-none shadow-2xl",
          collapsed ? "w-14" : "w-[200px]",
          className,
        )}
      >
        {/* Collapse Toggle Button */}
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            className="hidden sm:flex absolute -right-3 top-4 z-10 h-6 w-6 items-center justify-center rounded-full border bg-background shadow-sm hover:bg-accent transition-colors"
            title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}

        {/* Menu Items */}
        <nav className="flex-1 px-2 py-2 overflow-y-auto">
          <ul className="space-y-0.5">
            {items.map((item) => {
              // Render separator
              if (item.type === "separator") {
                return (
                  <li key={item.id} className="my-2 px-2">
                    <div className="border-t border-border" />
                  </li>
                )
              }

              // Render header
              if (item.type === "header") {
                if (collapsed) {
                  return (
                    <li key={item.id} className="my-2 px-2">
                      <div className="border-t border-border" />
                    </li>
                  )
                }
                return (
                  <li key={item.id} className="mt-4 mb-2 px-2 first:mt-0">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {item.label}
                    </div>
                  </li>
                )
              }

              // Render normal menu item
              const isActive = currentActiveId === item.id

              const button = (
                <button
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-2 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive && "bg-accent text-accent-foreground",
                    collapsed ? "px-2.5 py-2 justify-center" : "px-2.5 py-2",
                  )}
                >
                  <span className={cn("flex-shrink-0", isActive && "text-primary")}>
                    {item.icon}
                  </span>
                  {!collapsed && <span className="text-left truncate">{item.label}</span>}
                </button>
              )

              if (collapsed) {
                return (
                  <li key={item.id}>
                    <Tooltip>
                      <TooltipTrigger asChild>{button}</TooltipTrigger>
                      <TooltipContent side="right" align="center">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  </li>
                )
              }

              return <li key={item.id}>{button}</li>
            })}
          </ul>
        </nav>
      </div>
    </TooltipProvider>
  )
}
