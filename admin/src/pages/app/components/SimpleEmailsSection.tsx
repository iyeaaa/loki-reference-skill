import { motion } from "framer-motion"
import { Skeleton } from "@/components/ui/skeleton"

type EmailStep = {
  id: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
}

type SimpleEmailsSectionProps = {
  steps: EmailStep[]
  onEditStep: (step: EmailStep) => void
  isKorean: boolean
  isLoading?: boolean
}

export function SimpleEmailsSection({
  steps,
  onEditStep,
  isKorean,
  isLoading = false,
}: SimpleEmailsSectionProps) {
  const getDelayText = (delayDays: number, stepOrder: number) => {
    if (stepOrder === 1) {
      return isKorean ? "2분 뒤" : "In 2 min"
    }
    if (delayDays === 1) {
      return isKorean ? "1일 후" : "Day 1"
    }
    return isKorean ? `${delayDays}일 후` : `Day ${delayDays}`
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <h3 className="font-semibold text-gray-900 text-sm">
          {isKorean ? "영업 메일" : "Sales Emails"}
        </h3>
        <p className="text-gray-500 text-sm">
          {isKorean
            ? isLoading
              ? `${steps.length}단계+ 시퀀스 준비 중...`
              : `${steps.length}단계 시퀀스`
            : isLoading
              ? `${steps.length}+ step sequence loading...`
              : `${steps.length}-step sequence`}
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((step) => (
          <button
            className="w-full cursor-pointer rounded-xl border bg-card p-4 text-left transition-all hover:shadow-sm"
            key={step.id}
            onClick={() => onEditStep(step)}
            type="button"
          >
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500 font-semibold text-sm text-white">
                {step.stepOrder}
              </div>
              <div>
                <div className="text-gray-500 text-xs">Step {step.stepOrder}</div>
                <div className="text-gray-500 text-xs">
                  {getDelayText(step.delayDays, step.stepOrder)}
                </div>
              </div>
            </div>
            <h4 className="mb-2 font-medium text-gray-900 text-sm">
              {step.emailSubject || (isKorean ? "(제목 없음)" : "(No subject)")}
            </h4>
            <p className="line-clamp-3 text-gray-600 text-sm leading-relaxed">
              {step.emailBodyText || (isKorean ? "(본문 없음)" : "(No content)")}
            </p>
          </button>
        ))}
        {/* 로딩 중일 때 하단 스켈레톤 카드 표시 */}
        {isLoading &&
          Array.from({ length: 2 }).map((_, i) => (
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border bg-card p-4"
              initial={{ opacity: 0, y: 10 }}
              key={`loading-skeleton-email-${i}`}
              transition={{ delay: i * 0.1 }}
            >
              <div className="mb-3 flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="mb-1 h-4 w-16" />
                  <Skeleton className="h-3 w-12" />
                </div>
              </div>
              <Skeleton className="mb-2 h-5 w-3/4" />
              <Skeleton className="mb-1 h-3 w-full" />
              <Skeleton className="mb-1 h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </motion.div>
          ))}
      </div>
    </div>
  )
}
