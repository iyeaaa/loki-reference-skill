/**
 * IAM Service
 *
 * IAM (Identity and Access Management) 관련 데이터베이스 작업을 처리하는 서비스
 */

import { and, count, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm"
import { db } from "../db"
import { billingPlans, billingProducts, subscriptions } from "../db/schema/billing"
import type { SubscriptionTier } from "../db/schema/enums"
import type {
  IamAuditLog,
  IamMemberPolicy,
  IamMemberRole,
  IamPolicy,
  IamPolicyStatement,
  IamRolePolicy,
  IamTierBoundary,
  IamWorkspaceRole,
  NewIamAuditLog,
  NewIamMemberPolicy,
  NewIamMemberRole,
  NewIamPolicy,
  NewIamPolicyStatement,
  NewIamRolePolicy,
  NewIamWorkspaceRole,
} from "../db/schema/iam"
import {
  iamAuditLogs,
  iamMemberPolicies,
  iamMemberRoles,
  iamPolicies,
  iamPolicyStatements,
  iamRolePolicies,
  iamTierBoundaries,
  iamWorkspaceRoles,
} from "../db/schema/iam"
import { users } from "../db/schema/users"
import { workspaceMembers, workspaces } from "../db/schema/workspaces"

// ============================================================================
// Policies
// ============================================================================

export interface PolicyFilters {
  workspaceId?: string
  isManaged?: boolean
  isActive?: boolean
  search?: string
}

/**
 * 정책이 특정 워크스페이스에서 사용 가능한지 확인
 *
 * 제외 대상:
 * 1. TierBoundary 정책: 구독 등급의 최대 권한 정의 (멤버에게 직접 할당 불가)
 * 2. SystemAdmin 정책: 전체 시스템 관리자 전용 (워크스페이스 수준에서 할당 불가)
 *
 * @param policyName - 정책 이름
 * @param workspaceId - 워크스페이스 ID (선택적, tier 확인용)
 * @returns boolean - 사용 가능 여부
 */
export async function isPolicyAvailableForWorkspace(
  policyName: string,
  workspaceId?: string,
): Promise<boolean> {
  // TierBoundary 정책은 항상 제외
  if (policyName.startsWith("TierBoundary:")) return false

  // SystemAdmin 정책은 워크스페이스 수준에서 할당 불가
  if (policyName === "SystemAdmin") return false

  // 워크스페이스가 지정되지 않았으면 기본적으로 허용
  if (!workspaceId) return true

  // 추가 tier 기반 제한은 향후 확장 가능
  // 현재는 TierBoundary와 SystemAdmin만 제외
  return true
}

export async function listPolicies(
  limit: number,
  offset: number,
  filters?: PolicyFilters,
): Promise<
  (IamPolicy & {
    statementsCount: number
    workspace?: { id: string; name: string } | null
    creator?: { id: string; username: string } | null
  })[]
> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamPolicies.workspaceId, filters.workspaceId))
  } else if (filters?.workspaceId === null) {
    conditions.push(isNull(iamPolicies.workspaceId))
  }
  if (filters?.isManaged !== undefined) {
    conditions.push(eq(iamPolicies.isManaged, filters.isManaged))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(iamPolicies.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(iamPolicies.name, `%${filters.search}%`),
        ilike(iamPolicies.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const policiesData = await db
    .select({
      policy: iamPolicies,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
      },
      creator: {
        id: users.id,
        username: users.username,
      },
    })
    .from(iamPolicies)
    .leftJoin(workspaces, eq(iamPolicies.workspaceId, workspaces.id))
    .leftJoin(users, eq(iamPolicies.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(iamPolicies.createdAt))
    .limit(limit)
    .offset(offset)

  // Get statement counts for each policy
  const policyIds = policiesData.map((p) => p.policy.id)
  const statementCounts = await db
    .select({
      policyId: iamPolicyStatements.policyId,
      count: count(),
    })
    .from(iamPolicyStatements)
    .where(
      policyIds.length > 0
        ? or(...policyIds.map((id) => eq(iamPolicyStatements.policyId, id)))
        : undefined,
    )
    .groupBy(iamPolicyStatements.policyId)

  const countMap = new Map(statementCounts.map((c) => [c.policyId, c.count]))

  return policiesData.map((row) => ({
    ...row.policy,
    statementsCount: countMap.get(row.policy.id) || 0,
    workspace: row.workspace?.id ? row.workspace : null,
    creator: row.creator?.id ? row.creator : null,
  }))
}

export async function countPolicies(filters?: PolicyFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamPolicies.workspaceId, filters.workspaceId))
  } else if (filters?.workspaceId === null) {
    conditions.push(isNull(iamPolicies.workspaceId))
  }
  if (filters?.isManaged !== undefined) {
    conditions.push(eq(iamPolicies.isManaged, filters.isManaged))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(iamPolicies.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(iamPolicies.name, `%${filters.search}%`),
        ilike(iamPolicies.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(iamPolicies).where(whereClause)

  return result[0]?.count || 0
}

export async function getPolicy(id: string): Promise<IamPolicy | null> {
  const result = await db.select().from(iamPolicies).where(eq(iamPolicies.id, id)).limit(1)
  return result[0] || null
}

export async function createPolicy(
  data: Omit<NewIamPolicy, "id" | "createdAt" | "updatedAt" | "version">,
): Promise<IamPolicy> {
  const result = await db
    .insert(iamPolicies)
    .values({ ...data, version: 1 })
    .returning()
  if (!result[0]) {
    throw new Error("Failed to create policy")
  }
  return result[0]
}

export async function updatePolicy(
  id: string,
  data: Partial<Omit<NewIamPolicy, "id" | "createdAt" | "version">>,
): Promise<IamPolicy | null> {
  const current = await getPolicy(id)
  if (!current) return null

  const result = await db
    .update(iamPolicies)
    .set({ ...data, version: current.version + 1, updatedAt: new Date() })
    .where(eq(iamPolicies.id, id))
    .returning()
  return result[0] || null
}

export async function deletePolicy(id: string): Promise<void> {
  await db.delete(iamPolicies).where(eq(iamPolicies.id, id))
}

// ============================================================================
// Policy Statements
// ============================================================================

export async function getPolicyStatements(policyId: string): Promise<IamPolicyStatement[]> {
  return db
    .select()
    .from(iamPolicyStatements)
    .where(eq(iamPolicyStatements.policyId, policyId))
    .orderBy(desc(iamPolicyStatements.priority), iamPolicyStatements.createdAt)
}

export async function addPolicyStatement(
  data: Omit<NewIamPolicyStatement, "id" | "createdAt">,
): Promise<IamPolicyStatement> {
  const result = await db.insert(iamPolicyStatements).values(data).returning()
  // Increment policy version
  const currentPolicy = await getPolicy(data.policyId)
  if (currentPolicy) {
    await db
      .update(iamPolicies)
      .set({
        version: currentPolicy.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(iamPolicies.id, data.policyId))
  }
  if (!result[0]) {
    throw new Error("Failed to add policy statement")
  }
  return result[0]
}

export async function updatePolicyStatement(
  policyId: string,
  statementId: string,
  data: Partial<Omit<NewIamPolicyStatement, "id" | "policyId" | "createdAt">>,
): Promise<IamPolicyStatement | null> {
  const result = await db
    .update(iamPolicyStatements)
    .set(data)
    .where(and(eq(iamPolicyStatements.id, statementId), eq(iamPolicyStatements.policyId, policyId)))
    .returning()
  return result[0] || null
}

export async function deletePolicyStatement(policyId: string, statementId: string): Promise<void> {
  await db
    .delete(iamPolicyStatements)
    .where(and(eq(iamPolicyStatements.id, statementId), eq(iamPolicyStatements.policyId, policyId)))
}

// ============================================================================
// Workspace Roles
// ============================================================================

export interface RoleFilters {
  workspaceId?: string
  isSystem?: boolean
  isDefault?: boolean
  search?: string
}

export async function listRoles(
  limit: number,
  offset: number,
  filters?: RoleFilters,
): Promise<
  (IamWorkspaceRole & {
    policiesCount: number
    membersCount: number
    workspace?: { id: string; name: string } | null
    creator?: { id: string; username: string } | null
  })[]
> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamWorkspaceRoles.workspaceId, filters.workspaceId))
  }
  if (filters?.isSystem !== undefined) {
    conditions.push(eq(iamWorkspaceRoles.isSystem, filters.isSystem))
  }
  if (filters?.isDefault !== undefined) {
    conditions.push(eq(iamWorkspaceRoles.isDefault, filters.isDefault))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(iamWorkspaceRoles.name, `%${filters.search}%`),
        ilike(iamWorkspaceRoles.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rolesData = await db
    .select({
      role: iamWorkspaceRoles,
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
      },
      creator: {
        id: users.id,
        username: users.username,
      },
    })
    .from(iamWorkspaceRoles)
    .leftJoin(workspaces, eq(iamWorkspaceRoles.workspaceId, workspaces.id))
    .leftJoin(users, eq(iamWorkspaceRoles.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(iamWorkspaceRoles.priority), iamWorkspaceRoles.createdAt)
    .limit(limit)
    .offset(offset)

  // Get counts
  const roleIds = rolesData.map((r) => r.role.id)
  if (roleIds.length === 0) return []

  const policyCounts = await db
    .select({
      roleId: iamRolePolicies.roleId,
      count: count(),
    })
    .from(iamRolePolicies)
    .where(or(...roleIds.map((id) => eq(iamRolePolicies.roleId, id))))
    .groupBy(iamRolePolicies.roleId)

  const memberCounts = await db
    .select({
      roleId: iamMemberRoles.roleId,
      count: count(),
    })
    .from(iamMemberRoles)
    .where(or(...roleIds.map((id) => eq(iamMemberRoles.roleId, id))))
    .groupBy(iamMemberRoles.roleId)

  const policyCountMap = new Map(policyCounts.map((c) => [c.roleId, c.count]))
  const memberCountMap = new Map(memberCounts.map((c) => [c.roleId, c.count]))

  return rolesData.map((row) => ({
    ...row.role,
    policiesCount: policyCountMap.get(row.role.id) || 0,
    membersCount: memberCountMap.get(row.role.id) || 0,
    workspace: row.workspace?.id ? row.workspace : null,
    creator: row.creator?.id ? row.creator : null,
  }))
}

export async function countRoles(filters?: RoleFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamWorkspaceRoles.workspaceId, filters.workspaceId))
  }
  if (filters?.isSystem !== undefined) {
    conditions.push(eq(iamWorkspaceRoles.isSystem, filters.isSystem))
  }
  if (filters?.isDefault !== undefined) {
    conditions.push(eq(iamWorkspaceRoles.isDefault, filters.isDefault))
  }
  if (filters?.search) {
    conditions.push(
      or(
        ilike(iamWorkspaceRoles.name, `%${filters.search}%`),
        ilike(iamWorkspaceRoles.description, `%${filters.search}%`),
      ) as SQL,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(iamWorkspaceRoles).where(whereClause)

  return result[0]?.count || 0
}

export async function getRole(id: string): Promise<IamWorkspaceRole | null> {
  const result = await db
    .select()
    .from(iamWorkspaceRoles)
    .where(eq(iamWorkspaceRoles.id, id))
    .limit(1)
  return result[0] || null
}

export async function createRole(
  data: Omit<NewIamWorkspaceRole, "id" | "createdAt" | "updatedAt">,
): Promise<IamWorkspaceRole> {
  const result = await db.insert(iamWorkspaceRoles).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create role")
  }
  return result[0]
}

