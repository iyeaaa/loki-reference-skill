import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailRepliesApi } from "../services/email-replies"
import type { EmailReplyFilters } from "../types/email-reply"

export const EMAIL_REPLIES_QUERY_KEY = "email-replies"

/**
 * Hook to list email replies with pagination and filters
 */
export function useEmailReplies(params: {
  limit?: number
  offset?: number
  filters?: EmailReplyFilters
}) {
  return useQuery({
    queryKey: [EMAIL_REPLIES_QUERY_KEY, params],
    queryFn: () => emailRepliesApi.list(params),
  })
}

/**
 * Hook to get single email reply by ID
 */
export function useEmailReply(id: string) {
  return useQuery({
    queryKey: [EMAIL_REPLIES_QUERY_KEY, id],
    queryFn: () => emailRepliesApi.getById(id),
    enabled: !!id,
  })
}

/**
 * Hook to mark reply as read
 */
export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => emailRepliesApi.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      toast.success("읽음으로 표시되었습니다.")
    },
    onError: () => {
      toast.error("읽음 표시에 실패했습니다.")
    },
  })
}

/**
 * Hook to mark reply as unread
 */
export function useMarkAsUnread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => emailRepliesApi.markAsUnread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      toast.success("읽지 않음으로 표시되었습니다.")
    },
    onError: () => {
      toast.error("읽지 않음 표시에 실패했습니다.")
    },
  })
}

/**
 * Hook to bulk mark as read
 */
export function useBulkMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (replyIds: string[]) => emailRepliesApi.bulkMarkAsRead(replyIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      toast.success(`${data.updatedCount}개의 답장이 읽음으로 표시되었습니다.`)
    },
    onError: () => {
      toast.error("읽음 표시에 실패했습니다.")
    },
  })
}

/**
 * Hook to bulk mark as unread
 */
export function useBulkMarkAsUnread() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (replyIds: string[]) => emailRepliesApi.bulkMarkAsUnread(replyIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      toast.success(`${data.updatedCount}개의 답장이 읽지 않음으로 표시되었습니다.`)
    },
    onError: () => {
      toast.error("읽지 않음 표시에 실패했습니다.")
    },
  })
}

/**
 * Hook to delete email reply
 */
export function useDeleteEmailReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => emailRepliesApi.delete(id),
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      queryClient.invalidateQueries({ queryKey: ["thread-emails"] })
      queryClient.invalidateQueries({ queryKey: ["emails"] })
      toast.success("답장이 삭제되었습니다.")
    },
    onError: () => {
      toast.error("답장 삭제에 실패했습니다.")
    },
  })
}

/**
 * Hook to bulk delete email replies
 * Invalidates all related caches: email-replies, replied-emails, thread-emails, emails
 */
export function useBulkDeleteEmailReplies() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (replyIds: string[]) => emailRepliesApi.bulkDelete(replyIds),
    onSuccess: (data) => {
      // Invalidate all related queries after bulk delete
      // This ensures the UI reflects the deletion across all views
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      queryClient.invalidateQueries({ queryKey: ["thread-emails"] })
      queryClient.invalidateQueries({ queryKey: ["emails"] })
      toast.success(`${data.deletedCount}개의 답장이 삭제되었습니다.`)
    },
    onError: () => {
      toast.error("답장 삭제에 실패했습니다.")
    },
  })
}
