import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailSignaturesApi } from "../services/email-signatures"
import type {
  CreateEmailSignatureRequest,
  UpdateEmailSignatureRequest,
} from "../types/email-signature"

// Query Keys
export const emailSignatureKeys = {
  all: ["emailSignatures"] as const,
  lists: () => [...emailSignatureKeys.all, "list"] as const,
  list: (params?: { includeInactive?: boolean }) =>
    [...emailSignatureKeys.lists(), params] as const,
  detail: (id: string) => [...emailSignatureKeys.all, "detail", id] as const,
  default: () => [...emailSignatureKeys.all, "default"] as const,
}

// Queries
export function useEmailSignatures(
  params?: { includeInactive?: boolean; userId?: string },
  enabled = true,
) {
  return useQuery({
    queryKey: emailSignatureKeys.list(params),
    queryFn: () => emailSignaturesApi.list(params),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmailSignature(id: string, enabled = true) {
  return useQuery({
    queryKey: emailSignatureKeys.detail(id),
    queryFn: () => emailSignaturesApi.get(id),
    enabled: enabled && !!id,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useDefaultEmailSignature(enabled = true) {
  return useQuery({
    queryKey: emailSignatureKeys.default(),
    queryFn: async () => {
      try {
        return await emailSignaturesApi.getDefault()
      } catch (error) {
        // 404, 401 에러는 기본 서명이 없는 것으로 처리
        if (
          error &&
          typeof error === "object" &&
          "status" in error &&
          (error.status === 404 || error.status === 401)
        ) {
          return null
        }
        throw error
      }
    },
    enabled: typeof enabled === "boolean" ? enabled : true,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: false, // 404, 401 에러는 재시도하지 않음
  })
}

// Mutations
export function useCreateEmailSignature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      body,
      params,
    }: {
      body: CreateEmailSignatureRequest
      params?: { workspaceId?: string; userId?: string }
    }) => emailSignaturesApi.create(body, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      toast.success("서명이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "서명 생성에 실패했습니다")
    },
  })
}

export function useUpdateEmailSignature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateEmailSignatureRequest }) =>
      emailSignaturesApi.update(id, body),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: emailSignatureKeys.detail(variables.id),
      })
      toast.success("서명이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "서명 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteEmailSignature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params?: { hardDelete?: boolean } }) =>
      emailSignaturesApi.delete(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      toast.success("서명이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "서명 삭제에 실패했습니다")
    },
  })
}

export function useSetDefaultEmailSignature() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      emailSignaturesApi.setDefault(id, userId),
    onSuccess: () => {
      // 모든 관련 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.default() })
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.all })
      toast.success("기본 서명으로 설정되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "기본 서명 설정에 실패했습니다")
    },
  })
}
