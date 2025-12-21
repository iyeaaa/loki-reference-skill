/**
 * StepLeadGeneration - Unified Step 2: Lead Discovery & Email Generation
 *
 * Combines the previous Step 2 (lead discovery) and Step 3 (email generation)
 * into a single, streamlined experience optimized for 20 leads / 40 emails.
 *
 * Features:
 * - Real-time lead cards showing discovery/enrichment/email status
 * - Inline email preview within each lead card
 * - Phase-based progress tracking with SSE
 * - Seamless transition from discovery to email generation
 */

import { ArrowRight, CheckCircle2, Loader2, Mail, Sparkles, Users, XCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { useEmails } from "@/lib/api/hooks/emails"
import {
  type EmailProgressItem,
  type LeadProgressItem,
  useOnboardingProgress,
  useOnboardingSSE,
} from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { LeadCard } from "./LeadCard"
import { PhaseChecklist } from "./PhaseChecklist"

type ViewState = "loading" | "initial" | "generating" | "complete" | "error"

// Target counts for progress calculation
const TARGET_LEADS = 20

export function StepLeadGeneration() {
  const { i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [viewState, setViewState] = useState<ViewState>("loading") // Start with loading
  const [leads, setLeads] = useState<LeadProgressItem[]>([])
  const [emails, setEmails] = useState<EmailProgressItem[]>([])
  const isKorean = i18n.language === "ko"

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

  // Get onboarding progress from DB
  const {
    data: onboardingData,
    isLoading: onboardingLoading,
    refetch: refetchOnboarding,
  } = useOnboardingProgress(workspaceId, !!workspaceId)

  // Fetch generated emails from DB
  const sequenceId = onboardingData?.generatedSequenceId || ""
  const { data: emailsData, refetch: refetchEmails } = useEmails({
    workspaceId,
    sequenceId: sequenceId || undefined,
    limit: 100,
  })

  // SSE for real-time progress updates
  // Enable SSE when job is active/waiting (from DB) or when viewState is generating
  const shouldEnableSSE =
    !!workspaceId &&
    (viewState === "generating" ||
      onboardingData?.jobStatus === "active" ||
      onboardingData?.jobStatus === "waiting")

  const {
    progress: sseProgress,
    phase,
    progressPercent,
    message,
    isComplete: sseComplete,
    hasError: sseError,
  } = useOnboardingSSE(workspaceId, {
    enabled: shouldEnableSSE,
    onProgress: (event) => {
      // Update leads from SSE
      if (event.details?.leads) {
        setLeads(event.details.leads)
      } else if (event.details?.currentLead) {
        const currentLead = event.details.currentLead
        setLeads((prev) => {
          const existing = prev.find((l) => l.leadId === currentLead.leadId)
          if (existing) {
            return prev.map((l) => (l.leadId === currentLead.leadId ? currentLead : l))
          }
          return [...prev, currentLead]
        })
      }

      // Update emails from SSE
      if (event.details?.emails) {
        setEmails(event.details.emails)
      } else if (event.details?.recentEmail) {
        const recentEmail = event.details.recentEmail
        setEmails((prev) => {
          const existing = prev.find((e) => e.emailId === recentEmail.emailId)
          if (!existing) {
            return [...prev, recentEmail]
          }
          return prev
        })
      }
    },
    onComplete: () => {
      console.log("[StepLeadGeneration] SSE complete")
      setViewState("complete")
      refetchOnboarding()
      refetchEmails()
    },
    onError: (event) => {
      console.error("[StepLeadGeneration] SSE error:", event)
      setViewState("error")
    },
  })

  // Determine initial view state based on job status
  useEffect(() => {
    // Wait for data to load
    if (workspacesLoading || onboardingLoading) {
      setViewState("loading")
      return
    }

    // Once data is loaded, determine the appropriate state
    const jobStatus = onboardingData?.jobStatus

    if (jobStatus === "active" || jobStatus === "waiting") {
      // Job is running or queued - show generating state
      setViewState("generating")
    } else if (jobStatus === "completed") {
      // Job is completed - show complete state (regardless of lead count)
      setViewState("complete")
    } else if (jobStatus === "failed") {
      // Job failed - show error state
      setViewState("error")
    } else {
      // No job or unknown status - show initial state
      // This should rarely happen since job is auto-queued on registration
      setViewState("initial")
    }
  }, [workspacesLoading, onboardingLoading, onboardingData?.jobStatus])

  // Handle SSE state changes
  useEffect(() => {
    if (sseComplete && viewState === "generating") {
      setViewState("complete")
      refetchOnboarding()
      refetchEmails()
    }
    if (sseError && viewState === "generating") {
      setViewState("error")
    }
  }, [sseComplete, sseError, viewState, refetchOnboarding, refetchEmails])

  const handleStartGeneration = useCallback(() => {
    setViewState("generating")
  }, [])

  const handleNext = useCallback(() => {
    // Go to step 3 (email linking)
    setSearchParams({ step: "3" })
  }, [setSearchParams])

  const handleRetry = useCallback(() => {
    setLeads([])
    setEmails([])
    setViewState("generating")
  }, [])

  // Calculate stats
  const leadCount = leads.length || onboardingData?.selectedLeadIds?.length || 0
  const emailCount = emails.length || emailsData?.emails?.length || 0
  const completedLeads = leads.filter((l) => l.status === "done").length

  // Map DB emails to display format for complete state
  const displayEmails = useMemo(() => {
    if (emailsData?.emails?.length) {
      return emailsData.emails.map((e) => ({
        id: e.id,
        subject: e.subject || "",
        body: e.bodyText || "",
        leadName: e.leadName || e.toEmail || "",
        leadId: e.leadId || "",
        step: 1, // Will be grouped by lead
      }))
    }
    return []
  }, [emailsData?.emails])

  // Get phase info for checklist
  const getPhaseStatus = useCallback(
    (targetPhase: string) => {
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

  // Loading State (데이터 로딩 중)
  if (viewState === "loading") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
            <p className="text-gray-500 text-sm">
              {isKorean ? "준비 중이에요..." : "Getting ready..."}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error State (친근한 에러 메시지)
  if (viewState === "error") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center px-8 py-16">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-10 w-10 text-red-500" />
            </div>
            <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
              {isKorean ? "앗, 문제가 생겼어요" : "Oops, something went wrong"}
            </h2>
            <p className="mb-6 text-center text-gray-500 text-sm">
              {sseProgress?.details?.error ||
                (isKorean
                  ? "일시적인 오류예요. 다시 시도해주세요"
                  : "This is temporary. Please try again")}
            </p>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleRetry}>
              {isKorean ? "다시 시도하기" : "Try again"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Complete State (성취감 + 다음 단계 안내)
  if (viewState === "complete") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
              {isKorean ? "준비 완료!" : "All set!"}
            </CardTitle>
            <p className="mt-1 text-gray-600 text-sm">
              {isKorean
                ? "바이어와 이메일이 모두 준비됐어요. 이제 발송만 하면 돼요"
                : "Buyers and emails are ready. Just connect your email to start sending"}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
                <Users className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="font-bold text-2xl text-blue-600">{leadCount}</p>
                  <p className="text-gray-600 text-sm">{isKorean ? "바이어" : "Buyers"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 p-4">
                <Mail className="h-8 w-8 text-green-600" />
                <div>
                  <p className="font-bold text-2xl text-green-600">{emailCount}</p>
                  <p className="text-gray-600 text-sm">{isKorean ? "이메일" : "Emails"}</p>
                </div>
              </div>
            </div>

            {/* Lead Cards with Emails */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">
                {isKorean ? "찾은 바이어 목록" : "Found buyers"}
              </h3>
              <div className="max-h-[400px] space-y-2 overflow-y-auto">
                {leads.length > 0
                  ? leads.map((lead) => (
                      <LeadCard
                        emails={displayEmails.filter((e) => e.leadId === lead.leadId)}
                        isKorean={isKorean}
                        key={lead.leadId}
                        lead={lead}
                      />
                    ))
                  : // Fallback: group emails by leadName if we don't have lead data
                    Array.from(new Set(displayEmails.map((e) => e.leadId))).map((leadId) => {
                      const leadEmails = displayEmails.filter((e) => e.leadId === leadId)
                      const firstEmail = leadEmails[0]
                      return (
                        <LeadCard
                          emails={leadEmails}
                          isKorean={isKorean}
                          key={leadId}
                          lead={{
                            leadId,
                            companyName: firstEmail?.leadName || "Unknown",
                            status: "done",
                            emailCount: leadEmails.length,
                          }}
                        />
                      )
                    })}
              </div>
            </div>

            {/* Next Button */}
            <div className="flex justify-end pt-4">
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleNext}>
                {isKorean ? "발송 계정 연결하기" : "Connect email account"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Generating State (AI 에이전틱 UX)
  if (viewState === "generating") {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <div className="relative">
                <Sparkles className="h-6 w-6 text-blue-500" />
                <div className="-inset-1 absolute animate-ping rounded-full bg-blue-400/30" />
              </div>
              {isKorean ? "AI가 일하고 있어요" : "AI is working"}
            </CardTitle>
            <p className="mt-1 text-gray-600 text-sm">
              {message ||
                (isKorean
                  ? "잠시만 기다려주세요, 딱 맞는 바이어를 찾고 있어요"
                  : "Please wait while I find the perfect buyers for you")}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">{isKorean ? "진행 중" : "In progress"}</span>
                <span className="font-medium text-blue-600">{progressPercent}%</span>
              </div>
              <Progress className="h-3" value={progressPercent} />
            </div>

            {/* Phase Checklist */}
            <PhaseChecklist
              emailCount={emails.length}
              getPhaseStatus={getPhaseStatus}
              isKorean={isKorean}
              leadCount={leadCount}
            />

            {/* Real-time Lead Cards */}
            {leads.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">
                    {isKorean
                      ? `찾은 바이어 ${completedLeads}명`
                      : `Found ${completedLeads} buyers`}
                  </h3>
                  <span className="text-gray-400 text-sm">
                    {isKorean ? `목표 ${TARGET_LEADS}명` : `Target: ${TARGET_LEADS}`}
                  </span>
                </div>
                <div className="max-h-[300px] space-y-2 overflow-y-auto">
                  {leads.map((lead) => (
                    <LeadCard
                      emails={emails.filter((e) => e.leadId === lead.leadId)}
                      isKorean={isKorean}
                      key={lead.leadId}
                      lead={lead}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Loading indicator when no leads yet */}
            {leads.length === 0 && (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="mb-4 h-12 w-12 animate-spin text-blue-500" />
                <p className="text-gray-500 text-sm">
                  {isKorean
                    ? "회사에 맞는 바이어를 찾고 있어요..."
                    : "Looking for buyers that match your company..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // Initial State - Start Generation (토스 스타일 + AI 에이전틱)
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardContent className="flex flex-col items-center px-8 py-12">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-indigo-100">
            <Sparkles className="h-10 w-10 text-blue-500" />
          </div>
          <h2 className="mb-2 text-center font-semibold text-gray-900 text-xl">
            {isKorean ? "이제 AI가 일할 차례예요" : "Now it's AI's turn"}
          </h2>
          <p className="mb-8 text-center text-gray-500 text-sm">
            {isKorean
              ? `회사 정보를 분석해서 딱 맞는 바이어 ${TARGET_LEADS}명을 찾고,\n각 바이어에게 보낼 맞춤 이메일까지 준비해드릴게요`
              : `I'll analyze your company info, find ${TARGET_LEADS} matching buyers,\nand prepare personalized emails for each of them`}
          </p>

          <div className="mb-8 w-full max-w-sm space-y-3 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-5">
            <p className="mb-3 font-medium text-gray-700 text-sm">
              {isKorean ? "AI가 해드릴 일" : "What AI will do"}
            </p>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 text-xs shadow-sm">
                1
              </div>
              <span className="text-gray-700">
                {isKorean ? "맞춤 바이어 20명 찾기" : "Find 20 matching buyers"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 text-xs shadow-sm">
                2
              </div>
              <span className="text-gray-700">
                {isKorean ? "담당자 이메일 확보" : "Get contact emails"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-blue-600 text-xs shadow-sm">
                3
              </div>
              <span className="text-gray-700">
                {isKorean ? "맞춤 이메일 40개 작성" : "Write 40 personalized emails"}
              </span>
            </div>
          </div>

          <Button
            className="w-full max-w-sm bg-blue-600 hover:bg-blue-700"
            onClick={handleStartGeneration}
            size="lg"
          >
            {isKorean ? "AI에게 맡기기" : "Let AI handle it"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
