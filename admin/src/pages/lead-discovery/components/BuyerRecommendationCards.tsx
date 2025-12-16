/**
 * Buyer Recommendation Cards Component
 * LangGraph에서 생성된 바이어 추천을 표시하고 선택하는 컴포넌트
 * 토스 스타일 - 심플하고 깔끔한 UI
 */

import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronDown, ChevronRight, FileText, Loader2, MapPin, Target } from "lucide-react"
import type React from "react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import type { BuyerRecommendation } from "@/lib/api/types/lead-discovery"
import { cn } from "@/lib/utils"

// Markdown 컴포넌트 스타일링 (챗봇과 동일한 스타일)
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

type BuyerRecommendationCardsProps = {
  recommendations: BuyerRecommendation[]
  onSelect: (recommendation: BuyerRecommendation) => void
  disabled?: boolean
  selectedId?: string
  analysisSummary?: string
  className?: string
  /** 바이어 추천 로딩 중 여부 */
  isLoadingRecommendations?: boolean
  /** 분석 완료 여부 */
  isAnalysisComplete?: boolean
  /** 분석 중 여부 (스트리밍 중) */
  isAnalyzing?: boolean
}

export function BuyerRecommendationCards({
  recommendations,
  onSelect,
  disabled = false,
  selectedId,
  analysisSummary,
  className,
  isLoadingRecommendations = false,
  isAnalysisComplete = false,
  isAnalyzing = false,
}: BuyerRecommendationCardsProps) {
  // 코드 펜스 제거 처리
  const cleanAnalysisSummary = analysisSummary ? stripCodeFences(analysisSummary) : ""

  // 분석 리포트 접기/펼치기 상태 (기본: 접힌 상태)
  const [isReportExpanded, setIsReportExpanded] = useState(false)

  // 분석 중이 아니고, 로딩 중이 아니고, 추천도 없으면 null 반환
  if (!(isAnalyzing || isLoadingRecommendations) && recommendations.length === 0) {
    return null
  }

  const hasSelection = !!selectedId

  // 분석 리포트 표시 여부 (스트리밍 중이거나 완료 후)
  const showAnalysisReport = cleanAnalysisSummary && (isAnalyzing || isAnalysisComplete)

  return (
    <div className={cn("space-y-4", className)}>
      {/* AI 분석 요약 - 스트리밍 중이거나 완료 후 표시, 접기/펼치기 가능 */}
      {showAnalysisReport && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-xl border border-border/50 bg-muted/30"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3 }}
        >
          <button
            className="flex w-full items-center justify-between gap-2 p-4 transition-colors hover:bg-muted/50"
            onClick={() => setIsReportExpanded(!isReportExpanded)}
            type="button"
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium text-foreground text-sm">웹사이트 분석 리포트</span>
              {!isReportExpanded && (
                <span
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs",
                    isAnalyzing
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" />
                      분석 중
                    </>
                  ) : (
                    <>
                      <Check className="h-3 w-3" />
                      분석 완료
                    </>
                  )}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                !isReportExpanded && "-rotate-90",
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {isReportExpanded && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="border-border/50 border-t px-5 pt-0 pb-5">
                  {/* @ts-ignore - Complex markdown component types */}
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-4 [&>*:last-child]:mb-0">
                    <ReactMarkdown components={markdownComponents}>
                      {cleanAnalysisSummary}
                    </ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* 추천 로딩 중일 때 로딩 UI 표시 */}
      {isLoadingRecommendations && recommendations.length === 0 && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 py-4"
          initial={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-base text-muted-foreground">
            웹사이트를 분석한 정보를 기반으로 최적의 바이어 타겟을 찾고 있어요
          </span>
        </motion.div>
      )}

      {/* 추천이 있을 때만 헤더와 카드 표시 (분석 중일 때는 표시 안 함) */}
      {recommendations.length > 0 && (
        <>
          {/* 헤더 */}
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground text-sm">
              {hasSelection ? "선택한 바이어 타겟" : "이런 바이어를 추천해요"}
            </span>
          </div>

          {/* 카드 목록 */}
          <div className="space-y-2">
            {recommendations.map((rec, index) => {
              const isSelected = rec.id === selectedId
              const isOther = hasSelection && !isSelected

              // 선택 후에는 선택된 카드만 표시
              if (isOther) {
                return null
              }

              return (
                <motion.button
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "group w-full rounded-xl border bg-card p-4 text-left transition-all",
                    !hasSelection &&
                      "hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]",
                    isSelected && "border-primary bg-primary/5",
                    disabled && !isSelected && "cursor-not-allowed opacity-50",
                    hasSelection && !isSelected && "hidden",
                  )}
                  disabled={disabled || hasSelection}
                  initial={{ opacity: 0, y: 8 }}
                  key={rec.id}
                  onClick={() => !hasSelection && onSelect(rec)}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* 왼쪽: 국가 & 산업 */}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-start gap-2">
                        {isSelected ? (
                          <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                        ) : (
                          <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        )}
                        <span
                          className={cn(
                            "break-words font-medium text-base",
                            isSelected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {rec.country}
                        </span>
                      </div>
                      <p className="break-words pl-6 text-muted-foreground text-sm">
                        {rec.industry}
                        {rec.subIndustry && ` · ${rec.subIndustry}`}
                      </p>
                    </div>

                    {/* 오른쪽: 체크 또는 화살표 */}
                    {isSelected ? (
                      <span className="flex-shrink-0 font-medium text-primary text-sm">선택됨</span>
                    ) : (
                      <ChevronRight className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                    )}
                  </div>

                  {/* 추천 이유 */}
                  {rec.reasoning && (
                    <p className="mt-2 break-words pl-6 text-muted-foreground/80 text-sm">
                      {rec.reasoning}
                    </p>
                  )}

                  {/* 예상 리드 수 */}
                  {rec.estimatedLeadCount && (
                    <p className="mt-2 pl-6 text-muted-foreground/60 text-sm">
                      약 {rec.estimatedLeadCount.toLocaleString()}명의 잠재 바이어
                    </p>
                  )}
                </motion.button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
