/**
 * ThinkingBlock Component
 * - Cursor Agent 스타일의 토글 가능한 Thinking UI
 * - 기본적으로 접힌 상태에서 한 줄 요약만 표시
 * - 펼치면 상세 사고 과정 표시
 * - 스트리밍 중일 때 실시간 텍스트 표시
 */

import { AnimatePresence, motion } from "framer-motion"
import { Brain, ChevronDown, ChevronRight, Loader2 } from "lucide-react"
import React, { Suspense, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

// Lazy load Streamdown for streaming markdown rendering
const Streamdown = React.lazy(() =>
  import("streamdown").then((mod) => ({ default: mod.Streamdown })),
)

// 노드 이름을 사용자 친화적인 한글로 매핑
const NODE_LABELS: Record<string, string> = {
  routeMode: "모드 분석",
  analyzeWebsite: "웹사이트 분석",
  recommendBuyers: "바이어 추천",
  generateBigQueryParams: "검색 준비",
  executeBigQuery: "리드 검색",
}

function getNodeLabel(node?: string): string | undefined {
  if (!node) {
    return
  }
  return NODE_LABELS[node] || node
}

export type ThinkingBlockProps = {
  /** 한 줄 요약 (접힌 상태에서 표시) */
  summary: string
  /** 상세 내용 (펼쳤을 때 표시) */
  detail: string
  /** 스트리밍 중 여부 */
  isStreaming: boolean
  /** 노드 이름 (구분용) */
  node?: string
  /** 기본 펼침 상태 */
  defaultExpanded?: boolean
  /** 스트리밍 완료 시 자동 접기 */
  autoCollapseOnComplete?: boolean
  /** 추가 className */
  className?: string
}

export function ThinkingBlock({
  summary,
  detail,
  isStreaming,
  node,
  defaultExpanded = false,
  autoCollapseOnComplete = false,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const wasStreamingRef = useRef(isStreaming)

  // 스트리밍 시작 시 자동 펼치기 (선택적)
  useEffect(() => {
    if (isStreaming && !wasStreamingRef.current) {
      // 스트리밍 시작 시 펼치기 (선택적)
      // setIsExpanded(true)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming])

  // 스트리밍 완료 시 자동 접기 (선택적)
  useEffect(() => {
    if (autoCollapseOnComplete && wasStreamingRef.current && !isStreaming) {
      const timer = setTimeout(() => setIsExpanded(false), 1500)
      return () => clearTimeout(timer)
    }
    wasStreamingRef.current = isStreaming
  }, [isStreaming, autoCollapseOnComplete])

  // 내용이 없으면 렌더링하지 않음
  if (!(summary || detail)) {
    return null
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-lg border transition-colors",
        isStreaming
          ? "border-violet-500/30 bg-violet-500/5 dark:border-violet-400/30 dark:bg-violet-950/20"
          : "border-border/50 bg-muted/30",
        className,
      )}
      initial={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      {/* 헤더 (항상 표시) - 클릭하면 펼침/접힘 */}
      <button
        aria-expanded={isExpanded}
        aria-label={isExpanded ? "Thinking 접기" : "Thinking 펼치기"}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50",
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        {/* 아이콘 */}
        <div
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md",
            isStreaming
              ? "bg-violet-500/20 text-violet-600 dark:text-violet-400"
              : "bg-muted text-muted-foreground",
          )}
        >
          {isStreaming ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Brain className="h-3.5 w-3.5" />
          )}
        </div>

        {/* 제목 & 요약 */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "font-medium text-sm",
                isStreaming ? "text-violet-600 dark:text-violet-400" : "text-foreground",
              )}
            >
              {isStreaming ? "분석 중" : "완료"}
            </span>
            {isStreaming && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
              </span>
            )}
            {node && (
              <span className="rounded bg-muted/80 px-1.5 py-0.5 text-muted-foreground text-xs">
                {getNodeLabel(node)}
              </span>
            )}
          </div>
          {/* 접힌 상태에서만 요약 표시 */}
          {!isExpanded && summary && (
            <p className="mt-0.5 truncate text-muted-foreground text-xs">{summary}</p>
          )}
        </div>

        {/* 토글 아이콘 */}
        <div
          className={cn(
            "flex-shrink-0 transition-colors",
            isStreaming ? "text-violet-500" : "text-muted-foreground",
          )}
        >
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>
      </button>

      {/* 상세 내용 (펼쳤을 때만) */}
      <AnimatePresence>
        {isExpanded && (detail || summary) && (
          <motion.div
            animate={{ height: "auto", opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            <div className="border-border/30 border-t px-3 pt-2 pb-3">
              <div
                className={cn(
                  "max-h-[400px] overflow-y-auto text-sm leading-relaxed",
                  "prose prose-sm dark:prose-invert max-w-none",
                  "[&>p:last-child]:mb-0 [&>p]:mb-2",
                  "[&>ul]:mb-2 [&>ul]:ml-4 [&>ul]:list-disc",
                  "[&>ol]:mb-2 [&>ol]:ml-4 [&>ol]:list-decimal",
                  isStreaming ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {isStreaming ? (
                  // 스트리밍 중: Streamdown으로 실시간 렌더링
                  <Suspense
                    fallback={
                      <div className="animate-pulse whitespace-pre-wrap">{detail || summary}</div>
                    }
                  >
                    <Streamdown>{detail || summary}</Streamdown>
                  </Suspense>
                ) : (
                  // 완료 후: 일반 텍스트로 표시 (줄바꿈 유지)
                  <div className="whitespace-pre-wrap">{detail || summary}</div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * ThinkingBlockList Component
 * - 여러 개의 ThinkingBlock을 렌더링
 * - 노드별로 그룹화하여 표시
 */
export type ThinkingEntry = {
  id: string
  node: string
  summary: string
  detail: string
  isStreaming: boolean
  timestamp: number
}

type ThinkingBlockListProps = {
  entries: ThinkingEntry[]
  className?: string
}

export function ThinkingBlockList({ entries, className }: ThinkingBlockListProps) {
  if (entries.length === 0) {
    return null
  }

  return (
    <div className={cn("space-y-2", className)}>
      {entries.map((entry) => (
        <ThinkingBlock
          autoCollapseOnComplete
          defaultExpanded={entry.isStreaming}
          detail={entry.detail}
          isStreaming={entry.isStreaming}
          key={entry.id}
          node={entry.node}
          summary={entry.summary}
        />
      ))}
    </div>
  )
}
