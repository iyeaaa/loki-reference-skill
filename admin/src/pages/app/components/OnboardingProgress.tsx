/**
 * OnboardingProgress Component
 *
 * 온보딩 자동 생성 진행 상황을 실시간으로 표시하는 컴포넌트
 * SSE를 통해 BullMQ worker의 진행 상황을 실시간으로 받아 표시
 */

import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Progress } from "@/components/ui/progress"
import {
  type OnboardingPhase,
  type OnboardingProgressEvent,
  useOnboardingSSE,
} from "@/lib/api/hooks/onboarding"
import { cn } from "@/lib/utils"

// ============================================================================
// Types
// ============================================================================

type OnboardingProgressProps = {
  workspaceId: string
  enabled?: boolean
  onComplete?: (event: OnboardingProgressEvent) => void
  onError?: (event: OnboardingProgressEvent) => void
  className?: string
}

type PhaseInfo = {
  key: OnboardingPhase
  labelEn: string
  labelKr: string
  startPercent: number
  endPercent: number
}

// ============================================================================
// Constants
// ============================================================================

const PHASES: PhaseInfo[] = [
  {
    key: "discovery",
    labelEn: "Lead Discovery",
    labelKr: "리드 탐색",
    startPercent: 0,
    endPercent: 30,
  },
  { key: "group", labelEn: "Create Group", labelKr: "그룹 생성", startPercent: 30, endPercent: 40 },
  {
    key: "templates",
    labelEn: "Generate Templates",
    labelKr: "템플릿 생성",
    startPercent: 40,
    endPercent: 65,
  },
  {
    key: "sequence",
    labelEn: "Create Sequence",
    labelKr: "시퀀스 생성",
    startPercent: 65,
    endPercent: 75,
  },
  {
    key: "previews",
    labelEn: "Generate Previews",
    labelKr: "프리뷰 생성",
    startPercent: 75,
    endPercent: 95,
  },
  { key: "complete", labelEn: "Complete", labelKr: "완료", startPercent: 95, endPercent: 100 },
]

// ============================================================================
// Helper Functions
// ============================================================================

function getPhaseStatus(
  currentPhase: OnboardingPhase | null,
  targetPhase: OnboardingPhase,
  isComplete: boolean,
  hasError: boolean,
): "pending" | "active" | "completed" | "error" {
  if (hasError && currentPhase === targetPhase) {
    return "error"
  }
  if (isComplete) {
    return "completed"
  }
  if (!currentPhase) {
    return "pending"
  }

  const phaseOrder = PHASES.map((p) => p.key)
  const currentIndex = phaseOrder.indexOf(currentPhase)
  const targetIndex = phaseOrder.indexOf(targetPhase)

  if (targetIndex < currentIndex) {
    return "completed"
  }
  if (targetIndex === currentIndex) {
    return "active"
  }
  return "pending"
}

function formatDetails(
  phase: OnboardingPhase | null,
  details: OnboardingProgressEvent["details"] | undefined,
  isKorean: boolean,
): string {
  if (!(details && phase)) {
    return ""
  }

  switch (phase) {
    case "discovery":
      // 리드 발견 상세 정보는 표시하지 않음 (메인 메시지에서 이미 표시)
      break
    case "templates":
      if (details.templatesGenerated !== undefined && details.totalTemplates) {
        return isKorean
          ? `${details.templatesGenerated}/${details.totalTemplates} 템플릿`
          : `${details.templatesGenerated}/${details.totalTemplates} templates`
      }
      break
    case "previews":
      if (details.previewsGenerated !== undefined && details.totalPreviews) {
        return isKorean
          ? `${details.previewsGenerated}/${details.totalPreviews} 프리뷰`
          : `${details.previewsGenerated}/${details.totalPreviews} previews`
      }
      break
  }

  return ""
}

// ============================================================================
// Sub-Components
// ============================================================================

type PhaseIndicatorProps = {
  phase: PhaseInfo
  status: "pending" | "active" | "completed" | "error"
  isKorean: boolean
}

