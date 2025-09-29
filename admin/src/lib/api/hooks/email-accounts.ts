import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailAccountsApi } from "../services/email-accounts"
import type {
  BulkUpdateEmailAccountStatusRequest,
  CreateEmailAccountRequest,
  EmailAccountsParams,
  SetAsDefaultRequest,
  UpdateEmailAccountRequest,
  UpdateErrorRequest,
} from "../types/email-account"

// Query Keys
export const emailAccountKeys = {
  all: ["emailAccounts"] as const,
  lists: () => [...emailAccountKeys.all, "list"] as const,
  list: (params?: EmailAccountsParams) => [...emailAccountKeys.lists(), params] as const,
  detail: (id: string) => [...emailAccountKeys.all, "detail", id] as const,
  user: (userId: string) => [...emailAccountKeys.all, "user", userId] as const,
  workspace: (workspaceId: string) => [...emailAccountKeys.all, "workspace", workspaceId] as const,
  activeWorkspace: (workspaceId: string) =>
    [...emailAccountKeys.all, "activeWorkspace", workspaceId] as const,
}

// Queries
export function useEmailAccounts(params?: EmailAccountsParams) {
  return useQuery({
    queryKey: emailAccountKeys.list(params),
    queryFn: () => emailAccountsApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmailAccount(accountId: string, enabled = true) {
  return useQuery({
    queryKey: emailAccountKeys.detail(accountId),
    queryFn: () => emailAccountsApi.get(accountId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEmailAccountsByUser(userId: string, enabled = true) {
  return useQuery({
    queryKey: emailAccountKeys.user(userId),
    queryFn: () => emailAccountsApi.getByUser(userId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEmailAccountsByWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: emailAccountKeys.workspace(workspaceId),
    queryFn: () => emailAccountsApi.getByWorkspace(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useActiveEmailAccountsByWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: emailAccountKeys.activeWorkspace(workspaceId),
    queryFn: () => emailAccountsApi.getActiveByWorkspace(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Mutations
export function useCreateEmailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmailAccountRequest) => emailAccountsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("이메일 계정이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 계정 생성에 실패했습니다")
    },
  })
}

export function useUpdateEmailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: UpdateEmailAccountRequest }) =>
      emailAccountsApi.update(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(variables.accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("이메일 계정이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 계정 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteEmailAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => emailAccountsApi.delete(accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("이메일 계정이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 계정 삭제에 실패했습니다")
    },
  })
}

export function useSetEmailAccountAsDefault() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: SetAsDefaultRequest }) =>
      emailAccountsApi.setAsDefault(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(variables.accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("기본 계정으로 설정되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "기본 계정 설정에 실패했습니다")
    },
  })
}

export function useUpdateSentCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => emailAccountsApi.updateSentCount(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "발송 카운트 업데이트에 실패했습니다")
    },
  })
}

export function useResetDailySentCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => emailAccountsApi.resetDailySentCount(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("일일 발송 카운트가 초기화되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "일일 발송 카운트 초기화에 실패했습니다")
    },
  })
}

export function useResetMonthlySentCount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => emailAccountsApi.resetMonthlySentCount(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success("월별 발송 카운트가 초기화되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "월별 발송 카운트 초기화에 실패했습니다")
    },
  })
}

export function useUpdateLastError() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: UpdateErrorRequest }) =>
      emailAccountsApi.updateLastError(accountId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(variables.accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "에러 정보 업데이트에 실패했습니다")
    },
  })
}

export function useUpdateLastSync() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (accountId: string) => emailAccountsApi.updateLastSync(accountId),
    onSuccess: (_, accountId) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.detail(accountId) })
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
    },
    onError: (error: Error) => {
      toast.error(error.message || "동기화 정보 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateEmailAccountStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateEmailAccountStatusRequest) =>
      emailAccountsApi.bulkUpdateStatus(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailAccountKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 이메일 계정 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 계정 상태 업데이트에 실패했습니다")
    },
  })
}
