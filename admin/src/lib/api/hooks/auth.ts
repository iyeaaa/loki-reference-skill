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
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
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
        response.message || "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다."
      )
      navigate("/login")
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
      authApi.logout()
    },
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: authKeys.all })
      queryClient.clear()

      toast.success("로그아웃되었습니다.")
      navigate("/login")
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
