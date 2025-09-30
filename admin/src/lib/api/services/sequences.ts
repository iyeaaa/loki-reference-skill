import { apiFetch } from "@/lib/api/client"
import type {
  BulkEnrollRequest,
  BulkUpdateSequenceStatusRequest,
  CreateEnrollmentRequest,
  CreateSequenceRequest,
  CreateSequenceStepRequest,
  Sequence,
  SequenceEnrollment,
  SequenceStep,
  SequencesParams,
  UpdateSequenceRequest,
} from "../types/sequence"

export const sequencesApi = {
  list: (params?: SequencesParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) searchParams.append("search", params.search)
    if (params?.status && params.status !== "all") {
      searchParams.append("status", params.status)
    }
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","))
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: Sequence[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/sequences/search${query ? `?${query}` : ""}`).then((response) => ({
      sequences: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (sequenceId: string) => {
    return apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}`)
  },

  create: (data: CreateSequenceRequest) => {
    return apiFetch<Sequence>("/api/v1/sequences", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  update: (sequenceId: string, data: UpdateSequenceRequest) => {
    return apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  delete: (sequenceId: string) => {
    return apiFetch(`/api/v1/sequences/${sequenceId}`, {
      method: "DELETE",
    })
  },

  // Sequence steps
  getSteps: (sequenceId: string) => {
    return apiFetch<SequenceStep[]>(`/api/v1/sequences/${sequenceId}/steps`)
  },

  createStep: (sequenceId: string, data: CreateSequenceStepRequest) => {
    return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateStep: (sequenceId: string, stepId: string, data: CreateSequenceStepRequest) => {
    return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  deleteStep: (sequenceId: string, stepId: string) => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
      method: "DELETE",
    })
  },

  // Enrollments
  getEnrollments: (sequenceId: string, page = 1, limit = 10) => {
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    return apiFetch<{
      data: SequenceEnrollment[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/sequences/${sequenceId}/enrollments?${searchParams.toString()}`).then(
      (response) => ({
        enrollments: response.data,
        total: response.total,
        page,
        limit,
        totalPages: Math.ceil(response.total / limit),
      })
    )
  },

  createEnrollment: (sequenceId: string, data: CreateEnrollmentRequest) => {
    return apiFetch<SequenceEnrollment>(`/api/v1/sequences/${sequenceId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  updateEnrollmentStatus: (sequenceId: string, enrollmentId: string, status: string) => {
    return apiFetch<SequenceEnrollment>(
      `/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }
    )
  },

  // Bulk operations
  bulkUpdateStatus: (data: BulkUpdateSequenceStatusRequest) => {
    return apiFetch<{ updatedCount: number }>("/api/v1/admin/sequences/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },

  bulkDelete: (sequenceIds: string[]) => {
    return apiFetch<{ deletedCount: number }>("/api/v1/admin/sequences/bulk", {
      method: "DELETE",
      body: JSON.stringify({ sequenceIds }),
    })
  },

  bulkEnroll: (data: BulkEnrollRequest) => {
    return apiFetch<{ enrolledCount: number }>(
      `/api/v1/admin/sequences/${data.sequenceId}/enrollments/bulk`,
      {
        method: "POST",
        body: JSON.stringify({
          leadIds: data.leadIds,
          userEmailAccountId: data.userEmailAccountId,
          enrolledBy: data.enrolledBy,
        }),
      }
    )
  },

  bulkUnenroll: (enrollmentIds: string[]) => {
    return apiFetch<{ unenrolledCount: number }>(
      "/api/v1/admin/sequences/enrollments/bulk/unenroll",
      {
        method: "PUT",
        body: JSON.stringify({ enrollmentIds }),
      }
    )
  },

  bulkEnrollWithScheduling: (
    sequenceId: string,
    data: { leadIds: string[]; userEmailAccountId: string; enrolledBy?: string }
  ) => {
    return apiFetch<{
      enrolledCount: number
      totalSteps: number
      scheduledExecutions: number
    }>(`/api/v1/admin/sequences/${sequenceId}/enrollments/bulk-with-scheduling`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  getByWorkspace: (workspaceId: string) => {
    return apiFetch<Sequence[]>(`/api/v1/sequences/workspace/${workspaceId}`)
  },
}
