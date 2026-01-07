/**
 * StepBuyerLoading - Step 3: 바이어 찾고 이메일 생성 (로딩 화면)
 *
 * Unipile 연동 완료 후 백그라운드 작업이 아직 진행 중일 때 표시되는 화면.
 * SSE를 통해 실시간 진행 상황을 보여주고, 완료 시 Step 4로 자동 이동.
 *
 * NEW: 통합 Onboarding Progress Store 사용
 * - NotificationBell과 상태 공유
 * - Phase별 Fake Progress 지원
 * - 재접속 시 캐시 상태 복원
 */

import { CheckCircle2, Circle, Loader2, Mail, Search, Users, XCircle, Zap } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { StarSpinner } from "@/components/chatbot/StarSpinner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { trackOnboardingStep3Complete } from "@/lib/analytics"
import { useOnboardingProgress as useOnboardingProgressAPI } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { cn } from "@/lib/utils"
import { useOnboardingProgress, useResetOnboardingProgress } from "@/store/onboarding-progress"

type ViewState = "loading" | "generating" | "complete" | "error"

// Phase Checklist 컴포넌트 (간소화 버전)
type PhaseStatus = "complete" | "active" | "pending"

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

const phases = [
  { id: "discovery", labelKr: "바이어 찾는 중", labelEn: "Finding buyers", icon: Search },
  { id: "group", labelKr: "리스트 정리하는 중", labelEn: "Organizing list", icon: Users },
  { id: "templates", labelKr: "이메일 초안 쓰는 중", labelEn: "Writing email drafts", icon: Zap },
  {
    id: "previews",
    labelKr: "맞춤 이메일 쓰는 중",
    labelEn: "Writing personalized emails",
    icon: Mail,
  },
]

