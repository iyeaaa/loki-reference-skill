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

  copy: (
    sequenceId: string,
    data?: {
      name?: string
      customerGroupId?: string
      selectedLeadIds?: string[]
      createdBy?: string
    },
  ) => {
    return apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}/copy`, {
      method: "POST",
      body: JSON.stringify(data || {}),
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
      }),
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
      },
    )
  },

  getEnrollmentStepExecutions: (sequenceId: string, enrollmentId: string) => {
    return apiFetch<
      {
        id: string
        stepId: string
        stepOrder: number
        status: string
        scheduledAt: string
        executedAt: string | null
        emailId: string | null
        errorMessage: string | null
        emailSubject: string
      }[]
    >(`/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}/step-executions`)
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
      },
    )
  },

  bulkUnenroll: (enrollmentIds: string[]) => {
    return apiFetch<{ unenrolledCount: number }>(
      "/api/v1/admin/sequences/enrollments/bulk/unenroll",
      {
        method: "PUT",
        body: JSON.stringify({ enrollmentIds }),
      },
    )
  },

  bulkEnrollWithScheduling: (
    sequenceId: string,
    data: { leadIds: string[]; userEmailAccountId: string; enrolledBy?: string },
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

  // Activate step-based sequence
  activateStepBased: (sequenceId: string) => {
    return apiFetch<{ success: boolean; message: string; stepsCount: number }>(
      `/api/v1/sequences/${sequenceId}/activate-step-based`,
      {
        method: "POST",
      },
    )
  },

  // Get sequence metrics
  getMetrics: (sequenceId: string) => {
    return apiFetch<{
      data: {
        // 발송 통계
        totalSent: number
        delivered: number
        bounced: number
        dropped: number

        // 참여 통계
        opened: number
        clicked: number
        replied: number
        unsubscribed: number

        // 성과 지표
        openRate: number
        clickRate: number
        replyRate: number
        bounceRate: number

        // 시퀀스 진행도
        totalEnrollments: number
        activeEnrollments: number
        completedEnrollments: number
        pausedEnrollments: number

        // 시간별 통계
        lastSentAt?: string
      }
    }>(`/api/v1/sequences/${sequenceId}/metrics`)
  },

  // Get enrollment metrics
  getEnrollmentMetrics: (enrollmentId: string) => {
    return apiFetch<{
      data: {
        companyName: string
        emailAddress: string
        enrollmentId: string
        status: string
        enrolledAt: string
        currentStep: number
        totalSteps: number

        // 이메일 발송 통계
        emailsSent: number
        emailsDelivered: number
        emailsOpened: number
        emailsClicked: number
        emailsReplied: number
        emailsBounced: number

        // 성과 지표
        openRate: number
        clickRate: number
        replyRate: number
        bounceRate: number

        // 시간 통계
        firstEmailSentAt?: string
        lastEmailSentAt?: string

        // 상세 이메일 이력
        emailHistory: Array<{
          stepOrder: number
          subject: string
          sentAt: string
          status: "sent" | "delivered" | "opened" | "clicked" | "replied" | "bounced"
          openCount: number
          clickCount: number
          replyAt?: string
        }>
      }
    }>(`/api/v1/sequences/enrollments/${enrollmentId}/metrics`)
  },

  // AI 이메일 템플릿 생성
  generateTemplate: (data: {
    workspaceId: string
    country: string
    prompt: string
    model?: string
    temperature?: number
  }) => {
    return apiFetch<{
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
      detectedLanguage?: string
    }>("/api/v1/sequences/generate-template", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
}
