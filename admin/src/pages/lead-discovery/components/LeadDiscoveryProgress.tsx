/**
 * Lead Discovery Progress Component
 * - 현재 진행 중인 단계 표시 (최근 완료 1개 + 현재 + 대기)
 * - 분석된 웹사이트 페이지 iframe 미리보기 (analyzing 상태에서만, 한 번에 하나씩)
 * - 분석 완료 후에도 분석된 페이지 목록 유지
 */

import { AnimatePresence, motion } from "framer-motion"
import { AlertTriangle, Check, ExternalLink, FileText, Globe, Loader2 } from "lucide-react"
import React, { Suspense, useEffect, useMemo, useRef, useState } from "react"
import ReactMarkdown from "react-markdown"
import { StarSpinner } from "@/components/chatbot/StarSpinner"

// Lazy load Streamdown for streaming markdown rendering
const Streamdown = React.lazy(() =>
  import("streamdown").then((mod) => ({ default: mod.Streamdown })),
)

import type { LeadDiscoveryStatus } from "@/lib/api/hooks/lead-discovery"
import type { AnalyzedPage } from "@/lib/api/types/lead-discovery"
import { cn } from "@/lib/utils"

// 노드 설정 (간결한 단계명)
const NODE_CONFIG: Record<
  string,
  {
    name: string
    order: number
  }
> = {
  connecting: { name: "연결", order: 0 },
  routing: { name: "분석", order: 1 },
  analyzing: { name: "웹사이트 읽기", order: 2 },
  recommending: { name: "바이어 탐색", order: 3 },
  waiting_selection: { name: "선택 대기", order: 4 },
  searching: { name: "리드 검색", order: 5 },
  complete: { name: "완료", order: 6 },
}

// 상태에서 노드 상태 계산
function getNodeStatus(
  nodeOrder: number,
  currentStatus: LeadDiscoveryStatus,
): "pending" | "in_progress" | "completed" {
  const currentNode = NODE_CONFIG[currentStatus]
  if (!currentNode) {
    return "pending"
  }

  const currentOrder = currentNode.order

  if (nodeOrder < currentOrder) {
    return "completed"
  }
  if (nodeOrder === currentOrder) {
    return "in_progress"
  }
  return "pending"
}

// 단계 아이콘
function StepIcon({ status }: { status: "pending" | "in_progress" | "completed" }) {
  if (status === "completed") {
    return <Check className="h-2.5 w-2.5" strokeWidth={3} />
  }

  if (status === "in_progress") {
    return <Loader2 className="h-2.5 w-2.5 animate-spin" />
  }

  return <div className="h-1.5 w-1.5 rounded-full bg-current opacity-40" />
}

