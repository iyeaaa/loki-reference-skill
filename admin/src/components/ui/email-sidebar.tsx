import { HelpCircle, Mail, MessageSquare, Minus, Star, ThumbsDown, ThumbsUp } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

export interface EmailSidebarItem {
  id: string
  label: string
  icon: React.ReactNode
  count?: number
}

export interface EmailSidebarSection {
  title: string
  items: EmailSidebarItem[]
}

export interface EmailSidebarProps {
  sections?: EmailSidebarSection[]
  activeItemId?: string
  onItemClick?: (itemId: string) => void
  className?: string
}

const defaultSections: EmailSidebarSection[] = [
  {
    title: "OVERVIEW",
    items: [
      {
        id: "all",
        label: "All",
        icon: <Mail className="h-4 w-4" />,
      },
      {
        id: "unread",
        label: "Unread",
        icon: <Mail className="h-4 w-4" />,
      },
      {
        id: "important",
        label: "Important",
        icon: <Star className="h-4 w-4" />,
      },
    ],
  },
  {
    title: "LABELS",
    items: [
      {
        id: "positive",
        label: "Positive",
        icon: <ThumbsUp className="h-4 w-4" />,
      },
      {
        id: "negative",
        label: "Negative",
        icon: <ThumbsDown className="h-4 w-4" />,
      },
      {
        id: "auto-messages",
        label: "Auto Messages",
        icon: <MessageSquare className="h-4 w-4" />,
      },
      {
        id: "other",
        label: "Other",
        icon: <Minus className="h-4 w-4" />,
      },
      {
        id: "unclassified",
        label: "Unclassified",
        icon: <HelpCircle className="h-4 w-4" />,
      },
    ],
  },
]

export function EmailSidebar({
  sections = defaultSections,
  activeItemId = "unread",
  onItemClick,
  className,
}: EmailSidebarProps) {
  const [activeId, setActiveId] = React.useState(activeItemId)

  React.useEffect(() => {
    setActiveId(activeItemId)
  }, [activeItemId])

  const handleItemClick = (itemId: string) => {
    setActiveId(itemId)
    onItemClick?.(itemId)
  }

  return (
    <div
      className={cn(
        "w-64 bg-background overflow-y-auto border rounded-lg ml-4 my-4 flex-shrink-0",
        className,
      )}
      style={{ height: "calc(100vh - 152px)" }}
    >
      <div className="py-4 px-3 space-y-6">
        {sections.map((section, sectionIndex) => (
          <div key={sectionIndex}>
            <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground tracking-wider">
              {section.title}
            </h3>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    activeId === item.id
                      ? "bg-accent text-accent-foreground font-medium"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex-shrink-0",
                      activeId === item.id ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {item.icon}
                  </span>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.count !== undefined && (
                    <span className="text-xs text-muted-foreground">{item.count}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
