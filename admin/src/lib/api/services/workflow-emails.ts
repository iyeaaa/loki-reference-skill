import { apiFetch } from "../client"
import type {
  GenerateAllEmailsRequest,
  GenerateAllEmailsResponse,
  UpdateGeneratedEmailRequest,
  WorkflowGeneratedEmail,
} from "../types/workflow-email"

export const workflowEmailsApi = {
  // Get all generated emails for a node
  getByNode: async (sequenceId: string, nodeId: string): Promise<WorkflowGeneratedEmail[]> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails`)
  },

  // Generate all emails
  generateAll: async (
    sequenceId: string,
    nodeId: string,
    data: GenerateAllEmailsRequest
  ): Promise<GenerateAllEmailsResponse> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generate-emails`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  // Get single email
  get: async (
    sequenceId: string,
    nodeId: string,
    emailId: string
  ): Promise<WorkflowGeneratedEmail> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails/${emailId}`)
  },

  // Update email
  update: async (
    sequenceId: string,
    nodeId: string,
    emailId: string,
    data: UpdateGeneratedEmailRequest
  ): Promise<WorkflowGeneratedEmail> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails/${emailId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },

  // Delete email
  delete: async (sequenceId: string, nodeId: string, emailId: string): Promise<void> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails/${emailId}`, {
      method: "DELETE",
    })
  },

  // Regenerate single email (AI)
  regenerate: async (
    sequenceId: string,
    nodeId: string,
    emailId: string
  ): Promise<{ message: string; email: WorkflowGeneratedEmail }> => {
    return apiFetch(
      `/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails/${emailId}/regenerate`,
      {
        method: "POST",
      }
    )
  },

  // Delete all emails for a node
  deleteAll: async (sequenceId: string, nodeId: string): Promise<void> => {
    return apiFetch(`/api/v1/sequences/${sequenceId}/nodes/${nodeId}/generated-emails`, {
      method: "DELETE",
    })
  },
}
