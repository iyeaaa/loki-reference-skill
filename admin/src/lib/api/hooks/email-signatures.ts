import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { emailSignaturesApi } from "../services/email-signatures"
import type {
  CreateEmailSignatureRequest,
  EmailSignaturesParams,
  GetDefaultSignatureParams,
  UpdateEmailSignatureRequest,
} from "../types/email-signature"

// Query Keys
export const emailSignatureKeys = {
  all: ["emailSignatures"] as const,
  lists: () => [...emailSignatureKeys.all, "list"] as const,
  list: (params?: EmailSignaturesParams) => [...emailSignatureKeys.lists(), params] as const,
  detail: (id: string, workspaceId: string, userId: string) =>
    [...emailSignatureKeys.all, "detail", id, workspaceId, userId] as const,
  default: (params: GetDefaultSignatureParams) =>
    [...emailSignatureKeys.all, "default", params] as const,
}

// Queries
export function useEmailSignatures(params: EmailSignaturesParams, enabled = true) {
  return useQuery({
    queryKey: emailSignatureKeys.list(params),
    queryFn: () => emailSignaturesApi.list(params),
    enabled: enabled && !!params.workspaceId && !!params.userId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useEmailSignature(
  id: string,
  params: { workspaceId: string; userId: string },
  enabled = true,
) {
  return useQuery({
    queryKey: emailSignatureKeys.detail(id, params.workspaceId, params.userId),
    queryFn: () => emailSignaturesApi.get(id, params),
    enabled: enabled && !!id && !!params.workspaceId && !!params.userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useDefaultEmailSignature(params: GetDefaultSignatureParams, enabled = true) {
  return useQuery({
    queryKey: emailSignatureKeys.default(params),
    queryFn: () => emailSignaturesApi.getDefault(params),
    enabled: enabled && !!params.workspaceId && !!params.userId,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
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
      params: { workspaceId: string; userId: string }
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
    mutationFn: ({
      id,
      body,
      params,
    }: {
      id: string
      body: UpdateEmailSignatureRequest
      params: { workspaceId: string; userId: string }
    }) => emailSignaturesApi.update(id, body, params),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: emailSignatureKeys.detail(
          variables.id,
          variables.params.workspaceId,
          variables.params.userId,
        ),
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
    mutationFn: ({
      id,
      params,
    }: {
      id: string
      params: { workspaceId: string; userId: string; hardDelete?: boolean }
    }) => emailSignaturesApi.delete(id, params),
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
    mutationFn: ({ id, params }: { id: string; params: { workspaceId: string; userId: string } }) =>
      emailSignaturesApi.setAsDefault(id, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.lists() })
      queryClient.invalidateQueries({ queryKey: emailSignatureKeys.all })
      toast.success("기본 서명으로 설정되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "기본 서명 설정에 실패했습니다")
    },
  })
}