function PhaseChecklist({
  getPhaseStatus,
  isKorean,
}: {
  getPhaseStatus: (phase: string) => PhaseStatus
  isKorean: boolean
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-gray-50 to-slate-50 p-4">
      <div className="space-y-3">
        {phases.map((phase) => {
          const status = getPhaseStatus(phase.id)
          const Icon = phase.icon

          return (
            <div
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                status === "active" && "bg-blue-50",
                status === "complete" && "bg-green-50/50",
              )}
              key={phase.id}
            >
              {getStatusIcon(status)}
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
                <Icon className="h-4 w-4" />
                <span className="text-sm">{isKorean ? phase.labelKr : phase.labelEn}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function StepBuyerLoading() {
  const { i18n } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewState, setViewState] = useState<ViewState>("loading")
  const currentStep = searchParams.get("step")
  const isFromStep4 = searchParams.get("from") === "step4"
  const isKorean = i18n.language === "ko"
  const resetProgress = useResetOnboardingProgress()

  // Get current user and workspace
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}")
    } catch {
      return {}
    }
  }, [])
  const userId = currentUser?.id || ""

  const { data: userWorkspaces, isLoading: workspacesLoading } = useUserWorkspaces(!!userId)
  const workspaceId = userWorkspaces?.[0]?.id || ""

  // Get onboarding progress from DB (for initial state check)
  const { data: onboardingData, isLoading: onboardingLoading } = useOnboardingProgressAPI(
    workspaceId,
    !!workspaceId,
  )

  // SSE 연결 조건: workspaceId가 있고, 로딩이 끝났으면 바로 연결
  // (캐시된 상태가 있으면 즉시 수신됨)
  const shouldEnableSSE = !!workspaceId && !workspacesLoading

  // NEW: 통합 Onboarding Progress Hook 사용
  const {
    phase,
    displayProgress,
    message,
    parallelProgress,
    isComplete: sseComplete,
    hasError: sseError,
    leads,
  } = useOnboardingProgress(workspaceId, {
    enabled: shouldEnableSSE,
    onComplete: () => {
      // 📊 Analytics: Step 3 완료 이벤트 추적
      trackOnboardingStep3Complete({
        leadsFound: leads?.length || 0,
      })
      // 완료 시 Step 4로 자동 이동
      setSearchParams({ step: "4" })
    },
    onError: () => {
      setViewState("error")
    },
  })

  // Use progress from unified store (includes fake progress)
  const progressPercent = displayProgress

  // Determine initial view state based on job status
  useEffect(() => {
    // URL이 step=3이 아니면 이 컴포넌트의 로직을 실행하지 않음
    // (다른 step으로 이동 중일 때 리다이렉트 방지)
    if (currentStep !== "3") {
      return
    }

    if (workspacesLoading || onboardingLoading) {
      setViewState("loading")
      return
    }

    const jobStatus = onboardingData?.jobStatus

    if (jobStatus === "active" || jobStatus === "waiting") {
      setViewState("generating")
    } else if (jobStatus === "completed") {
      // Step 4에서 "이전" 버튼으로 돌아온 경우 리다이렉트하지 않음
      if (isFromStep4) {
        setViewState("complete")
      } else {
        // 이미 완료됨 - Step 4로 이동
        setSearchParams({ step: "4" })
      }
    } else if (jobStatus === "failed") {
      setViewState("error")
    } else {
      // Step 4에서 "이전" 버튼으로 돌아온 경우 리다이렉트하지 않음
      if (isFromStep4) {
        setViewState("complete")
      } else {
        // 알 수 없는 상태 - Step 4로 이동
        setSearchParams({ step: "4" })
      }
    }
  }, [
    currentStep,
    workspacesLoading,
    onboardingLoading,
    onboardingData?.jobStatus,
    setSearchParams,
    isFromStep4,
  ])

  // Handle SSE state changes
  useEffect(() => {
    if (sseComplete && viewState === "generating") {
      setSearchParams({ step: "4" })
    }
    if (sseError && viewState === "generating") {
      setViewState("error")
    }
  }, [sseComplete, sseError, viewState, setSearchParams])

  // Cleanup: Reset progress state on unmount (페이지 전환 시)
  useEffect(
    () => () => {
      if (workspaceId) {
        resetProgress(workspaceId)
      }
    },
    [workspaceId, resetProgress],
  )

  const handleRetry = useCallback(() => {
    if (workspaceId) {
      resetProgress(workspaceId)
    }
    setViewState("generating")
  }, [workspaceId, resetProgress])

  const handleBack = useCallback(() => {
    setSearchParams({ step: "2" })
  }, [setSearchParams])

  // Get phase info for checklist
  const getPhaseStatus = useCallback(
    (targetPhase: string): PhaseStatus => {
      if (!phase) {
        return "pending"
      }
      const phaseOrder = ["discovery", "group", "templates", "sequence", "previews", "complete"]
      const currentIndex = phaseOrder.indexOf(phase)
      const targetIndex = phaseOrder.indexOf(targetPhase)

      if (targetIndex < currentIndex) {
        return "complete"
      }
      if (targetIndex === currentIndex) {
        return "active"
      }
      return "pending"
    },
    [phase],
  )

  // Calculate stats
  const leadCount = leads.length || onboardingData?.selectedLeadIds?.length || 0
  const completedLeads = leads.filter((l) => l.status === "done").length

  // Loading State
  if (viewState === "loading") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-4">
              <StarSpinner size={48} />
            </div>
            <p className="text-gray-500 text-sm">
              {isKorean ? "준비 중이에요..." : "Getting ready..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error State
  if (viewState === "error") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "잠깐 문제가 생겼어요" : "Something went wrong"}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {isKorean ? "다시 시도해 주세요" : "Please try again"}
            </p>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline">
                {isKorean ? "이전" : "Back"}
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRetry}>
                {isKorean ? "다시 시도" : "Try again"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Complete State (Step 4에서 "이전" 버튼으로 돌아온 경우)
  if (viewState === "complete") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "바이어와 이메일이 준비됐어요" : "Buyers and emails are ready"}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {isKorean
                ? `${leadCount}명의 바이어에게 보낼 이메일이 생성됐어요`
                : `Emails for ${leadCount} buyers have been generated`}
            </p>
            <div className="flex gap-3">
              <Button onClick={handleBack} variant="outline">
                {isKorean ? "이전" : "Back"}
              </Button>
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setSearchParams({ step: "4" })}
              >
                {isKorean ? "다음" : "Next"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Generating State (Main UI)
  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <StarSpinner size={24} />
            {isKorean ? "바이어 찾고 이메일 생성" : "Finding buyers & generating emails"}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {message ||
              (isKorean
                ? "바이어를 찾고 맞춤 이메일을 작성 중이에요"
                : "Finding buyers and writing personalized emails")}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{isKorean ? "진행 중" : "In progress"}</span>
              <span className="font-medium text-blue-600">{Math.round(progressPercent)}%</span>
            </div>
            <Progress className="h-3" value={progressPercent} />
          </div>

          {/* Parallel Progress (Discovery + Templates) */}
          {parallelProgress && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {isKorean ? "바이어 검색" : "Finding Buyers"}
                  </span>
                  <span className="text-gray-600">
                    {parallelProgress.discovery.done
                      ? "✓"
                      : `${parallelProgress.discovery.percent}%`}
                  </span>
                </div>
                {!parallelProgress.discovery.done && (
                  <Progress className="h-2" value={parallelProgress.discovery.percent} />
                )}
              </div>

              <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-700">
                    {isKorean ? "이메일 생성" : "Writing Emails"}
                  </span>
                  <span className="text-gray-600">
                    {parallelProgress.templates.done
                      ? "✓"
                      : `${parallelProgress.templates.percent}%`}
                  </span>
                </div>
                {!parallelProgress.templates.done && (
                  <Progress className="h-2" value={parallelProgress.templates.percent} />
                )}
              </div>
            </div>
          )}

          {/* Phase Checklist */}
          <PhaseChecklist getPhaseStatus={getPhaseStatus} isKorean={isKorean} />

          {/* Real-time Lead Cards (간소화) */}
          {leads.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">
                  {isKorean ? `찾은 바이어 ${completedLeads}명` : `Found ${completedLeads} buyers`}
                </h3>
                <span className="text-gray-400 text-sm">
                  {isKorean ? `총 ${leadCount}명` : `Total: ${leadCount}`}
                </span>
              </div>
              <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-lg border p-3">
                {leads.slice(0, 10).map((lead) => (
                  <div
                    className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2"
                    key={lead.leadId}
                  >
                    <span className="truncate text-gray-700 text-sm">{lead.companyName}</span>
                    <span
                      className={cn(
                        "text-xs",
                        lead.status === "done" ? "text-green-600" : "text-gray-400",
                      )}
                    >
                      {lead.status === "done"
                        ? isKorean
                          ? "완료"
                          : "Done"
                        : isKorean
                          ? "진행 중"
                          : "Processing"}
                    </span>
                  </div>
                ))}
                {leads.length > 10 && (
                  <p className="text-center text-gray-400 text-xs">
                    +{leads.length - 10}
                    {isKorean ? "개 더" : " more"}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
