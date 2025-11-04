import { useMutation, useQuery } from "@tanstack/react-query"
import type { ChatbotAskRequest, ChatMessage } from "@/lib/api/types/chatbot"
import { chatbotApi } from "../services/chatbot"

// 1. Query Keys
export const chatbotKeys = {
  all: ["chatbot"] as const,
  history: (conversationId: string) => [...chatbotKeys.all, "history", conversationId] as const,
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
  onError?: (error: string) => void
  onConfirmationRequired?: (message: string) => void
}

/**
 * TanStack Query mutation for chatbot streaming
 * Handles lifecycle management while preserving streaming functionality
 */
export function useChatbotMutation(options: UseChatbotMutationOptions) {
  const { onMessage, onMessageUpdate, onThinking, onError, onConfirmationRequired } = options

  return useMutation({
    mutationKey: ["chatbot", "ask"],
    mutationFn: async (request: ChatbotAskRequest) => {
      await chatbotApi.streamAsk(request, {
        onMessage,
        onMessageUpdate,
        onThinking,
        onError,
        onConfirmationRequired,
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
