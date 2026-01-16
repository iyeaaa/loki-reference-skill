/**
 * UnipileRedirect (NylasRedirect)
 *
 * Unipile OAuth 콜백 처리 컴포넌트
 * - /app/redirect?account_id=xxx&state=workspaceId 형태로 리다이렉트됨
 * - 팝업에서 실행된 경우: 부모 창에 postMessage 전달 후 닫힘
 * - 일반 창에서 실행된 경우: 성공 시 Step 3, 실패 시 Step 2로 이동
 */

import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { ApiError } from "@/lib/api/client"
import { useUserWorkspaces } from "@/lib/api/hooks/workspaces"
import { processUnipileCallback } from "@/lib/api/services/unipile"

// [DEPRECATED] Nylas는 더 이상 사용하지 않음 - Unipile 사용
// import { exchangeCodeForGrant } from "@/lib/api/services/nylas"

/**
 * 팝업 창에서 실행 중인지 확인
 */
function isRunningInPopup(): boolean {
  try {
    // window.opener가 있고, 같은 origin인 경우 팝업으로 간주
    return !!window.opener && window.opener !== window
  } catch {
    // cross-origin 접근 에러 발생 시 false
    return false
  }
}

/**
 * 부모 창에 메시지 전송
 */
function notifyParent(type: "EMAIL_CONNECT_SUCCESS" | "EMAIL_CONNECT_ERROR", message?: string) {
  try {
    if (window.opener) {
      window.opener.postMessage({ type, message }, window.location.origin)
    }
  } catch (error) {
    console.warn("⚠️ [UnipileRedirect] Failed to send message to parent:", error)
  }
}

