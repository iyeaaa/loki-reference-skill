import { useState } from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { ChatRoom } from "./ChatRoom"
import { CustomerTable } from "./CustomerTable"

export default function LeadDiscoveryPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)

  // calc(100vh - 헤더 높이 64px), -m-4로 DashboardLayout의 패딩 상쇄
  return (
    <div className="-m-4 w-[calc(100%+2rem)]" style={{ height: "calc(100vh - 64px)" }}>
      {isFullscreen ? (
        <CustomerTable
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(false)}
        />
      ) : (
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
