import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Mail,
  Plus,
  SkipForward,
  Trash2,
} from "lucide-react"
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
  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(
    userId,
    !!userId,
  )
  const workspace = userWorkspaces?.[0]

  // Get email accounts for this workspace and user
  const {
    data: emailAccount,
    isLoading: isLoadingEmailAccounts,
    isRefetchError,
    error: emailAccountError,
  } = useEmailAccountByWorkspaceAndUser(workspace?.id || "", userId, !!workspace?.id && !!userId)

  console.log(isRefetchError, emailAccountError)

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

  const handleNextStep = () => {
    // Go to step 5 (confirmation)
    setSearchParams({ step: "5" })
  }

  const handleSkip = () => {
    // Skip email linking and go to next step
    setSearchParams({ step: "5" })
  }

  // Loading state
  if (isLoadingWorkspaces || isLoadingEmailAccounts) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="pt-12 pb-10 px-8 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    )
  }

  // If email account exists, show the linked accounts view
  if (emailAccount && workspace && !isRefetchError && !emailAccountError) {
    return (
      <LinkedEmailAccountsView
        emailAccount={emailAccount}
        workspaceId={workspace.id}
        userId={userId}
        onAddMore={handleConnect}
        onNext={handleNextStep}
        isAddingMore={isLoading}
      />
    )
  }

  // No email accounts - show confirmation dialog
  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-12 pb-10 px-8">
        <div className="flex flex-col items-center text-center">
          {/* Email Icon */}
          <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mb-8">
            <Mail className="w-10 h-10 text-blue-500" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            {t("app.onboarding.step4.connectTitle", "이메일 연동")}
          </h2>

          {/* Description */}
          <p className="text-gray-500 mb-4 max-w-sm">
            {t(
              "app.onboarding.step4.connectDescription",
              "이메일을 발송하기 위해 계정을 연동해주세요",
            )}
          </p>

          {/* Current user email info */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6 w-full max-w-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <p className="font-medium text-gray-900">{userEmail}</p>
                <p className="text-sm text-gray-500">
                  {isKorean ? "현재 로그인된 계정" : "Currently logged in account"}
                </p>
              </div>
            </div>
          </div>

          {/* Confirmation message */}
          <p className="text-lg font-medium text-gray-900 mb-6">
            {t("app.onboarding.step4.confirmConnect", "연동하시겠습니까?")}
          </p>

          {/* Error Message */}
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {/* Action Buttons */}
          <div className="flex gap-3 w-full max-w-sm">
            <Button variant="outline" size="lg" onClick={handleSkip} className="flex-1 h-12">
              <SkipForward className="w-4 h-4 mr-2" />
              {t("app.onboarding.step4.skipButton", "나중에")}
            </Button>
            <Button
              size="lg"
              onClick={handleConnect}
              disabled={isLoading}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-5 h-5 mr-2" />
              )}
              {isLoading
                ? t("app.onboarding.step1.loading", "연동 중...")
                : t("app.onboarding.step4.connectButton", "연동하기")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Linked email accounts view component
interface LinkedEmailAccountsViewProps {
  emailAccount: UserEmailAccount
  workspaceId: string
  userId: string
  onAddMore: () => void
  onNext: () => void
  isAddingMore: boolean
}

function LinkedEmailAccountsView({
  emailAccount,
  workspaceId,
  userId,
  onAddMore,
  onNext,
  isAddingMore,
}: LinkedEmailAccountsViewProps) {
  const { t } = useTranslation()
  const deleteEmailAccountMutation = useDeleteEmailAccount()
  const [isDeleting, setIsDeleting] = useState(false)

  const { refetch } = useEmailAccountByWorkspaceAndUser(workspaceId, userId, true)

  const handleDelete = async () => {
    // Confirm deletion
    const confirmed = window.confirm(
      t("app.onboarding.step1.deleteConfirm", "이 이메일 계정을 삭제하시겠습니까?"),
    )
    if (!confirmed) return

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

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent className="pt-8 pb-8 px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {t("app.onboarding.step1.linkedTitle", "이메일 계정이 연동되었습니다")}
            </h2>
            <p className="text-gray-500 text-sm">
              {t("app.onboarding.step1.linkedDescription", "아래 계정으로 이메일을 발송합니다")}
            </p>
          </div>
        </div>

        {/* Email Account Card */}
        <div className="border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{emailAccount.emailAddress}</span>
                {emailAccount.isDefault && (
                  <Badge variant="secondary" className="text-xs">
                    {t("app.onboarding.step1.default", "기본")}
                  </Badge>
                )}
              </div>
              {emailAccount.displayName && (
                <span className="text-sm text-gray-500">{emailAccount.displayName}</span>
              )}
            </div>
            <Badge
              variant={emailAccount.status === "active" ? "default" : "secondary"}
              className={emailAccount.status === "active" ? "bg-green-100 text-green-700" : ""}
            >
              {emailAccount.status === "active"
                ? t("app.onboarding.step1.statusActive", "활성")
                : emailAccount.status}
            </Badge>
            {/* Delete Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50"
            >
              {isDeleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Add More Button */}
        <Button
          variant="outline"
          onClick={onAddMore}
          disabled={isAddingMore}
          className="w-full mb-4 h-11 border-dashed"
        >
          {isAddingMore ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-2" />
          )}
          {t("app.onboarding.step1.addMore", "다른 이메일 계정 추가")}
        </Button>

        {/* Next Step Button */}
        <Button onClick={onNext} className="w-full bg-blue-500 hover:bg-blue-600 text-white h-11">
          {t("app.onboarding.step1.nextButton", "다음 단계로")}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  )
}