export async function updateRole(
  id: string,
  data: Partial<Omit<NewIamWorkspaceRole, "id" | "createdAt" | "workspaceId">>,
): Promise<IamWorkspaceRole | null> {
  const result = await db
    .update(iamWorkspaceRoles)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(iamWorkspaceRoles.id, id))
    .returning()
  return result[0] || null
}

export async function deleteRole(id: string): Promise<void> {
  await db.delete(iamWorkspaceRoles).where(eq(iamWorkspaceRoles.id, id))
}

// ============================================================================
// Role Policies
// ============================================================================

export async function getRolePolicies(
  roleId: string,
): Promise<(IamRolePolicy & { policy?: IamPolicy })[]> {
  const result = await db
    .select({
      rolePolicy: iamRolePolicies,
      policy: iamPolicies,
    })
    .from(iamRolePolicies)
    .leftJoin(iamPolicies, eq(iamRolePolicies.policyId, iamPolicies.id))
    .where(eq(iamRolePolicies.roleId, roleId))

  return result.map((row) => ({
    ...row.rolePolicy,
    policy: row.policy || undefined,
  }))
}

export async function attachPolicyToRole(
  data: Omit<NewIamRolePolicy, "id" | "attachedAt">,
): Promise<IamRolePolicy> {
  const result = await db.insert(iamRolePolicies).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to attach policy to role")
  }
  return result[0]
}

