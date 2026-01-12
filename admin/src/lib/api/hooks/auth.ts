import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { useNavigate } from "react-router-dom"
import { authApi } from "../services/auth"

// 1. Query Keys
export const authKeys = {
  all: ["auth"] as const,
  verify: () => [...authKeys.all, "verify"] as const,
  session: () => [...authKeys.all, "session"] as const,
  user: () => [...authKeys.all, "user"] as const,
}

// 2. Queries
// useQuery: 특정 쿼리 키(key)를 기준으로 서버 데이터 fetch, 캐시, 상태 관리, 자동 refetch, 중복 요청 제거까지 담당.
export function useVerifyToken(enabled = true) {
  return useQuery({
    queryKey: authKeys.verify(),
    queryFn: authApi.verify,
    enabled,
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.user(),
    queryFn: authApi.getStoredUser,
    staleTime: 0, // Always consider data stale so it refetches when invalidated
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
  })
}

// 3. Mutations
// useMutation: 특정 데이터를 서버에 전송하고, 응답 데이터를 처리하는 작업을 담당. 서버 데이터 변경이 필요한 경우(POST/PUT/PATCH/DELETE) 사용. 로딩/에러/성공 상태 자동 관리, 요청 종료 후 관련 쿼리 자동 갱신 가능.
export function useLoginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["auth", "login"],
    mutationFn: authApi.login,
    onSuccess: (response) => {
      authApi.storeAuthData(response.token, response.user)

      queryClient.setQueryData(authKeys.user(), response.user)
      queryClient.invalidateQueries({ queryKey: authKeys.verify() })

      toast.success("로그인되었습니다.")

      // Force a page reload to ensure auth context is updated
      window.location.href = "/dashboard"
    },
    onError: (error: Error) => {
      toast.error(error.message || "로그인에 실패했습니다.")
    },
  })
}

export function useSignupMutation() {
  const navigate = useNavigate()

  return useMutation({
    mutationKey: ["auth", "signup"],
    mutationFn: authApi.signup,
    onSuccess: (response) => {
      toast.success(
        response.message || "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다.",
      )
      navigate("/auth")
    },
    onError: (error: Error) => {
      toast.error(error.message || "회원가입에 실패했습니다.")
    },
  })
}

export function useLogoutMutation() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["auth", "logout"],
    mutationFn: async () => {
      // 진입점 확인: /trial에서 로그인했으면 /trial로 복귀
      const entryPoint = sessionStorage.getItem("auth_entry_point")
      console.log("[useLogoutMutation] entryPoint:", entryPoint)

      authApi.logout()

      // Clear survey data to prevent stale data for next user
      localStorage.removeItem("rinda_survey_data")

      // Clear onboarding-related session storage
      sessionStorage.removeItem("onboarding_sequence")
      sessionStorage.removeItem("onboarding_leads")
      sessionStorage.removeItem("onboarding_company_info")
      sessionStorage.removeItem("onboarding_customer_group_id")
      sessionStorage.removeItem("auth_entry_point")

      return { entryPoint }
    },
    onSuccess: (result) => {
      queryClient.removeQueries({ queryKey: authKeys.all })
      queryClient.clear()

      toast.success("로그아웃되었습니다.")

      // 진입점 기반 리다이렉트: trial에서 들어왔으면 /trial로, 아니면 /auth로
      const redirectPath = result.entryPoint === "trial" ? "/trial?from=logout" : "/auth"
      console.log("[useLogoutMutation] redirecting to:", redirectPath)
      navigate(redirectPath)
    },
  })
}

export function useRefreshToken() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["auth", "refresh"],
    mutationFn: authApi.refresh,
    onSuccess: (response) => {
      const user = authApi.getStoredUser()
      if (user) {
        authApi.storeAuthData(response.token, user)
      }
      queryClient.invalidateQueries({ queryKey: authKeys.verify() })
    },
    onError: () => {
      toast.error("세션이 만료되었습니다. 다시 로그인해주세요.")
    },
  })
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["auth", "updateProfile"],
    mutationFn: authApi.updateProfile,
    onSuccess: (response) => {
      // Get current token
      const token = localStorage.getItem("authToken")
      if (token) {
        // Update localStorage with new user data
        authApi.storeAuthData(token, response.user)
      }

      // Update query cache and invalidate to force refetch
      queryClient.setQueryData(authKeys.user(), response.user)
      queryClient.invalidateQueries({ queryKey: authKeys.user() })
      queryClient.invalidateQueries({ queryKey: authKeys.verify() })

      toast.success("프로필이 업데이트되었습니다.")
    },
    onError: (error: Error) => {
      toast.error(error.message || "프로필 업데이트에 실패했습니다.")
    },
  })
}

// 4. アカウント削除
export function useAccountDeletionCheck() {
  return useQuery({
    queryKey: [...authKeys.all, "deletion-check"],
    queryFn: authApi.checkDeletionEligibility,
    staleTime: 0,
  })
}

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ["auth", "deleteAccount"],
    mutationFn: authApi.deleteAccount,
    onSuccess: () => {
      // すべての認証データをクリア
      authApi.logout()

      // すべてのクエリをクリア
      queryClient.removeQueries({ queryKey: authKeys.all })
      queryClient.clear()

      toast.success("계정이 삭제되었습니다.")

      // 認証ページにリダイレクト (window.location.href로 강제 페이지 리로드)
      // navigate 대신 사용하여 RouteGuard와의 충돌 방지
      setTimeout(() => {
        window.location.href = "/auth"
      }, 500) // toast 메시지가 보이도록 약간의 딜레이
    },
    onError: (error: Error) => {
      toast.error(error.message || "계정 삭제에 실패했습니다.")
    },
  })
}
