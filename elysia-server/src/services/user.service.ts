import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { departments, users } from '../db/schema/users'

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
    .innerJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, id))
    .limit(1)

  return result[0]
}

// CreateUser :one
export async function createUser(data: {
  username: string
  email: string
  passwordHash?: string
  userRole?: 'admin' | 'user'
  isActive?: boolean
  departmentId: string
  employeeId: string
}) {
  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash || null,
      userRole: data.userRole || 'user',
      isActive: data.isActive ?? true,
      departmentId: data.departmentId,
      employeeId: data.employeeId,
    })
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

  return newUser
}

// UpdateUser :one
export async function updateUser(
  id: string,
  data: {
    username: string
    email: string
    userRole: 'admin' | 'user'
    isActive: boolean
    departmentId: string
    employeeId: string
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
    .innerJoin(departments, eq(users.departmentId, departments.id))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListUsersWithFilters :many
export async function listUsersWithFilters(
  limit: number,
  offset: number,
  filters?: {
    role?: 'admin' | 'user'
    isActive?: boolean
    search?: string
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
    conditions.push(
      or(
        ilike(users.email, `%${filters.search}%`),
        ilike(users.username, `%${filters.search}%`),
        ilike(users.employeeId, `%${filters.search}%`),
      )!,
    )
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
    .innerJoin(departments, eq(users.departmentId, departments.id))
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
    .innerJoin(departments, eq(users.departmentId, departments.id))
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
    .innerJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.isActive, true), eq(users.userRole, 'admin')))
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
  role?: 'admin' | 'user'
  isActive?: boolean
  search?: string
}) {
  const conditions = []

  if (filters?.role) {
    conditions.push(eq(users.userRole, filters.role))
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(users.email, `%${filters.search}%`),
        ilike(users.username, `%${filters.search}%`),
        ilike(users.employeeId, `%${filters.search}%`),
      )!,
    )
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
    .select({ exists: sql<boolean>`EXISTS(SELECT 1 FROM ${users} WHERE email = ${email})` })
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
  userRole?: 'admin' | 'user'
  isActive?: boolean
  departmentId: string
  employeeId: string
}) {
  const [upsertedUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      userRole: data.userRole || 'user',
      isActive: data.isActive ?? true,
      departmentId: data.departmentId,
      employeeId: data.employeeId,
      lastLoginAt: new Date(),
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
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
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
    })

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