export async function detachPolicyFromRole(roleId: string, policyId: string): Promise<void> {
  await db
    .delete(iamRolePolicies)
    .where(and(eq(iamRolePolicies.roleId, roleId), eq(iamRolePolicies.policyId, policyId)))
}

// ============================================================================
// Member Roles
// ============================================================================

export async function getMemberRoles(
  memberId: string,
): Promise<(IamMemberRole & { role?: IamWorkspaceRole })[]> {
  const result = await db
    .select({
      memberRole: iamMemberRoles,
      role: iamWorkspaceRoles,
    })
    .from(iamMemberRoles)
    .leftJoin(iamWorkspaceRoles, eq(iamMemberRoles.roleId, iamWorkspaceRoles.id))
    .where(eq(iamMemberRoles.memberId, memberId))

  return result.map((row) => ({
    ...row.memberRole,
    role: row.role || undefined,
  }))
}

export async function getRoleMembers(roleId: string): Promise<IamMemberRole[]> {
  return db.select().from(iamMemberRoles).where(eq(iamMemberRoles.roleId, roleId))
}

export async function grantRoleToMember(
  data: Omit<NewIamMemberRole, "id" | "grantedAt">,
): Promise<IamMemberRole> {
  const result = await db.insert(iamMemberRoles).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to grant role to member")
  }
  return result[0]
}

