import { ChevronLeft, ChevronRight } from "lucide-react"
import type React from "react"
import { WebExtractionProgress } from "@/components/web-extraction/WebExtractionProgress"
import type { ExtractionProgress } from "@/lib/api/types/web-extraction"
import { cn } from "@/lib/utils"

type ProgressPanelProps = {
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
  if (!progress) {
    return null
  }

  if (isPanelVisible) {
    return (
      <>
        {/* Resizer Handle */}
        {/* biome-ignore lint/a11y/useSemanticElements: resizer handle requires div for proper styling and drag functionality */}
        <div
          aria-label="패널 너비 조절"
          aria-orientation="vertical"
          aria-valuenow={panelWidth}
          className={cn(
            "w-1 flex-shrink-0 cursor-col-resize bg-border transition-colors hover:bg-primary/50",
            isResizing && "bg-primary",
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            onStartResize()
          }}
          ref={resizeRef}
          role="separator"
          tabIndex={0}
        />
        <div
          className="flex h-full min-h-0 flex-shrink-0 flex-col overflow-hidden border-border border-l bg-muted/20"
          style={{ width: `${panelWidth}px` }}
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex items-center justify-end border-border border-b p-2">
              <button
                aria-label="패널 숨기기"
                className="rounded-md p-1.5 transition-colors hover:bg-muted"
                onClick={() => onTogglePanel(false)}
                type="button"
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
              <WebExtractionProgress
                apiKeyCount={activeApiKeysCount}
                concurrency={activeApiKeysCount * 20}
                progress={progress}
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
      aria-label="패널 보이기"
      className="flex w-8 items-center justify-center border-border border-l bg-muted/20 transition-colors hover:bg-muted/40"
      onClick={() => onTogglePanel(true)}
      type="button"
    >
      <ChevronLeft className="h-4 w-4 text-muted-foreground" />
    </button>
  )
}
