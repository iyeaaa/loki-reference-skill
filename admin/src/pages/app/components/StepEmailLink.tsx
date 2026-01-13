import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Send,
  Shield,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { trackOnboardingStep2Complete } from "@/lib/analytics"
import {
  useDeleteEmailAccount,
  useEmailAccountByWorkspaceAndUser,
} from "@/lib/api/hooks/email-accounts"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { onboardingApi } from "@/lib/api/services/onboarding"
import { deleteUnipileAccount, getUnipileAuthUrl } from "@/lib/api/services/unipile"
import type { UserEmailAccount } from "@/lib/api/types/email-account"

export function StepEmailLink() {
  const { t, i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingJobStatus, setIsCheckingJobStatus] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get current user
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  const userEmail = currentUser?.email || ""
  const isKorean = i18n.language === "ko"

  // Get user's workspace
  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(!!userId)
  const workspace = userWorkspaces?.[0]

  // Get email accounts for this workspace and user
  const {
    data: emailAccount,
    isLoading: isLoadingEmailAccounts,
    // isRefetchError,
    // error: emailAccountError,
  } = useEmailAccountByWorkspaceAndUser(workspace?.id || "", !!workspace?.id)

  // console.log(isRefetchError, emailAccountError)

  const handleConnect = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // ⚠️ 중요: Unipile OAuth 전에 workspaceId를 localStorage에 저장
      // Unipile가 state 파라미터를 유실할 수 있으므로 백업 저장
      // Safari, 시크릿 모드 등에서 localStorage 사용 불가할 수 있으므로 try-catch로 처리
      if (workspace?.id) {
        try {
          localStorage.setItem("unipile_oauth_workspace_id", workspace.id)
          console.log("🔐 [StepEmailLink] Saved workspaceId to localStorage:", workspace.id)
        } catch (storageError) {
          // localStorage 저장 실패 (Safari 시크릿 모드, 저장소 할당량 초과 등)
          // state 파라미터로 workspaceId를 전달하므로 계속 진행
          console.warn(
            "⚠️ [StepEmailLink] Failed to save workspaceId to localStorage (Safari/incognito mode?):",
            storageError,
          )
          console.log("✅ [StepEmailLink] Continuing with state parameter fallback")
        }
      }

      // Get hosted auth URL from backend with workspaceId in state
      const response = await getUnipileAuthUrl(workspace?.id)

      console.log("🚀 [StepEmailLink] Redirecting to Unipile OAuth:", response.hostedAuthUrl)

      // Redirect to Unipile hosted authentication
      window.location.href = response.hostedAuthUrl
    } catch (err) {
      console.error("Failed to get auth URL:", err)
      setError(
        t("app.onboarding.step1.error", "인증 URL을 가져오는데 실패했습니다. 다시 시도해주세요."),
      )
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Go back to step 1 (company info)
    setSearchParams({ step: "1" })
  }

  const handleNextStep = async () => {
    // Check job status and navigate conditionally
    if (!workspace?.id) {
      const isKorean = i18n.language === "ko"
      toast.error(
        isKorean
          ? "워크스페이스 정보를 찾을 수 없습니다. 워크스페이스가 선택되었는지 확인해주세요."
          : "Workspace information not found. Please check if a workspace is selected.",
      )
      return
    }

    setIsCheckingJobStatus(true)
    try {
      const jobStatus = await onboardingApi.getJobStatus(workspace.id)

      // 📊 Analytics: Step 2 완료 이벤트 추적
      trackOnboardingStep2Complete({
        emailProvider: "sendgrid", // SendGrid API 기반
        hasEmailConnected: !!emailAccount && emailAccount.apiKey !== "TRIAL_PREVIEW",
      })

      if (jobStatus.isComplete) {
        // Job done - skip Step 3, go directly to Step 4
        setSearchParams({ step: "4" })
      } else {
        // Job still running - show Step 3 (loading progress)
        setSearchParams({ step: "3" })
      }
    } catch (err) {
      console.error("Failed to check job status:", err)
      // 에러 발생 시 현재 화면에 머물고 에러 메시지 표시
      const isKorean = i18n.language === "ko"
      toast.error(
        isKorean
          ? "작업 상태를 확인할 수 없습니다. 잠시 후 다시 시도해주세요."
          : "Failed to check job status. Please try again later.",
      )
    } finally {
      setIsCheckingJobStatus(false)
    }
  }

  // 자동 이동 제거 - 사용자가 이메일 연동 결과를 확인하고 직접 다음 단계 버튼을 클릭하도록 변경
  // (이전: 이메일 연동 후 자동으로 다음 단계로 이동했으나, 사용자가 확인할 시간 필요)

  // Loading state
  if (isLoadingWorkspaces || isLoadingEmailAccounts) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardContent className="flex items-center justify-center px-8 pt-12 pb-10">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    )
  }

  // Check if it's a trial preview account (not a real connected account)
  const isTrialPreviewAccount = emailAccount?.apiKey === "TRIAL_PREVIEW"

  // If email account exists and is NOT a trial preview, show the linked accounts view
  if (emailAccount && workspace && !isTrialPreviewAccount) {
    return (
      <LinkedEmailAccountsView
        emailAccount={emailAccount}
        isAddingMore={isLoading}
        isNextLoading={isCheckingJobStatus}
        onAddMore={handleConnect}
        onBack={handleBack}
        onNext={handleNextStep}
        workspaceId={workspace.id}
      />
    )
  }

  // No email accounts - show confirmation dialog (토스 스타일)
  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="px-8 pt-12 pb-10">
        <div className="flex flex-col items-center text-center">
          {/* Email Icon */}
          <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50">
            <Mail className="h-10 w-10 text-blue-500" />
          </div>

          {/* Title */}
          <h2 className="mb-3 font-bold text-2xl text-gray-900">
            {isKorean ? "발송에 사용할 이메일을 연결해주세요" : "Connect your email for sending"}
          </h2>

          {/* Description */}
          <p className="mb-6 max-w-sm text-gray-500">
            {isKorean
              ? "이 계정으로 바이어에게 영업 이메일을 보내드려요"
              : "Sales emails will be sent to buyers from this account"}
          </p>

          {/* 보안 배지 */}
          <div className="mb-6 flex items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5">
              <Shield className="h-3.5 w-3.5 text-green-600" />
              <span className="font-medium text-green-700 text-xs">
                {isKorean ? "OAuth 2.0 보안 연결" : "OAuth 2.0 Secure"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5">
              <Lock className="h-3.5 w-3.5 text-blue-600" />
              <span className="font-medium text-blue-700 text-xs">
                {isKorean ? "비밀번호 저장 안 함" : "No Password Stored"}
              </span>
            </div>
          </div>

          {/* 연동 장점 리스트 */}
          <div className="mb-6 w-full max-w-sm rounded-lg border border-gray-100 bg-gray-50/50 p-4">
            <h4 className="mb-3 font-medium text-gray-900 text-sm">
              {isKorean ? "이메일을 연동하면" : "When you connect"}
            </h4>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                <Send className="h-4 w-4 text-blue-500" />
                {isKorean
                  ? "AI가 맞춤 영업 메일을 자동으로 발송해요"
                  : "AI sends personalized sales emails automatically"}
              </div>
              <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                <Clock className="h-4 w-4 text-blue-500" />
                {isKorean
                  ? "바이어 시간대에 맞춰 최적 시간에 발송해요"
                  : "Emails sent at optimal times for each timezone"}
              </div>
              <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                <Bell className="h-4 w-4 text-blue-500" />
                {isKorean
                  ? "바이어가 답장하면 바로 알려드려요"
                  : "Get notified instantly when buyers reply"}
              </div>
              <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                <BarChart2 className="h-4 w-4 text-blue-500" />
                {isKorean
                  ? "이메일 오픈율과 응답률을 실시간으로 확인해요"
                  : "Track open rates and responses in real-time"}
              </div>
            </div>
          </div>

          {/* Current user email info */}
          <div className="mb-6 w-full max-w-sm rounded-lg bg-gradient-to-br from-gray-50 to-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">{userEmail}</p>
                <p className="text-gray-500 text-sm">
                  {isKorean ? "로그인 계정" : "Logged in account"}
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation message */}
          <p className="mb-6 font-medium text-base text-gray-700">
            {isKorean ? "이 계정으로 발송할까요?" : "Send emails from this account?"}
          </p>

          {/* Error Message */}
          {error && <p className="mb-4 text-red-500 text-sm">{error}</p>}

          {/* Action Buttons */}
          <div className="w-full max-w-sm space-y-3">
            <Button
              className="h-12 w-full bg-blue-600 hover:bg-blue-700"
              disabled={isLoading}
              onClick={handleConnect}
              size="lg"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              {isLoading
                ? isKorean
                  ? "연결 중..."
                  : "Connecting..."
                : isKorean
                  ? "이메일 연동하기"
                  : "Connect Email"}
            </Button>

            {/* Back Button */}
            <Button
              className="w-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              onClick={handleBack}
              variant="ghost"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isKorean ? "이전" : "Back"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Linked email accounts view component