export async function revokeRoleFromMember(memberId: string, roleId: string): Promise<void> {
  await db
    .delete(iamMemberRoles)
    .where(and(eq(iamMemberRoles.memberId, memberId), eq(iamMemberRoles.roleId, roleId)))
}

// ============================================================================
// Member Policies (Inline)
// ============================================================================

export async function getMemberPolicies(
  memberId: string,
): Promise<(IamMemberPolicy & { policy?: IamPolicy })[]> {
  const result = await db
    .select({
      memberPolicy: iamMemberPolicies,
      policy: iamPolicies,
    })
    .from(iamMemberPolicies)
    .leftJoin(iamPolicies, eq(iamMemberPolicies.policyId, iamPolicies.id))
    .where(eq(iamMemberPolicies.memberId, memberId))

  return result.map((row) => ({
    ...row.memberPolicy,
    policy: row.policy || undefined,
  }))
}

export async function attachPolicyToMember(
  data: Omit<NewIamMemberPolicy, "id" | "attachedAt">,
): Promise<IamMemberPolicy> {
  const result = await db.insert(iamMemberPolicies).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to attach policy to member")
  }
  return result[0]
}

export async function detachPolicyFromMember(memberId: string, policyId: string): Promise<void> {
  await db
    .delete(iamMemberPolicies)
    .where(and(eq(iamMemberPolicies.memberId, memberId), eq(iamMemberPolicies.policyId, policyId)))
}

// ============================================================================
// Tier Boundaries
// ============================================================================

export async function listTierBoundaries(
  tier?: SubscriptionTier,
): Promise<(IamTierBoundary & { policy?: IamPolicy })[]> {
  const conditions = tier ? [eq(iamTierBoundaries.tier, tier)] : []
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      tierBoundary: iamTierBoundaries,
      policy: iamPolicies,
    })
    .from(iamTierBoundaries)
    .leftJoin(iamPolicies, eq(iamTierBoundaries.policyId, iamPolicies.id))
    .where(whereClause)

  return result.map((row) => ({
    ...row.tierBoundary,
    policy: row.policy || undefined,
  }))
}

export async function getTierBoundary(tier: SubscriptionTier): Promise<IamTierBoundary | null> {
  const result = await db
    .select()
    .from(iamTierBoundaries)
    .where(eq(iamTierBoundaries.tier, tier))
    .limit(1)
  return result[0] || null
}

export async function updateTierBoundary(
  tier: SubscriptionTier,
  policyId: string,
): Promise<IamTierBoundary | null> {
  const result = await db
    .update(iamTierBoundaries)
    .set({ policyId, updatedAt: new Date() })
    .where(eq(iamTierBoundaries.tier, tier))
    .returning()
  return result[0] || null
}

/**
 * 워크스페이스의 현재 구독 tier 조회
 *
 * subscription이 없거나 만료된 경우 'trial' 반환
 * trialing 상태도 해당 tier의 권한 적용
 *
 * @param workspaceId - 워크스페이스 ID
 * @returns SubscriptionTier (trial, basic, pro, enterprise)
 */
export async function getWorkspaceTier(workspaceId: string): Promise<SubscriptionTier> {
  // 활성 구독 조회 (trialing, active 상태만)
  const activeStatuses = ["trialing", "active"] as const

  const result = await db
    .select({
      tier: billingProducts.tier,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(
        eq(subscriptions.workspaceId, workspaceId),
        eq(subscriptions.isPrimary, true),
        inArray(subscriptions.status, activeStatuses),
      ),
    )
    .limit(1)

  // 구독이 없거나 만료된 경우 trial로 처리
  if (!result[0]) {
    return "trial"
  }

  return result[0].tier
}

// ============================================================================
// Audit Logs
// ============================================================================

export interface AuditLogFilters {
  workspaceId?: string
  userId?: string
  action?: string
  targetType?: string
  startDate?: Date
  endDate?: Date
}

export async function listAuditLogs(
  limit: number,
  offset: number,
  filters?: AuditLogFilters,
): Promise<
  (IamAuditLog & {
    user?: { id: string; username: string } | null
    workspace?: { id: string; name: string } | null
  })[]
> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamAuditLogs.workspaceId, filters.workspaceId))
  }
  if (filters?.userId) {
    conditions.push(eq(iamAuditLogs.userId, filters.userId))
  }
  if (filters?.action) {
    conditions.push(eq(iamAuditLogs.action, filters.action))
  }
  if (filters?.targetType) {
    conditions.push(eq(iamAuditLogs.targetType, filters.targetType))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      auditLog: iamAuditLogs,
      user: {
        id: users.id,
        username: users.username,
      },
      workspace: {
        id: workspaces.id,
        name: workspaces.name,
      },
    })
    .from(iamAuditLogs)
    .leftJoin(users, eq(iamAuditLogs.userId, users.id))
    .leftJoin(workspaces, eq(iamAuditLogs.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(iamAuditLogs.createdAt))
    .limit(limit)
    .offset(offset)

  return result.map((row) => ({
    ...row.auditLog,
    user: row.user?.id ? row.user : null,
    workspace: row.workspace?.id ? row.workspace : null,
  }))
}

