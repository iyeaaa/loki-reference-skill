import { motion } from "framer-motion"
import { CompanyAvatar } from "@/components/CompanyAvatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
  contactName?: string
  description?: string
  employeeCount?: string
  businessType?: string
  websiteUrl?: string
  score?: number // LLM 평가 점수 (0-100)
}

type SimpleLeadsSectionProps = {
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
  isKorean: boolean
  isLoading?: boolean
}

/**
 * 점수에 따른 배지 색상 결정
 */
function getScoreBadgeStyle(score: number): string {
  if (score >= 80) {
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
  }
  if (score >= 60) {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
  }
  if (score >= 40) {
    return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
  }
  return "bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
}

export function SimpleLeadsSection({
  leads,
  onLeadClick,
  isKorean,
  isLoading = false,
}: SimpleLeadsSectionProps) {
  return (
    <div className="flex h-full flex-col">
      {/* 테이블 헤더 */}
      <div className="shrink-0 border-b bg-muted/30">
        <div className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-2.5 font-medium text-muted-foreground text-xs">
          <div className="text-center">#</div>
          <div>{isKorean ? "회사명" : "Company"}</div>
          <div>{isKorean ? "설명" : "Description"}</div>
          <div>{isKorean ? "국가" : "Country"}</div>
          <div className="text-center">{isKorean ? "적합도" : "Fit"}</div>
          <div>{isKorean ? "이메일" : "Email"}</div>
        </div>
      </div>

      {/* 테이블 바디 - 스켈레톤과 동일한 grid 구조 */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="divide-y divide-border">
          {leads.map((lead, index) => (
            <button
              className="grid w-full cursor-pointer grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-3 text-left text-sm transition-colors hover:bg-muted/30"
              key={lead.id}
              onClick={() => onLeadClick(lead)}
              type="button"
            >
              <div className="flex items-center justify-center text-muted-foreground text-xs tabular-nums">
                {index + 1}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <CompanyAvatar
                  companyName={lead.companyName}
                  size="sm"
                  websiteUrl={lead.websiteUrl}
                />
                <span className="truncate font-medium text-foreground">{lead.companyName}</span>
              </div>
              <div className="flex min-w-0 items-center">
                <span className="line-clamp-2 text-muted-foreground text-xs">
                  {lead.description || "-"}
                </span>
              </div>
              <div className="flex items-center justify-center">
                <span className="text-muted-foreground text-xs">{lead.country || "-"}</span>
              </div>
              <div className="flex items-center justify-center">
                {lead.score !== null && lead.score !== undefined ? (
                  <Badge
                    className={cn(
                      "min-w-[42px] justify-center px-1.5 font-medium text-xs tabular-nums",
                      getScoreBadgeStyle(lead.score),
                    )}
                    variant="secondary"
                  >
                    {lead.score}
                  </Badge>
                ) : (
                  <span className="text-muted-foreground text-xs">-</span>
                )}
              </div>
              <div className="flex min-w-0 items-center">
                <span className="truncate text-muted-foreground text-xs">
                  {lead.email || (isKorean ? "없음" : "N/A")}
                </span>
              </div>
            </button>
          ))}
          {/* 로딩 중일 때 하단 스켈레톤 행 표시 */}
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <motion.div
                animate={{ opacity: 1 }}
                className="grid grid-cols-[48px_minmax(100px,1fr)_minmax(100px,1.5fr)_50px_60px_minmax(140px,1.5fr)] gap-2 px-4 py-3"
                initial={{ opacity: 0 }}
                key={`loading-skeleton-${i}`}
                transition={{ delay: i * 0.1 }}
              >
                <Skeleton className="mx-auto h-4 w-6" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="mx-auto h-4 w-5" />
                <Skeleton className="mx-auto h-4 w-10" />
                <Skeleton className="h-4 w-24" />
              </motion.div>
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}
