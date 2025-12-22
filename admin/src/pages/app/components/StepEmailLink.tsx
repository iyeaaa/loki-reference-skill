import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Mail, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  useDeleteEmailAccount,
  useEmailAccountByWorkspaceAndUser,
} from "@/lib/api/hooks/email-accounts"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { deleteGrant, getNylasAuthUrl } from "@/lib/api/services/nylas"
import type { UserEmailAccount } from "@/lib/api/types/email-account"

export function StepEmailLink() {
  const { t, i18n } = useTranslation()
  const [, setSearchParams] = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)
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
      // Get OAuth URL from backend
      const response = await getNylasAuthUrl()

      // Redirect to Google OAuth
      window.location.href = response.url
    } catch (err) {
      console.error("Failed to get auth URL:", err)
      setError(
        t("app.onboarding.step1.error", "인증 URL을 가져오는데 실패했습니다. 다시 시도해주세요."),
      )
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    // Go back to step 2 (lead generation)
    setSearchParams({ step: "2" })
  }

  const handleNextStep = () => {
    // Go to step 4 (confirmation) - updated from 5 to 4 after combining steps
    setSearchParams({ step: "4" })
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
            {isKorean ? "발송 계정을 연결해주세요" : "Connect your email account"}
          </h2>

          {/* Description */}
          <p className="mb-4 max-w-sm text-gray-500">
            {isKorean
              ? "이 계정에서 바이어에게 이메일이 발송돼요"
              : "Emails will be sent from this account to your buyers"}
          </p>

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
                  ? "Gmail 연동하기"
                  : "Connect Gmail"}
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
}

function LinkedEmailAccountsView({
  emailAccount,
  workspaceId,
  onAddMore,
  onBack,
  onNext,
  isAddingMore,
}: LinkedEmailAccountsViewProps) {
  const { t, i18n } = useTranslation()
  const deleteEmailAccountMutation = useDeleteEmailAccount()
  const [isDeleting, setIsDeleting] = useState(false)

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
      // The apiKey field stores the Nylas grantId
      await deleteGrant(emailAccount.id)
      // Then delete the email account from database
      await deleteEmailAccountMutation.mutateAsync(emailAccount.id)

      // Refetch to refresh the list
      await refetch()

      toast.success(t("app.onboarding.step1.deleteSuccess", "이메일 계정이 삭제되었습니다"))
    } catch (error) {
      console.error("Failed to delete email account:", error)
      toast.error(t("app.onboarding.step1.deleteError", "이메일 계정 삭제에 실패했습니다"))
    } finally {
      setIsDeleting(false)
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
              {isKorean ? "연결 완료!" : "Connected!"}
            </h2>
            <p className="text-gray-500 text-sm">
              {isKorean
                ? "이 계정에서 바이어에게 이메일이 발송돼요"
                : "Emails will be sent from this account"}
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

        {/* Add More Button */}
        <Button
          className="mb-4 h-11 w-full border-dashed"
          disabled={isAddingMore}
          onClick={onAddMore}
          variant="outline"
        >
          {isAddingMore ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          {isKorean ? "다른 계정 추가" : "Add another account"}
        </Button>

        {/* Navigation Buttons */}
        <div className="flex gap-3">
          <Button
            className="h-11 flex-1 text-gray-600 hover:bg-gray-100 hover:text-gray-800"
            onClick={onBack}
            variant="ghost"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            {isKorean ? "이전" : "Back"}
          </Button>
          <Button
            className="h-11 flex-[2] bg-blue-500 text-white hover:bg-blue-600"
            onClick={onNext}
          >
            {isKorean ? "캠페인 확인하기" : "Review campaign"}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