export async function countAuditLogs(filters?: AuditLogFilters): Promise<number> {
  const conditions: SQL[] = []

  if (filters?.workspaceId) {
    conditions.push(eq(iamAuditLogs.workspaceId, filters.workspaceId))
  }
  if (filters?.userId) {
    conditions.push(eq(iamAuditLogs.userId, filters.userId))
  }
  if (filters?.action) {
    conditions.push(eq(iamAuditLogs.action, filters.action))
  }
  if (filters?.targetType) {
    conditions.push(eq(iamAuditLogs.targetType, filters.targetType))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db.select({ count: count() }).from(iamAuditLogs).where(whereClause)

  return result[0]?.count || 0
}

export async function getAuditLog(id: string): Promise<IamAuditLog | null> {
  const result = await db.select().from(iamAuditLogs).where(eq(iamAuditLogs.id, id)).limit(1)
  return result[0] || null
}

export async function createAuditLog(
  data: Omit<NewIamAuditLog, "id" | "createdAt">,
): Promise<IamAuditLog> {
  const result = await db.insert(iamAuditLogs).values(data).returning()
  if (!result[0]) {
    throw new Error("Failed to create audit log")
  }
  return result[0]
}

// ============================================================================
// Permission Check Functions
// ============================================================================

/**
 * 권한 체크 캐시 (TTL: 5분)
 * 2025 Best Practice: 권한 체크는 매 요청마다 발생하므로 캐싱 필수
 */
const permissionCache = new Map<string, { result: boolean; timestamp: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5분

function getCacheKey(memberId: string, resource: string, action: string): string {
  return `${memberId}:${resource}:${action}`
}

function getCachedPermission(memberId: string, resource: string, action: string): boolean | null {
  const key = getCacheKey(memberId, resource, action)
  const cached = permissionCache.get(key)

  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result
  }

  // 만료된 캐시 삭제
  if (cached) {
    permissionCache.delete(key)
  }

  return null
}

function setCachedPermission(
  memberId: string,
  resource: string,
  action: string,
  result: boolean,
): void {
  const key = getCacheKey(memberId, resource, action)
  permissionCache.set(key, { result, timestamp: Date.now() })

  // 캐시 크기 제한 (메모리 관리)
  if (permissionCache.size > 10000) {
    const keysToDelete = Array.from(permissionCache.keys()).slice(0, 1000)
    for (const k of keysToDelete) {
      permissionCache.delete(k)
    }
  }
}

/**
 * 멤버의 권한 캐시 무효화 (역할/정책 변경 시 호출)
 */
export function invalidateMemberPermissionCache(memberId: string): void {
  const keysToDelete: string[] = []
  for (const key of permissionCache.keys()) {
    if (key.startsWith(`${memberId}:`)) {
      keysToDelete.push(key)
    }
  }
  for (const k of keysToDelete) {
    permissionCache.delete(k)
  }
}

/**
 * 전체 캐시 무효화 (정책 변경 시)
 */
export function invalidateAllPermissionCache(): void {
  permissionCache.clear()
}

/**
 * userId와 workspaceId로 멤버 ID 조회
 */
export async function getMemberIdByUserAndWorkspace(
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  const result = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.status, "active"),
      ),
    )
    .limit(1)

  return result[0]?.id || null
}

/**
 * 멤버 ID로 워크스페이스 ID 조회
 */
export async function getMemberWorkspaceId(
  memberId: string,
): Promise<{ workspaceId: string } | null> {
  const result = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.id, memberId))
    .limit(1)

  return result[0] || null
}

