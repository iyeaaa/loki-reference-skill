import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { departments, users } from "../db/schema/users"
import * as workspaceService from "./workspace.service"

// ====================================
// USER CRUD OPERATIONS
// ====================================

// GetUser :one
export async function getUser(id: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      passwordHash: users.passwordHash,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, id))
    .limit(1)

  return result[0]
}

// CreateUser :one
export async function createUser(data: {
  username: string
  email: string
  passwordHash?: string
  userRole?: "super_admin" | "admin" | "paying_user" | "user"
  isActive?: boolean
  departmentId?: string
  employeeId?: string
}) {
  // Calculate trial period (7 days from now)
  const trialStartDate = new Date()
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 7)

  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash || null,
      userRole: data.userRole || "user",
      isActive: data.isActive !== undefined ? data.isActive : true,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
      trialStartDate,
      trialEndDate,
      isTrialActive: true,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })

  return newUser
}

// UpdateUser :one
export async function updateUser(
  id: string,
  data: {
    username: string
    email: string
    userRole: "super_admin" | "admin" | "paying_user" | "user"
    isActive: boolean
    departmentId: string | null
    employeeId: string | null
  },
) {
  const [updatedUser] = await db
    .update(users)
    .set({
      username: data.username,
      email: data.email,
      userRole: data.userRole,
      isActive: data.isActive,
      departmentId: data.departmentId,
      employeeId: data.employeeId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })

  return updatedUser
}

// DeleteUser :exec
export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id))
}

// ====================================
// USER QUERY AND SEARCH OPERATIONS
// ====================================

// ListUsers :many
export async function listUsers(limit: number, offset: number) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetAllUsers - 페이지네이션 없이 모든 유저 조회 (모든 유저)
export async function getAllUsers() {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .orderBy(desc(users.createdAt))

  return result
}

// ListUsersWithFilters :many
export async function listUsersWithFilters(
  limit: number,
  offset: number,
  filters?: {
    role?: "super_admin" | "admin" | "paying_user" | "user"
    isActive?: boolean
    search?: string
    departmentIds?: string[]
  },
) {
  const conditions = []

  if (filters?.role) {
    conditions.push(eq(users.userRole, filters.role))
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(users.email, `%${filters.search}%`),
      ilike(users.username, `%${filters.search}%`),
      ilike(users.employeeId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.departmentIds && filters.departmentIds.length > 0) {
    const departmentCondition = or(...filters.departmentIds.map((id) => eq(users.departmentId, id)))
    if (departmentCondition) {
      conditions.push(departmentCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetUserByEmail :one
export async function getUserByEmail(email: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      passwordHash: users.passwordHash,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.email, email))
    .limit(1)

  return result[0]
}

// GetAssignableUsers :many
export async function getAssignableUsers() {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.isActive, true), eq(users.userRole, "admin")))
    .orderBy(users.username)

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountUsers :one
export async function countUsers() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(users)

  return result[0]?.count ?? 0
}