type LinkedEmailAccountsViewProps = {
  emailAccount: UserEmailAccount
  workspaceId: string
  onAddMore: () => void
  onBack: () => void
  onNext: () => void
  isAddingMore: boolean
  isNextLoading?: boolean
}

function LinkedEmailAccountsView({
  emailAccount,
  workspaceId,
  onAddMore,
  onBack,
  onNext,
  isAddingMore,
  isNextLoading,
}: LinkedEmailAccountsViewProps) {
  const { t, i18n } = useTranslation()
  const deleteEmailAccountMutation = useDeleteEmailAccount()
  const [isDeleting, setIsDeleting] = useState(false)
  const [showChangeAccountDialog, setShowChangeAccountDialog] = useState(false)
  const [isChangingAccount, setIsChangingAccount] = useState(false)

  const { refetch } = useEmailAccountByWorkspaceAndUser(workspaceId, !!workspaceId)

  const handleDelete = async () => {
    // Confirm deletion
    const confirmed = window.confirm(
      t("app.onboarding.step1.deleteConfirm", "이 이메일 계정을 삭제하시겠습니까?"),
    )
    if (!confirmed) {
      return
    }

    setIsDeleting(true)
    try {
      // Try to delete Unipile account first (may fail if already deleted or invalid)
      try {
        await deleteUnipileAccount(emailAccount.id)
      } catch (accountError) {
        // Account deletion failure is not critical - continue with email account deletion
        console.warn("Failed to delete Unipile account (may already be deleted):", accountError)
      }

      // Then delete the email account from database
      await deleteEmailAccountMutation.mutateAsync(emailAccount.id)

      // Refetch to refresh the list (may 404 if account was deleted, which is expected)
      try {
        await refetch()
      } catch {
        // Expected - account no longer exists after deletion
      }

      toast.success(t("app.onboarding.step1.deleteSuccess", "이메일 계정이 삭제되었습니다"))
    } catch (error) {
      console.error("Failed to delete email account:", error)
      toast.error(t("app.onboarding.step1.deleteError", "이메일 계정 삭제에 실패했습니다"))
    } finally {
      setIsDeleting(false)
    }
  }

  // 계정 변경: 기존 계정 삭제 후 새 계정 연동 플로우 시작
  const handleChangeAccount = async () => {
    setIsChangingAccount(true)
    try {
      // 1. 기존 Unipile 계정 삭제 시도
      try {
        await deleteUnipileAccount(emailAccount.id)
      } catch (accountError) {
        console.warn("Failed to delete Unipile account (may already be deleted):", accountError)
      }

      // 2. DB에서 이메일 계정 삭제
      await deleteEmailAccountMutation.mutateAsync(emailAccount.id)

      // 3. 삭제 성공 후 새 계정 연동 플로우 시작
      setShowChangeAccountDialog(false)
      onAddMore()
    } catch (error) {
      console.error("Failed to change email account:", error)
      toast.error(
        i18n.language === "ko"
          ? "계정 변경에 실패했습니다. 다시 시도해주세요."
          : "Failed to change account. Please try again.",
      )
      setIsChangingAccount(false)
    }
  }

  const isKorean = i18n.language === "ko"

  return (
    <Card className="mx-auto max-w-2xl">
      <CardContent className="px-8 pt-8 pb-8">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-50 to-emerald-50">
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-xl">
              {isKorean ? "연결 완료" : "Connected"}
            </h2>
            <p className="text-gray-500 text-sm">
              {isKorean
                ? "이제 영업 이메일을 대신 보내드릴 준비가 됐어요"
                : "Now ready to send sales emails on your behalf"}
            </p>
          </div>
        </div>

        {/* Email Account Card */}
        <div className="mb-6 rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Mail className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{emailAccount.emailAddress}</span>
                {emailAccount.isDefault && (
                  <Badge className="text-xs" variant="secondary">
                    {isKorean ? "기본" : "Default"}
                  </Badge>
                )}
              </div>
              {emailAccount.displayName && (
                <span className="text-gray-500 text-sm">{emailAccount.displayName}</span>
              )}
            </div>
            <Badge
              className={emailAccount.status === "active" ? "bg-green-100 text-green-700" : ""}
              variant={emailAccount.status === "active" ? "default" : "secondary"}
            >
              {emailAccount.status === "active"
                ? isKorean
                  ? "연결됨"
                  : "Connected"
                : emailAccount.status}
            </Badge>
            {/* Delete Button */}
            <Button
              className="text-gray-400 hover:bg-red-50 hover:text-red-500"
              disabled={isDeleting}
              onClick={handleDelete}
              size="icon"
              variant="ghost"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Change Account Button */}
        <Button
          className="mb-4 h-11 w-full border-dashed text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          disabled={isAddingMore || isChangingAccount}
          onClick={() => setShowChangeAccountDialog(true)}
          variant="outline"
        >
          {isAddingMore || isChangingAccount ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          {isKorean ? "다른 계정으로 변경" : "Change to another account"}
        </Button>

        {/* Change Account Confirmation Dialog */}
        <AlertDialog onOpenChange={setShowChangeAccountDialog} open={showChangeAccountDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <AlertDialogTitle className="text-center">
                {isKorean ? "이메일 계정을 변경하시겠어요?" : "Change email account?"}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                {isKorean ? (
                  <>
                    현재 연동된{" "}
                    <span className="font-medium text-gray-700">{emailAccount.emailAddress}</span>{" "}
                    계정의 연결이 해제되고,
                    <br />새 계정으로 연동됩니다.
                  </>
                ) : (
                  <>
                    Your current account{" "}
                    <span className="font-medium text-gray-700">{emailAccount.emailAddress}</span>{" "}
                    will be disconnected,
                    <br />
                    and a new account will be connected.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="sm:justify-center">
              <AlertDialogCancel disabled={isChangingAccount}>
                {isKorean ? "취소" : "Cancel"}
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-blue-600 hover:bg-blue-700"
                disabled={isChangingAccount}
                onClick={(e) => {
                  e.preventDefault()
                  handleChangeAccount()
                }}
              >
                {isChangingAccount ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {isKorean ? "계정 변경하기" : "Change account"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <Button
            className="h-11 flex-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            disabled={isNextLoading}
            onClick={onBack}
            variant="ghost"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isKorean ? "이전" : "Back"}
          </Button>
          <Button
            className="h-11 flex-[2] bg-blue-500 text-white hover:bg-blue-600"
            disabled={isNextLoading}
            onClick={onNext}
          >
            {isNextLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isKorean ? "바이어 확인하기" : "Review buyers"}
            {!isNextLoading && <ArrowRight className="ml-2 h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