/**
 * 리소스 패턴 매칭 헬퍼
 * @param patterns - 정책에 정의된 리소스 패턴들 (예: ["*", "leads", "sequences:*"])
 * @param target - 체크할 리소스 (예: "leads", "sequences:email")
 */
function matchResource(patterns: string[], target: string): boolean {
  return patterns.some((p) => {
    if (p === "*") return true
    if (p === target) return true
    if (p.endsWith(":*")) {
      const prefix = p.slice(0, -2)
      return target === prefix || target.startsWith(`${prefix}:`)
    }
    return false
  })
}

/**
 * 액션 패턴 매칭 헬퍼
 * @param patterns - 정책에 정의된 액션들 (예: ["*", "read", "create"])
 * @param target - 체크할 액션 (예: "read", "delete")
 */
function matchAction(patterns: string[], target: string): boolean {
  return patterns.some((p) => p === "*" || p === target)
}

/**
 * 권한 체크 핵심 함수 (캐싱 적용)
 *
 * 권한 평가 순서:
 * 1. 캐시 확인
 * 2. 멤버 직접 정책 (인라인) - 최우선
 * 3. 역할 기반 정책
 * 4. Deny 우선 원칙 (AWS IAM 스타일)
 *
 * @param memberId - workspace_members.id (멤버 ID)
 * @param resource - 리소스 종류 (예: "leads", "sequences", "billing")
 * @param action - 액션 (예: "read", "create", "update", "delete")
 * @returns boolean - 권한 있음/없음
 */
export async function checkPermission(
  memberId: string,
  resource: string,
  action: string,
): Promise<boolean> {
  // 0. 캐시 확인
  const cached = getCachedPermission(memberId, resource, action)
  if (cached !== null) {
    return cached
  }

  // 1. 멤버의 역할들 조회
  const memberRoles = await getMemberRoles(memberId)

  // 2. 멤버에 직접 할당된 정책 조회
  const memberPolicies = await getMemberPolicies(memberId)

  // 3. 모든 statements 수집 (priority 순서로)
  const allStatements: IamPolicyStatement[] = []

  // 역할의 정책에서 statements 수집
  for (const mr of memberRoles) {
    if (mr.role) {
      const rolePolicies = await getRolePolicies(mr.role.id)
      for (const rp of rolePolicies) {
        if (rp.policy?.isActive) {
          const statements = await getPolicyStatements(rp.policyId)
          allStatements.push(...statements)
        }
      }
    }
  }

  // 멤버 직접 정책에서 statements 수집
  for (const mp of memberPolicies) {
    if (mp.policy?.isActive) {
      const statements = await getPolicyStatements(mp.policyId)
      allStatements.push(...statements)
    }
  }

  // 4. priority 내림차순 정렬 (높은 우선순위 먼저)
  allStatements.sort((a, b) => b.priority - a.priority)

  // 5. 매칭되는 statement 찾기
  let result = false
  for (const stmt of allStatements) {
    const resourceMatch = matchResource(stmt.resources, resource)
    const actionMatch = matchAction(stmt.actions, action)

    if (resourceMatch && actionMatch) {
      // deny 발견시 즉시 거부 (Deny 우선 원칙)
      if (stmt.effect === "deny") {
        result = false
        break
      }
      // allow 발견시 허용
      if (stmt.effect === "allow") {
        result = true
        break
      }
    }
  }

  // 6. 결과 캐싱 및 반환
  setCachedPermission(memberId, resource, action, result)
  return result
}

/**
 * 멤버가 Admin 역할(Owner 또는 Admin)인지 확인
 * @param memberId - workspace_members.id
 * @returns boolean
 */
export async function isMemberAdmin(memberId: string): Promise<boolean> {
  const memberRoles = await getMemberRoles(memberId)
  return memberRoles.some((mr) => mr.role?.name === "Owner" || mr.role?.name === "Admin")
}

/**
 * 현재 멤버의 권한 정보 조회 (프론트엔드용)
 *
 * AWS IAM 스타일 권한 평가:
 * 1. 멤버의 역할(Role)에서 정책(Policy) 수집
 * 2. 멤버에 직접 할당된 정책(Inline Policy) 수집
 * 3. Allow/Deny statements 처리 (Deny 우선)
 * 4. TierBoundary 적용 (구독 등급별 제한)
 * 5. 최종 permissions 배열 생성
 *
 * @param memberId - workspace_members.id
 * @param workspaceId - 워크스페이스 ID (TierBoundary 적용용, optional for backward compatibility)
 * @returns roles, isAdmin, permissions 배열
 */
