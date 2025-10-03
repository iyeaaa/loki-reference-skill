import { and, between, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import type { NewActivityLog } from "../db/schema/activity-logs"
import { activityLogs } from "../db/schema/activity-logs"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

// ====================================
// ACTIVITY LOG CRUD OPERATIONS
// ====================================

// GetActivityLog :one
export async function getActivityLog(id: string) {
  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .where(eq(activityLogs.id, id))
    .limit(1)

  return result[0]
}

// CreateActivityLog :one
export async function createActivityLog(data: NewActivityLog) {
  const [newLog] = await db
    .insert(activityLogs)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId || null,
      entityType: data.entityType,
      entityId: data.entityId,
      action: data.action,
      details: data.details || null,
      ipAddress: data.ipAddress || null,
      userAgent: data.userAgent || null,
    })
    .returning({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
    })

  return newLog
}

// ====================================
// ACTIVITY LOG QUERY OPERATIONS
// ====================================

// ListActivityLogs :many
export async function listActivityLogs(limit: number, offset: number) {
  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListActivityLogsWithFilters :many
export async function listActivityLogsWithFilters(
  limit: number,
  offset: number,
  filters?: {
    entityType?: string
    action?: string
    search?: string
    workspaceIds?: string[]
    userIds?: string[]
    startDate?: Date
    endDate?: Date
  },
) {
  const conditions = []

  if (filters?.entityType) {
    conditions.push(eq(activityLogs.entityType, filters.entityType))
  }

  if (filters?.action) {
    conditions.push(eq(activityLogs.action, filters.action))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(activityLogs.entityType, `%${filters.search}%`),
      ilike(activityLogs.action, `%${filters.search}%`),
      ilike(activityLogs.entityId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(activityLogs.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(activityLogs.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.startDate && filters?.endDate) {
    conditions.push(between(activityLogs.createdAt, filters.startDate, filters.endDate))
  } else if (filters?.startDate) {
    conditions.push(sql`${activityLogs.createdAt} >= ${filters.startDate}`)
  } else if (filters?.endDate) {
    conditions.push(sql`${activityLogs.createdAt} <= ${filters.endDate}`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ====================================
// STATISTICS AND COUNTING
// ====================================

// CountActivityLogs :one
export async function countActivityLogs() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(activityLogs)

  return result[0]?.count ?? 0
}

// CountActivityLogsWithFilters :one
export async function countActivityLogsWithFilters(filters?: {
  entityType?: string
  action?: string
  search?: string
  workspaceIds?: string[]
  userIds?: string[]
  startDate?: Date
  endDate?: Date
}) {
  const conditions = []

  if (filters?.entityType) {
    conditions.push(eq(activityLogs.entityType, filters.entityType))
  }

  if (filters?.action) {
    conditions.push(eq(activityLogs.action, filters.action))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(activityLogs.entityType, `%${filters.search}%`),
      ilike(activityLogs.action, `%${filters.search}%`),
      ilike(activityLogs.entityId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(activityLogs.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(activityLogs.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.startDate && filters?.endDate) {
    conditions.push(between(activityLogs.createdAt, filters.startDate, filters.endDate))
  } else if (filters?.startDate) {
    conditions.push(sql`${activityLogs.createdAt} >= ${filters.startDate}`)
  } else if (filters?.endDate) {
    conditions.push(sql`${activityLogs.createdAt} <= ${filters.endDate}`)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activityLogs)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// SPECIAL QUERY OPERATIONS
// ====================================

// GetLogsByEntity :many - Get all logs for a specific entity
export async function getLogsByEntity(
  entityType: string,
  entityId: string,
  limit: number = 50,
  offset: number = 0,
) {
  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .where(and(eq(activityLogs.entityType, entityType), eq(activityLogs.entityId, entityId)))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetLogsByUser :many - Get all logs for a specific user
export async function getLogsByUser(userId: string, limit: number = 50, offset: number = 0) {
  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .where(eq(activityLogs.userId, userId))
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetRecentActivity :many - Get recent activity across all entities
export async function getRecentActivity(limit: number = 20, workspaceId?: string) {
  const conditions = workspaceId ? [eq(activityLogs.workspaceId, workspaceId)] : []
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: activityLogs.id,
      workspaceId: activityLogs.workspaceId,
      userId: activityLogs.userId,
      entityType: activityLogs.entityType,
      entityId: activityLogs.entityId,
      action: activityLogs.action,
      details: activityLogs.details,
      ipAddress: activityLogs.ipAddress,
      userAgent: activityLogs.userAgent,
      createdAt: activityLogs.createdAt,
      userName: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .leftJoin(workspaces, eq(activityLogs.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(activityLogs.createdAt))
    .limit(limit)

  return result
}

// ====================================
// UTILITY FUNCTIONS
// ====================================

// CreateLog - Helper function to create a log entry
export async function createLog(
  workspaceId: string,
  entityType: string,
  entityId: string,
  action: string,
  options?: {
    userId?: string | null
    details?: Record<string, unknown>
    ipAddress?: string | null
    userAgent?: string | null
  },
) {
  return createActivityLog({
    workspaceId,
    userId: options?.userId || null,
    entityType,
    entityId,
    action,
    details: options?.details || null,
    ipAddress: options?.ipAddress || null,
    userAgent: options?.userAgent || null,
  })
}
