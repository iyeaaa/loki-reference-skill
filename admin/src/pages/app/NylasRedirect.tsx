import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { exchangeCodeForGrant } from "@/lib/api/services/nylas"
import { processUnipileCallback } from "@/lib/api/services/unipile"

export function NylasRedirect() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [hasProcessed, setHasProcessed] = useState(false)

  // Get user's workspace (fallback only)
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const fallbackWorkspaceId = userWorkspaces?.[0]?.id

  useEffect(() => {
    const code = searchParams.get("code")
    const accountId = searchParams.get("account_id")
    const errorParam = searchParams.get("error")

    // Get workspaceId from state parameter (passed from OAuth URL)
    const stateWorkspaceId = searchParams.get("state")
    const workspaceId = stateWorkspaceId || fallbackWorkspaceId

    // Check for error from auth provider
    if (errorParam) {
      toast.error(t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요."))
      navigate("/company?step=3", { replace: true })
      return
    }

    // Check if already processed or missing required params
    if (hasProcessed || !workspaceId) {
      return
    }

    // Handle Unipile callback (account_id present)
    if (accountId) {
      setHasProcessed(true)

      console.log("Processing Unipile callback:", { accountId, workspaceId })

      processUnipileCallback(accountId, workspaceId)
        .then((account) => {
          console.log("Unipile account connected:", account)
          toast.success(t("redirect.success", "이메일 계정이 연동되었습니다!"))
          navigate("/company?step=4", { replace: true })
        })
        .catch((error) => {
          console.error("Failed to process Unipile callback:", error)
          toast.error(t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요."))
          navigate("/company?step=3", { replace: true })
        })
      return
    }

    // Handle Nylas callback (code present)
    if (code) {
      setHasProcessed(true)

      exchangeCodeForGrant(code, workspaceId)
        .then((grant) => {
          console.log("Nylas grant received:", grant)
          toast.success(t("redirect.success", "이메일 계정이 연동되었습니다!"))
          navigate("/company?step=4", { replace: true })
        })
        .catch((error) => {
          console.error("Failed to exchange code:", error)
          toast.error(t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요."))
          navigate("/company?step=3", { replace: true })
        })
      return
    }
  }, [searchParams, navigate, hasProcessed, t, fallbackWorkspaceId])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
      <p className="text-gray-500">{t("redirect.connecting", "이메일 계정을 연동하는 중...")}</p>
    </div>
  )
}