// iframe 웹사이트 프리뷰 컴포넌트
function WebsiteIframePreview({ page }: { page: AnalyzedPage }) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const hostname = useMemo(() => {
    try {
      return new URL(page.url).hostname
    } catch {
      return page.url
    }
  }, [page.url])

  // biome-ignore lint/correctness/useExhaustiveDependencies: page.url 변경 시 의도적으로 타임아웃 재설정
  useEffect(() => {
    setIsLoading(true)
    setHasError(false)

    // 5초 후 에러로 처리 (X-Frame-Options 차단 가능성)
    // handleLoad가 호출되면 clearTimeout으로 취소됨
    timeoutRef.current = setTimeout(() => {
      setHasError(true)
      setIsLoading(false)
    }, 5000)

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [page.url])

  const handleLoad = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsLoading(false)
  }

  const handleError = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setHasError(true)
    setIsLoading(false)
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="group relative"
      exit={{ opacity: 0, scale: 0.9 }}
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      <div className="overflow-hidden rounded-lg border border-border/50 bg-muted/30 shadow-sm">
        {/* 브라우저 스타일 헤더 */}
        <div className="flex items-center gap-2 border-border/30 border-b bg-muted/60 px-3 py-2">
          {/* 트래픽 라이트 */}
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
          </div>

          {/* URL 바 */}
          <div className="flex flex-1 items-center gap-2 truncate rounded bg-background/80 px-3 py-1.5 text-muted-foreground text-xs">
            {page.favicon ? (
              <img
                alt=""
                className="h-4 w-4 flex-shrink-0 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                }}
                src={page.favicon}
              />
            ) : (
              <Globe className="h-4 w-4 flex-shrink-0" />
            )}
            <span className="truncate">{page.url}</span>
          </div>

          {/* 외부 링크 */}
          <a
            className="rounded p-1.5 transition-colors hover:bg-background/80"
            href={page.url}
            onClick={(e) => e.stopPropagation()}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>

        {/* iframe 컨테이너 */}
        <div className="relative h-[320px] w-full bg-white">
          {/* 로딩 상태 */}
          {isLoading && !hasError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/20">
              <Loader2 className="mb-3 h-8 w-8 animate-spin text-primary" />
              <span className="text-muted-foreground text-sm">페이지 로딩 중...</span>
            </div>
          )}

          {/* 에러 상태 (X-Frame-Options 차단 등) */}
          {hasError && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/30">
              <AlertTriangle className="mb-3 h-8 w-8 text-amber-500" />
              <span className="px-4 text-center text-muted-foreground text-sm">
                미리보기를 표시할 수 없습니다
              </span>
              <a
                className="mt-3 text-primary text-sm hover:underline"
                href={page.url}
                rel="noopener noreferrer"
                target="_blank"
              >
                새 탭에서 열기
              </a>
            </div>
          )}

          {/* iframe */}
          {!hasError && (
            <iframe
              className={cn(
                "pointer-events-none h-full w-full border-0 transition-opacity duration-300",
                isLoading ? "opacity-0" : "opacity-100",
              )}
              loading="lazy"
              onError={handleError}
              onLoad={handleLoad}
              ref={iframeRef}
              sandbox="allow-scripts allow-same-origin"
              src={page.url}
              title={page.title || hostname}
            />
          )}
        </div>

        {/* 페이지 제목 */}
        <div className="border-border/30 border-t bg-muted/40 px-3 py-2.5">
          <p className="truncate font-medium text-foreground text-sm">{page.title || hostname}</p>
        </div>
      </div>
    </motion.div>
  )
}

// 분석된 페이지 요약 카드 (컴팩트)
function AnalyzedPageCard({ page }: { page: AnalyzedPage }) {
  const hostname = useMemo(() => {
    try {
      return new URL(page.url).hostname
    } catch {
      return page.url
    }
  }, [page.url])

  return (
    <motion.div animate={{ opacity: 1, x: 0 }} className="group" initial={{ opacity: 0, x: -10 }}>
      <a
        className="flex items-center gap-2.5 rounded-lg border border-border/30 bg-muted/40 p-2 transition-colors hover:bg-muted/60"
        href={page.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {/* Favicon */}
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded bg-background/80">
          {page.favicon ? (
            <img
              alt=""
              className="h-4 w-4 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none"
                e.currentTarget.nextElementSibling?.classList.remove("hidden")
              }}
              src={page.favicon}
            />
          ) : null}
          <Globe className={cn("h-3.5 w-3.5 text-muted-foreground", page.favicon && "hidden")} />
        </div>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground text-sm">{page.title || hostname}</p>
        </div>

        {/* Check icon */}
        <Check className="h-4 w-4 flex-shrink-0 text-emerald-500" />
      </a>
    </motion.div>
  )
}

// 현재 페이지 iframe 프리뷰 (analyzing 중)
function CurrentPagePreview({
  pages,
  isAnalyzing,
}: {
  pages: AnalyzedPage[]
  isAnalyzing: boolean
}) {
  if (!isAnalyzing || pages.length === 0) {
    return null
  }

  const currentPage = pages.at(-1)

  if (!currentPage) {
    return null
  }

  return (
    <div className="mt-4">
      <AnimatePresence mode="wait">
        <WebsiteIframePreview key={currentPage.url} page={currentPage} />
      </AnimatePresence>
    </div>
  )
}

// 분석 완료된 페이지 목록 (컴팩트)
function AnalyzedPagesSummary({
  pages,
  isAnalyzing,
}: {
  pages: AnalyzedPage[]
  isAnalyzing: boolean
}) {
  // analyzing 중이거나 페이지가 없으면 표시 안함
  if (isAnalyzing || pages.length === 0) {
    return null
  }

  return (
    <div className="mt-4 space-y-3">
      <div className="ml-1 flex items-center gap-2">
        <FileText className="h-4 w-4 text-emerald-500" />
        <span className="text-muted-foreground text-sm">{pages.length}개 페이지를 분석했어요</span>
      </div>
      <div className="space-y-2">
        {pages.map((page) => (
          <AnalyzedPageCard key={page.url} page={page} />
        ))}
      </div>
    </div>
  )
}

