import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { users } from '../db/schema/users'
import { workspaceMembers, workspaces } from '../db/schema/workspaces'

// ====================================
// WORKSPACE CRUD OPERATIONS
// ====================================

// GetWorkspace :one
export async function getWorkspace(id: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(eq(workspaces.id, id))
    .limit(1)

  return result[0]
}

// CreateWorkspace :one
export async function createWorkspace(data: {
  name: string
  description?: string
  ownerId: string
  isActive?: boolean
}) {
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      name: data.name,
      description: data.description || null,
      ownerId: data.ownerId,
      isActive: data.isActive !== undefined ? data.isActive : true,
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })

  return newWorkspace
}

// UpdateWorkspace :one
export async function updateWorkspace(
  id: string,
  data: {
    name: string
    description?: string
    isActive: boolean
  },
) {
  const [updatedWorkspace] = await db
    .update(workspaces)
    .set({
      name: data.name,
      description: data.description,
      isActive: data.isActive,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })

  return updatedWorkspace
}

// DeleteWorkspace :exec
export async function deleteWorkspace(id: string) {
  await db.delete(workspaces).where(eq(workspaces.id, id))
}

// ====================================
// WORKSPACE QUERY AND SEARCH OPERATIONS
// ====================================

// ListWorkspaces :many
export async function listWorkspaces(limit: number, offset: number) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .orderBy(desc(workspaces.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListWorkspacesWithFilters :many
export async function listWorkspacesWithFilters(
  limit: number,
  offset: number,
  filters?: {
    isActive?: boolean
    search?: string
    ownerIds?: string[]
  },
) {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(workspaces.isActive, filters.isActive))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(workspaces.name, `%${filters.search}%`),
        ilike(workspaces.description, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    conditions.push(or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))!)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      ownerUsername: users.username,
      ownerEmail: users.email,
    })
    .from(workspaces)
    .innerJoin(users, eq(workspaces.ownerId, users.id))
    .where(whereClause)
    .orderBy(desc(workspaces.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetWorkspacesByOwner :many
export async function getWorkspacesByOwner(ownerId: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      isActive: workspaces.isActive,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, ownerId))
    .orderBy(desc(workspaces.createdAt))

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountWorkspaces :one
export async function countWorkspaces() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(workspaces)

  return result[0]?.count ?? 0
}

// CountWorkspacesWithFilters :one
export async function countWorkspacesWithFilters(filters?: {
  isActive?: boolean
  search?: string
  ownerIds?: string[]
}) {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(workspaces.isActive, filters.isActive))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(workspaces.name, `%${filters.search}%`),
        ilike(workspaces.description, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    conditions.push(or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))!)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workspaces)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(workspaceIds: string[], isActive: boolean) {
  const result = await db
    .update(workspaces)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(or(...workspaceIds.map((id) => eq(workspaces.id, id)))!)
    .returning({ id: workspaces.id })

  return result.length
}

// TransferOwnership :one
export async function transferOwnership(workspaceId: string, newOwnerId: string) {
  const [updatedWorkspace] = await db
    .update(workspaces)
    .set({
      ownerId: newOwnerId,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, workspaceId))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      updatedAt: workspaces.updatedAt,
    })

  return updatedWorkspace
}

// ====================================
// WORKSPACE MEMBERS OPERATIONS
// ====================================

// GetWorkspaceMembers :many
export async function getWorkspaceMembers(workspaceId: string) {
  const result = await db
    .select({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedBy: workspaceMembers.invitedBy,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: workspaceMembers.joinedAt,
      username: users.username,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(desc(workspaceMembers.invitedAt))

  return result
}

// AddWorkspaceMember :one
export async function addWorkspaceMember(data: {
  workspaceId: string
  userId: string
  role?: 'owner' | 'admin' | 'member' | 'viewer'
  invitedBy?: string
  status?: 'invited' | 'active' | 'inactive' | 'removed'
}) {
  const [newMember] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      role: data.role || 'member',
      invitedBy: data.invitedBy || null,
      status: data.status || 'invited',
    })
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      invitedAt: workspaceMembers.invitedAt,
      joinedAt: workspaceMembers.joinedAt,
    })

  return newMember
}

// UpdateWorkspaceMemberRole :one
export async function updateWorkspaceMemberRole(
  memberId: string,
  role: 'owner' | 'admin' | 'member' | 'viewer',
) {
  const [updatedMember] = await db
    .update(workspaceMembers)
    .set({
      role,
    })
    .where(eq(workspaceMembers.id, memberId))
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
    })

  return updatedMember
}

// UpdateWorkspaceMemberStatus :one
export async function updateWorkspaceMemberStatus(
  memberId: string,
  status: 'invited' | 'active' | 'inactive' | 'removed',
) {
  const [updatedMember] = await db
    .update(workspaceMembers)
    .set({
      status,
      joinedAt: status === 'active' ? new Date() : undefined,
    })
    .where(eq(workspaceMembers.id, memberId))
    .returning({
      id: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
    })

  return updatedMember
}

// RemoveWorkspaceMember :exec
export async function removeWorkspaceMember(memberId: string) {
  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, memberId))
}

// GetUserWorkspaces :many
export async function getUserWorkspaces(userId: string) {
  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      isActive: workspaces.isActive,
      role: workspaceMembers.role,
      status: workspaceMembers.status,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaceMembers.joinedAt))

  return result
}
