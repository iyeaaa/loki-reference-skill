// Email Template Management API Types (aligned with backend database schema)

export interface EmailTemplate {
  id: string
  workspaceId: string
  name: string
  description?: string | null
  subject: string
  bodyText?: string | null
  bodyHtml?: string | null
  variables?: Record<string, unknown> | null // JSON field for template variables
  category?: string | null
  isShared: boolean
  createdBy?: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateEmailTemplateRequest {
  workspaceId: string
  name: string
  description?: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  variables?: Record<string, unknown>
  category?: string
  isShared?: boolean
  createdBy?: string
}

export interface UpdateEmailTemplateRequest {
  name: string
  description?: string | null
  subject: string
  bodyText?: string | null
  bodyHtml?: string | null
  variables?: Record<string, unknown> | null
  category?: string | null
  isShared: boolean
}

export interface EmailTemplatesResponse {
  data: EmailTemplate[]
  total: number
  limit: number
  offset: number
}

export interface EmailTemplatesParams {
  page?: number
  limit?: number
  isShared?: boolean | "all"
  search?: string
  category?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export interface BulkUpdateCategoryRequest {
  templateIds: string[]
  category: string
}

export interface BulkUpdateSharedRequest {
  templateIds: string[]
  isShared: boolean
}
