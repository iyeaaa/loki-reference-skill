import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type {
  ChatbotAskRequest,
  ChatbotProgress,
  ChatMessage,
  NodeProgressUpdate,
  SequenceModalPayload,
} from "@/lib/api/types/chatbot"
import { chatbotApi } from "../services/chatbot"

// 1. Query Keys
export const chatbotKeys = {
  all: ["chatbot"] as const,
  history: (conversationId: string) => [...chatbotKeys.all, "history", conversationId] as const,
  conversations: (workspaceId: string, userId: string) =>
    [...chatbotKeys.all, "conversations", workspaceId, userId] as const,
}

// 2. Queries
export function useChatbotHistory(conversationId: string, enabled = true) {
  return useQuery({
    queryKey: chatbotKeys.history(conversationId),
    queryFn: () => chatbotApi.getHistory(conversationId),
    enabled: enabled && !!conversationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// 3. Mutations
interface UseChatbotMutationOptions {
  onMessage: (message: ChatMessage) => void
  onMessageUpdate?: (message: ChatMessage) => void
  onThinking: (thinking: string) => void
  onProgress?: (progress: ChatbotProgress) => void
  onError?: (error: string) => void
  onConfirmationRequired?: (message: string) => void
  onNodeProgress?: (progress: NodeProgressUpdate) => void
  onOpenSequenceModal?: (payload: SequenceModalPayload) => void
}

/**
 * TanStack Query mutation for chatbot streaming
 * Handles lifecycle management while preserving streaming functionality
 */
export function useChatbotMutation(options: UseChatbotMutationOptions) {
  const {
    onMessage,
    onMessageUpdate,
    onThinking,
    onProgress,
    onError,
    onConfirmationRequired,
    onNodeProgress,
    onOpenSequenceModal,
  } = options

  return useMutation({
    mutationKey: ["chatbot", "ask"],
    mutationFn: async (request: ChatbotAskRequest) => {
      await chatbotApi.streamAsk(request, {
        onMessage,
        onMessageUpdate,
        onThinking,
        onProgress,
        onError,
        onConfirmationRequired,
        onNodeProgress,
        onOpenSequenceModal,
      })
    },
    retry: 1, // Retry once on failure
    retryDelay: 1000, // Wait 1 second before retry
  })
}

// 4. Convenience Hook (Legacy API compatibility)
interface UseChatbotOptions {
  onMessage: (message: ChatMessage) => void
  onThinking: (thinking: string) => void
  onError?: (error: string) => void
}

/**
 * @deprecated Use useChatbotMutation directly for better control
 * This hook is provided for backward compatibility
 */
export function useChatbot(options: UseChatbotOptions) {
  const mutation = useChatbotMutation(options)

  return {
    ask: mutation.mutate,
    askAsync: mutation.mutateAsync,
    isStreaming: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}

// Re-export types
export type { ChatbotAskRequest, ChatMessage } from "@/lib/api/types/chatbot"
export type { ChatConversation } from "../services/chatbot"

// ============================================
// Conversation Management Hooks
// ============================================

/**
 * Query hook to fetch all conversations for a user in a workspace
 */
export function useConversations(workspaceId: string, userId: string, enabled = true) {
  return useQuery({
    queryKey: chatbotKeys.conversations(workspaceId, userId),
    queryFn: () => chatbotApi.getConversations(workspaceId, userId),
    enabled: enabled && !!workspaceId && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Mutation hook to create a new conversation
 */
export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      title,
    }: {
      workspaceId: string
      userId: string
      title?: string
    }) => chatbotApi.createConversation(workspaceId, userId, title),
    onSuccess: (_data, variables) => {
      // Invalidate conversations list to refetch
      queryClient.invalidateQueries({
        queryKey: chatbotKeys.conversations(variables.workspaceId, variables.userId),
      })
    },
  })
}

/**
 * Mutation hook to update conversation title
 */
export function useUpdateConversationTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      chatbotApi.updateConversationTitle(id, title),
    onSuccess: () => {
      // Invalidate all conversations queries
      queryClient.invalidateQueries({
        queryKey: chatbotKeys.all,
      })
    },
  })
}

/**
 * Mutation hook to delete a conversation
 */
export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => chatbotApi.deleteConversation(id),
    onSuccess: () => {
      // Invalidate all conversations queries
      queryClient.invalidateQueries({
        queryKey: chatbotKeys.all,
      })
    },
  })
}

/**
 * Mutation hook to generate AI title for a conversation
 */
export function useGenerateConversationTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      firstMessage,
      locale,
    }: {
      id: string
      firstMessage: string
      locale?: string
    }) => chatbotApi.generateConversationTitle(id, firstMessage, locale),
    onSuccess: () => {
      // Invalidate all conversations queries to refetch with new title
      queryClient.invalidateQueries({
        queryKey: chatbotKeys.all,
      })
    },
  })
}
