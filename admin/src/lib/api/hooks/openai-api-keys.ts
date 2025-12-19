import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { openAIApiKeysApi } from "../services/openai-api-keys"
import type { CreateApiKeyRequest, UpdateApiKeyRequest } from "../types/openai-api-keys"

// Query Keys
export const openAIApiKeyKeys = {
  all: ["openai-api-keys"] as const,
  lists: () => [...openAIApiKeyKeys.all, "list"] as const,
  list: (workspaceId: string) => [...openAIApiKeyKeys.lists(), workspaceId] as const,
}

// Queries
export function useOpenAIApiKeys(workspaceId: string) {
  return useQuery({
    queryKey: openAIApiKeyKeys.list(workspaceId),
    queryFn: () => openAIApiKeysApi.list(workspaceId),
    enabled: !!workspaceId && workspaceId !== "all",
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Mutations
export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => openAIApiKeysApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: openAIApiKeyKeys.list(variables.workspaceId),
      })
      toast.success("API 키가 추가되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "API 키 추가에 실패했습니다")
    },
  })
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateApiKeyRequest }) =>
      openAIApiKeysApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: openAIApiKeyKeys.list(variables.data.workspaceId),
      })
      toast.success("API 키가 수정되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "API 키 수정에 실패했습니다")
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, workspaceId }: { id: string; workspaceId: string }) =>
      openAIApiKeysApi.delete(id, workspaceId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: openAIApiKeyKeys.list(variables.workspaceId),
      })
      toast.success("API 키가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "API 키 삭제에 실패했습니다")
    },
  })
}
