/**
 * PhaseChecklist Component
 *
 * Shows the progress of each phase in the onboarding generation process.
 * Provides visual feedback on completed, active, and pending phases.
 */

import { CheckCircle2, Circle, Loader2, Mail, Search, Users, Zap } from "lucide-react"
import { cn } from "@/lib/utils"

type PhaseStatus = "complete" | "active" | "pending"

type PhaseChecklistProps = {
  getPhaseStatus: (phase: string) => PhaseStatus
  isKorean: boolean
  leadCount: number
  emailCount: number
}

type PhaseItem = {
  id: string
  labelKr: string
  labelEn: string
  icon: React.ReactNode
  countKey?: "leads" | "emails"
}

// 토스 스타일 단계 표현
const phases: PhaseItem[] = [
  {
    id: "discovery",
    labelKr: "바이어 찾는 중",
    labelEn: "Finding buyers",
    icon: <Search className="h-4 w-4" />,
    countKey: "leads",
  },
  {
    id: "group",
    labelKr: "연락처 정리 중",
    labelEn: "Organizing contacts",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "templates",
    labelKr: "이메일 초안 작성 중",
    labelEn: "Drafting emails",
    icon: <Zap className="h-4 w-4" />,
  },
  {
    id: "previews",
    labelKr: "맞춤 이메일 완성 중",
    labelEn: "Personalizing emails",
    icon: <Mail className="h-4 w-4" />,
    countKey: "emails",
  },
]

function getStatusIcon(status: PhaseStatus) {
  switch (status) {
    case "complete":
      return <CheckCircle2 className="h-5 w-5 text-green-500" />
    case "active":
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
    default:
      return <Circle className="h-5 w-5 text-gray-300" />
  }
}

export function PhaseChecklist({
  getPhaseStatus,
  isKorean,
  leadCount,
  emailCount,
}: PhaseChecklistProps) {
  const counts = {
    leads: leadCount,
    emails: emailCount,
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 p-4">
      <div className="space-y-3">
        {phases.map((phase) => {
          const status = getPhaseStatus(phase.id)
          const count = phase.countKey ? counts[phase.countKey] : undefined

          return (
            <div
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                status === "active" && "bg-blue-50",
                status === "complete" && "bg-green-50/50",
              )}
              key={phase.id}
            >
              {/* Status Icon */}
              {getStatusIcon(status)}

              {/* Phase Icon & Label */}
              <div
                className={cn(
                  "flex items-center gap-2",
                  status === "active"
                    ? "text-blue-700"
                    : status === "complete"
                      ? "text-green-700"
                      : "text-gray-500",
                )}
              >
                {phase.icon}
                <span className="text-sm">{isKorean ? phase.labelKr : phase.labelEn}</span>
              </div>

              {/* Count Badge */}
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-xs",
                    status === "active"
                      ? "bg-blue-100 text-blue-700"
                      : status === "complete"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-500",
                  )}
                >
                  {count}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
