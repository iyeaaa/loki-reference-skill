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
    <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3 mt-5 text-xl font-bold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-2 mt-4 text-lg font-semibold first:mt-0">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 mt-3 text-base font-semibold first:mt-0">{children}</h4>
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
    <blockquote className="mb-4 border-l-4 border-border pl-4 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className
    return isInline ? (
      <code className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">{children}</code>
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
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline hover:text-primary/80"
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

interface BuyerRecommendationCardsProps {
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
  if (!isAnalyzing && !isLoadingRecommendations && recommendations.length === 0) return null

  const hasSelection = !!selectedId

  // 분석 리포트 표시 여부 (스트리밍 중이거나 완료 후)
  const showAnalysisReport = cleanAnalysisSummary && (isAnalyzing || isAnalysisComplete)

  return (
    <div className={cn("space-y-4", className)}>
      {/* AI 분석 요약 - 스트리밍 중이거나 완료 후 표시, 접기/펼치기 가능 */}
      {showAnalysisReport && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl bg-muted/30 border border-border/50 overflow-hidden"
        >
          <button
            type="button"
            onClick={() => setIsReportExpanded(!isReportExpanded)}
            className="w-full flex items-center justify-between gap-2 p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">웹사이트 분석 리포트</span>
              {!isReportExpanded && (
                <span
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    isAnalyzing
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      분석 중
                    </>
                  ) : (
                    <>
                      <Check className="w-3 h-3" />
                      분석 완료
                    </>
                  )}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                "w-4 h-4 text-muted-foreground transition-transform duration-200",
                !isReportExpanded && "-rotate-90",
              )}
            />
          </button>
          <AnimatePresence initial={false}>
            {isReportExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="px-5 pb-5 pt-0 border-t border-border/50">
                  {/* @ts-ignore - Complex markdown component types */}
                  <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-4 [&>*:last-child]:mb-0">
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
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="flex items-center gap-3 py-4"
        >
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
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
            <span className="text-sm font-medium text-foreground">
              {hasSelection ? "선택한 바이어 타겟" : "이런 바이어를 추천해요"}
            </span>
          </div>

          {/* 카드 목록 */}
          <div className="space-y-2">
            {recommendations.map((rec, index) => {
              const isSelected = rec.id === selectedId
              const isOther = hasSelection && !isSelected

              // 선택 후에는 선택된 카드만 표시
              if (isOther) return null

              return (
                <motion.button
                  key={rec.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  type="button"
                  onClick={() => !hasSelection && onSelect(rec)}
                  disabled={disabled || hasSelection}
                  className={cn(
                    "group w-full text-left rounded-xl border bg-card p-4 transition-all",
                    !hasSelection &&
                      "hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]",
                    isSelected && "border-primary bg-primary/5",
                    disabled && !isSelected && "opacity-50 cursor-not-allowed",
                    hasSelection && !isSelected && "hidden",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* 왼쪽: 국가 & 산업 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        {isSelected ? (
                          <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                        ) : (
                          <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <span
                          className={cn(
                            "text-base font-medium break-words",
                            isSelected ? "text-primary" : "text-foreground",
                          )}
                        >
                          {rec.country}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground break-words pl-6">
                        {rec.industry}
                        {rec.subIndustry && ` · ${rec.subIndustry}`}
                      </p>
                    </div>

                    {/* 오른쪽: 체크 또는 화살표 */}
                    {isSelected ? (
                      <span className="text-sm text-primary font-medium flex-shrink-0">선택됨</span>
                    ) : (
                      <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0 mt-0.5" />
                    )}
                  </div>

                  {/* 추천 이유 */}
                  {rec.reasoning && (
                    <p className="mt-2 text-sm text-muted-foreground/80 pl-6 break-words">
                      {rec.reasoning}
                    </p>
                  )}

                  {/* 예상 리드 수 */}
                  {rec.estimatedLeadCount && (
                    <p className="mt-2 text-sm text-muted-foreground/60 pl-6">
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
