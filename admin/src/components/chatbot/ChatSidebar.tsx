import {
  ChevronLeft,
  ChevronRight,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ChatConversation } from "@/lib/api/hooks/chatbot"
import { cn } from "@/lib/utils"

type ChatSidebarProps = {
  collapsed: boolean
  onToggle: () => void
  conversations: ChatConversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  isLoading?: boolean
}

type DateGroup = {
  label: string
  conversations: ChatConversation[]
}

export function ChatSidebar({
  collapsed,
  onToggle,
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onDelete,
  isLoading,
}: ChatSidebarProps) {
  const { t } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
    const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

    const groups: DateGroup[] = [
      { label: t("chatbot.sidebar.today"), conversations: [] },
      { label: t("chatbot.sidebar.yesterday"), conversations: [] },
      { label: t("chatbot.sidebar.last7Days"), conversations: [] },
      { label: t("chatbot.sidebar.last30Days"), conversations: [] },
      { label: t("chatbot.sidebar.older"), conversations: [] },
    ]

    for (const conv of conversations) {
      const updatedAt = new Date(conv.updatedAt)

      if (updatedAt >= today) {
        groups[0].conversations.push(conv)
      } else if (updatedAt >= yesterday) {
        groups[1].conversations.push(conv)
      } else if (updatedAt >= last7Days) {
        groups[2].conversations.push(conv)
      } else if (updatedAt >= last30Days) {
        groups[3].conversations.push(conv)
      } else {
        groups[4].conversations.push(conv)
      }
    }

    // Filter out empty groups
    return groups.filter((group) => group.conversations.length > 0)
  }, [conversations, t])

  const handleStartEdit = useCallback((conv: ChatConversation) => {
    setEditingId(conv.id)
    setEditTitle(conv.title)
  }, [])

  const handleSaveEdit = useCallback(
    (id: string) => {
      if (editTitle.trim()) {
        onRename(id, editTitle.trim())
      }
      setEditingId(null)
      setEditTitle("")
    },
    [editTitle, onRename],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditTitle("")
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSaveEdit(id)
      } else if (e.key === "Escape") {
        handleCancelEdit()
      }
    },
    [handleSaveEdit, handleCancelEdit],
  )

  return (
    <div
      className={cn(
        "relative flex flex-col bg-muted/30 transition-all duration-300",
        collapsed ? "" : "w-64 border-border border-r",
      )}
    >
      {/* Toggle button - always visible */}
      <Button
        className={cn(
          "absolute top-3 z-10 h-7 w-7 rounded-full border border-border bg-background shadow-sm hover:bg-accent",
          // collapsed ? "left-2" : "right-2",
        )}
        onClick={onToggle}
        size="icon"
        variant="ghost"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Sidebar content */}
      {!collapsed && (
        <>
          {/* New Chat button */}
          <div className="p-3 pt-12">
            <Button className="w-full justify-start gap-2" onClick={onNew} variant="outline">
              <MessageSquarePlus className="h-4 w-4" />
              {t("chatbot.sidebar.newChat")}
            </Button>
          </div>

          {/* Conversations list */}
          <ScrollArea className="flex-1">
            <div className="px-2 pb-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
                  {t("chatbot.sidebar.loading")}
                </div>
              ) : groupedConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground text-sm">
                  <MessageSquarePlus className="mb-2 h-8 w-8 opacity-50" />
                  {t("chatbot.sidebar.empty")}
                </div>
              ) : (
                groupedConversations.map((group) => (
                  <div className="mt-4 first:mt-0" key={group.label}>
                    <div className="mb-2 px-2 font-medium text-muted-foreground text-xs">
                      {group.label}
                    </div>
                    <div className="space-y-0.5">
                      {group.conversations.map((conv) => (
                        <ConversationItem
                          conversation={conv}
                          editTitle={editTitle}
                          isActive={activeId === conv.id}
                          isEditing={editingId === conv.id}
                          key={conv.id}
                          onCancelEdit={handleCancelEdit}
                          onDelete={() => onDelete(conv.id)}
                          onEditTitleChange={setEditTitle}
                          onKeyDown={(e) => handleKeyDown(e, conv.id)}
                          onSaveEdit={() => handleSaveEdit(conv.id)}
                          onSelect={() => onSelect(conv.id)}
                          onStartEdit={() => handleStartEdit(conv)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}

type ConversationItemProps = {
  conversation: ChatConversation
  isActive: boolean
  isEditing: boolean
  editTitle: string
  onSelect: () => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onEditTitleChange: (title: string) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onDelete: () => void
  t: (key: string) => string
}

function ConversationItem({
  conversation,
  isActive,
  isEditing,
  editTitle,
  onSelect,
  onStartEdit,
  onSaveEdit,
  onCancelEdit: _onCancelEdit,
  onEditTitleChange,
  onKeyDown,
  onDelete,
  t,
}: ConversationItemProps) {
  // Note: _onCancelEdit is available but we use onBlur → onSaveEdit for better UX
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  if (isEditing) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-accent p-1">
        <Input
          autoFocus
          className="h-7 text-sm"
          onBlur={onSaveEdit}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={onKeyDown}
          value={editTitle}
        />
      </div>
    )
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: ignore
    <div
      className={cn(
        "group relative flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent",
        isActive && "bg-accent",
      )}
      onClick={onSelect}
    >
      <span className="flex-1 truncate">{conversation.title}</span>

      {/* Action menu - visible on hover or when open */}
      <DropdownMenu onOpenChange={setIsMenuOpen} open={isMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            className={cn(
              "h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
              isMenuOpen && "opacity-100",
            )}
            onClick={(e) => e.stopPropagation()}
            size="icon"
            variant="ghost"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen(false)
              onStartEdit()
            }}
          >
            <Pencil className="mr-2 h-4 w-4" />
            {t("chatbot.sidebar.rename")}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-destructive focus:text-destructive"
            onClick={(e) => {
              e.stopPropagation()
              setIsMenuOpen(false)
              onDelete()
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("chatbot.sidebar.delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
