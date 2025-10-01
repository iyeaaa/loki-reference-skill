import { apiFetch } from "../client"

export interface NodeStatistics {
  nodeId: string
  sentCount: number
  repliedCount: number
  waitingCount: number
}

export interface WorkflowEnrollment {
  id: string
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  status: string
  currentNodeId: string | null
  enrolledAt: string
  firstEmailSentAt: string | null
  lastEmailSentAt: string | null
  completedAt: string | null
  stoppedReason: string | null
  leadCompanyName: string | null
}

export const workflowExecutionApi = {
  // Get node statistics
  getNodeStats: async (sequenceId: string, nodeId: string): Promise<NodeStatistics> => {
    return await apiFetch<NodeStatistics>(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/stats`)
  },

  // Get workflow enrollments
  getEnrollments: async (
    sequenceId: string,
    limit = 50,
    offset = 0
  ): Promise<WorkflowEnrollment[]> => {
    return await apiFetch<WorkflowEnrollment[]>(
      `/api/v1/sequences/${sequenceId}/workflow-enrollments?limit=${limit}&offset=${offset}`
    )
  },

  // Bulk enroll from customer group
  bulkEnroll: async (data: {
    sequenceId: string
    customerGroupId: string
    userEmailAccountId: string
    enrolledBy?: string
  }): Promise<{
    message: string
    enrolledCount: number
    enrollments: WorkflowEnrollment[]
  }> => {
    const { sequenceId, ...body } = data
    return await apiFetch<{
      message: string
      enrolledCount: number
      enrollments: WorkflowEnrollment[]
    }>(`/api/v1/sequences/${sequenceId}/workflow-enrollments/bulk`, {
      method: "POST",
      body: JSON.stringify(body),
    })
  },
}
