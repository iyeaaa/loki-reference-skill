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

    if (params?.search) {
      searchParams.append("search", params.search)
    }
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

  get: (sequenceId: string) => apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}`),

  create: (data: CreateSequenceRequest) =>
    apiFetch<Sequence>("/api/v1/sequences", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (sequenceId: string, data: UpdateSequenceRequest) =>
    apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (sequenceId: string) =>
    apiFetch(`/api/v1/sequences/${sequenceId}`, {
      method: "DELETE",
    }),

  copy: (
    sequenceId: string,
    data?: {
      name?: string
      customerGroupId?: string
      selectedLeadIds?: string[]
      createdBy?: string
    },
  ) =>
    apiFetch<Sequence>(`/api/v1/sequences/${sequenceId}/copy`, {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  // Sequence steps
  getSteps: (sequenceId: string) =>
    apiFetch<SequenceStep[]>(`/api/v1/sequences/${sequenceId}/steps`),

  createStep: (sequenceId: string, data: CreateSequenceStepRequest, files?: File[]) => {
    console.log("📎 API - createStep called with files:", files)
    console.log("📎 API - Files count:", files?.length || 0)
    console.log("📎 API - Data:", {
      ...data,
      emailBodyHtmlLength: data.emailBodyHtml?.length || 0,
      emailBodyHtmlPreview: data.emailBodyHtml?.substring(0, 200),
      hasEmailBodyHtml: !!data.emailBodyHtml,
    })

    // If files are provided, use FormData
    if (files && files.length > 0) {
      console.log("📎 API - Using FormData for file upload")
      const formData = new FormData()

      // Append all data fields
      formData.append("stepOrder", data.stepOrder.toString())
      formData.append("delayDays", data.delayDays.toString())
      // Ensure scheduledHour and scheduledMinute are not null (use defaults)
      formData.append("scheduledHour", (data.scheduledHour ?? 9).toString())
      formData.append("scheduledMinute", (data.scheduledMinute ?? 0).toString())
      if (data.timezone) {
        formData.append("timezone", data.timezone)
      }
      formData.append("emailSubject", data.emailSubject)
      if (data.emailBodyText) {
        formData.append("emailBodyText", data.emailBodyText)
      }
      if (data.emailBodyHtml) {
        formData.append("emailBodyHtml", data.emailBodyHtml)
        console.log("📎 API - emailBodyHtml appended to FormData:", {
          length: data.emailBodyHtml.length,
          preview: data.emailBodyHtml.substring(0, 200),
        })
      } else {
        console.warn("📎 API - emailBodyHtml is missing!")
      }
      if (data.emailTemplateId) {
        formData.append("emailTemplateId", data.emailTemplateId)
      }

      // Append files
      for (const file of files) {
        formData.append("files", file)
      }

      return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps`, {
        method: "POST",
        body: formData,
        headers: {}, // Let browser set Content-Type with boundary
      })
    }

    // No files, use JSON
    console.log("📎 API - Using JSON, emailBodyHtml:", {
      hasEmailBodyHtml: !!data.emailBodyHtml,
      emailBodyHtmlLength: data.emailBodyHtml?.length || 0,
      emailBodyHtmlPreview: data.emailBodyHtml?.substring(0, 200),
    })

    // Clean data to ensure no null values for scheduledHour/scheduledMinute
    // API doesn't accept null, only number or string
    const cleanedData = {
      ...data,
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
    }

    return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps`, {
      method: "POST",
      body: JSON.stringify(cleanedData),
    })
  },

  updateStep: (
    sequenceId: string,
    stepId: string,
    data: Partial<CreateSequenceStepRequest>,
    files?: File[],
  ) => {
    console.log("📎 API - updateStep FUNCTION CALLED!")
    console.log("📎 API - updateStep called:", {
      sequenceId,
      stepId,
      ...data,
      emailBodyHtmlLength: data.emailBodyHtml?.length || 0,
      emailBodyHtmlPreview: data.emailBodyHtml?.substring(0, 200),
      hasEmailBodyHtml: !!data.emailBodyHtml,
      filesCount: files?.length || 0,
    })

    // If files are provided, use FormData
    if (files && files.length > 0) {
      const formData = new FormData()

      // Append all data fields (only if defined for Partial type)
      if (data.stepOrder !== undefined) {
        formData.append("stepOrder", data.stepOrder.toString())
      }
      if (data.delayDays !== undefined) {
        formData.append("delayDays", data.delayDays.toString())
      }
      // Ensure scheduledHour and scheduledMinute are not null (use defaults)
      formData.append("scheduledHour", (data.scheduledHour ?? 9).toString())
      formData.append("scheduledMinute", (data.scheduledMinute ?? 0).toString())
      if (data.timezone) {
        formData.append("timezone", data.timezone)
      }
      if (data.emailSubject) {
        formData.append("emailSubject", data.emailSubject)
      }
      if (data.emailBodyText) {
        formData.append("emailBodyText", data.emailBodyText)
      }
      if (data.emailBodyHtml) {
        formData.append("emailBodyHtml", data.emailBodyHtml)
        console.log("📎 API - emailBodyHtml appended to FormData:", {
          length: data.emailBodyHtml.length,
          preview: data.emailBodyHtml.substring(0, 200),
        })
      } else {
        console.warn("📎 API - emailBodyHtml is missing!")
      }
      if (data.emailTemplateId) {
        formData.append("emailTemplateId", data.emailTemplateId)
      }

      // Append files
      for (const file of files) {
        formData.append("files", file)
      }

      return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
        method: "PUT",
        body: formData,
        headers: {}, // Let browser set Content-Type with boundary
      })
    }

    // No files, use JSON
    console.log("📎 API - Using JSON for updateStep, emailBodyHtml:", {
      hasEmailBodyHtml: !!data.emailBodyHtml,
      emailBodyHtmlLength: data.emailBodyHtml?.length || 0,
      emailBodyHtmlPreview: data.emailBodyHtml?.substring(0, 200),
    })

    // Clean data to ensure no null values for scheduledHour/scheduledMinute
    // API doesn't accept null, only number or string
    const cleanedData = {
      ...data,
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
    }

    return apiFetch<SequenceStep>(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
      method: "PUT",
      body: JSON.stringify(cleanedData),
    })
  },

  deleteStep: (sequenceId: string, stepId: string) =>
    apiFetch(`/api/v1/sequences/${sequenceId}/steps/${stepId}`, {
      method: "DELETE",
    }),

  // Enrollments
  getEnrollments: (
    sequenceId: string,
    page = 1,
    limit = 10,
    filters?: {
      companyName?: string
      opened?: boolean
      clicked?: boolean
      replied?: boolean
      delivered?: boolean
    },
  ) => {
    const offset = (page - 1) * limit
    const searchParams = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    // 필터 추가
    if (filters?.companyName) {
      searchParams.append("companyName", filters.companyName)
    }
    if (filters?.opened !== undefined) {
      searchParams.append("opened", filters.opened.toString())
    }
    if (filters?.clicked !== undefined) {
      searchParams.append("clicked", filters.clicked.toString())
    }
    if (filters?.replied !== undefined) {
      searchParams.append("replied", filters.replied.toString())
    }
    if (filters?.delivered !== undefined) {
      searchParams.append("delivered", filters.delivered.toString())
    }

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

  createEnrollment: (sequenceId: string, data: CreateEnrollmentRequest) =>
    apiFetch<SequenceEnrollment>(`/api/v1/sequences/${sequenceId}/enrollments`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEnrollmentStatus: (sequenceId: string, enrollmentId: string, status: string) =>
    apiFetch<SequenceEnrollment>(
      `/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}/status`,
      {
        method: "PATCH",
        body: JSON.stringify({ status }),
      },
    ),

  getEnrollmentStepExecutions: (sequenceId: string, enrollmentId: string) =>
    apiFetch<
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
    >(`/api/v1/sequences/${sequenceId}/enrollments/${enrollmentId}/step-executions`),

  // Bulk operations
  bulkUpdateStatus: (data: BulkUpdateSequenceStatusRequest) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/sequences/bulk/status", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  bulkDelete: (sequenceIds: string[]) =>
    apiFetch<{ deletedCount: number }>("/api/v1/admin/sequences/bulk", {
      method: "DELETE",
      body: JSON.stringify({ sequenceIds }),
    }),

  bulkEnroll: (data: BulkEnrollRequest) =>
    apiFetch<{ enrolledCount: number }>(
      `/api/v1/admin/sequences/${data.sequenceId}/enrollments/bulk`,
      {
        method: "POST",
        body: JSON.stringify({
          leadIds: data.leadIds,
          userEmailAccountId: data.userEmailAccountId,
          enrolledBy: data.enrolledBy,
        }),
      },
    ),

  bulkUnenroll: (enrollmentIds: string[]) =>
    apiFetch<{ unenrolledCount: number }>("/api/v1/admin/sequences/enrollments/bulk/unenroll", {
      method: "PUT",
      body: JSON.stringify({ enrollmentIds }),
    }),

  bulkEnrollWithScheduling: (
    sequenceId: string,
    data: { leadIds: string[]; userEmailAccountId: string; enrolledBy?: string },
  ) =>
    apiFetch<{
      enrolledCount: number
      totalSteps: number
      scheduledExecutions: number
    }>(`/api/v1/admin/sequences/${sequenceId}/enrollments/bulk-with-scheduling`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getByWorkspace: (workspaceId: string) =>
    apiFetch<Sequence[]>(`/api/v1/sequences/workspace/${workspaceId}`),

  // Activate step-based sequence
  activateStepBased: (sequenceId: string) =>
    apiFetch<{ success: boolean; message: string; stepsCount: number }>(
      `/api/v1/sequences/${sequenceId}/activate-step-based`,
      {
        method: "POST",
      },
    ),

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
        avgTimeToReply?: number // 분 단위
        minTimeToReply?: number // 분 단위
        maxTimeToReply?: number // 분 단위

        // 회신 상세 정보
        replySummaries?: Array<{
          originalEmailId: string
          replyTime: number
          aiSummary: string | null
          sentiment: string | null
          intent: string | null
        }>
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
        emailsFailed: number

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
          status:
            | "sent"
            | "delivered"
            | "opened"
            | "clicked"
            | "replied"
            | "bounced"
            | "failed"
            | "spam"
          openCount: number
          clickCount: number
          deliveredAt?: string
          openedAt?: string
          clickedAt?: string
          repliedAt?: string
          bounceType?: string | null
          bounceReason?: string | null
          errorMessage?: string | null
        }>
      }
    }>(`/api/v1/sequences/enrollments/${enrollmentId}/metrics`)
  },

  // Get overall sequence statistics
  getOverallStats: (workspaceId?: string) => {
    const searchParams = new URLSearchParams()
    if (workspaceId) {
      searchParams.append("workspaceId", workspaceId)
    }
    const query = searchParams.toString()
    return apiFetch<{
      data: {
        totalSequences: number
        activeSequences: number
        pausedSequences: number
        completedSequences: number
        archivedSequences: number
        readySequences: number
        totalSent: number
        totalDelivered: number
        totalOpened: number
        totalReplied: number
        openRate: number
        replyRate: number
      }
    }>(`/api/v1/sequences/stats/overall${query ? `?${query}` : ""}`)
  },

  // AI 이메일 템플릿 생성
  generateTemplate: (data: {
    workspaceId: string
    country: string
    prompt: string
    model?: string
    temperature?: number
  }) =>
    apiFetch<{
      emailSubject: string
      emailBodyText: string
      emailBodyHtml: string
      detectedLanguage?: string
    }>("/api/v1/sequences/generate-template", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generateAI: async (
    sequenceId: string,
    userEmailAccountId?: string,
  ): Promise<{
    success: boolean
    message: string
    data: {
      totalLeads: number
      totalDrafts: number
      stepsCreated: number
      enrollmentsCreated: number
    }
  }> => {
    // Build request body conditionally - only include userEmailAccountId if provided
    const requestBody: { userEmailAccountId?: string } = {}
    if (userEmailAccountId) {
      requestBody.userEmailAccountId = userEmailAccountId
    }

    return apiFetch(`/api/v1/sequences/${sequenceId}/generate`, {
      method: "POST",
      body: JSON.stringify(requestBody),
    })
  },
}
