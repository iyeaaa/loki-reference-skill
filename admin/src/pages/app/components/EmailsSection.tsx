import { Calendar, Clock, Edit3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

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

type EmailsSectionProps = {
  steps: EmailStep[]
  onEditStep: (step: EmailStep) => void
  isKorean: boolean
}

export function EmailsSection({ steps, onEditStep, isKorean }: EmailsSectionProps) {
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
    <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="font-semibold text-gray-900 text-sm">
            {isKorean ? "이메일 시퀀스" : "Email Sequence"}
          </h3>
          <p className="text-gray-500 text-sm">
            {isKorean
              ? `${steps.length}개 스텝으로 순차 발송`
              : `${steps.length} steps, sent sequentially`}
          </p>
        </div>

        {/* Email Steps - Vertical (Compact) */}
        <div className="space-y-2">
          {steps.map((step) => (
            <div
              className="group relative rounded-lg border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-2.5 transition-all hover:border-blue-200 hover:shadow-sm"
              key={step.id}
            >
              {/* Step header */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 font-semibold text-white text-xs">
                    {step.stepOrder}
                  </div>
                  <Badge className="h-5 px-1.5 text-xs" variant="secondary">
                    <Clock className="mr-0.5 h-2.5 w-2.5" />
                    {getDelayText(step.delayDays, step.stepOrder)}
                  </Badge>
                </div>
                <Button
                  className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={() => onEditStep(step)}
                  size="icon"
                  variant="ghost"
                >
                  <Edit3 className="h-2.5 w-2.5" />
                </Button>
              </div>

              {/* Subject only (no body preview) */}
              <p className="line-clamp-1 font-medium text-gray-900 text-xs">
                {step.emailSubject || (isKorean ? "(제목 없음)" : "(No subject)")}
              </p>
            </div>
          ))}
        </div>

        {/* Schedule info */}
        <div className="mt-2 flex items-center justify-center gap-1.5 text-gray-500 text-xs">
          <Calendar className="h-3 w-3" />
          <span>{isKorean ? "오늘 시작 → 매일 자동 발송" : "Starts today → Auto-sends daily"}</span>
        </div>
      </CardContent>
    </Card>
  )
}
