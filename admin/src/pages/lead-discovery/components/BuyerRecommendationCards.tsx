/**
 * Buyer Recommendation Cards Component
 * LangGraph에서 생성된 바이어 추천을 표시하고 선택하는 컴포넌트
 * 토스 스타일 - 심플하고 깔끔한 UI
 */

import { motion } from "framer-motion"
import { Check, ChevronRight, FileText, MapPin, Target } from "lucide-react"
import type React from "react"
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
}

export function BuyerRecommendationCards({
  recommendations,
  onSelect,
  disabled = false,
  selectedId,
  analysisSummary,
  className,
}: BuyerRecommendationCardsProps) {
  // 코드 펜스 제거 처리
  const cleanAnalysisSummary = analysisSummary ? stripCodeFences(analysisSummary) : ""

  if (recommendations.length === 0) return null

  const hasSelection = !!selectedId

  return (
    <div className={cn("space-y-4", className)}>
      {/* AI 분석 요약 */}
      {cleanAnalysisSummary && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="p-5 rounded-xl bg-muted/30 border border-border/50"
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">웹사이트 분석 리포트</span>
          </div>
          {/* @ts-ignore - Complex markdown component types */}
          <div className="prose prose-sm max-w-none dark:prose-invert [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown components={markdownComponents}>{cleanAnalysisSummary}</ReactMarkdown>
          </div>
        </motion.div>
      )}

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
                !hasSelection && "hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99]",
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
    </div>
  )
}
