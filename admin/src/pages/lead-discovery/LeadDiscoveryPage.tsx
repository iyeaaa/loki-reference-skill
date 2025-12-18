/**
 * Lead Discovery Page
 * - 메시지 상태(Jotai)를 기반으로 레이아웃 결정
 * - ChatRoom 리마운트 시에도 메시지 상태 유지
 * - 분석 중일 때는 AnalysisPanel, 검색 완료 후에는 CustomerTable 표시
 */

import { useAtomValue } from "jotai"
import { GripVertical } from "lucide-react"
import { useState } from "react"
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"
import { AnalysisPanel } from "./AnalysisPanel"
import { ChatRoom } from "./ChatRoom"
import { CustomerTable } from "./CustomerTable"
import { chatMessagesAtom, streamingStateAtom } from "./store"

export default function LeadDiscoveryPage() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const messages = useAtomValue(chatMessagesAtom)
  const streamingState = useAtomValue(streamingStateAtom)

  // 메시지가 없으면 초기 화면 (ChatRoom만 전체 표시)
  const showInitialScreen = messages.length === 0

  // 분석 패널을 표시할 상태: 연결 중, 분석 중, 추천 중, 선택 대기 중
  // (선택 완료 후 검색 중이거나 완료되면 CustomerTable 표시)
  const showAnalysisPanel =
    streamingState.status === "connecting" ||
    streamingState.status === "routing" ||
    streamingState.status === "analyzing" ||
    streamingState.status === "recommending" ||
    streamingState.status === "waiting_selection" ||
    streamingState.status === "waiting_clarification"

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
        // 분할 화면: 좌측 ChatRoom + 우측 (AnalysisPanel 또는 CustomerTable)
        <PanelGroup className="h-full" direction="horizontal">
          <Panel defaultSize={30} maxSize={50} minSize={20}>
            <ChatRoom />
          </Panel>
          <PanelResizeHandle className="group flex w-2 items-center justify-center bg-border/50 transition-colors hover:bg-border">
            <GripVertical className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
          </PanelResizeHandle>
          <Panel defaultSize={70} minSize={50}>
            {showAnalysisPanel ? (
              <AnalysisPanel />
            ) : (
              <CustomerTable
                isFullscreen={isFullscreen}
                onToggleFullscreen={() => setIsFullscreen(true)}
              />
            )}
          </Panel>
        </PanelGroup>
      )}
    </div>
  )
}
