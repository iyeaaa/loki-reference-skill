// Email Template Management API Types (aligned with backend database schema)

export type EmailTemplate = {
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

export type CreateEmailTemplateRequest = {
  workspaceId: string
  name: string
  description?: string | null
  subject: string
  bodyText?: string | null
  bodyHtml?: string | null
  variables?: Record<string, unknown> | null
  category?: string | null
  isShared?: boolean
  createdBy?: string
}

export type UpdateEmailTemplateRequest = {
  name: string
  description?: string | null
  subject: string
  bodyText?: string | null
  bodyHtml?: string | null
  variables?: Record<string, unknown> | null
  category?: string | null
  isShared: boolean
}

export type EmailTemplatesResponse = {
  data: EmailTemplate[]
  total: number
  limit: number
  offset: number
}

export type EmailTemplatesParams = {
  page?: number
  limit?: number
  isShared?: boolean | "all"
  search?: string
  category?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}

export type BulkUpdateCategoryRequest = {
  templateIds: string[]
  category: string
}

export type BulkUpdateSharedRequest = {
  templateIds: string[]
  isShared: boolean
}