// Memoized markdown components for ReactMarkdown (챗봇과 동일한 스타일)
const markdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 leading-relaxed last:mb-0">{children}</p>
  ),
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mt-6 mb-4 font-bold text-2xl first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mt-5 mb-3 font-bold text-xl first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mt-4 mb-2 font-semibold text-lg first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mt-3 mb-2 font-semibold text-base first:mt-0">{children}</h4>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 ml-6 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 ml-6 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => <em className="italic">{children}</em>,
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-4 border-border border-l-4 pl-4 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className
    return isInline ? (
      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
    ) : (
      <code className="font-mono text-sm">{children}</code>
    )
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-4 overflow-x-auto rounded-lg bg-muted p-3">{children}</pre>
  ),
  a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => (
    <a
      {...props}
      className="text-primary underline hover:text-primary/80"
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.children}
    </a>
  ),
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }: { children?: React.ReactNode }) => (
    <thead className="border-b">{children}</thead>
  ),
  tbody: ({ children }: { children?: React.ReactNode }) => <tbody>{children}</tbody>,
  tr: ({ children }: { children?: React.ReactNode }) => (
    <tr className="border-b last:border-0">{children}</tr>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="px-3 py-2 text-left font-medium">{children}</th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => <td className="px-3 py-2">{children}</td>,
  hr: () => <hr className="my-6 border-border" />,
}

// 코드 펜스 제거 유틸리티 (GPT가 ```markdown 으로 감싸는 경우 대비)
function stripCodeFences(text: string): string {
  let result = text
  // 시작 부분의 코드 펜스 제거 (```markdown\n 또는 ```\n)
  result = result.replace(/^```(?:markdown)?\s*\n?/i, "")
  // 끝 부분의 코드 펜스 제거
  result = result.replace(/\n?```\s*$/i, "")
  return result
}

// AI 분석 요약 스트리밍 텍스트 (Markdown 지원)
function StreamingAnalysisSummary({
  text,
  isStreaming,
  title,
}: {
  text: string
  isStreaming: boolean
  title?: string
}) {
  // 코드 펜스 제거 처리
  const cleanText = useMemo(() => stripCodeFences(text), [text])

  if (!cleanText) {
    return null
  }

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-4"
      initial={{ opacity: 0, y: 10 }}
      transition={{ duration: 0.3 }}
    >
      <div className="rounded-xl border border-border/50 bg-muted/30 p-5">
        {title && (
          <div className="mb-4 flex items-center gap-2 border-border/50 border-b pb-3">
            <FileText className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground text-sm">{title}</span>
            {isStreaming && (
              <span className="ml-auto animate-pulse text-muted-foreground text-xs">
                분석 중...
              </span>
            )}
          </div>
        )}
        {/* @ts-ignore - Complex markdown component types */}
        <div className="prose prose-sm dark:prose-invert max-w-none will-change-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {isStreaming ? (
            // 스트리밍 중: Streamdown으로 실시간 렌더링
            <Suspense
              fallback={
                <div className="animate-pulse whitespace-pre-wrap text-muted-foreground">
                  {cleanText}
                </div>
              }
            >
              <Streamdown>{cleanText}</Streamdown>
            </Suspense>
          ) : (
            // 완료 후: ReactMarkdown으로 렌더링
            <ReactMarkdown components={markdownComponents}>{cleanText}</ReactMarkdown>
          )}
        </div>
      </div>
    </motion.div>
  )
}

type LeadDiscoveryProgressProps = {
  status: LeadDiscoveryStatus
  message: string
  mode?: "basic" | "advanced"
  analyzedPages?: AnalyzedPage[]
  customerAnalysisSummary?: string
  className?: string
}