export async function getMemberPermissions(
  memberId: string,
  workspaceId?: string,
): Promise<{
  roles: Array<{ id: string; name: string; priority: number }>
  isAdmin: boolean
  permissions: Array<{ resource: string; action: string }>
  tier?: SubscriptionTier
}> {
  const memberRoles = await getMemberRoles(memberId)

  // 역할 정보 추출
  const roles = memberRoles
    .filter((mr): mr is typeof mr & { role: NonNullable<typeof mr.role> } => mr.role !== undefined)
    .map((mr) => ({
      id: mr.role.id,
      name: mr.role.name,
      priority: mr.role.priority,
    }))

  // 워크스페이스 내 Admin 여부 (Owner 또는 Admin 역할)
  // 주의: 이것은 "시스템 Admin"이 아닌 "워크스페이스 Admin"
  // TierBoundary는 여전히 적용됨
  const isWorkspaceAdmin = roles.some((r) => r.name === "Owner" || r.name === "Admin")

  // 워크스페이스의 현재 구독 tier 조회
  let tier: SubscriptionTier = "trial"
  if (workspaceId) {
    tier = await getWorkspaceTier(workspaceId)
  }

  // 유효 권한 계산 (TierBoundary 적용)
  // 워크스페이스 Owner/Admin도 구독 등급에 따른 제한을 받음
  const permissions = await calculateEffectivePermissions(memberId, tier)

  return { roles, isAdmin: isWorkspaceAdmin, permissions, tier }
}

/**
 * 멤버의 유효 권한 계산 (AWS IAM 스타일)
 *
 * 권한 평가 순서:
 * 1. 멤버의 Role 정책에서 Allow/Deny 수집
 * 2. 멤버 직접 할당 정책에서 Allow/Deny 수집
 * 3. Deny 우선 적용 (Allow - Deny)
 * 4. TierBoundary와 교집합 (구독 등급 제한)
 *
 * @param memberId - workspace_members.id
 * @param tier - 구독 등급 (TierBoundary 적용)
 * @returns 허용된 resource:action 쌍 배열
 */
async function calculateEffectivePermissions(
  memberId: string,
  tier: SubscriptionTier = "trial",
): Promise<Array<{ resource: string; action: string }>> {
  const allowSet = new Set<string>()
  const denySet = new Set<string>()

  // 1. 역할(Role)의 정책에서 statements 수집
  const memberRoles = await getMemberRoles(memberId)
  for (const mr of memberRoles) {
    if (mr.role) {
      const rolePolicies = await getRolePolicies(mr.role.id)
      for (const rp of rolePolicies) {
        if (rp.policy?.isActive) {
          const statements = await getPolicyStatements(rp.policyId)
          processStatements(statements, allowSet, denySet)
        }
      }
    }
  }

  // 2. 멤버에 직접 할당된 정책(Inline Policy)에서 statements 수집
  const memberPolicies = await getMemberPolicies(memberId)
  for (const mp of memberPolicies) {
    if (mp.policy?.isActive) {
      const statements = await getPolicyStatements(mp.policyId)
      processStatements(statements, allowSet, denySet)
    }
  }

  // 3. TierBoundary 허용 범위 가져오기
  const tierAllowed = await getTierAllowedPermissions(tier)
  const hasWildcard = tierAllowed.has("*||*")

  // 4. 최종 권한 계산: (Allow - Deny) ∩ TierBoundary
  const permissions: Array<{ resource: string; action: string }> = []
  for (const key of allowSet) {
    if (!denySet.has(key)) {
      // 구분자 "||"로 resource와 action 분리
      const separatorIndex = key.indexOf(PERMISSION_SEPARATOR)
      if (separatorIndex > 0) {
        const resource = key.substring(0, separatorIndex)
        const action = key.substring(separatorIndex + PERMISSION_SEPARATOR.length)

        if (resource && action) {
          // TierBoundary 체크: 와일드카드이거나 명시적으로 허용된 경우만
          if (hasWildcard || tierAllowed.has(key)) {
            permissions.push({ resource, action })
          }
        }
      }
    }
  }

  return permissions
}

/**
 * 권한 키 구분자
 * 리소스 이름에 ":"가 포함될 수 있으므로 (예: "settings:profile", "ai:chatbot")
 * 구분자로 "||"를 사용
 */
const PERMISSION_SEPARATOR = "||"

/**
 * Policy Statements를 Allow/Deny Set으로 변환
 *
 * Action 계층 구조 적용:
 * - "*" → 모든 액션
 * - "manage" → list, read, create, update, delete
 * - "read" → list
 */
