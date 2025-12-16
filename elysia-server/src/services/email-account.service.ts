import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

// ====================================
// EMAIL ACCOUNT CRUD OPERATIONS
// ====================================

// GetEmailAccount :one
export async function getEmailAccount(id: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      apiKey: userEmailAccounts.apiKey,
      sendgridVerifiedSenderId: userEmailAccounts.sendgridVerifiedSenderId,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      lastResetDaily: userEmailAccounts.lastResetDaily,
      lastResetMonthly: userEmailAccounts.lastResetMonthly,
      status: userEmailAccounts.status,
      lastError: userEmailAccounts.lastError,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .where(eq(userEmailAccounts.id, id))
    .limit(1)

  return result[0]
}

// CreateEmailAccount :one
export async function createEmailAccount(data: {
  userId: string
  workspaceId: string
  emailAddress: string
  displayName?: string
  apiKey: string
  sendgridVerifiedSenderId?: string
  isVerified?: boolean
  isDefault?: boolean
  dailyLimit?: number
  monthlyLimit?: number
  status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
}) {
  const [newAccount] = await db
    .insert(userEmailAccounts)
    .values({
      userId: data.userId,
      workspaceId: data.workspaceId,
      emailAddress: data.emailAddress,
      displayName: data.displayName || null,
      apiKey: data.apiKey,
      sendgridVerifiedSenderId: data.sendgridVerifiedSenderId || null,
      isVerified: data.isVerified || false,
      isDefault: data.isDefault || false,
      dailyLimit: data.dailyLimit || null,
      monthlyLimit: data.monthlyLimit || null,
      status: data.status || "inactive",
    })
    .returning({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
    })

  return newAccount
}

// UpdateEmailAccount :one
export async function updateEmailAccount(
  id: string,
  data: {
    emailAddress: string
    displayName?: string
    apiKey: string
    sendgridVerifiedSenderId?: string
    isVerified: boolean
    isDefault: boolean
    dailyLimit?: number
    monthlyLimit?: number
    status: "active" | "inactive" | "error" | "rate_limited" | "suspended"
  },
) {
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      emailAddress: data.emailAddress,
      displayName: data.displayName,
      apiKey: data.apiKey,
      sendgridVerifiedSenderId: data.sendgridVerifiedSenderId,
      isVerified: data.isVerified,
      isDefault: data.isDefault,
      dailyLimit: data.dailyLimit,
      monthlyLimit: data.monthlyLimit,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
    })

  return updatedAccount
}

// DeleteEmailAccount :exec
export async function deleteEmailAccount(id: string) {
  await db.delete(userEmailAccounts).where(eq(userEmailAccounts.id, id))
}

// ====================================
// EMAIL ACCOUNT QUERY AND SEARCH OPERATIONS
// ====================================

// ListEmailAccounts :many
export async function listEmailAccounts(limit: number, offset: number) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      status: userEmailAccounts.status,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .orderBy(desc(userEmailAccounts.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListEmailAccountsWithFilters :many
export async function listEmailAccountsWithFilters(
  limit: number,
  offset: number,
  filters?: {
    status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
    isVerified?: boolean
    isDefault?: boolean
    search?: string
    userIds?: string[]
    workspaceIds?: string[]
  },
) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(userEmailAccounts.status, filters.status))
  }

  if (filters?.isVerified !== undefined) {
    conditions.push(eq(userEmailAccounts.isVerified, filters.isVerified))
  }

  if (filters?.isDefault !== undefined) {
    conditions.push(eq(userEmailAccounts.isDefault, filters.isDefault))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(userEmailAccounts.emailAddress, `%${filters.search}%`),
      ilike(userEmailAccounts.displayName, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(userEmailAccounts.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(userEmailAccounts.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      status: userEmailAccounts.status,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(userEmailAccounts.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetEmailAccountsByUser :many
export async function getEmailAccountsByUser(userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.userId, userId))
    .orderBy(desc(userEmailAccounts.isDefault), desc(userEmailAccounts.createdAt))

  return result
}

// GetEmailAccountsByWorkspace :many
export async function getEmailAccountsByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      username: users.username,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .where(eq(userEmailAccounts.workspaceId, workspaceId))
    .orderBy(desc(userEmailAccounts.createdAt))

  return result
}

// GetActiveEmailAccounts :many
export async function getActiveEmailAccounts(workspaceId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
    })
    .from(userEmailAccounts)
    .where(
      and(eq(userEmailAccounts.workspaceId, workspaceId), eq(userEmailAccounts.status, "active")),
    )
    .orderBy(userEmailAccounts.emailAddress)

  return result
}

