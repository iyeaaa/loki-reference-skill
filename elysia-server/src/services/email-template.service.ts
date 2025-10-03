import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { emailTemplates } from "../db/schema/email-templates"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

// ====================================
// EMAIL TEMPLATE CRUD OPERATIONS
// ====================================

// GetEmailTemplate :one
export async function getEmailTemplate(id: string) {
  const result = await db
    .select({
      id: emailTemplates.id,
      workspaceId: emailTemplates.workspaceId,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      bodyText: emailTemplates.bodyText,
      bodyHtml: emailTemplates.bodyHtml,
      variables: emailTemplates.variables,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(emailTemplates)
    .innerJoin(workspaces, eq(emailTemplates.workspaceId, workspaces.id))
    .leftJoin(users, eq(emailTemplates.createdBy, users.id))
    .where(eq(emailTemplates.id, id))
    .limit(1)

  return result[0]
}

// CreateEmailTemplate :one
export async function createEmailTemplate(data: {
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
}) {
  const [newTemplate] = await db
    .insert(emailTemplates)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description || null,
      subject: data.subject,
      bodyText: data.bodyText || null,
      bodyHtml: data.bodyHtml || null,
      variables: data.variables || null,
      category: data.category || null,
      isShared: data.isShared || false,
      createdBy: data.createdBy || null,
    })
    .returning({
      id: emailTemplates.id,
      workspaceId: emailTemplates.workspaceId,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      bodyText: emailTemplates.bodyText,
      bodyHtml: emailTemplates.bodyHtml,
      variables: emailTemplates.variables,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
    })

  return newTemplate
}

// UpdateEmailTemplate :one
export async function updateEmailTemplate(
  id: string,
  data: {
    name: string
    description?: string
    subject: string
    bodyText?: string
    bodyHtml?: string
    variables?: Record<string, unknown>
    category?: string
    isShared: boolean
  },
) {
  const [updatedTemplate] = await db
    .update(emailTemplates)
    .set({
      name: data.name,
      description: data.description,
      subject: data.subject,
      bodyText: data.bodyText,
      bodyHtml: data.bodyHtml,
      variables: data.variables,
      category: data.category,
      isShared: data.isShared,
      updatedAt: new Date(),
    })
    .where(eq(emailTemplates.id, id))
    .returning({
      id: emailTemplates.id,
      workspaceId: emailTemplates.workspaceId,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      bodyText: emailTemplates.bodyText,
      bodyHtml: emailTemplates.bodyHtml,
      variables: emailTemplates.variables,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
    })

  return updatedTemplate
}

// DeleteEmailTemplate :exec
export async function deleteEmailTemplate(id: string) {
  await db.delete(emailTemplates).where(eq(emailTemplates.id, id))
}

// ====================================
// EMAIL TEMPLATE QUERY AND SEARCH OPERATIONS
// ====================================

