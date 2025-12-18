import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Globe2,
  Loader2,
  Mail,
  Send,
  Target,
  Users,
  Zap,
} from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api/client"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useCompleteOnboarding, useOnboardingProgress } from "@/lib/api/hooks/onboarding"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

type Lead = {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
}

type SequenceInfo = {
  id: string
  name: string
  emailSubject: string
  emailBodyText: string
  leadsCount: number
}

export function StepConfirmation() {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionComplete, setExecutionComplete] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [executionStatus, setExecutionStatus] = useState("")

  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(
    workspace?.id || "",
    userId,
    !!workspace?.id && !!userId,
  )

  const { data: onboardingProgress } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeOnboardingMutation = useCompleteOnboarding()

  const selectedLeadIds = useMemo(
    () => onboardingProgress?.selectedLeadIds || [],
    [onboardingProgress],
  )

  const [leads, setLeads] = useState<Lead[]>([])

  useEffect(() => {
    if (selectedLeadIds.length === 0) {
      return
    }

    const fetchLeads = async () => {
      try {
        const response = await apiFetch<{ data: Lead[] }>(
          `/api/v1/leads?ids=${selectedLeadIds.join(",")}`,
        )
        if (response.data) {
          setLeads(response.data)
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error)
        setLeads(
          selectedLeadIds.map((id) => ({
            id,
            companyName: `Lead ${id.slice(0, 8)}...`,
          })),
        )
      }
    }

    fetchLeads()
  }, [selectedLeadIds])

  const sequenceInfo = useMemo<SequenceInfo | null>(() => {
    if (onboardingProgress?.generatedSequenceId) {
      return {
        id: onboardingProgress.generatedSequenceId,
        name: "Demo Sequence",
        emailSubject: "",
        emailBodyText: "",
        leadsCount: selectedLeadIds.length,
      }
    }
    return null
  }, [onboardingProgress, selectedLeadIds])

  const completeOnboardingAndClearData = async () => {
    if (workspace?.id) {
      try {
        await completeOnboardingMutation.mutateAsync({ workspaceId: workspace.id, userId })
      } catch (error) {
        console.error("Failed to complete onboarding:", error)
      }
    }
  }

  const handleExecute = async () => {
    if (!sequenceInfo?.id) {
      toast.error(isKorean ? "캠페인 정보가 없어요" : "Missing campaign information")
      return
    }

    if (!emailAccount?.id) {
      toast.error(isKorean ? "이메일 계정을 먼저 연동해주세요" : "Please connect your email first")
      return
    }

    if (leads.length === 0) {
      toast.error(isKorean ? "발송할 리드가 없어요" : "No leads to send to")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      setExecutionStatus(isKorean ? "리드 등록 중..." : "Enrolling leads...")
      setExecutionProgress(20)

      const leadIds = leads.map((lead) => lead.id)
      const enrollResult = await apiFetch<{
        enrolledCount: number
        totalSteps: number
        scheduledExecutions: number
      }>(`/api/v1/admin/sequences/${sequenceInfo.id}/enrollments/bulk-with-scheduling`, {
        method: "POST",
        body: JSON.stringify({
          leadIds,
          userEmailAccountId: emailAccount.id,
          enrolledBy: userId,
        }),
      })

      console.log("Enrollment result:", enrollResult)
      setExecutionProgress(60)

      setExecutionStatus(isKorean ? "캠페인 활성화 중..." : "Activating campaign...")

      await apiFetch(`/api/v1/sequences/${sequenceInfo.id}/activate-step-based`, {
        method: "POST",
      })

      setExecutionProgress(100)
      setExecutionComplete(true)

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명에게 이메일이 예약됐어요`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      await completeOnboardingAndClearData()

      setTimeout(() => {
        navigate("/dashboard")
      }, 3000)
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

  const handleSkipToDashboard = async () => {
    await completeOnboardingAndClearData()
    navigate("/dashboard")
  }

  const uniqueCountries = useMemo(() => {
    const countries = leads.map((l) => l.country).filter(Boolean) as string[]
    return [...new Set(countries)].slice(0, 3)
  }, [leads])

  // 설정 필요 상태
  if (!sequenceInfo) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100">
                <Zap className="h-7 w-7 text-amber-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "아직 준비가 안 됐어요" : "Not quite ready yet"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "캠페인을 시작하려면\n이전 단계를 먼저 완료해주세요"
                  : "Please complete the previous steps\nto start your campaign"}
              </p>
              <Button
                className="h-12 w-full rounded-xl bg-gray-900 font-medium hover:bg-gray-800"
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

  // 리드 없음 상태
  if (leads.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100">
                <CheckCircle2 className="h-7 w-7 text-green-600" />
              </div>
              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "설정이 완료됐어요" : "You're all set"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "이메일 템플릿이 준비됐어요.\n대시보드에서 리드를 추가해보세요."
                  : "Your email template is ready.\nAdd leads from the dashboard to get started."}
              </p>
              <Button
                className="h-12 w-full rounded-xl bg-gray-900 font-medium hover:bg-gray-800"
                onClick={handleSkipToDashboard}
              >
                {isKorean ? "대시보드로 이동" : "Go to dashboard"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 실행 중 상태
  if (isExecuting) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-16">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="relative">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500">
                  <Send className="h-7 w-7 text-white" />
                </div>
                <div className="-inset-2 absolute animate-pulse rounded-2xl bg-blue-500/20" />
              </div>

              <div className="space-y-2">
                <h2 className="font-bold text-[22px] text-gray-900 tracking-tight">
                  {isKorean ? "캠페인을 시작하고 있어요" : "Launching your campaign"}
                </h2>
                <p className="text-gray-500">{executionStatus}</p>
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

  // 완료 상태
  if (executionComplete) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <Card className="border-0 bg-white shadow-gray-200/50 shadow-lg">
          <CardContent className="px-8 py-12">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500">
                <CheckCircle2 className="h-8 w-8 text-white" />
              </div>

              <h2 className="mb-2 font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "캠페인이 시작됐어요!" : "Campaign launched!"}
              </h2>
              <p className="mb-8 text-gray-500 leading-relaxed">
                {isKorean
                  ? "이메일 발송이 예약됐어요.\n대시보드에서 실시간으로 확인하세요."
                  : "Emails have been scheduled.\nTrack progress on your dashboard."}
              </p>

              {/* 통계 */}
              <div className="mb-8 flex w-full max-w-xs justify-center gap-12">
                <div className="text-center">
                  <p className="font-bold text-3xl text-gray-900">{leads.length}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "리드" : "Leads"}</p>
                </div>
                <div className="w-px bg-gray-100" />
                <div className="text-center">
                  <p className="font-bold text-3xl text-gray-900">{leads.length * 2}</p>
                  <p className="mt-1 text-gray-400 text-sm">{isKorean ? "이메일" : "Emails"}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-gray-400 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isKorean ? "대시보드로 이동 중..." : "Redirecting..."}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 에러 상태
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
                {isKorean ? "문제가 생겼어요" : "Something went wrong"}
              </h2>
              <p className="mb-8 max-w-sm text-gray-500 leading-relaxed">{executionError}</p>
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
                  {isKorean ? "대시보드" : "Dashboard"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 메인 확인 화면 - 토스 스타일
  return (
    <div className="mx-auto max-w-lg px-4">
      <Card className="overflow-hidden border-0 bg-white shadow-gray-200/50 shadow-lg">
        {/* 헤더 */}
        <div className="px-8 pt-8 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="mb-1 font-medium text-blue-600 text-sm">
                {isKorean ? "마지막 단계예요" : "Final step"}
              </p>
              <h2 className="font-bold text-[22px] text-gray-900 tracking-tight">
                {isKorean ? "캠페인을 시작할까요?" : "Ready to launch?"}
              </h2>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
              <Target className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 px-8 pb-8">
          {/* 핵심 지표 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Users className="h-5 w-5 text-gray-600" />
              </div>
              <p className="font-bold text-2xl text-gray-900">{leads.length}</p>
              <p className="text-gray-500 text-xs">{isKorean ? "리드" : "Leads"}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Mail className="h-5 w-5 text-gray-600" />
              </div>
              <p className="font-bold text-2xl text-gray-900">{leads.length * 2}</p>
              <p className="text-gray-500 text-xs">{isKorean ? "이메일" : "Emails"}</p>
            </div>
            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                <Calendar className="h-5 w-5 text-gray-600" />
              </div>
              <p className="font-bold text-2xl text-gray-900">2</p>
              <p className="text-gray-500 text-xs">{isKorean ? "단계" : "Steps"}</p>
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="space-y-2">
            {/* 타겟 시장 */}
            {uniqueCountries.length > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Globe2 className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 text-sm">{isKorean ? "타겟 시장" : "Target"}</span>
                </div>
                <div className="flex gap-1.5">
                  {uniqueCountries.map((country) => (
                    <Badge
                      className="rounded-lg bg-white font-normal text-gray-700 shadow-sm"
                      key={country}
                      variant="secondary"
                    >
                      {country}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* 발송 일정 */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 text-sm">{isKorean ? "발송 일정" : "Schedule"}</span>
              </div>
              <span className="text-gray-900 text-sm">
                {isKorean ? "오늘 → 3일 후" : "Today → Day 3"}
              </span>
            </div>

            {/* 발송 계정 */}
            <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600 text-sm">{isKorean ? "발송 계정" : "From"}</span>
              </div>
              {emailAccount ? (
                <div className="flex items-center gap-2">
                  <span className="max-w-[180px] truncate text-gray-900 text-sm">
                    {emailAccount.emailAddress}
                  </span>
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                </div>
              ) : (
                <span className="text-amber-600 text-sm">
                  {isKorean ? "연동 필요" : "Required"}
                </span>
              )}
            </div>
          </div>

          {/* 리드 미리보기 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 text-sm">
                {isKorean ? "리드 목록" : "Leads"}
              </span>
              <span className="text-gray-400 text-xs">
                {leads.length}
                {isKorean ? "개" : " total"}
              </span>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {leads.slice(0, 4).map((lead, index) => (
                <div
                  className={`flex items-center justify-between px-4 py-3 ${
                    index !== Math.min(3, leads.length - 1) ? "border-gray-50 border-b" : ""
                  }`}
                  key={lead.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 text-sm">{lead.companyName}</p>
                    <p className="truncate text-gray-400 text-xs">
                      {lead.email || (isKorean ? "이메일 대기 중" : "Pending")}
                    </p>
                  </div>
                  {lead.country && (
                    <span className="ml-3 flex-shrink-0 text-gray-400 text-xs">{lead.country}</span>
                  )}
                </div>
              ))}
              {leads.length > 4 && (
                <div className="bg-gray-50 px-4 py-2.5 text-center">
                  <span className="text-gray-500 text-xs">
                    +{leads.length - 4}
                    {isKorean ? "개 더" : " more"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3 pt-2">
            <Button
              className="h-12 flex-1 rounded-xl border-gray-200 font-medium text-gray-600"
              onClick={handleSkipToDashboard}
              variant="outline"
            >
              {isKorean ? "나중에" : "Later"}
            </Button>
            <Button
              className="h-12 flex-[2] rounded-xl bg-blue-500 font-semibold text-white hover:bg-blue-600 disabled:bg-gray-200 disabled:text-gray-400"
              disabled={isExecuting || !emailAccount}
              onClick={handleExecute}
            >
              {isKorean ? "캠페인 시작하기" : "Launch campaign"}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
