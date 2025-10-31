import { ChatInterface } from "@/components/chatbot/ChatInterface"

export default function ChatbotPage() {
  const workspaceId = localStorage.getItem("selectedWorkspace") || "all"

  return (
    <div className="h-[calc(100vh-80px)]">
      <ChatInterface workspaceId={workspaceId} />
    </div>
  )
}
