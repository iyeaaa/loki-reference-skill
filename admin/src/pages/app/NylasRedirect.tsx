import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api/client"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { authApi } from "@/lib/api/services/auth"
import { exchangeCodeForGrant } from "@/lib/api/services/nylas"
import { useAuth } from "@/lib/auth-provider"
import { clearSurveyStorage, isValidSurveyData, type SurveyData } from "@/store/survey"

type NylasAuthResponse = {
  token: string
  user: {
    id: string
    username: string
    email: string
    userRole: string
    isActive: boolean
    authProvider: string
    profilePicture?: string
    trialStatus?: {
      isTrialActive: boolean
      daysRemaining: number
      trialEndDate: string
    }
  }
}

export function NylasRedirect() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()
  const [hasProcessed, setHasProcessed] = useState(false)

  // Get user's workspace (fallback only for email linking)
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  const { data: userWorkspaces } = useUserWorkspaces(!!userId)
  const fallbackWorkspaceId = userWorkspaces?.[0]?.id

  useEffect(() => {
    const code = searchParams.get("code")
    const stateParam = searchParams.get("state")

    if (!code || hasProcessed) {
      return
    }

    // Parse state to determine context
    let context = "email_link" // default for existing email linking flow
    let parsedState: SurveyData & { context?: string } = {
      industry: null,
      target: null,
      country: null,
      experience: null,
    }

    if (stateParam) {
      try {
        parsedState = JSON.parse(stateParam)
        context = parsedState.context || "email_link"
      } catch (_error) {
        // If state is not JSON, it's probably workspaceId from old flow
        console.log("Using state as workspaceId (legacy flow)")
      }
    }

    setHasProcessed(true)

    // Handle initial login flow (from NewTrialPage)
    if (context === "initial_login") {
      console.log("[NylasRedirect] Processing initial login flow")

      apiFetch<NylasAuthResponse>("/api/v1/auth/nylas/callback", {
        method: "POST",
        body: JSON.stringify({ code, state: stateParam }),
      })
        .then((response) => {
          console.log("[NylasRedirect] Login successful:", response.user.email)

          const authUser = {
            id: response.user.id,
            email: response.user.email,
            username: response.user.username,
            userRole: response.user.userRole,
            isActive: response.user.isActive,
            trialStatus: response.user.trialStatus,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          // Store auth data
          authApi.storeAuthData(response.token, authUser)

          // Update auth context
          login(response.token, authUser, true)

          toast.success(`환영합니다, ${response.user.username}님!`)

          if (response.user.trialStatus?.isTrialActive) {
            toast.info(`무료 체험 기간: ${response.user.trialStatus.daysRemaining}일 남음`)
          }

          // Clear survey data
          clearSurveyStorage()

          // Navigate based on onboarding params
          // Use window.location.href to ensure auth context is fully loaded
          if (isValidSurveyData(parsedState)) {
            const params = new URLSearchParams({
              industry: parsedState.industry || "",
              target: parsedState.target || "",
              country: parsedState.country || "",
              experience: parsedState.experience || "",
            })
            window.location.href = `/trial/result?${params.toString()}`
          } else {
            window.location.href = "/company"
          }
        })
        .catch((error) => {
          console.error("[NylasRedirect] Login failed:", error)
          toast.error("로그인에 실패했습니다. 다시 시도해주세요.")
          navigate("/trial", { replace: true })
        })
    } else {
      // Handle email linking flow (from StepEmailLink)
      console.log("[NylasRedirect] Processing email linking flow")

      const workspaceId =
        typeof stateParam === "string" && !parsedState.context ? stateParam : fallbackWorkspaceId

      if (!workspaceId) {
        toast.error("워크스페이스 정보를 찾을 수 없습니다.")
        navigate("/company?step=3", { replace: true })
        return
      }

      exchangeCodeForGrant(code, workspaceId)
        .then((grant) => {
          console.log("Nylas grant received:", grant)
          toast.success(t("redirect.success", "이메일 계정이 연동되었습니다!"))
          // Go to step 4 (confirmation) after successful email linking
          navigate("/company?step=4", { replace: true })
        })
        .catch((error) => {
          console.error("Failed to exchange code:", error)
          toast.error(t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요."))
          // Go back to step 3 (email linking) on failure
          navigate("/company?step=3", { replace: true })
        })
    }
  }, [searchParams, navigate, hasProcessed, t, fallbackWorkspaceId, login])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
      <p className="text-gray-500">{t("redirect.connecting", "이메일 계정을 연동하는 중...")}</p>
    </div>
  )
}
