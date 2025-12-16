import { AlertCircle } from "lucide-react"
import { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChatInterface } from "@/components/chatbot/ChatInterface"
import { ChatSidebar } from "@/components/chatbot/ChatSidebar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  useConversations,
  useCreateConversation,
  useDeleteConversation,
  useGenerateConversationTitle,
  useUpdateConversationTitle,
} from "@/lib/api/hooks/chatbot"
import { useAuth } from "@/lib/auth-provider"
import { useWorkspace } from "@/lib/hooks/useWorkspace"
import { cn } from "@/lib/utils"

export default function ChatbotPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()
  const { user } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)

  // Queries and mutations
  const { data: conversations = [], isLoading: isLoadingConversations } = useConversations(
    selectedWorkspace?.id || "",
    user?.id || "",
    !!selectedWorkspace?.id && selectedWorkspace.id !== "all" && !!user?.id,
  )

  const createConversation = useCreateConversation()
  const updateTitle = useUpdateConversationTitle()
  const deleteConversation = useDeleteConversation()
  const generateTitle = useGenerateConversationTitle()

  // Handlers
  const handleNewChat = useCallback(() => {
    setCurrentConversationId(null)
  }, [])

  const handleSelectConversation = useCallback((id: string) => {
    setCurrentConversationId(id)
  }, [])

  const handleRenameConversation = useCallback(
    (id: string, title: string) => {
      updateTitle.mutate({ id, title })
    },
    [updateTitle],
  )

  const handleDeleteConversation = useCallback(
    (id: string) => {
      deleteConversation.mutate(id, {
        onSuccess: () => {
          // If deleted conversation was active, clear selection
          if (currentConversationId === id) {
            setCurrentConversationId(null)
          }
        },
      })
    },
    [deleteConversation, currentConversationId],
  )

  // Called when a new conversation is created from ChatInterface
  const handleConversationCreated = useCallback(
    async (conversationId: string, firstMessage: string): Promise<string | undefined> => {
      if (!(selectedWorkspace?.id && user?.id)) {
        return
      }

      try {
        // Create conversation in database
        const newConversation = await createConversation.mutateAsync({
          workspaceId: selectedWorkspace.id,
          userId: user.id,
        })

        // Update the conversation ID in ChatInterface
        setCurrentConversationId(newConversation.id)

        // Generate title from first message
        generateTitle.mutate({
          id: newConversation.id,
          firstMessage,
          locale: localStorage.getItem("i18nextLng") || "ko",
        })

        return newConversation.id
      } catch (error) {
        console.error("Failed to create conversation:", error)
        return conversationId // Return original ID if creation fails
      }
    },
    [selectedWorkspace?.id, user?.id, createConversation, generateTitle],
  )

  // Require a specific workspace to be selected (not "all")
  if (!selectedWorkspace || selectedWorkspace.id === "all" || !selectedWorkspace.id) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center p-4">
        <Alert className="max-w-md" variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("chatbot.workspace.select.title")}</AlertTitle>
          <AlertDescription>{t("chatbot.workspace.select.description")}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Sidebar */}
      <ChatSidebar
        activeId={currentConversationId}
        collapsed={sidebarCollapsed}
        conversations={conversations}
        isLoading={isLoadingConversations}
        onDelete={handleDeleteConversation}
        onNew={handleNewChat}
        onRename={handleRenameConversation}
        onSelect={handleSelectConversation}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main chat area */}
      <div className={cn("flex-1 overflow-hidden", sidebarCollapsed && "pl-0")}>
        <ChatInterface
          conversationId={currentConversationId || undefined}
          onConversationCreated={handleConversationCreated}
          workspaceId={selectedWorkspace.id}
        />
      </div>
    </div>
  )
}
