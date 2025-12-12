import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { usersApi } from "../services/users"
import type { User, UsersParams } from "../types"

// 1. Query Keys
export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params?: UsersParams) => [...userKeys.lists(), params] as const,
  detail: (id: string) => [...userKeys.all, "detail", id] as const,
  stats: () => [...userKeys.all, "stats"] as const,
}

// 2. Queries
export function useUsers(params?: UsersParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
    enabled: options?.enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useUser(userId: string, enabled = true) {
  return useQuery({
    queryKey: userKeys.detail(userId),
    queryFn: () => usersApi.get(userId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useUserStats() {
  return useQuery({
    queryKey: userKeys.stats(),
    queryFn: usersApi.stats,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useAllUsers(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...userKeys.all, "all"],
    queryFn: () => usersApi.getAll(),
    enabled: options?.enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// 3. Mutations
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      username: string
      email: string
      password?: string
      userRole: string
      isActive: boolean
      departmentId: number
      employeeId: string
    }) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })
      toast.success("사용자가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 생성에 실패했습니다")
    },
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, data }: { userId: string; data: Partial<User> }) =>
      usersApi.update(userId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.userId) })
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })

      // 현재 로그인 사용자의 역할이 변경된 경우 → 페이지 새로고침으로 전체 상태 초기화
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
      if (currentUser?.id === variables.userId && variables.data.userRole !== undefined) {
        const updatedUserData = { ...currentUser, userRole: variables.data.userRole }
        localStorage.setItem("user", JSON.stringify(updatedUserData))
        toast.success("권한이 변경되어 페이지를 새로고침합니다")
        setTimeout(() => window.location.reload(), 500)
        return
      }

      toast.success("사용자 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => usersApi.delete(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })
      toast.success("사용자가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 삭제에 실패했습니다")
    },
  })
}

export function useBulkUpdateStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { userIds: string[]; isActive: boolean }) =>
      usersApi.bulkUpdateStatus(data.userIds, data.isActive),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })
      toast.success(`${response.updatedCount || 0}명의 사용자 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { userIds: string[]; role: string }) =>
      usersApi.bulkUpdateRole(data.userIds, data.role),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })

      // 현재 로그인 사용자가 변경 대상에 포함된 경우 → 페이지 새로고침
      const currentUser = JSON.parse(localStorage.getItem("user") || "{}")
      if (currentUser?.id && variables.userIds.includes(currentUser.id)) {
        const updatedUserData = { ...currentUser, userRole: variables.role }
        localStorage.setItem("user", JSON.stringify(updatedUserData))
        toast.success("권한이 변경되어 페이지를 새로고침합니다")
        setTimeout(() => window.location.reload(), 500)
        return
      }

      toast.success(`${response.updatedCount || 0}명의 사용자 역할이 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 역할 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: { userIds: string[]; departmentId: string }) =>
      usersApi.bulkUpdateDepartment(data.userIds, data.departmentId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })
      toast.success(`${response.updatedCount || 0}명의 사용자 부서가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "사용자 부서 업데이트에 실패했습니다")
    },
  })
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ userId, password }: { userId: string; password: string }) =>
      usersApi.changePassword(userId, password),
    onSuccess: () => {
      toast.success("비밀번호가 변경되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "비밀번호 변경에 실패했습니다")
    },
  })
}

// ====================================
// ONBOARDING HOOKS
// ====================================

export const onboardingKeys = {
  all: ["onboarding"] as const,
  status: (userId: string) => [...onboardingKeys.all, "status", userId] as const,
}

/** 온보딩 상태 조회 훅 */
export function useOnboardingStatus(userId: string, enabled = true) {
  return useQuery({
    queryKey: onboardingKeys.status(userId),
    queryFn: () => usersApi.getOnboardingStatus(userId),
    enabled: enabled && !!userId,
    staleTime: 0, // 항상 최신 데이터
    gcTime: 0,
  })
}

/** 온보딩 단계 업데이트 mutation */
export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, step }: { userId: string; step: number }) =>
      usersApi.updateOnboardingStep(userId, step),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(variables.userId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 진행 상태 업데이트에 실패했습니다")
    },
  })
}

/** 온보딩 완료 mutation */
export function useCompleteOnboarding() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => usersApi.completeOnboarding(userId),
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(userId) })
      toast.success("온보딩이 완료되었습니다!")
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 완료 처리에 실패했습니다")
    },
  })
}

/** 온보딩 설문 업데이트 mutation */
export function useUpdateOnboardingSurvey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      userId,
      survey,
    }: {
      userId: string
      survey: {
        industry?: string
        target?: string
        country?: string
        experience?: string
        lang?: string
      }
    }) => usersApi.updateOnboardingSurvey(userId, survey),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: onboardingKeys.status(variables.userId) })
    },
    onError: (error: Error) => {
      toast.error(error.message || "온보딩 설문 업데이트에 실패했습니다")
    },
  })
}
