import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { users } from "../db/schema/users"
import { workspaceMembers, workspaces } from "../db/schema/workspaces"

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
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
  companyName?: string
  companyWebsite?: string
  companyPhone?: string
  industry?: string
  companySize?: string
  companyAddress?: string
  companyDescription?: string
}) {
  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      name: data.name,
      description: data.description || null,
      ownerId: data.ownerId,
      isActive: data.isActive !== undefined ? data.isActive : true,
      companyName: data.companyName || null,
      companyWebsite: data.companyWebsite || null,
      companyPhone: data.companyPhone || null,
      industry: data.industry || null,
      companySize: data.companySize || null,
      companyAddress: data.companyAddress || null,
      companyDescription: data.companyDescription || null,
    })
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
    ownerId?: string
    isActive: boolean
    companyName?: string
    companyWebsite?: string
    companyPhone?: string
    industry?: string
    companySize?: string
    companyAddress?: string
    companyDescription?: string
  },
) {
  const updateData: {
    name: string
    description?: string
    ownerId?: string
    isActive: boolean
    companyName?: string
    companyWebsite?: string
    companyPhone?: string
    industry?: string
    companySize?: string
    companyAddress?: string
    companyDescription?: string
    updatedAt: Date
  } = {
    name: data.name,
    description: data.description,
    isActive: data.isActive,
    companyName: data.companyName,
    companyWebsite: data.companyWebsite,
    companyPhone: data.companyPhone,
    industry: data.industry,
    companySize: data.companySize,
    companyAddress: data.companyAddress,
    companyDescription: data.companyDescription,
    updatedAt: new Date(),
  }

  // Only update ownerId if provided
  if (data.ownerId) {
    updateData.ownerId = data.ownerId
  }

  const [updatedWorkspace] = await db
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, id))
    .returning({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
    const searchCondition = or(
      ilike(workspaces.name, `%${filters.search}%`),
      ilike(workspaces.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    const ownerCondition = or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))
    if (ownerCondition) {
      conditions.push(ownerCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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
    const searchCondition = or(
      ilike(workspaces.name, `%${filters.search}%`),
      ilike(workspaces.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.ownerIds && filters.ownerIds.length > 0) {
    const ownerCondition = or(...filters.ownerIds.map((id) => eq(workspaces.ownerId, id)))
    if (ownerCondition) {
      conditions.push(ownerCondition)
    }
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
  const workspaceCondition = or(...workspaceIds.map((id) => eq(workspaces.id, id)))
  if (!workspaceCondition) {
    return 0
  }

  const result = await db
    .update(workspaces)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(workspaceCondition)
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
  role?: "owner" | "admin" | "member" | "viewer"
  invitedBy?: string
  status?: "active" | "inactive" | "removed"
}) {
  const [newMember] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId: data.workspaceId,
      userId: data.userId,
      role: data.role || "member",
      invitedBy: data.invitedBy || null,
      status: data.status || "active",
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
  role: "owner" | "admin" | "member" | "viewer",
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
  status: "active" | "inactive" | "removed",
) {
  const [updatedMember] = await db
    .update(workspaceMembers)
    .set({
      status,
      joinedAt: status === "active" ? new Date() : undefined,
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
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
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

// GetAllUserRelatedWorkspaces - 소유하거나 멤버인 워크스페이스 모두 반환
export async function getAllUserRelatedWorkspaces(userId: string) {
  // 소유한 워크스페이스
  const ownedWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      isActive: workspaces.isActive,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.createdAt))

  // 멤버인 워크스페이스
  const memberWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      description: workspaces.description,
      isActive: workspaces.isActive,
      ownerId: workspaces.ownerId,
      companyName: workspaces.companyName,
      companyWebsite: workspaces.companyWebsite,
      companyPhone: workspaces.companyPhone,
      industry: workspaces.industry,
      companySize: workspaces.companySize,
      companyAddress: workspaces.companyAddress,
      companyDescription: workspaces.companyDescription,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.status, "active")))
    .orderBy(desc(workspaces.createdAt))

  // 중복 제거 (소유자이면서 멤버인 경우)
  const workspaceMap = new Map()

  // 소유한 워크스페이스 먼저 추가
  for (const ws of ownedWorkspaces) {
    workspaceMap.set(ws.id, ws)
  }

  // 멤버인 워크스페이스 추가 (중복되지 않는 것만)
  for (const ws of memberWorkspaces) {
    if (!workspaceMap.has(ws.id)) {
      workspaceMap.set(ws.id, ws)
    }
  }

  return Array.from(workspaceMap.values())
}
