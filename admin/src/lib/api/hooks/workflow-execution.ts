import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { workflowExecutionApi } from "../services/workflow-execution"

// Query Keys
export const workflowExecutionKeys = {
  all: ["workflowExecution"] as const,
  nodeStats: (sequenceId: string, nodeId: string) =>
    [...workflowExecutionKeys.all, "nodeStats", sequenceId, nodeId] as const,
  enrollments: (sequenceId: string) =>
    [...workflowExecutionKeys.all, "enrollments", sequenceId] as const,
}

// Queries
export function useNodeStatistics(sequenceId: string, nodeId: string, enabled = true) {
  return useQuery({
    queryKey: workflowExecutionKeys.nodeStats(sequenceId, nodeId),
    queryFn: () => workflowExecutionApi.getNodeStats(sequenceId, nodeId),
    enabled: enabled && !!sequenceId && !!nodeId,
    staleTime: 10 * 1000, // 10초
    gcTime: 30 * 1000, // 30초
    refetchInterval: 30 * 1000, // 30초마다 자동 갱신
  })
}

export function useWorkflowEnrollments(sequenceId: string, enabled = true) {
  return useQuery({
    queryKey: workflowExecutionKeys.enrollments(sequenceId),
    queryFn: () => workflowExecutionApi.getEnrollments(sequenceId),
    enabled: enabled && !!sequenceId,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Mutations
export function useBulkEnrollWorkflow() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: {
      sequenceId: string
      customerGroupId: string
      userEmailAccountId: string
      enrolledBy?: string
    }) => workflowExecutionApi.bulkEnroll(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: workflowExecutionKeys.enrollments(variables.sequenceId),
      })
      toast.success(response.message || `${response.enrolledCount}명이 등록되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "워크플로우 등록에 실패했습니다")
    },
  })
}
