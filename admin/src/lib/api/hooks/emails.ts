import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailsApi } from "../services/emails"
import type {
  BulkUpdateEmailStatusRequest,
  CreateEmailRequest,
  EmailsParams,
  SendEmailRequest,
  UpdateEmailStatusRequest,
} from "../types/email"

// Query Keys
export const emailKeys = {
  all: ["emails"] as const,
  lists: () => [...emailKeys.all, "list"] as const,
  list: (params?: EmailsParams) => [...emailKeys.lists(), params] as const,
  detail: (id: string) => [...emailKeys.all, "detail", id] as const,
  events: (emailId: string) => [...emailKeys.all, "events", emailId] as const,
  replied: (workspaceId?: string, userId?: string) =>
    [...emailKeys.all, "replied", workspaceId, userId] as const,
}

// Queries
export function useEmails(params?: EmailsParams) {
  return useQuery({
    queryKey: emailKeys.list(params),
    queryFn: () => emailsApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmail(emailId: string, enabled = true) {
  return useQuery({
    queryKey: emailKeys.detail(emailId),
    queryFn: () => emailsApi.get(emailId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEmailEvents(emailId: string, enabled = true) {
  return useQuery({
    queryKey: emailKeys.events(emailId),
    queryFn: () => emailsApi.getEvents(emailId),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Mutations
export function useSendEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: SendEmailRequest) => emailsApi.send(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success("이메일이 전송되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 전송에 실패했습니다")
    },
  })
}

export function useCreateEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateEmailRequest) => emailsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success("이메일이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 생성에 실패했습니다")
    },
  })
}

export function useUpdateEmailStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ emailId, data }: { emailId: string; data: UpdateEmailStatusRequest }) =>
      emailsApi.updateStatus(emailId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.detail(variables.emailId) })
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success("이메일 상태가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 상태 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (emailId: string) => emailsApi.delete(emailId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success("이메일이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 삭제에 실패했습니다")
    },
  })
}

export function useBulkUpdateEmailStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateEmailStatusRequest) => emailsApi.bulkUpdateStatus(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 이메일 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkDeleteEmails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (emailIds: string[]) => emailsApi.bulkDelete(emailIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: emailKeys.lists() })
      toast.success(`${response.deletedCount || 0}개의 이메일이 삭제되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 삭제에 실패했습니다")
    },
  })
}

// Replied emails params type (users 패턴과 동일)
export interface RepliedEmailsParams {
  workspaceId: string
  page?: number
  limit?: number
  status?: string
  leadId?: string
  sequenceId?: string
  search?: string
}

export function useRepliedEmails(params: RepliedEmailsParams) {
  return useQuery({
    queryKey: ["replied-emails", params],
    queryFn: () => emailsApi.searchRepliedEmails(params),
    enabled: !!params.workspaceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Hook for thread emails (conversation history)
export function useThreadEmails(threadId: string | null, workspaceId?: string) {
  return useQuery({
    queryKey: ["thread-emails", threadId, workspaceId],
    queryFn: () => emailsApi.getThreadEmails(threadId || "", workspaceId),
    enabled: !!threadId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
