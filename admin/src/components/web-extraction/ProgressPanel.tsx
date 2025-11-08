import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"
import { WebExtractionProgress } from "@/components/web-extraction/WebExtractionProgress"
import type { ExtractionProgress } from "@/lib/api/types/web-extraction"
import { cn } from "@/lib/utils"

interface ProgressPanelProps {
  progress: ExtractionProgress | null
  isPanelVisible: boolean
  panelWidth: number
  isResizing: boolean
  activeApiKeysCount: number
  totalTimeSaved: number
  onTogglePanel: (visible: boolean) => void
  onStartResize: () => void
  resizeRef: React.RefObject<HTMLDivElement> | React.MutableRefObject<HTMLDivElement | null>
}

/**
 * Progress Panel Component with resizable sidebar
 */
export function ProgressPanel({
  progress,
  isPanelVisible,
  panelWidth,
  isResizing,
  activeApiKeysCount,
  totalTimeSaved,
  onTogglePanel,
  onStartResize,
  resizeRef,
}: ProgressPanelProps) {
  if (!progress) return null

  if (isPanelVisible) {
    return (
      <>
        {/* Resizer Handle */}
        {/* biome-ignore lint/a11y/useSemanticElements: resizer handle requires div for proper styling and drag functionality */}
        <div
          ref={resizeRef}
          role="separator"
          tabIndex={0}
          onMouseDown={(e) => {
            e.preventDefault()
            onStartResize()
          }}
          className={cn(
            "w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0",
            isResizing && "bg-primary",
          )}
          aria-label="패널 너비 조절"
          aria-orientation="vertical"
          aria-valuenow={panelWidth}
        />
        <div
          className="border-l border-border bg-muted/20 flex flex-col h-full min-h-0 overflow-hidden flex-shrink-0"
          style={{ width: `${panelWidth}px` }}
        >
          <div className="h-full flex flex-col min-h-0 overflow-hidden">
            <div className="flex items-center justify-end p-2 border-b border-border">
              <button
                type="button"
                onClick={() => onTogglePanel(false)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                aria-label="패널 숨기기"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 flex flex-col min-h-0 p-4 overflow-hidden">
              <WebExtractionProgress
                progress={progress}
                apiKeyCount={activeApiKeysCount}
                concurrency={activeApiKeysCount * 20}
                totalTimeSaved={totalTimeSaved}
              />
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onTogglePanel(true)}
      className="w-8 border-l border-border bg-muted/20 hover:bg-muted/40 transition-colors flex items-center justify-center"
      aria-label="패널 보이기"
    >
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