export function NylasRedirect() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [hasProcessed, setHasProcessed] = useState(false)
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")

  // Get user's workspace (fallback when state param is missing)
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
  const userId = currentUser?.id || ""
  const { data: userWorkspaces, isLoading: isLoadingWorkspaces } = useUserWorkspaces(!!userId)
  const fallbackWorkspaceId = userWorkspaces?.[0]?.id

  useEffect(() => {
    const accountId = searchParams.get("account_id")
    const errorParam = searchParams.get("error")

    // Get workspaceId from multiple sources (priority order):
    // 1. state parameter from URL (passed through OAuth)
    // 2. localStorage backup (saved before OAuth redirect)
    // 3. fallback from user's workspaces API
    const stateWorkspaceId = searchParams.get("state")
    let localStorageWorkspaceId: string | null = null
    try {
      localStorageWorkspaceId = localStorage.getItem("unipile_oauth_workspace_id")
    } catch (storageError) {
      // localStorage 접근 실패 (Safari 시크릿 모드 등)
      console.warn("⚠️ [UnipileRedirect] Failed to read from localStorage:", storageError)
    }
    const workspaceId = stateWorkspaceId || localStorageWorkspaceId || fallbackWorkspaceId

    // Debug logging - 핵심 디버깅 정보
    console.log("🔍 [UnipileRedirect] ============ DEBUG START ============")
    console.log("🔍 [UnipileRedirect] Full URL:", window.location.href)
    console.log("🔍 [UnipileRedirect] URL Search Params:", window.location.search)
    console.log("🔍 [UnipileRedirect] Parsed params:", {
      account_id: accountId,
      state: stateWorkspaceId,
      error: errorParam,
    })
    console.log("🔍 [UnipileRedirect] WorkspaceId sources:", {
      fromState: stateWorkspaceId,
      fromLocalStorage: localStorageWorkspaceId,
      fromFallback: fallbackWorkspaceId,
    })
    console.log("🔍 [UnipileRedirect] Final workspaceId:", workspaceId)
    console.log("🔍 [UnipileRedirect] State:", { hasProcessed, isLoadingWorkspaces, userId })
    console.log("🔍 [UnipileRedirect] ============ DEBUG END ==============")

    // 팝업 여부 확인
    const isPopup = isRunningInPopup()
    console.log("🔍 [UnipileRedirect] Running in popup:", isPopup)

    // Check for error from auth provider
    if (errorParam) {
      console.error("❌ [UnipileRedirect] OAuth error from provider:", errorParam)
      // Clean up localStorage (Safari 시크릿 모드에서 실패할 수 있음)
      try {
        localStorage.removeItem("unipile_oauth_workspace_id")
      } catch (storageError) {
        console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
      }

      // 팝업인 경우 부모에게 알리고 닫기
      if (isPopup) {
        setStatus("error")
        notifyParent("EMAIL_CONNECT_ERROR", t("redirect.error", "이메일 연동에 실패했습니다."))
        setTimeout(() => window.close(), 1500)
        return
      }

      toast.error(t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요."))
      navigate("/company?step=2", { replace: true })
      return
    }

    // Check if already processed
    if (hasProcessed) {
      console.log("⏭️ [UnipileRedirect] Already processed, skipping")
      return
    }

    // No account_id = not a valid Unipile callback
    if (!accountId) {
      console.warn("⚠️ [UnipileRedirect] No account_id in URL, redirecting to step 2")
      try {
        localStorage.removeItem("unipile_oauth_workspace_id") // Clean up
      } catch (storageError) {
        console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
      }
      navigate("/company?step=2", { replace: true })
      return
    }

    // Wait for workspaceId (either from state, localStorage, or fallback)
    if (!workspaceId) {
      if (isLoadingWorkspaces) {
        console.log("⏳ [UnipileRedirect] Waiting for workspace to load...")
        return
      }
      console.error("❌ [UnipileRedirect] No workspaceId available!", {
        fromState: stateWorkspaceId,
        fromLocalStorage: localStorageWorkspaceId,
        fromFallback: fallbackWorkspaceId,
      })
      try {
        localStorage.removeItem("unipile_oauth_workspace_id") // Clean up
      } catch (storageError) {
        console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
      }
      toast.error(t("redirect.error", "워크스페이스 정보를 찾을 수 없습니다."))
      navigate("/company?step=2", { replace: true })
      return
    }

    // Handle Unipile callback
    setHasProcessed(true)
    console.log("🚀 [UnipileRedirect] Processing Unipile callback:", { accountId, workspaceId })

    processUnipileCallback(accountId, workspaceId)
      .then((response) => {
        console.log("✅ [UnipileRedirect] Unipile success:", response)

        // Clean up localStorage after successful OAuth
        try {
          localStorage.removeItem("unipile_oauth_workspace_id")
          console.log("🧹 [UnipileRedirect] Cleaned up localStorage")
        } catch (storageError) {
          console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
        }

        // 팝업인 경우 부모에게 알리고 닫기
        if (isPopup) {
          setStatus("success")
          notifyParent("EMAIL_CONNECT_SUCCESS")
          setTimeout(() => window.close(), 100)
          return
        }

        toast.success(t("redirect.success", "이메일 계정이 연동되었습니다!"))
        // Step 3: 바이어 찾고 이메일 생성 화면으로 이동 (백그라운드 작업 진행 표시)
        navigate("/company?step=3", { replace: true })
      })
      .catch((error: Error | ApiError) => {
        // ApiError인 경우 status 정보 사용 가능
        const status = error instanceof ApiError ? error.status : undefined
        const data = error instanceof ApiError ? error.data : undefined

        console.error("❌ [UnipileRedirect] Unipile callback failed:", {
          message: error.message,
          status,
          data,
          isApiError: error instanceof ApiError,
          errorName: error.name,
        })

        // 409 Conflict = 이미 연동된 계정 → 성공으로 처리
        if (status === 409 || error.message?.includes("already exists")) {
          console.log("ℹ️ [UnipileRedirect] Account already exists (409), proceeding to step 3")

          // Clean up localStorage
          try {
            localStorage.removeItem("unipile_oauth_workspace_id")
          } catch (storageError) {
            console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
          }

          // 팝업인 경우 부모에게 알리고 닫기 (이미 연동된 계정도 성공으로 처리)
          if (isPopup) {
            setStatus("success")
            notifyParent("EMAIL_CONNECT_SUCCESS")
            setTimeout(() => window.close(), 1500)
            return
          }

          toast.success(t("redirect.alreadyConnected", "이미 연동된 계정입니다. 계속 진행합니다."))
          navigate("/company?step=3", { replace: true })
          return
        }

        // 400 Bad Request - workspaceId 누락 등
        if (status === 400) {
          console.error("❌ [UnipileRedirect] Bad Request (400) - likely missing workspaceId")
        }

        // 401 Unauthorized - 토큰 문제
        if (status === 401) {
          console.error("❌ [UnipileRedirect] Unauthorized (401) - auth token issue")
        }

        // Clean up localStorage on error too
        try {
          localStorage.removeItem("unipile_oauth_workspace_id")
        } catch (storageError) {
          console.warn("⚠️ [UnipileRedirect] Failed to clean up localStorage:", storageError)
        }

        const errorMessage =
          data?.message ||
          error.message ||
          t("redirect.error", "이메일 연동에 실패했습니다. 다시 시도해주세요.")

        // 팝업인 경우 부모에게 알리고 닫기
        if (isPopup) {
          setStatus("error")
          notifyParent("EMAIL_CONNECT_ERROR", errorMessage)
          setTimeout(() => window.close(), 2000)
          return
        }

        toast.error(errorMessage)
        navigate("/company?step=2", { replace: true })
      })
  }, [searchParams, navigate, hasProcessed, t, fallbackWorkspaceId, isLoadingWorkspaces, userId])

  // 상태별 UI 렌더링
  if (status === "success") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <CheckCircle className="mb-4 h-12 w-12 text-green-500" />
        <p className="font-medium text-gray-700">
          {t("redirect.success", "이메일 계정이 연동되었습니다!")}
        </p>
        <p className="mt-2 text-gray-500 text-sm">
          {t("redirect.closingPopup", "잠시 후 창이 닫힙니다...")}
        </p>
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center">
        <XCircle className="mb-4 h-12 w-12 text-red-500" />
        <p className="font-medium text-gray-700">
          {t("redirect.error", "이메일 연동에 실패했습니다.")}
        </p>
        <p className="mt-2 text-gray-500 text-sm">
          {t("redirect.closingPopup", "잠시 후 창이 닫힙니다...")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
      <p className="text-gray-500">{t("redirect.connecting", "이메일 계정을 연동하는 중...")}</p>
    </div>
  )
}
