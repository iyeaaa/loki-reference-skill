import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { workflowEmailsApi } from "../services/workflow-emails"
import type { GenerateAllEmailsRequest, UpdateGeneratedEmailRequest } from "../types/workflow-email"

// Query Keys
export const workflowEmailKeys = {
  all: ["workflowEmails"] as const,
  node: (sequenceId: string, nodeId: string) =>
    [...workflowEmailKeys.all, "node", sequenceId, nodeId] as const,
  detail: (sequenceId: string, nodeId: string, emailId: string) =>
    [...workflowEmailKeys.all, "detail", sequenceId, nodeId, emailId] as const,
}

// Queries
export function useGeneratedEmails(sequenceId: string, nodeId: string, enabled = true) {
  return useQuery({
    queryKey: workflowEmailKeys.node(sequenceId, nodeId),
    queryFn: () => workflowEmailsApi.getByNode(sequenceId, nodeId),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useGeneratedEmail(
  sequenceId: string,
  nodeId: string,
  emailId: string,
  enabled = true
) {
  return useQuery({
    queryKey: workflowEmailKeys.detail(sequenceId, nodeId, emailId),
    queryFn: () => workflowEmailsApi.get(sequenceId, nodeId, emailId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

// Mutations
export function useGenerateAllEmails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      nodeId,
      data,
    }: {
      sequenceId: string
      nodeId: string
      data: GenerateAllEmailsRequest
    }) => workflowEmailsApi.generateAll(sequenceId, nodeId, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowEmailKeys.node(variables.sequenceId, variables.nodeId),
      })
      toast.success(
        `${response.generated}/${response.total}개의 이메일이 생성되었습니다${
          response.failed > 0 ? ` (${response.failed}개 실패)` : ""
        }`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 생성에 실패했습니다")
    },
  })
}

export function useUpdateGeneratedEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      nodeId,
      emailId,
      data,
    }: {
      sequenceId: string
      nodeId: string
      emailId: string
      data: UpdateGeneratedEmailRequest
    }) => workflowEmailsApi.update(sequenceId, nodeId, emailId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowEmailKeys.node(variables.sequenceId, variables.nodeId),
      })
      queryClient.invalidateQueries({
        queryKey: workflowEmailKeys.detail(
          variables.sequenceId,
          variables.nodeId,
          variables.emailId
        ),
      })
      toast.success("이메일이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteGeneratedEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      nodeId,
      emailId,
    }: {
      sequenceId: string
      nodeId: string
      emailId: string
    }) => workflowEmailsApi.delete(sequenceId, nodeId, emailId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowEmailKeys.node(variables.sequenceId, variables.nodeId),
      })
      toast.success("이메일이 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 삭제에 실패했습니다")
    },
  })
}

export function useRegenerateEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      nodeId,
      emailId,
    }: {
      sequenceId: string
      nodeId: string
      emailId: string
    }) => workflowEmailsApi.regenerate(sequenceId, nodeId, emailId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowEmailKeys.node(variables.sequenceId, variables.nodeId),
      })
      toast.success("이메일 재생성이 요청되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "이메일 재생성에 실패했습니다")
    },
  })
}
