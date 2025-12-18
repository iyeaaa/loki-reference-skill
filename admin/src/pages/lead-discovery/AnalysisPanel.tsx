/**
 * Analysis Panel Component
 * 웹사이트 분석 결과, 분석 리포트, 바이어 추천 카드를 오른쪽 패널에 표시
 */

import { useAtomValue } from "jotai"
import { FileSearch, Loader2, Sparkles } from "lucide-react"
import { useCallback } from "react"
import type { BuyerRecommendation } from "@/lib/api/types/lead-discovery"
import { BuyerRecommendationCards } from "./components/BuyerRecommendationCards"
import { LeadDiscoveryProgress } from "./components/LeadDiscoveryProgress"
import { streamingStateAtom } from "./store"

export function AnalysisPanel() {
  const streamingState = useAtomValue(streamingStateAtom)

  const isAnalyzing =
    streamingState.status === "analyzing" || streamingState.status === "recommending"
  const isWaitingSelection = streamingState.status === "waiting_selection"
  const isSearching = streamingState.status === "searching"

  // 추천 선택 시 CustomEvent 발생 → ChatRoom에서 처리
  const handleRecommendationSelect = useCallback((rec: BuyerRecommendation) => {
    const event = new CustomEvent("selectRecommendation", {
      detail: {
        id: rec.id,
        country: rec.country,
        industry: rec.industry,
        subIndustry: rec.subIndustry,
      },
    })
    window.dispatchEvent(event)
  }, [])

  return (
    <div className="flex h-full flex-col bg-background">
      {/* 헤더 */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
          {isAnalyzing ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <FileSearch className="h-5 w-5 text-white" />
          )}
        </div>
        <div>
          <h2 className="font-semibold text-foreground text-lg">웹사이트 분석</h2>
          <p className="text-muted-foreground text-sm">
            {isAnalyzing
              ? "AI가 웹사이트를 분석하고 있습니다..."
              : isWaitingSelection
                ? "분석이 완료되었습니다. 타겟 바이어를 선택해주세요."
                : "분석 결과를 확인하세요."}
          </p>
        </div>
      </div>

      {/* 콘텐츠 영역 */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 p-6">
          {/* 미리보기/분석 텍스트만 표시 (진행 상태는 좌측 ChatRoom에서) */}
          <LeadDiscoveryProgress
            analyzedPages={streamingState.analyzedPages}
            customerAnalysisSummary={streamingState.customerAnalysisSummary}
            hideStatus
            message={streamingState.message}
            mode={streamingState.mode}
            status={streamingState.status}
          />

          {/* 바이어 추천 카드 */}
          {(isAnalyzing ||
            streamingState.recommendations.length > 0 ||
            streamingState.analysisSummary) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h3 className="font-semibold text-foreground">AI 분석 결과</h3>
              </div>

              <BuyerRecommendationCards
                analysisSummary={streamingState.analysisSummary}
                disabled={isSearching || !!streamingState.selectedRecommendationId}
                isAnalysisComplete={
                  isWaitingSelection ||
                  streamingState.status === "complete" ||
                  !!streamingState.selectedRecommendationId
                }
                isAnalyzing={isAnalyzing}
                isLoadingRecommendations={streamingState.status === "recommending"}
                onSelect={handleRecommendationSelect}
                recommendations={streamingState.recommendations}
                selectedId={streamingState.selectedRecommendationId}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