export function LeadDiscoveryProgress({
  status,
  message,
  mode,
  analyzedPages = [],
  customerAnalysisSummary = "",
  className,
}: LeadDiscoveryProgressProps) {
  // 모드에 따라 표시할 노드 결정
  const allNodes =
    mode === "advanced"
      ? ["connecting", "routing", "searching", "complete"]
      : [
          "connecting",
          "routing",
          "analyzing",
          "recommending",
          "waiting_selection",
          "searching",
          "complete",
        ]

  // 현재 상태의 order 찾기
  const currentOrder = NODE_CONFIG[status]?.order ?? 0

  // 보여줄 노드 필터링: 최근 완료 1개 + 현재 진행 + 대기 중
  const visibleNodes = useMemo(() => {
    return allNodes.filter((nodeKey) => {
      const nodeOrder = NODE_CONFIG[nodeKey]?.order ?? 0
      // 현재 진행 중인 노드의 바로 이전 노드(최근 완료) + 현재 + 대기 중
      return nodeOrder >= currentOrder - 1
    })
  }, [allNodes, currentOrder])

  if (status === "idle" || status === "error") {
    return null
  }

  const isAnalyzing = status === "analyzing"

  // 현재 진행 단계 계산 (접근성용)
  const completedSteps = visibleNodes.filter(
    (nodeKey) => getNodeStatus(NODE_CONFIG[nodeKey]?.order ?? 0, status) === "completed",
  ).length
  const totalSteps = visibleNodes.length
  const progressPercent = Math.round((completedSteps / totalSteps) * 100)

  return (
    <section
      aria-busy={status !== "complete"}
      aria-label="리드 검색 진행 상태"
      className={cn("space-y-3", className)}
    >
      {/* 스크린 리더용 진행 상태 안내 (aria-live) */}
      <output aria-atomic="true" aria-live="polite" className="sr-only">
        {status === "complete"
          ? "리드 검색이 완료되었습니다."
          : `리드 검색 진행 중: ${NODE_CONFIG[status]?.name || "처리 중"}. ${completedSteps}/${totalSteps} 단계 완료.`}
      </output>

      {/* 현재 진행 메시지 */}
      <div aria-hidden="true" className="flex items-center gap-2.5">
        <StarSpinner size={20} />
        <span className="font-medium text-foreground text-sm">{message || "처리 중..."}</span>
      </div>

      {/* 진행률 표시 (시각적으로 숨김, 스크린 리더용) */}
      <div
        aria-label={`진행률 ${progressPercent}%`}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        className="sr-only"
        role="progressbar"
      />

      {/* 단계 표시 - 세로 배치 (애니메이션 적용) */}
      <div className="ml-1 flex flex-col gap-0">
        <AnimatePresence mode="popLayout">
          {visibleNodes.map((nodeKey, index) => {
            const config = NODE_CONFIG[nodeKey]
            if (!config) {
              return null
            }

            const nodeStatus = getNodeStatus(config.order, status)
            const isLast = index === visibleNodes.length - 1

            return (
              <motion.div
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-stretch"
                exit={{ opacity: 0, height: 0 }}
                initial={{ opacity: 0, height: 0 }}
                key={nodeKey}
                transition={{ duration: 0.2 }}
              >
                {/* 왼쪽: 아이콘 + 연결선 */}
                <div className="mr-2 flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full transition-all",
                      nodeStatus === "completed" &&
                        "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
                      nodeStatus === "in_progress" &&
                        "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
                      nodeStatus === "pending" && "bg-muted text-muted-foreground/50",
                    )}
                  >
                    <StepIcon status={nodeStatus} />
                  </div>
                  {/* 세로 연결선 */}
                  {!isLast && (
                    <div
                      className={cn(
                        "min-h-[12px] w-px flex-1",
                        nodeStatus === "completed"
                          ? "bg-emerald-300 dark:bg-emerald-700"
                          : "bg-muted-foreground/20",
                      )}
                    />
                  )}
                </div>

                {/* 오른쪽: 텍스트 */}
                <div className={cn("pb-3", isLast && "pb-0")}>
                  <span
                    className={cn(
                      "font-medium text-sm transition-all",
                      nodeStatus === "completed" && "text-emerald-600 dark:text-emerald-400",
                      nodeStatus === "in_progress" && "text-blue-600 dark:text-blue-400",
                      nodeStatus === "pending" && "text-muted-foreground/50",
                    )}
                  >
                    {config.name}
                  </span>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* iframe 프리뷰 - analyzing 상태에서만 현재 페이지 하나만 표시 */}
      <CurrentPagePreview isAnalyzing={isAnalyzing} pages={analyzedPages} />

      {/* 분석 완료된 페이지 목록 - analyzing 이후에 표시 */}
      <AnalyzedPagesSummary isAnalyzing={isAnalyzing} pages={analyzedPages} />

      {/* 고객군 분석 스트리밍 텍스트 - searching 상태에서 표시 */}
      {customerAnalysisSummary && (
        <StreamingAnalysisSummary
          isStreaming={status === "searching"}
          text={customerAnalysisSummary}
          title="잠재 바이어 분석 리포트"
        />
      )}
    </section>
  )
}