function PhaseIndicator({ phase, status, isKorean }: PhaseIndicatorProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full px-3 py-1.5 font-medium text-xs transition-all",
        status === "completed" &&
          "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
        status === "active" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
        status === "pending" && "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500",
        status === "error" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      )}
    >
      {status === "completed" && <CheckCircle2 className="h-3.5 w-3.5" />}
      {status === "active" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {status === "pending" && <div className="h-3.5 w-3.5 rounded-full border-2 border-current" />}
      {status === "error" && <XCircle className="h-3.5 w-3.5" />}
      <span>{isKorean ? phase.labelKr : phase.labelEn}</span>
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function OnboardingProgress({
  workspaceId,
  enabled = true,
  onComplete,
  onError,
  className,
}: OnboardingProgressProps) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"

  const { progress, phase, progressPercent, message, isComplete, hasError } = useOnboardingSSE(
    workspaceId,
    {
      enabled,
      onComplete,
      onError,
    },
  )

  // Don't render if not connected and no progress
  if (!enabled) {
    return null
  }

  const details = formatDetails(phase, progress?.details, isKorean)

  return (
    <div className={cn("space-y-4 rounded-lg border bg-card p-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-sm">
          {isKorean ? "자동 생성 진행 중" : "Auto-generation in progress"}
        </h3>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Progress
          className={cn(
            "h-2",
            hasError && "bg-red-100 dark:bg-red-900/30",
            isComplete && "bg-green-100 dark:bg-green-900/30",
          )}
          value={progressPercent}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {message || (isKorean ? "준비 중..." : "Preparing...")}
          </span>
          <span className="font-medium">{progressPercent > 0 ? `${progressPercent}%` : ""}</span>
        </div>
        {details && <div className="text-muted-foreground text-xs">{details}</div>}
      </div>

      {/* Phase Indicators */}
      <div className="flex flex-wrap gap-2">
        {PHASES.slice(0, -1).map((phaseInfo) => (
          <PhaseIndicator
            isKorean={isKorean}
            key={phaseInfo.key}
            phase={phaseInfo}
            status={getPhaseStatus(
              phase,
              phaseInfo.key,
              isComplete,
              hasError && phase === phaseInfo.key,
            )}
          />
        ))}
      </div>

      {/* Status Message */}
      {isComplete && (
        <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span>{isKorean ? "자동 생성이 완료되었습니다!" : "Auto-generation completed!"}</span>
        </div>
      )}

      {hasError && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
          <XCircle className="h-4 w-4" />
          <span>
            {progress?.details?.error || (isKorean ? "오류가 발생했습니다" : "An error occurred")}
          </span>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Compact Variant
// ============================================================================

type OnboardingProgressCompactProps = {
  workspaceId: string
  enabled?: boolean
  className?: string
}

/**
 * 컴팩트 버전의 진행 상황 표시 컴포넌트
 * 헤더나 사이드바에 사용하기 적합
 */
export function OnboardingProgressCompact({
  workspaceId,
  enabled = true,
  className,
}: OnboardingProgressCompactProps) {
  const { i18n } = useTranslation()
  const isKorean = i18n.language === "ko"

  const { isConnected, progress, progressPercent, message, isComplete, hasError } =
    useOnboardingSSE(workspaceId, { enabled })

  if (!(enabled && (isConnected || progress))) {
    return null
  }

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Status Icon */}
      {isComplete ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : hasError ? (
        <XCircle className="h-4 w-4 text-red-500" />
      ) : (
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      )}

      {/* Progress Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Progress className="h-1.5 flex-1" value={progressPercent} />
          <span className="whitespace-nowrap text-muted-foreground text-xs">
            {progressPercent}%
          </span>
        </div>
        <p className="mt-0.5 truncate text-muted-foreground text-xs">
          {message || (isKorean ? "처리 중..." : "Processing...")}
        </p>
      </div>
    </div>
  )
}

// ============================================================================
// Exports
// ============================================================================

export type { OnboardingProgressProps, OnboardingProgressCompactProps }
