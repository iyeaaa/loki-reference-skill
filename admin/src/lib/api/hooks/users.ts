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
export function useUsers(params?: UsersParams) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => usersApi.list(params),
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

// 3. Mutations
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<User>) => usersApi.create(data),
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
      toast.success(`${response.updated_count}명의 사용자 상태가 업데이트되었습니다`)
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
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: userKeys.lists() })
      queryClient.invalidateQueries({ queryKey: userKeys.stats() })
      toast.success(`${response.updated_count}명의 사용자 역할이 업데이트되었습니다`)
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
      toast.success(`${response.updated_count}명의 사용자 부서가 업데이트되었습니다`)
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
