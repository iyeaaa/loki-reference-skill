import { useAtom } from "jotai"
import { useState } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ChatRoom } from "./ChatRoom"
import { CustomerTable } from "./CustomerTable"
import { chatMessagesAtom } from "./store"

export default function LeadDiscoveryPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [messages] = useAtom(chatMessagesAtom)

  // 메시지가 없을 때는 ChatRoom만 전체 화면으로 표시 (ChatGPT 스타일)
  const showInitialScreen = messages.length === 0

  // calc(100vh - 헤더 높이 64px), -m-4로 DashboardLayout의 패딩 상쇄
  return (
    <div className="-m-4 w-[calc(100%+2rem)]" style={{ height: "calc(100vh - 64px)" }}>
      {showInitialScreen ? (
        // 첫 화면: ChatRoom만 표시
        <ChatRoom />
      ) : isFullscreen ? (
        // 전체화면: CustomerTable만 표시
        <CustomerTable
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(false)}
        />
      ) : (
        // 기본 화면: 좌측 ChatRoom + 우측 CustomerTable
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* 좌측: 채팅방 */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
            <ChatRoom />
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* 우측: 고객 테이블 */}
          <ResizablePanel defaultSize={70} minSize={50}>
            <CustomerTable
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(true)}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
