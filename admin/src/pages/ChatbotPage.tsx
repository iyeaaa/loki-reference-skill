import { AlertCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ChatInterface } from "@/components/chatbot/ChatInterface"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export default function ChatbotPage() {
  const { t } = useTranslation()
  const { selectedWorkspace } = useWorkspace()

  // Require a specific workspace to be selected (not "all")
  if (!selectedWorkspace || selectedWorkspace.id === "all" || !selectedWorkspace.id) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("chatbot.workspace.select.title")}</AlertTitle>
          <AlertDescription>{t("chatbot.workspace.select.description")}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-80px)]">
      <ChatInterface workspaceId={selectedWorkspace.id} />
    </div>
  )
}
