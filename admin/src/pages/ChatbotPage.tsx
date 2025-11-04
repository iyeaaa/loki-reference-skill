import { AlertCircle } from "lucide-react"
import { ChatInterface } from "@/components/chatbot/ChatInterface"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useWorkspace } from "@/lib/hooks/useWorkspace"

export default function ChatbotPage() {
  const { selectedWorkspace } = useWorkspace()

  // Require a specific workspace to be selected (not "all")
  if (!selectedWorkspace || selectedWorkspace.id === "all" || !selectedWorkspace.id) {
    return (
      <div className="flex h-[calc(100vh-80px)] items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>워크스페이스를 선택해주세요</AlertTitle>
          <AlertDescription>
            챗봇을 사용하려면 왼쪽 사이드바에서 특정 워크스페이스를 선택해주세요. "전체"
            워크스페이스에서는 챗봇을 사용할 수 없습니다.
          </AlertDescription>
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
