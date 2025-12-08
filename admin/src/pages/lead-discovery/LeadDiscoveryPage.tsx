/**
 * Lead Discovery Page
 * - 메시지 상태(Jotai)를 기반으로 레이아웃 결정
 * - ChatRoom 리마운트 시에도 메시지 상태 유지
 */

import { useAtomValue } from "jotai"
import { GripVertical } from "lucide-react"
import { useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { ChatRoom } from "./ChatRoom"
import { CustomerTable } from "./CustomerTable"
import { chatMessagesAtom } from "./store"

export default function LeadDiscoveryPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const messages = useAtomValue(chatMessagesAtom)

  // 메시지가 없으면 초기 화면 (ChatRoom만 전체 표시)
  const showInitialScreen = messages.length === 0

  // calc(100vh - 헤더 높이 64px), -m-4로 DashboardLayout의 패딩 상쇄
  return (
    <div className="-m-4 w-[calc(100%+2rem)]" style={{ height: "calc(100vh - 64px)" }}>
      {isFullscreen ? (
        // 전체화면 모드: CustomerTable만 표시
        <CustomerTable
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen(false)}
        />
      ) : showInitialScreen ? (
        // 초기 화면: ChatRoom만 전체 너비로 표시
        <ChatRoom />
      ) : (
        // 분할 화면: 좌측 ChatRoom + 우측 CustomerTable
        <PanelGroup direction="horizontal" className="h-full">
          <Panel defaultSize={30} minSize={20} maxSize={50}>
            <ChatRoom />
          </Panel>
          <PanelResizeHandle className="w-2 bg-border/50 hover:bg-border transition-colors flex items-center justify-center group">
            <GripVertical className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </PanelResizeHandle>
          <Panel defaultSize={70} minSize={50}>
            <CustomerTable
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen(true)}
            />
          </Panel>
        </PanelGroup>
      )}
    </div>
  )
}
