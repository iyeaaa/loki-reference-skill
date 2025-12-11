import { ArrowRight, CheckCircle2, Loader2, Mail, Play, Rocket, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { apiFetch } from "@/lib/api/client"
import { useEmailAccountByWorkspaceAndUser } from "@/lib/api/hooks/email-accounts"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"

interface Lead {
  id: string
  companyName: string
  email?: string
  country?: string
  industry?: string
}

interface SequenceInfo {
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

  // Get data from session storage (memoized)
  const leads = useMemo<Lead[]>(
    () => JSON.parse(sessionStorage.getItem("onboarding_leads") || "[]"),
    [],
  )
  const sequenceInfo = useMemo<SequenceInfo | null>(
    () => JSON.parse(sessionStorage.getItem("onboarding_sequence") || "null"),
    [],
  )

  const clearSessionData = () => {
    sessionStorage.removeItem("onboarding_company_info")
    sessionStorage.removeItem("onboarding_leads")
    sessionStorage.removeItem("onboarding_sequence")
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

      // Step 2: Activate the sequence (80%)
      setExecutionStatus(isKorean ? "시퀀스 활성화 중..." : "Activating sequence...")

      await apiFetch(`/api/v1/sequences/${sequenceInfo.id}`, {
        method: "PUT",
        body: JSON.stringify({
          status: "active",
        }),
      })

      setExecutionProgress(100)
      setExecutionComplete(true)

      toast.success(
        isKorean
          ? `${enrollResult.enrolledCount}명의 리드에게 이메일이 예약되었습니다`
          : `Emails scheduled for ${enrollResult.enrolledCount} leads`,
      )

      // Clear session storage
      clearSessionData()

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        navigate("/dashboard")
      }, 2000)
    } catch (error) {
      console.error("Failed to execute sequence:", error)
      toast.error(isKorean ? "시퀀스 실행에 실패했습니다" : "Failed to execute sequence")
      setIsExecuting(false)
      setExecutionProgress(0)
      setExecutionStatus("")
    }
  }

  const handleSkipToDashboard = () => {
    // Clear session storage and go to dashboard
    clearSessionData()
    navigate("/dashboard")
  }

  // No data available - redirect to step 2
  if (leads.length === 0 || !sequenceInfo) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-10 px-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
                <Rocket className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-gray-600 mb-4">
                {isKorean
                  ? "필요한 정보가 없습니다. 이전 단계를 완료해주세요."
                  : "Missing required information. Please complete previous steps."}
              </p>
              <Button variant="outline" onClick={() => setSearchParams({ step: "2" })}>
                {isKorean ? "이전 단계로" : "Go Back"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isExecuting) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-10 px-8">
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  {t("app.onboarding.step5.executing", "실행 중...")}
                </h2>
                <p className="text-gray-500">{executionStatus}</p>
              </div>
              <div className="w-full max-w-xs">
                <Progress value={executionProgress} className="h-2" />
                <p className="text-center text-sm text-gray-500 mt-2">{executionProgress}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (executionComplete) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="pt-12 pb-10 px-8">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">
                {t("app.onboarding.step5.success", "시퀀스가 성공적으로 실행되었습니다")}
              </h2>
              <p className="text-gray-500 mb-6">
                {isKorean ? "대시보드로 이동합니다..." : "Redirecting to dashboard..."}
              </p>
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-3">
            <Rocket className="w-6 h-6 text-blue-500" />
            {t("app.onboarding.step5.confirmTitle", "시퀀스 실행 확인")}
          </CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            {t(
              "app.onboarding.step5.confirmDescription",
              "아래 리드에게 이메일 시퀀스를 실행하시겠습니까?",
            )}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">
                  {t("app.onboarding.step5.leadsCount", "리드 수")}
                </span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{leads.length}</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Mail className="w-5 h-5 text-purple-600" />
                <span className="text-sm text-gray-600">
                  {t("app.onboarding.step5.emailsCount", "이메일 수")}
                </span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{leads.length}</p>
            </div>
          </div>

          {/* Lead Preview */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {isKorean ? "리드 미리보기" : "Lead Preview"}
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {leads.slice(0, 5).map((lead, index) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-medium text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{lead.companyName}</p>
                    <p className="text-sm text-gray-500 truncate">
                      {lead.email || (isKorean ? "이메일 없음" : "No email")}
                    </p>
                  </div>
                  {lead.country && (
                    <Badge variant="outline" className="flex-shrink-0">
                      {lead.country}
                    </Badge>
                  )}
                </div>
              ))}
              {leads.length > 5 && (
                <p className="text-center text-sm text-gray-500 py-2">
                  +{leads.length - 5} {isKorean ? "개의 추가 리드" : "more leads"}
                </p>
              )}
            </div>
          </div>

          {/* Email Preview */}
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {t("app.onboarding.step5.previewEmail", "이메일 미리보기")}
            </h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="font-medium text-gray-900 mb-2">
                {isKorean ? "제목:" : "Subject:"} {sequenceInfo.emailSubject}
              </p>
              <p className="text-sm text-gray-600 whitespace-pre-line line-clamp-3">
                {sequenceInfo.emailBodyText}
              </p>
            </div>
          </div>

          {/* Email Account Info */}
          {emailAccount ? (
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-green-800">
                  {isKorean ? "발송 이메일:" : "Sending from:"}{" "}
                  <span className="font-medium">{emailAccount.emailAddress}</span>
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <Mail className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                {isKorean
                  ? "이메일 계정이 연동되지 않았습니다. 대시보드에서 연동 후 시퀀스를 실행하세요."
                  : "No email account connected. Connect one from the dashboard to run sequences."}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={handleSkipToDashboard} className="flex-1">
              {isKorean ? "대시보드로 이동" : "Go to Dashboard"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              onClick={handleExecute}
              disabled={isExecuting || !emailAccount}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-4 h-4 mr-2" />
              {t("app.onboarding.step5.executeButton", "시퀀스 실행")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
