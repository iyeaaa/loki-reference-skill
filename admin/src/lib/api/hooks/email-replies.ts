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

/**
 * Hook to update email reply intent and sentiment manually
 */
export function useUpdateEmailReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: {
        intent?:
          | "meeting_request"
          | "question"
          | "objection"
          | "out_of_office"
          | "not_interested"
          | "positive_interest"
          | "neutral"
          | null
        sentiment?: "positive" | "neutral" | "negative" | "interested" | "not_interested" | null
      }
    }) => emailRepliesApi.update(id, data),
    onSuccess: () => {
      // Invalidate related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      queryClient.invalidateQueries({ queryKey: ["thread-emails"] })
      queryClient.invalidateQueries({ queryKey: ["intent-counts"] })
      toast.success("태그가 업데이트되었습니다.")
    },
    onError: (error: Error) => {
      toast.error(`태그 업데이트 실패: ${error.message}`)
    },
  })
}

/**
 * Hook to reclassify email reply using AI
 */
export function useReclassifyEmailReply() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => emailRepliesApi.reclassify(id),
    onSuccess: (response) => {
      // Invalidate related queries to refresh UI
      queryClient.invalidateQueries({ queryKey: [EMAIL_REPLIES_QUERY_KEY] })
      queryClient.invalidateQueries({ queryKey: ["replied-emails"] })
      toast.success(
        `AI 분류 완료: ${response.data.classification.intent} (신뢰도: ${Math.round(response.data.classification.confidence * 100)}%)`,
      )
    },
    onError: (error: Error) => {
      toast.error(`AI 분류 실패: ${error.message}`)
    },
  })
}

/**
 * Hook to get intent counts for a workspace
 */
export function useIntentCounts(workspaceId: string) {
  return useQuery({
    queryKey: ["intent-counts", workspaceId],
    queryFn: () => emailRepliesApi.getIntentCounts(workspaceId),
    enabled: !!workspaceId,
    staleTime: 30 * 1000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to toggle important status of an email
 * Uses optimistic update to immediately update UI without refetching
 */
export function useToggleImportant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ threadId, isImportant }: { threadId: string; isImportant: boolean }) =>
      emailRepliesApi.toggleImportant(threadId, isImportant),
    onMutate: async ({ threadId, isImportant }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["replied-emails"] })

      // Snapshot the previous value
      const previousData = queryClient.getQueriesData({ queryKey: ["replied-emails"] })

      // Optimistically update ALL cached queries with replied-emails key
      // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
      queryClient.setQueriesData({ queryKey: ["replied-emails"] }, (old: any) => {
        if (!old?.repliedEmails) return old

        return {
          ...old,
          // biome-ignore lint/suspicious/noExplicitAny: QueryClient cache data is untyped
          repliedEmails: old.repliedEmails.map((email: any) =>
            email.threadId === threadId ? { ...email, isImportant } : email,
          ),
        }
      })

      // Return context for rollback
      return { previousData }
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data)
        }
      }
      toast.error("중요 표시 변경에 실패했습니다.")
    },
    onSuccess: () => {
      // After successful API call, invalidate queries but don't refetch active ones
      // This ensures that when switching to Important filter, it will fetch fresh data
      queryClient.invalidateQueries({
        queryKey: ["replied-emails"],
        refetchType: "none", // Don't refetch currently active queries
      })
      queryClient.invalidateQueries({ queryKey: ["intent-counts"] })
    },
  })
}
