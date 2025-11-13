import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import toast from "react-hot-toast"
import { sequencesApi } from "../services/sequences"
import type {
  BulkEnrollRequest,
  BulkUpdateSequenceStatusRequest,
  CreateEnrollmentRequest,
  CreateSequenceRequest,
  CreateSequenceStepRequest,
  SequencesParams,
  UpdateSequenceRequest,
} from "../types/sequence"

// Query Keys
export const sequenceKeys = {
  all: ["sequences"] as const,
  lists: () => [...sequenceKeys.all, "list"] as const,
  list: (params?: SequencesParams) => [...sequenceKeys.lists(), params] as const,
  detail: (id: string) => [...sequenceKeys.all, "detail", id] as const,
  steps: (sequenceId: string) => [...sequenceKeys.all, "steps", sequenceId] as const,
  metrics: (sequenceId: string) => [...sequenceKeys.all, "metrics", sequenceId] as const,
  enrollmentMetrics: (enrollmentId: string) =>
    [...sequenceKeys.all, "enrollment-metrics", enrollmentId] as const,
  enrollments: (sequenceId: string) => [...sequenceKeys.all, "enrollments", sequenceId] as const,
  enrollmentsList: (
    sequenceId: string,
    page?: number,
    limit?: number,
    filters?: {
      companyName?: string
      opened?: boolean
      clicked?: boolean
      replied?: boolean
      delivered?: boolean
    },
  ) => [...sequenceKeys.enrollments(sequenceId), page, limit, filters] as const,
  workspace: (workspaceId: string) => [...sequenceKeys.all, "workspace", workspaceId] as const,
}

// Queries
export function useSequences(params?: SequencesParams) {
  return useQuery({
    queryKey: sequenceKeys.list(params),
    queryFn: () => sequencesApi.list(params),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useSequence(sequenceId: string, enabled = true) {
  return useQuery({
    queryKey: sequenceKeys.detail(sequenceId),
    queryFn: () => sequencesApi.get(sequenceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useSequenceSteps(sequenceId: string, enabled = true) {
  return useQuery({
    queryKey: sequenceKeys.steps(sequenceId),
    queryFn: () => sequencesApi.getSteps(sequenceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useSequenceEnrollments(
  sequenceId: string,
  page = 1,
  limit = 10,
  enabled = true,
  filters?: {
    companyName?: string
    opened?: boolean
    clicked?: boolean
    replied?: boolean
    delivered?: boolean
  },
) {
  return useQuery({
    queryKey: sequenceKeys.enrollmentsList(sequenceId, page, limit, filters),
    queryFn: () => sequencesApi.getEnrollments(sequenceId, page, limit, filters),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useSequencesByWorkspace(workspaceId: string, enabled = true) {
  return useQuery({
    queryKey: sequenceKeys.workspace(workspaceId),
    queryFn: () => sequencesApi.getByWorkspace(workspaceId),
    enabled,
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useEnrollmentStepExecutions(
  sequenceId: string,
  enrollmentId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: [...sequenceKeys.enrollments(sequenceId), "executions", enrollmentId],
    queryFn: () => sequencesApi.getEnrollmentStepExecutions(sequenceId, enrollmentId),
    enabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

// Mutations
export function useCreateSequence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateSequenceRequest) => sequencesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success("시퀀스가 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 생성에 실패했습니다")
    },
  })
}

export function useUpdateSequence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sequenceId, data }: { sequenceId: string; data: UpdateSequenceRequest }) =>
      sequencesApi.update(sequenceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(variables.sequenceId),
      })
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success("시퀀스 정보가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 업데이트에 실패했습니다")
    },
  })
}

export function useDeleteSequence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sequenceId: string) => sequencesApi.delete(sequenceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success("시퀀스가 삭제되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 삭제에 실패했습니다")
    },
  })
}

export function useCreateSequenceStep(sequenceId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (
      variables:
        | { data: CreateSequenceStepRequest & { sequenceId?: string }; files?: File[] }
        | (CreateSequenceStepRequest & { sequenceId?: string }),
    ) => {
      console.log("📎 Hook - mutationFn called with variables:", variables)
      console.log("📎 Hook - Has 'data' property:", "data" in variables)

      // Handle both old format (direct data) and new format (with files)
      const data = "data" in variables ? variables.data : variables
      const files = "data" in variables ? variables.files : undefined

      console.log("📎 Hook - Extracted data:", data)
      console.log("📎 Hook - Extracted files:", files)
      console.log("📎 Hook - Files count:", files?.length || 0)

      const id = data.sequenceId || sequenceId
      if (!id) throw new Error("sequenceId is required")
      return sequencesApi.createStep(id, data, files)
    },
    onSuccess: (_, variables) => {
      const data = "data" in variables ? variables.data : variables
      const id = data.sequenceId || sequenceId
      if (id) {
        queryClient.invalidateQueries({ queryKey: sequenceKeys.steps(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      }
      toast.success("시퀀스 스텝이 생성되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 스텝 생성에 실패했습니다")
    },
  })
}

export function useUpdateSequenceStep(sequenceId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (variables: {
      sequenceId?: string
      stepId: string
      data: CreateSequenceStepRequest
      files?: File[]
    }) => {
      const id = variables.sequenceId || sequenceId
      if (!id) throw new Error("sequenceId is required")
      return sequencesApi.updateStep(id, variables.stepId, variables.data, variables.files)
    },
    onSuccess: (_, variables) => {
      const id = variables.sequenceId || sequenceId
      if (id) {
        queryClient.invalidateQueries({ queryKey: sequenceKeys.steps(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      }
      toast.success("시퀀스 스텝이 업데이트되었습니다")
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "시퀀스 스텝 업데이트에 실패했습니다"

      // 발송된 스텝 수정 시도 시 더 명확한 메시지 표시
      if (errorMessage.includes("발송되었습니다") || errorMessage.includes("발송된")) {
        toast.error(errorMessage, {
          duration: 8000,
          style: {
            maxWidth: "500px",
            whiteSpace: "pre-line",
          },
        })
      } else {
        toast.error(errorMessage)
      }
    },
  })
}

export function useDeleteSequenceStep(sequenceId?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sequenceId: seqId, stepId }: { sequenceId?: string; stepId: string }) => {
      const id = seqId || sequenceId
      if (!id) throw new Error("sequenceId is required")
      return sequencesApi.deleteStep(id, stepId)
    },
    onSuccess: (_, variables) => {
      const id = variables.sequenceId || sequenceId
      if (id) {
        queryClient.invalidateQueries({ queryKey: sequenceKeys.steps(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.detail(id) })
        queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      }
      toast.success("시퀀스 스텝이 삭제되었습니다")
    },
    onError: (error: Error) => {
      const errorMessage = error.message || "시퀀스 스텝 삭제에 실패했습니다"

      // 발송된 스텝 삭제 시도 시 더 명확한 메시지 표시
      if (errorMessage.includes("발송되었습니다") || errorMessage.includes("발송된")) {
        toast.error(errorMessage, {
          duration: 8000,
          style: {
            maxWidth: "500px",
            whiteSpace: "pre-line",
          },
        })
      } else {
        toast.error(errorMessage)
      }
    },
  })
}

export function useCreateEnrollment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sequenceId, data }: { sequenceId: string; data: CreateEnrollmentRequest }) =>
      sequencesApi.createEnrollment(sequenceId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.enrollments(variables.sequenceId),
      })
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(variables.sequenceId),
      })
      toast.success("시퀀스에 등록되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 등록에 실패했습니다")
    },
  })
}