// GetEmailAccountByWorkspaceAndUser :one
export async function getEmailAccountByWorkspaceAndUser(workspaceId: string, userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .where(
      and(
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.userId, userId),
        eq(userEmailAccounts.status, "active"),
      ),
    )
    .limit(1)

  return result[0]
}

// GetEmailAccountByWorkspaceAndUserAny :one (includes inactive/trial accounts)
// Use this when you need to find accounts regardless of status (e.g., TRIAL_PREVIEW accounts)
export async function getEmailAccountByWorkspaceAndUserAny(workspaceId: string, userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      apiKey: userEmailAccounts.apiKey, // Need this to check TRIAL_PREVIEW
      status: userEmailAccounts.status,
    })
    .from(userEmailAccounts)
    .where(
      and(eq(userEmailAccounts.workspaceId, workspaceId), eq(userEmailAccounts.userId, userId)),
    )
    .limit(1)

  return result[0]
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountEmailAccounts :one
export async function countEmailAccounts() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(userEmailAccounts)

  return result[0]?.count ?? 0
}

// CountEmailAccountsWithFilters :one
export async function countEmailAccountsWithFilters(filters?: {
  status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
  isVerified?: boolean
  isDefault?: boolean
  search?: string
  userIds?: string[]
  workspaceIds?: string[]
}) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(userEmailAccounts.status, filters.status))
  }

  if (filters?.isVerified !== undefined) {
    conditions.push(eq(userEmailAccounts.isVerified, filters.isVerified))
  }

  if (filters?.isDefault !== undefined) {
    conditions.push(eq(userEmailAccounts.isDefault, filters.isDefault))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(userEmailAccounts.emailAddress, `%${filters.search}%`),
      ilike(userEmailAccounts.displayName, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(userEmailAccounts.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(userEmailAccounts.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userEmailAccounts)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(
  accountIds: string[],
  status: "active" | "inactive" | "error" | "rate_limited" | "suspended",
) {
  const idCondition = or(...accountIds.map((id) => eq(userEmailAccounts.id, id)))
  if (!idCondition) {
    return 0
  }

  const result = await db
    .update(userEmailAccounts)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(idCondition)
    .returning({ id: userEmailAccounts.id })

  return result.length
}

// UpdateSentCount :one
export async function updateSentCount(id: string) {
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      dailySentCount: sql`${userEmailAccounts.dailySentCount} + 1`,
      monthlySentCount: sql`${userEmailAccounts.monthlySentCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
    })

  return updatedAccount
}

// ResetDailySentCount :exec
export async function resetDailySentCount(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      dailySentCount: 0,
      lastResetDaily: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// ResetMonthlySentCount :exec
export async function resetMonthlySentCount(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      monthlySentCount: 0,
      lastResetMonthly: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// UpdateLastError :exec
export async function updateLastError(id: string, errorMessage: string) {
  await db
    .update(userEmailAccounts)
    .set({
      lastError: errorMessage,
      status: "error",
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// UpdateLastSync :exec
export async function updateLastSync(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// SetAsDefault :one
export async function setAsDefault(id: string, userId: string, workspaceId: string) {
  // First, unset all other defaults for this user in this workspace
  await db
    .update(userEmailAccounts)
    .set({ isDefault: false })
    .where(
      and(eq(userEmailAccounts.userId, userId), eq(userEmailAccounts.workspaceId, workspaceId)),
    )

  // Then set the specified account as default
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      isDefault: userEmailAccounts.isDefault,
    })

  return updatedAccount
}