// CountUsersWithFilters :one
export async function countUsersWithFilters(filters?: {
  role?: "super_admin" | "admin" | "paying_user" | "user"
  isActive?: boolean
  search?: string
  departmentIds?: string[]
}) {
  const conditions = []

  if (filters?.role) {
    conditions.push(eq(users.userRole, filters.role))
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(users.email, `%${filters.search}%`),
      ilike(users.username, `%${filters.search}%`),
      ilike(users.employeeId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.departmentIds && filters.departmentIds.length > 0) {
    const departmentCondition = or(...filters.departmentIds.map((id) => eq(users.departmentId, id)))
    if (departmentCondition) {
      conditions.push(departmentCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// CheckAccountExists :one
export async function checkAccountExists(email: string) {
  const result = await db
    .select({
      exists: sql<boolean>`EXISTS(SELECT 1 FROM ${users} WHERE email = ${email})`,
    })
    .from(users)
    .limit(1)

  return result[0]?.exists ?? false
}

// ====================================
// AUTHENTICATION AND PASSWORD QUERIES
// ====================================

// UpdateUserPassword :one
export async function updateUserPassword(id: string, passwordHash: string) {
  const [updatedUser] = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
    })

  return updatedUser
}

// CreateOrUpdateGoogleUser :one
export async function createOrUpdateGoogleUser(data: {
  username: string
  email: string
  oauthId: string
  profilePicture?: string
  userRole?: "super_admin" | "admin" | "paying_user" | "user"
  isActive?: boolean
  departmentId?: string
  employeeId?: string
  onboardingParams?: {
    industry?: string | null
    target?: string | null
    country?: string | null
    experience?: string | null
    lang?: string | null
  }
}) {
  // Check if user already exists
  const existingUser = await getUserByEmail(data.email)

  // Calculate trial period (7 days from now)
  const trialStartDate = new Date()
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 7)

  const [upsertedUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      userRole: data.userRole || "user",
      isActive: data.isActive ?? true,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
      authProvider: "google",
      oauthId: data.oauthId,
      profilePicture: data.profilePicture,
      trialStartDate,
      trialEndDate,
      isTrialActive: true,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        profilePicture: data.profilePicture,
      },
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      authProvider: users.authProvider,
      oauthId: users.oauthId,
      profilePicture: users.profilePicture,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
    })

  // Create default workspace for new trial users
  if (!existingUser && upsertedUser?.isTrialActive) {
    try {
      await workspaceService.createWorkspace({
        name: `${upsertedUser.username}의 워크스페이스`,
        description: "기본 워크스페이스",
        ownerId: upsertedUser.id,
        isActive: true,
        rawResearchOutput: data.onboardingParams || null,
      })
    } catch (error) {
      console.error("Failed to create default workspace for trial user:", error)
      // Don't throw error here to avoid breaking user registration
    }
  }

  return upsertedUser
}

// UpdateLastLogin :exec
export async function updateLastLogin(id: string) {
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(userIds: string[], isActive: boolean) {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  const result = await db
    .update(users)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  return result.length
}

// BulkUpdateRole :exec
export async function bulkUpdateRole(
  userIds: string[],
  userRole: "super_admin" | "admin" | "paying_user" | "user",
) {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  const result = await db
    .update(users)
    .set({
      userRole,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  return result.length
}

// BulkUpdateDepartment :exec
export async function bulkUpdateDepartment(userIds: string[], departmentId: string) {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  const result = await db
    .update(users)
    .set({
      departmentId,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  return result.length
}

// ====================================
// TRIAL PERIOD AND OAUTH QUERIES
// ====================================

// GetUserByOAuthId :one
export async function getUserByOAuthId(oauthId: string, authProvider: "google") {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      authProvider: users.authProvider,
      oauthId: users.oauthId,
      profilePicture: users.profilePicture,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.oauthId, oauthId), eq(users.authProvider, authProvider)))
    .limit(1)

  return user
}

// CheckTrialStatus :one
export async function checkTrialStatus(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return null
  }

  // Check if trial has expired
  const now = new Date()
  const isTrialExpired = user.trialEndDate && now > user.trialEndDate

  return {
    ...user,
    isTrialExpired,
    daysRemaining: user.trialEndDate
      ? Math.max(
          0,
          Math.ceil((user.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : null,
  }
}

// UpdateTrialStatus :one
export async function updateTrialStatus(userId: string, isTrialActive: boolean) {
  const [updatedUser] = await db
    .update(users)
    .set({
      isTrialActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      isTrialActive: users.isTrialActive,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
    })

  return updatedUser
}

// ExtendTrial :one
export async function extendTrial(userId: string, additionalDays: number) {
  const user = await checkTrialStatus(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const newEndDate = new Date()
  if (user.trialEndDate && user.trialEndDate > new Date()) {
    // Extend from current end date if trial is still active
    newEndDate.setTime(user.trialEndDate.getTime())
  }
  newEndDate.setDate(newEndDate.getDate() + additionalDays)

  const [updatedUser] = await db
    .update(users)
    .set({
      trialEndDate: newEndDate,
      isTrialActive: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
    })

  return updatedUser
}