function processStatements(
  statements: IamPolicyStatement[],
  allowSet: Set<string>,
  denySet: Set<string>,
): void {
  for (const stmt of statements) {
    // 와일드카드 및 계층 구조 확장
    const expandedResources = expandResourcePatterns(stmt.resources)
    const expandedActions = expandActionPatterns(stmt.actions)

    for (const resource of expandedResources) {
      for (const action of expandedActions) {
        // "resource||action" 형식으로 키 생성
        const key = `${resource}${PERMISSION_SEPARATOR}${action}`
        if (stmt.effect === "deny") {
          denySet.add(key)
        } else {
          allowSet.add(key)
        }
      }
    }
  }
}

/**
 * 리소스 패턴 확장
 * - "*" → 모든 리소스
 * - "leads:*" → leads 및 leads 하위 리소스
 */
function expandResourcePatterns(patterns: string[]): string[] {
  const expanded = new Set<string>()

  for (const pattern of patterns) {
    if (pattern === "*") {
      // 모든 리소스 추가
      for (const r of ALL_RESOURCES) {
        expanded.add(r)
      }
    } else if (pattern.endsWith(":*")) {
      // 하위 리소스 확장 (예: "leads:*" → "leads", "leads:contacts", "leads:discovery")
      const prefix = pattern.slice(0, -2)
      expanded.add(prefix)
      for (const r of ALL_RESOURCES) {
        if (r.startsWith(`${prefix}:`)) {
          expanded.add(r)
        }
      }
    } else {
      expanded.add(pattern)
    }
  }

  return Array.from(expanded)
}

/**
 * 액션 패턴 확장 (계층 구조 적용)
 * - "*" → 모든 액션
 * - "manage" → list, read, create, update, delete
 * - "read" → list (읽기 권한 있으면 목록도 조회 가능)
 */
function expandActionPatterns(patterns: string[]): string[] {
  const expanded = new Set<string>()

  for (const pattern of patterns) {
    expanded.add(pattern)

    const includes = ACTION_HIERARCHY[pattern]
    if (includes) {
      for (const a of includes) {
        expanded.add(a)
      }
    }
  }

  return Array.from(expanded)
}

// 모든 리소스 목록 (와일드카드 확장용)
const ALL_RESOURCES = [
  "dashboard",
  "analytics",
  "leads",
  "leads:contacts",
  "leads:discovery",
  "leads:own",
  "customer-groups",
  "sequences",
  "sequences:steps",
  "sequences:own",
  "emails",
  "emails:own",
  "email-templates",
  "email-accounts",
  "bulk-email",
  "ai:chatbot",
  "ai:search",
  "settings",
  "settings:profile",
  "settings:workspace",
  "workspaces",
  "workspaces:members",
  "iam:policies",
  "iam:roles",
  "iam:members",
  "iam:audit",
  "billing",
  "billing:subscription",
  "billing:invoices",
]

// 액션 계층 구조 (상위 액션은 하위 액션을 포함)
const ACTION_HIERARCHY: Record<string, string[]> = {
  "*": [
    "manage",
    "list",
    "read",
    "create",
    "update",
    "delete",
    "execute",
    "send",
    "export",
    "import",
    "invite",
    "assign",
    "bulk:create",
    "bulk:update",
    "bulk:delete",
  ],
  manage: ["list", "read", "create", "update", "delete"],
  read: ["list"],
}

/**
 * TierBoundary 정책의 허용된 권한 Set 가져오기
 *
 * TierBoundary 정책은 구독 등급별 최대 권한 범위를 정의합니다.
 * Allow - Deny를 계산하여 최종 허용 범위를 반환합니다.
 *
 * @param tier - 구독 등급
 * @returns 허용된 resource||action 키 Set
 */
async function getTierAllowedPermissions(tier: SubscriptionTier): Promise<Set<string>> {
  const allowSet = new Set<string>()
  const denySet = new Set<string>()

  // TierBoundary에 연결된 정책 조회
  const tierBoundary = await getTierBoundary(tier)
  if (!tierBoundary?.policyId) {
    // TierBoundary가 없으면 모든 권한 허용 (하위 호환)
    return new Set(["*||*"])
  }

  // 정책의 statements 조회
  const statements = await getPolicyStatements(tierBoundary.policyId)

  // Allow/Deny statements 처리
  for (const stmt of statements) {
    const expandedResources = expandResourcePatterns(stmt.resources)
    const expandedActions = expandActionPatterns(stmt.actions)

    for (const resource of expandedResources) {
      for (const action of expandedActions) {
        const key = `${resource}${PERMISSION_SEPARATOR}${action}`
        if (stmt.effect === "deny") {
          denySet.add(key)
        } else {
          allowSet.add(key)
        }
      }
    }
  }

  // Deny 제거한 최종 Allow Set 반환
  for (const key of denySet) {
    allowSet.delete(key)
  }

  return allowSet
}
