import { ArrowRight, CheckCircle2, Loader2, Mail, Play, Rocket, Users } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const [isExecuting, setIsExecuting] = useState(false)
  const [executionComplete, setExecutionComplete] = useState(false)
  const [executionError, setExecutionError] = useState<string | null>(null)
  const [executionProgress, setExecutionProgress] = useState(0)
  const [executionStatus, setExecutionStatus] = useState("")

  // Get user's workspace (memoized)
  const currentUser = useMemo(() => JSON.parse(localStorage.getItem("user") || "{}"), [])
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(userId, !!userId)
  const workspace = userWorkspaces?.[0]
  const isKorean = i18n.language === "ko"

  // Get email account
  const { data: emailAccount } = useEmailAccountByWorkspaceAndUser(
    workspace?.id || "",
    userId,
    !!workspace?.id && !!userId,
  )

  // Onboarding hooks
  const { data: onboardingProgress } = useOnboardingProgress(workspace?.id || "", !!workspace?.id)
  const completeOnboardingMutation = useCompleteOnboarding()

  // Get leads from DB using onboarding progress lead IDs
  const selectedLeadIds = useMemo(
    () => onboardingProgress?.selectedLeadIds || [],
    [onboardingProgress],
  )

  // Local state for leads data
  const [leads, setLeads] = useState<Lead[]>([])

  // Fetch leads data based on selectedLeadIds
  useEffect(() => {
    if (selectedLeadIds.length === 0) {
      return
    }

    const fetchLeads = async () => {
      try {
        // 리드 데이터 조회 (bulk로 가져오기)
        const response = await apiFetch<{ data: Lead[] }>(
          `/api/v1/leads?ids=${selectedLeadIds.join(",")}`,
        )
        if (response.data) {
          setLeads(response.data)
        }
      } catch (error) {
        console.error("Failed to fetch leads:", error)
        // Fallback: ID만 있는 기본 구조
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

  // Get sequence info from onboarding progress
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
    // DB에 온보딩 완료 기록
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
      toast.error(isKorean ? "시퀀스 정보가 없습니다" : "Missing sequence information")
      return
    }

    if (!emailAccount?.id) {
      toast.error(isKorean ? "이메일 계정이 연동되지 않았습니다" : "No email account connected")
      return
    }

    if (leads.length === 0) {
      toast.error(isKorean ? "리드가 없습니다" : "No leads available")
      return
    }

    setIsExecuting(true)
    setExecutionProgress(0)

    try {
      // Step 1: Enroll leads to sequence with scheduling (40%)
      setExecutionStatus(isKorean ? "리드를 시퀀스에 등록 중..." : "Enrolling leads to sequence...")
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

      // Step 2: Activate the step-based sequence (80%)
      setExecutionStatus(isKorean ? "시퀀스 활성화 중..." : "Activating sequence...")

      await apiFetch(`/api/v1/sequences/${sequenceInfo.id}/activate-step-based`, {
        method: "POST",
      })

      setExecutionProgress(100)
      setExecutionComplete(true)

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명의 리드에게 이메일이 예약되었습니다`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      // DB에 온보딩 완료 기록
      await completeOnboardingAndClearData()

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate("/dashboard")
      }, 2000)
    } catch (error) {
      console.error("Failed to execute sequence:", error)
      const errorMessage =
        error instanceof Error
          ? error.message
          : isKorean
            ? "시퀀스 실행에 실패했습니다"
            : "Failed to execute sequence"
      toast.error(errorMessage)
      setExecutionError(errorMessage)
      setIsExecuting(false)
      setExecutionProgress(0)
      setExecutionStatus("")
    }
  }

  const handleSkipToDashboard = async () => {
    // DB에 온보딩 완료 기록 후 대시보드로 이동
    await completeOnboardingAndClearData()
    navigate("/dashboard")
  }

  // No sequence info - redirect to step 1
  if (!sequenceInfo) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="px-8 pt-12 pb-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-100">
                <Rocket className="h-8 w-8 text-yellow-600" />
              </div>
              <p className="mb-4 text-gray-600">
                {isKorean
                  ? "필요한 정보가 없습니다. 이전 단계를 완료해주세요."
                  : "Missing required information. Please complete previous steps."}
              </p>
              <Button onClick={() => setSearchParams({ step: "1" })} variant="outline">
                {isKorean ? "처음으로" : "Start Over"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // No leads available - go directly to dashboard
  if (leads.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="px-8 pt-12 pb-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="mb-3 font-bold text-2xl text-gray-900">
                {isKorean ? "설정이 완료되었습니다!" : "Setup Complete!"}
              </h2>
              <p className="mb-6 text-gray-600">
                {isKorean
                  ? "이메일 템플릿이 생성되었습니다. 대시보드에서 리드를 추가하여 시퀀스를 실행할 수 있습니다."
                  : "Your email template has been created. You can add leads and run sequences from the dashboard."}
              </p>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSkipToDashboard}>
                {isKorean ? "대시보드로 이동" : "Go to Dashboard"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isExecuting) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="px-8 pt-12 pb-10">
            <div className="flex flex-col items-center space-y-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
              </div>
              <div>
                <h2 className="mb-2 font-bold text-gray-900 text-xl">
                  {t("app.onboarding.step5.executing", "실행 중...")}
                </h2>
                <p className="text-gray-500">{executionStatus}</p>
              </div>
              <div className="w-full max-w-xs">
                <Progress className="h-2" value={executionProgress} />
                <p className="mt-2 text-center text-gray-500 text-sm">{executionProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (executionComplete) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="px-8 pt-12 pb-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-500" />
              </div>
              <h2 className="mb-3 font-bold text-2xl text-gray-900">
                {t("app.onboarding.step5.success", "시퀀스가 성공적으로 실행되었습니다")}
              </h2>
              <p className="mb-6 text-gray-500">
                {isKorean ? "대시보드로 이동합니다..." : "Redirecting to dashboard..."}
              </p>
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (executionError) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="px-8 pt-12 pb-10">
            <div className="flex flex-col items-center text-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
                <Rocket className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="mb-3 font-bold text-2xl text-gray-900">
                {isKorean ? "시퀀스 실행 실패" : "Sequence Execution Failed"}
              </h2>
              <p className="mb-6 text-gray-500">{executionError}</p>
              <div className="flex gap-3">
                <Button onClick={() => setExecutionError(null)} variant="outline">
                  {isKorean ? "다시 시도" : "Try Again"}
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleSkipToDashboard}>
                  {isKorean ? "대시보드로 이동" : "Go to Dashboard"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl">
            <Rocket className="h-6 w-6 text-blue-500" />
            {t("app.onboarding.step5.confirmTitle", "시퀀스 실행 확인")}
          </CardTitle>
          <p className="mt-1 text-gray-600 text-sm">
            {t(
              "app.onboarding.step5.confirmDescription",
              "아래 리드에게 이메일 시퀀스를 실행하시겠습니까?",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-blue-50 p-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-gray-600 text-sm">
                  {t("app.onboarding.step5.leadsCount", "리드 수")}
                </span>
              </div>
              <p className="font-bold text-2xl text-blue-600">{leads.length}</p>
            </div>
            <div className="rounded-lg bg-purple-50 p-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Mail className="h-5 w-5 text-purple-600" />
                <span className="text-gray-600 text-sm">
                  {t("app.onboarding.step5.emailsCount", "이메일 수")}
                </span>
              </div>
              <p className="font-bold text-2xl text-purple-600">{leads.length}</p>
            </div>
          </div>

          {/* Lead Preview */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-medium text-gray-900">
              <Users className="h-4 w-4" />
              {isKorean ? "리드 미리보기" : "Lead Preview"}
            </h3>
            <div className="max-h-40 space-y-2 overflow-y-auto">
              {leads.slice(0, 5).map((lead, index) => (
                <div
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                  key={lead.id}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 font-medium text-blue-600 text-sm">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">{lead.companyName}</p>
                    <p className="truncate text-gray-500 text-sm">
                      {lead.email || (isKorean ? "이메일 없음" : "No email")}
                    </p>
                  </div>
                  {lead.country && (
                    <Badge className="flex-shrink-0" variant="outline">
                      {lead.country}
                    </Badge>
                  )}
                </div>
              ))}
              {leads.length > 5 && (
                <p className="py-2 text-center text-gray-500 text-sm">
                  +{leads.length - 5} {isKorean ? "개의 추가 리드" : "more leads"}
                </p>
              )}
            </div>
          </div>

          {/* Email Preview */}
          <div className="space-y-3">
            <h3 className="flex items-center gap-2 font-medium text-gray-900">
              <Mail className="h-4 w-4" />
              {t("app.onboarding.step5.previewEmail", "이메일 미리보기")}
            </h3>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 font-medium text-gray-900">
                {isKorean ? "제목:" : "Subject:"} {sequenceInfo.emailSubject}
              </p>
              <p className="line-clamp-3 whitespace-pre-line text-gray-600 text-sm">
                {sequenceInfo.emailBodyText}
              </p>
            </div>
          </div>

          {/* Email Account Info */}
          {emailAccount ? (
            <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600" />
              <div>
                <p className="text-green-800 text-sm">
                  {isKorean ? "발송 이메일:" : "Sending from:"}{" "}
                  <span className="font-medium">{emailAccount.emailAddress}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
              <Mail className="h-5 w-5 flex-shrink-0 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                {isKorean
                  ? "이메일 계정이 연동되지 않았습니다. 대시보드에서 연동 후 시퀀스를 실행하세요."
                  : "No email account connected. Connect one from the dashboard to run sequences."}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button className="flex-1" onClick={handleSkipToDashboard} variant="outline">
              {isKorean ? "대시보드로 이동" : "Go to Dashboard"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={isExecuting || !emailAccount}
              onClick={handleExecute}
            >
              <Play className="mr-2 h-4 w-4" />
              {t("app.onboarding.step5.executeButton", "시퀀스 실행")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