// ListEmailTemplates :many
export async function listEmailTemplates(limit: number, offset: number) {
  const result = await db
    .select({
      id: emailTemplates.id,
      workspaceId: emailTemplates.workspaceId,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
    })
    .from(emailTemplates)
    .innerJoin(workspaces, eq(emailTemplates.workspaceId, workspaces.id))
    .leftJoin(users, eq(emailTemplates.createdBy, users.id))
    .orderBy(desc(emailTemplates.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListEmailTemplatesWithFilters :many
export async function listEmailTemplatesWithFilters(
  limit: number,
  offset: number,
  filters?: {
    isShared?: boolean
    search?: string
    category?: string
    workspaceIds?: string[]
    createdByIds?: string[]
  },
) {
  const conditions = []

  if (filters?.isShared !== undefined) {
    conditions.push(eq(emailTemplates.isShared, filters.isShared))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(emailTemplates.name, `%${filters.search}%`),
      ilike(emailTemplates.description, `%${filters.search}%`),
      ilike(emailTemplates.subject, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.category) {
    conditions.push(eq(emailTemplates.category, filters.category))
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(emailTemplates.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(
      ...filters.createdByIds.map((id) => eq(emailTemplates.createdBy, id)),
    )
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: emailTemplates.id,
      workspaceId: emailTemplates.workspaceId,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdBy: emailTemplates.createdBy,
      createdAt: emailTemplates.createdAt,
      updatedAt: emailTemplates.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
    })
    .from(emailTemplates)
    .innerJoin(workspaces, eq(emailTemplates.workspaceId, workspaces.id))
    .leftJoin(users, eq(emailTemplates.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(emailTemplates.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetEmailTemplatesByWorkspace :many
export async function getEmailTemplatesByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      description: emailTemplates.description,
      subject: emailTemplates.subject,
      category: emailTemplates.category,
      isShared: emailTemplates.isShared,
      createdAt: emailTemplates.createdAt,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.workspaceId, workspaceId))
    .orderBy(desc(emailTemplates.createdAt))

  return result
}

// GetEmailTemplatesByCategory :many
export async function getEmailTemplatesByCategory(workspaceId: string, category: string) {
  const result = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      description: emailTemplates.description,
      isShared: emailTemplates.isShared,
      createdAt: emailTemplates.createdAt,
    })
    .from(emailTemplates)
    .where(and(eq(emailTemplates.workspaceId, workspaceId), eq(emailTemplates.category, category)))
    .orderBy(emailTemplates.name)

  return result
}

// GetSharedEmailTemplates :many
export async function getSharedEmailTemplates(workspaceId: string) {
  const result = await db
    .select({
      id: emailTemplates.id,
      name: emailTemplates.name,
      subject: emailTemplates.subject,
      description: emailTemplates.description,
      category: emailTemplates.category,
      createdAt: emailTemplates.createdAt,
    })
    .from(emailTemplates)
    .where(and(eq(emailTemplates.workspaceId, workspaceId), eq(emailTemplates.isShared, true)))
    .orderBy(emailTemplates.name)

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountEmailTemplates :one
export async function countEmailTemplates() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(emailTemplates)

  return result[0]?.count ?? 0
}

// CountEmailTemplatesWithFilters :one
export async function countEmailTemplatesWithFilters(filters?: {
  isShared?: boolean
  search?: string
  category?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.isShared !== undefined) {
    conditions.push(eq(emailTemplates.isShared, filters.isShared))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(emailTemplates.name, `%${filters.search}%`),
      ilike(emailTemplates.description, `%${filters.search}%`),
      ilike(emailTemplates.subject, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.category) {
    conditions.push(eq(emailTemplates.category, filters.category))
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(emailTemplates.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(
      ...filters.createdByIds.map((id) => eq(emailTemplates.createdBy, id)),
    )
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailTemplates)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// GetTemplateCategories :many
export async function getTemplateCategories(workspaceId: string) {
  const result = await db
    .select({
      category: emailTemplates.category,
      count: sql<number>`count(*)::int`,
    })
    .from(emailTemplates)
    .where(eq(emailTemplates.workspaceId, workspaceId))
    .groupBy(emailTemplates.category)
    .orderBy(emailTemplates.category)

  return result
}

// ====================================
// BULK OPERATIONS
// ====================================

// BulkDelete :exec
export async function bulkDeleteEmailTemplates(templateIds: string[]) {
  const idCondition = or(...templateIds.map((id) => eq(emailTemplates.id, id)))
  if (!idCondition) {
    return 0
  }

  const result = await db
    .delete(emailTemplates)
    .where(idCondition)
    .returning({ id: emailTemplates.id })

  return result.length
}

// BulkUpdateCategory :exec
export async function bulkUpdateCategory(templateIds: string[], category: string) {
  const idCondition = or(...templateIds.map((id) => eq(emailTemplates.id, id)))
  if (!idCondition) {
    return 0
  }

  const result = await db
    .update(emailTemplates)
    .set({
      category,
      updatedAt: new Date(),
    })
    .where(idCondition)
    .returning({ id: emailTemplates.id })

  return result.length
}

// BulkUpdateShared :exec
export async function bulkUpdateShared(templateIds: string[], isShared: boolean) {
  const idCondition = or(...templateIds.map((id) => eq(emailTemplates.id, id)))
  if (!idCondition) {
    return 0
  }

  const result = await db
    .update(emailTemplates)
    .set({
      isShared,
      updatedAt: new Date(),
    })
    .where(idCondition)
    .returning({ id: emailTemplates.id })

  return result.length
}
