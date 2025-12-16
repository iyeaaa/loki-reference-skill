import { apiFetch } from "@/lib/api/client"
import type {
  BulkUpdateCategoryRequest,
  BulkUpdateSharedRequest,
  CreateEmailTemplateRequest,
  EmailTemplate,
  EmailTemplatesParams,
  UpdateEmailTemplateRequest,
} from "../types/email-template"

export const emailTemplatesApi = {
  list: (params?: EmailTemplatesParams) => {
    const searchParams = new URLSearchParams()

    const page = params?.page || 1
    const limit = params?.limit || 10
    const offset = (page - 1) * limit

    searchParams.append("limit", limit.toString())
    searchParams.append("offset", offset.toString())

    if (params?.search) {
      searchParams.append("search", params.search)
    }
    if (params?.isShared !== undefined && params.isShared !== "all") {
      searchParams.append("isShared", params.isShared.toString())
    }
    if (params?.category) {
      searchParams.append("category", params.category)
    }
    if (params?.workspaceIds && params.workspaceIds.length > 0) {
      searchParams.append("workspaceIds", params.workspaceIds.join(","))
    }
    if (params?.createdByIds && params.createdByIds.length > 0) {
      searchParams.append("createdByIds", params.createdByIds.join(","))
    }

    const query = searchParams.toString()
    return apiFetch<{
      data: EmailTemplate[]
      total: number
      limit: number
      offset: number
    }>(`/api/v1/email-templates/search${query ? `?${query}` : ""}`).then((response) => ({
      emailTemplates: response.data,
      total: response.total,
      page,
      limit,
      totalPages: Math.ceil(response.total / limit),
    }))
  },

  get: (templateId: string) => apiFetch<EmailTemplate>(`/api/v1/email-templates/${templateId}`),

  create: (data: CreateEmailTemplateRequest) =>
    apiFetch<EmailTemplate>("/api/v1/email-templates", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (templateId: string, data: UpdateEmailTemplateRequest) =>
    apiFetch<EmailTemplate>(`/api/v1/email-templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (templateId: string) =>
    apiFetch(`/api/v1/email-templates/${templateId}`, {
      method: "DELETE",
    }),

  bulkUpdateCategory: (data: BulkUpdateCategoryRequest) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/email-templates/bulk/category", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  bulkUpdateShared: (data: BulkUpdateSharedRequest) =>
    apiFetch<{ updatedCount: number }>("/api/v1/admin/email-templates/bulk/shared", {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  bulkDelete: (templateIds: string[]) =>
    apiFetch<{ deletedCount: number }>("/api/v1/admin/email-templates/bulk", {
      method: "DELETE",
      body: JSON.stringify({ templateIds }),
    }),

  getByWorkspace: (workspaceId: string) =>
    apiFetch<EmailTemplate[]>(`/api/v1/email-templates/workspace/${workspaceId}`),

  getCategories: (workspaceId: string) =>
    apiFetch<string[]>(`/api/v1/email-templates/workspace/${workspaceId}/categories`),

  getShared: (workspaceId: string) =>
    apiFetch<EmailTemplate[]>(`/api/v1/email-templates/workspace/${workspaceId}/shared`),
}
