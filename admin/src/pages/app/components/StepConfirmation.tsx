import { CheckCircle2, Loader2, Send, Zap } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { trackOnboardingComplete, trackOnboardingStep4Complete } from "@/lib/analytics"
import { apiFetch } from "@/lib/api/client"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useCompleteOnboarding, useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useSequenceSteps, useUpdateSequenceStep } from "@/lib/api/hooks/sequences"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { EmailEditModal } from "./EmailEditModal"
import { EmailsSection } from "./EmailsSection"
import { ExecuteSection } from "./ExecuteSection"
import { LeadDetailModal } from "./LeadDetailModal"
import { LeadsSection } from "./LeadsSection"

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
}

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

export function StepConfirmation() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const isKorean = i18n.language === "ko"

  // Execution states
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionComplete, setExecutionComplete] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [executionStatus, setExecutionStatus] = useState("")

  // UI states
  const [editingStep, setEditingStep] = useState<EmailStep | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  // User & workspace
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const workspace = userWorkspaces?.[0]

  // API hooks
  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(
    workspace?.id || "",
    !!workspace?.id,
  )
  const { data: onboardingProgress } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeOnboardingMutation = useCompleteOnboarding()

  // Sequence steps
  const sequenceId = onboardingProgress?.generatedSequenceId || ""
  const { data: stepsData } = useSequenceSteps(sequenceId, !!sequenceId)
  const updateStepMutation = useUpdateSequenceStep(sequenceId)

  const steps: EmailStep[] = useMemo(() => {
    if (!stepsData) {
      return []
    }
    return (stepsData as EmailStep[]).sort((a, b) => a.stepOrder - b.stepOrder)
  }, [stepsData])

  // Lead IDs from onboarding
  const allLeadIds = useMemo(() => onboardingProgress?.selectedLeadIds || [], [onboardingProgress])

  // Selected leads (initially all selected)
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([])
  const [leads, setLeads] = useState<Lead[]>([])

  // Fetch leads
  useEffect(() => {
    if (allLeadIds.length === 0) {
      return
    }

    const fetchLeads = async () => {
      try {
        const response = await apiFetch<{ data: Lead[] }>(
          `/api/v1/leads?ids=${allLeadIds.join(",")}`,
        )
        if (response.data) {
          setLeads(response.data)
          // Initially select all leads
          if (selectedLeadIds.length === 0) {
            setSelectedLeadIds(response.data.map((l) => l.id))
          }
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error)
        toast.error(
          isKorean
            ? "바이어 정보를 불러올 수 없어요. 다시 시도해주세요."
            : "Failed to load buyer information. Please try again.",
        )
        setLeads([])
      }
    }

    fetchLeads()
  }, [allLeadIds, selectedLeadIds.length, isKorean])

  // Toggle lead selection
  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId],
    )
  }

  // Select/Deselect all
  const toggleAllLeads = () => {
    if (selectedLeadIds.length === leads.length) {
      setSelectedLeadIds([])
    } else {
      setSelectedLeadIds(leads.map((l) => l.id))
    }
  }

  // Save edited step
  const handleSaveStep = async (subject: string, body: string) => {
    if (!(editingStep && sequenceId)) {
      return
    }

    try {
      await updateStepMutation.mutateAsync({
        sequenceId,
        stepId: editingStep.id,
        data: {
          stepOrder: editingStep.stepOrder,
          delayDays: editingStep.delayDays,
          scheduledHour: editingStep.scheduledHour ?? 9,
          scheduledMinute: editingStep.scheduledMinute ?? 0,
          emailSubject: subject,
          emailBodyText: body,
        },
      })
      toast.success(isKorean ? "이메일이 수정되었습니다" : "Email updated")
      setEditingStep(null)
    } catch {
      toast.error(isKorean ? "수정에 실패했습니다" : "Failed to update")
    }
  }

  // Complete onboarding - returns true if successful, false if failed
  const completeOnboardingAndClearData = async (): Promise<boolean> => {
    if (!workspace?.id) {
      console.error("[StepConfirmation] completeOnboarding - No workspace ID")
      return false
    }

    try {
      await completeOnboardingMutation.mutateAsync({ workspaceId: workspace.id, userId })
      console.log("[StepConfirmation] completeOnboarding - Success")
      return true
    } catch (error) {
      console.error("[StepConfirmation] completeOnboarding - Failed:", error)
      toast.error(
        isKorean
          ? "온보딩 완료 처리에 실패했습니다. 다시 시도해주세요."
          : "Failed to complete onboarding. Please try again.",
      )
      return false
    }
  }

  // Execute campaign
  const handleExecute = async () => {
    if (!sequenceId) {
      toast.error(isKorean ? "영업 메일 정보가 없어요" : "Missing sales email information")
      return
    }

    if (!emailAccount?.id) {
      toast.error(isKorean ? "이메일 계정을 먼저 연동해주세요" : "Please connect your email first")
      return
    }

    const validLeads = leads.filter((l) => selectedLeadIds.includes(l.id) && l.email)

    if (validLeads.length === 0) {
      toast.error(isKorean ? "발송할 리드가 없어요" : "No leads to send to")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      setExecutionStatus(isKorean ? "리드 등록 중" : "Enrolling leads")
      setExecutionProgress(20)

      const leadIds = validLeads.map((lead) => lead.id)
      const enrollResult = await apiFetch<{
        enrolledCount: number
        totalSteps: number
        scheduledExecutions: number
      }>(`/api/v1/admin/sequences/${sequenceId}/enrollments/bulk-with-scheduling`, {
        method: "POST",
        body: JSON.stringify({
          leadIds,
          userEmailAccountId: emailAccount.id,
          enrolledBy: userId,
        }),
      })

      setExecutionProgress(60)
      setExecutionStatus(isKorean ? "발송 준비 중" : "Preparing to send")

      await apiFetch(`/api/v1/sequences/${sequenceId}/activate-step-based`, {
        method: "POST",
      })

      setExecutionProgress(100)
      setExecutionComplete(true)

      // 📊 Analytics: Step 4 완료 및 캠페인 실행 이벤트 추적
      trackOnboardingStep4Complete({
        leadsCount: enrollResult.enrolledCount,
        emailsScheduled: enrollResult.scheduledExecutions,
      })

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명에게 이메일이 예약됐어요`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      const onboardingCompleted = await completeOnboardingAndClearData()

      if (onboardingCompleted) {
        setTimeout(() => {
          navigate("/dashboard")
        }, 3000)
      } else {
        // 온보딩 완료 실패 시 리다이렉트하지 않고 에러 상태로 전환
        setExecutionError(
          isKorean
            ? "캠페인은 시작됐지만, 온보딩 완료 처리에 실패했습니다."
            : "Campaign started but failed to complete onboarding.",
        )
        setIsExecuting(false)
      }
    } catch (error) {
      console.error("Failed to execute campaign:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : isKorean
            ? "캠페인 시작에 실패했어요"
            : "Failed to launch campaign"
      toast.error(errorMessage)
      setExecutionError(errorMessage)
      setIsExecuting(false)
      setExecutionProgress(0)
      setExecutionStatus("")
    }
  }

  const handleBack = () => {
    setSearchParams({ step: "3", from: "step4" })
  }

  const handleSkipToDashboard = async () => {
    const onboardingCompleted = await completeOnboardingAndClearData()

    if (onboardingCompleted) {
      trackOnboardingComplete()
      navigate("/dashboard")
    }
    // 실패 시 toast는 completeOnboardingAndClearData에서 이미 표시됨
    // 현재 페이지에 머물러서 사용자가 다시 시도할 수 있도록 함
  }

  // Counts
  const selectedCount = selectedLeadIds.filter((id) =>
    leads.find((l) => l.id === id && l.email),
  ).length
  const totalEmails = selectedCount * steps.length

  // Loading state
  if (!sequenceId) {
    return (
      <div className="mx-auto max-w-4xl px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="h-7 w-7 text-amber-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "먼저 준비할 게 있어요" : "Let's prepare something first"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "바이어와 영업 메일을 먼저 준비해야\n영업을 시작할 수 있어요"
                  : "Let's prepare buyers and sales emails\nbefore starting"}
              </p>
              <Button
                className="h-12 w-full max-w-xs rounded-xl bg-blue-500 font-medium hover:bg-blue-600"
                onClick={() => setSearchParams({ step: "1" })}
              >
                {isKorean ? "처음부터 시작하기" : "Start from beginning"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Executing state
  if (isExecuting) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-16">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div className="-inset-2 absolute animate-pulse rounded-2xl bg-blue-500/20" />
              </div>
              <div className="space-y-2">
                <h2 className="font-bold text-[22px] text-gray-900 tracking-tight">
                  {isKorean ? "영업 시작 준비 중" : "Setting up your outreach"}
                </h2>
                <p className="text-gray-500">
                  {executionStatus || (isKorean ? "잠시만요" : "Just a moment")}
                </p>
              </div>
              <div className="w-full max-w-xs space-y-3">
                <Progress className="h-2 rounded-full" value={executionProgress} />
                <p className="text-gray-400 text-sm">{executionProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Complete state
  if (executionComplete) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "영업이 시작됐어요" : "Outreach is now live"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "영업 이메일 발송이 시작됐어요.\n대시보드에서 바이어 반응을 확인해보세요"
                  : "Sales emails have started sending.\nTrack buyer responses on your dashboard"}
              </p>
              <div className="mb-8 flex w-full max-w-xs justify-center gap-12">
                <div className="text-center">
                  <p className="font-bold text-3xl text-blue-600">{selectedCount}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "바이어" : "Buyers"}</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <p className="font-bold text-3xl text-green-600">{totalEmails}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "이메일" : "Emails"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isKorean ? "대시보드로 이동할게요" : "Taking you to dashboard"}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  if (executionError) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100">
                <Zap className="h-7 w-7 text-red-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "잠깐 문제가 생겼어요" : "Something went wrong"}
              </h2>
              <p className="mb-8 max-w-sm text-gray-500 leading-relaxed">
                {isKorean ? "다시 시도해 주세요" : "Please try again"}
              </p>
              <div className="flex w-full gap-3">
                <Button
                  className="h-12 flex-1 rounded-xl border-gray-200"
                  onClick={() => setExecutionError(null)}
                  variant="outline"
                >
                  {isKorean ? "다시 시도" : "Try again"}
                </Button>
                <Button
                  className="h-12 flex-1 rounded-xl bg-gray-900 hover:bg-gray-800"
                  onClick={handleSkipToDashboard}
                >
                  {isKorean ? "대시보드로" : "Dashboard"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Main confirmation view - 3 column layout
  return (
    <div className="mx-auto max-w-full px-4 pb-8">
      {/* Header */}
      <div className="mb-4 text-center sm:mb-6">
        <p className="mb-1 font-medium text-blue-600 text-sm">
          {isKorean ? "영업 시작 준비 완료" : "Ready to start"}
        </p>
        <h2 className="font-bold text-gray-900 text-xl tracking-tight sm:text-2xl">
          {isKorean ? "바이어와 이메일을 확인해보세요" : "Take a look at buyers and emails"}
        </h2>
      </div>

      {/* 3 Column Layout - Mobile: stacked with execute section first for visibility */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Mobile: Show execute section summary at top */}
        <div className="lg:hidden">
          <ExecuteSection
            emailAccount={emailAccount}
            isExecuting={isExecuting}
            isKorean={isKorean}
            onBack={handleBack}
            onExecute={handleExecute}
            onSkip={handleSkipToDashboard}
            selectedCount={selectedCount}
            stepsCount={steps.length}
            totalEmails={totalEmails}
          />
        </div>

        {/* Mobile only: Show emails section early for easy access */}
        <div className="lg:hidden">
          <EmailsSection
            isKorean={isKorean}
            onEditStep={(step) => setEditingStep(step)}
            steps={steps}
          />
        </div>

        {/* ========== LEADS SECTION (2 columns) ========== */}
        <div className="lg:col-span-2">
          <LeadsSection
            isKorean={isKorean}
            leads={leads}
            onLeadClick={(lead) => setSelectedLead(lead)}
            selectedLeadIds={selectedLeadIds}
            toggleAllLeads={toggleAllLeads}
            toggleLead={toggleLead}
          />
        </div>

        {/* ========== RIGHT COLUMN: EMAILS + EXECUTE (Desktop only) ========== */}
        <div className="hidden space-y-4 lg:block">
          <EmailsSection
            isKorean={isKorean}
            onEditStep={(step) => setEditingStep(step)}
            steps={steps}
          />

          {/* Desktop only: Execute section in sidebar */}
          <ExecuteSection
            emailAccount={emailAccount}
            isExecuting={isExecuting}
            isKorean={isKorean}
            onBack={handleBack}
            onExecute={handleExecute}
            onSkip={handleSkipToDashboard}
            selectedCount={selectedCount}
            stepsCount={steps.length}
            totalEmails={totalEmails}
          />
        </div>
      </div>

      {/* Mobile: Sticky bottom execute button */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-gray-200 border-t bg-white p-4 shadow-lg lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="flex-1 text-sm">
            <span className="font-semibold text-blue-600">{selectedCount}</span>
            <span className="text-gray-500">{isKorean ? "명 선택" : " selected"}</span>
            <span className="mx-1 text-gray-300">·</span>
            <span className="font-semibold text-green-600">{totalEmails}</span>
            <span className="text-gray-500">{isKorean ? "개 이메일" : " emails"}</span>
          </div>
          <Button
            className="h-11 shrink-0 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 font-medium shadow-md hover:from-blue-700 hover:to-indigo-700"
            disabled={isExecuting || selectedCount === 0 || !emailAccount?.id}
            onClick={handleExecute}
          >
            {isKorean ? "영업 시작하기" : "Start outreach"}
          </Button>
        </div>
      </div>

      {/* Add bottom padding on mobile for sticky button */}
      <div className="h-20 lg:hidden" />

      {/* ========== LEAD DETAIL MODAL ========== */}
      <LeadDetailModal
        isKorean={isKorean}
        isOpen={!!selectedLead}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        selectedLeadIds={selectedLeadIds}
        toggleLead={toggleLead}
      />

      {/* ========== EMAIL EDIT MODAL ========== */}
      <EmailEditModal
        isKorean={isKorean}
        isOpen={!!editingStep}
        isSaving={updateStepMutation.isPending}
        onClose={() => setEditingStep(null)}
        onSave={handleSaveStep}
        step={editingStep}
      />
    </div>
  )
}