export function useUpdateEnrollmentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      enrollmentId,
      status,
    }: {
      sequenceId: string
      enrollmentId: string
      status: string
    }) => sequencesApi.updateEnrollmentStatus(sequenceId, enrollmentId, status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.enrollments(variables.sequenceId),
      })
      toast.success("등록 상태가 업데이트되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "등록 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkUpdateSequenceStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkUpdateSequenceStatusRequest) => sequencesApi.bulkUpdateStatus(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success(`${response.updatedCount || 0}개의 시퀀스 상태가 업데이트되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 상태 업데이트에 실패했습니다")
    },
  })
}

export function useBulkDeleteSequences() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sequenceIds: string[]) => sequencesApi.bulkDelete(sequenceIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success(`${response.deletedCount || 0}개의 시퀀스가 삭제되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 삭제에 실패했습니다")
    },
  })
}

export function useBulkEnroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: BulkEnrollRequest) => sequencesApi.bulkEnroll(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.enrollments(variables.sequenceId),
      })
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(variables.sequenceId),
      })
      toast.success(`${response.enrolledCount || 0}명이 시퀀스에 등록되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 등록에 실패했습니다")
    },
  })
}

export function useBulkUnenroll() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enrollmentIds: string[]) => sequencesApi.bulkUnenroll(enrollmentIds),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: sequenceKeys.all })
      toast.success(`${response.unenrolledCount || 0}명이 시퀀스에서 해제되었습니다`)
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 해제에 실패했습니다")
    },
  })
}

export function useBulkEnrollWithScheduling() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      sequenceId,
      data,
    }: {
      sequenceId: string
      data: {
        leadIds: string[]
        userEmailAccountId: string
        enrolledBy?: string
      }
    }) => sequencesApi.bulkEnrollWithScheduling(sequenceId, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.enrollments(variables.sequenceId),
      })
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(variables.sequenceId),
      })
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      toast.success(
        `${response.enrolledCount || 0}명이 시퀀스에 등록되고 ${
          response.scheduledExecutions || 0
        }개의 이메일이 스케줄되었습니다`,
      )
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 등록에 실패했습니다")
    },
  })
}

export function useActivateStepBasedSequence() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sequenceId: string) => sequencesApi.activateStepBased(sequenceId),
    onSuccess: (response, sequenceId) => {
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.detail(sequenceId),
      })
      queryClient.invalidateQueries({ queryKey: sequenceKeys.lists() })
      queryClient.invalidateQueries({
        queryKey: sequenceKeys.enrollments(sequenceId),
      })
      toast.success(response.message || "스텝 기반 시퀀스가 활성화되었습니다")
    },
    onError: (error: Error) => {
      toast.error(error.message || "시퀀스 활성화에 실패했습니다")
    },
  })
}

// Get sequence metrics
export function useSequenceMetrics(sequenceId: string) {
  return useQuery({
    queryKey: sequenceKeys.metrics(sequenceId),
    queryFn: () => sequencesApi.getMetrics(sequenceId),
    enabled: !!sequenceId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get enrollment metrics
export function useEnrollmentMetrics(enrollmentId: string) {
  return useQuery({
    queryKey: sequenceKeys.enrollmentMetrics(enrollmentId),
    queryFn: () => sequencesApi.getEnrollmentMetrics(enrollmentId),
    enabled: !!enrollmentId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

// Get overall sequence statistics
export function useSequencesOverallStats(workspaceId?: string) {
  return useQuery({
    queryKey: [...sequenceKeys.all, "overall-stats", workspaceId] as const,
    queryFn: () => sequencesApi.getOverallStats(workspaceId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  })
}
