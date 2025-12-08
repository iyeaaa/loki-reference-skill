import { FileText, Globe, Mail, Settings, Upload, User, Users } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface SettingsSidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  onClick?: () => void
}

export interface SettingsSidebarProps {
  title?: string
  subtitle?: string
  items?: SettingsSidebarItem[]
  activeItemId?: string
  onItemClick?: (itemId: string) => void
  className?: string
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
  title = "Settings & System Management",
  subtitle = "Manage your account and system",
  items = defaultItems,
  activeItemId,
  onItemClick,
  className,
}: SettingsSidebarProps) {
  const [internalActiveId, setInternalActiveId] = useState<string | undefined>(activeItemId)

  const handleItemClick = (itemId: string) => {
    setInternalActiveId(itemId)
    onItemClick?.(itemId)
    items.find((item) => item.id === itemId)?.onClick?.()
  }

  const currentActiveId = activeItemId ?? internalActiveId

  return (
    <div
      className={cn(
        "w-full max-w-sm bg-background border-r border-border h-full flex flex-col",
        "lg:shadow-none shadow-2xl", // Add shadow on mobile
        className,
      )}
    >
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-start gap-2 mb-2">
          <Settings className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <h2 className="text-lg font-semibold leading-tight">{title}</h2>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 p-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const isActive = currentActiveId === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    isActive && "bg-accent text-accent-foreground",
                  )}
                >
                  <span className={cn("flex-shrink-0", isActive && "text-primary")}>
                    {item.icon}
                  </span>
                  <span className="text-left">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
