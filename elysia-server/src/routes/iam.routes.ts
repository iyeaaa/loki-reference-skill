/**
 * IAM Routes
 *
 * IAM (Identity and Access Management) 관련 API 엔드포인트
 */

import { Elysia, t } from "elysia"
import type { SubscriptionTier } from "../db/schema/enums"
import { iamAuth } from "../plugins/iam-auth.plugin"
import * as iamService from "../services/iam.service"
import * as userService from "../services/user.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"

// Schema definitions
const policyEffectSchema = t.Union([t.Literal("allow"), t.Literal("deny")])

const subscriptionTierSchema = t.Union([
  t.Literal("trial"),
  t.Literal("basic"),
  t.Literal("pro"),
  t.Literal("enterprise"),
])

// ============================================================================
// Policies Routes
// ============================================================================

export const iamPoliciesRoutes = new Elysia({ prefix: "/api/v1/iam/policies" })
  // List policies
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        workspaceId: query.workspaceId,
        isManaged: query.isManaged ? query.isManaged === "true" : undefined,
        isActive: query.isActive ? query.isActive === "true" : undefined,
        search: query.search,
      }

      const data = await iamService.listPolicies(limit, offset, filters)
      const total = await iamService.countPolicies(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        isManaged: t.Optional(t.String()),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get policy by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const policy = await iamService.getPolicy(id)
      if (!policy) {
        set.status = 404
        return errorResponse("정책을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return policy
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create policy
  .post(
    "/",
    async ({ body }) => {
      const policy = await iamService.createPolicy({
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        isActive: body.isActive ?? true,
        createdBy: body.createdBy,
      })

      // Add statements if provided
      if (body.statements && body.statements.length > 0) {
        for (const stmt of body.statements) {
          await iamService.addPolicyStatement({
            policyId: policy.id,
            sid: stmt.sid,
            effect: stmt.effect,
            resources: stmt.resources,
            actions: stmt.actions,
            conditions: stmt.conditions || {},
            priority: stmt.priority || 0,
          })
        }
      }

      return policy
    },
    {
      body: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        name: t.String({ minLength: 1, maxLength: 100 }),
        description: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
        createdBy: t.Optional(t.String({ format: "uuid" })),
        statements: t.Optional(
          t.Array(
            t.Object({
              sid: t.Optional(t.String({ maxLength: 100 })),
              effect: policyEffectSchema,
              resources: t.Array(t.String()),
              actions: t.Array(t.String()),
              conditions: t.Optional(t.Object({})),
              priority: t.Optional(t.Number()),
            }),
          ),
        ),
      }),
    },
  )

  // Update policy
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const policy = await iamService.updatePolicy(id, {
        name: body.name,
        description: body.description,
        isActive: body.isActive,
      })
      if (!policy) {
        set.status = 404
        return errorResponse("정책을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return policy
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
        description: t.Optional(t.String()),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  // Delete policy
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await iamService.deletePolicy(id)
      return { success: true, message: "정책이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get policy statements
  .get(
    "/:id/statements",
    async ({ params: { id } }) => {
      const statements = await iamService.getPolicyStatements(id)
      return statements
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Add policy statement
  .post(
    "/:id/statements",
    async ({ params: { id }, body }) => {
      const statement = await iamService.addPolicyStatement({
        policyId: id,
        sid: body.sid,
        effect: body.effect,
        resources: body.resources,
        actions: body.actions,
        conditions: body.conditions || {},
        priority: body.priority || 0,
      })
      return statement
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        sid: t.Optional(t.String({ maxLength: 100 })),
        effect: policyEffectSchema,
        resources: t.Array(t.String()),
        actions: t.Array(t.String()),
        conditions: t.Optional(t.Object({})),
        priority: t.Optional(t.Number()),
      }),
    },
  )

  // Update policy statement
  .put(
    "/:id/statements/:statementId",
    async ({ params: { id, statementId }, body, set }) => {
      const statement = await iamService.updatePolicyStatement(id, statementId, {
        sid: body.sid,
        effect: body.effect,
        resources: body.resources,
        actions: body.actions,
        conditions: body.conditions,
        priority: body.priority,
      })
      if (!statement) {
        set.status = 404
        return errorResponse("명세를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return statement
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        statementId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        sid: t.Optional(t.String({ maxLength: 100 })),
        effect: t.Optional(policyEffectSchema),
        resources: t.Optional(t.Array(t.String())),
        actions: t.Optional(t.Array(t.String())),
        conditions: t.Optional(t.Object({})),
        priority: t.Optional(t.Number()),
      }),
    },
  )

  // Delete policy statement
  .delete(
    "/:id/statements/:statementId",
    async ({ params: { id, statementId } }) => {
      await iamService.deletePolicyStatement(id, statementId)
      return { success: true, message: "명세가 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        statementId: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Roles Routes
// ============================================================================

export const iamRolesRoutes = new Elysia({ prefix: "/api/v1/iam/roles" })
  // List roles
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        workspaceId: query.workspaceId,
        isSystem: query.isSystem ? query.isSystem === "true" : undefined,
        isDefault: query.isDefault ? query.isDefault === "true" : undefined,
        search: query.search,
      }

      const data = await iamService.listRoles(limit, offset, filters)
      const total = await iamService.countRoles(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        isSystem: t.Optional(t.String()),
        isDefault: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get role by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const role = await iamService.getRole(id)
      if (!role) {
        set.status = 404
        return errorResponse("역할을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return role
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create role
  .post(
    "/",
    async ({ body }) => {
      const role = await iamService.createRole({
        workspaceId: body.workspaceId,
        name: body.name,
        description: body.description,
        isDefault: body.isDefault ?? false,
        priority: body.priority || 0,
        createdBy: body.createdBy,
      })
      return role
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: "uuid" }),
        name: t.String({ minLength: 1, maxLength: 50 }),
        description: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
        priority: t.Optional(t.Number()),
        createdBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Update role
  .put(
    "/:id",
    async ({ params: { id }, body, set }) => {
      const role = await iamService.updateRole(id, {
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        priority: body.priority,
      })
      if (!role) {
        set.status = 404
        return errorResponse("역할을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return role
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 50 })),
        description: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
        priority: t.Optional(t.Number()),
      }),
    },
  )

  // Delete role
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await iamService.deleteRole(id)
      return { success: true, message: "역할이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get role policies
  .get(
    "/:id/policies",
    async ({ params: { id } }) => {
      const policies = await iamService.getRolePolicies(id)
      return policies
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Attach policy to role
  .post(
    "/:id/policies",
    async ({ params: { id }, body }) => {
      const rolePolicy = await iamService.attachPolicyToRole({
        roleId: id,
        policyId: body.policyId,
        attachedBy: body.attachedBy,
      })
      return rolePolicy
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        policyId: t.String({ format: "uuid" }),
        attachedBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Detach policy from role
  .delete(
    "/:id/policies/:policyId",
    async ({ params: { id, policyId } }) => {
      await iamService.detachPolicyFromRole(id, policyId)
      return { success: true, message: "정책이 역할에서 해제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
        policyId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get role members
  .get(
    "/:id/members",
    async ({ params: { id } }) => {
      const members = await iamService.getRoleMembers(id)
      return members
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Members Routes
// ============================================================================

export const iamMembersRoutes = new Elysia({ prefix: "/api/v1/iam/members" })
  // Get member roles
  .get(
    "/:memberId/roles",
    async ({ params: { memberId } }) => {
      const roles = await iamService.getMemberRoles(memberId)
      return roles
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Grant role to member
  .post(
    "/:memberId/roles",
    async ({ params: { memberId }, body }) => {
      const memberRole = await iamService.grantRoleToMember({
        memberId,
        roleId: body.roleId,
        grantedBy: body.grantedBy,
      })
      return memberRole
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        roleId: t.String({ format: "uuid" }),
        grantedBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Revoke role from member
  .delete(
    "/:memberId/roles/:roleId",
    async ({ params: { memberId, roleId } }) => {
      await iamService.revokeRoleFromMember(memberId, roleId)
      return { success: true, message: "역할이 멤버에서 해제되었습니다." }
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
        roleId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get member policies
  .get(
    "/:memberId/policies",
    async ({ params: { memberId } }) => {
      const policies = await iamService.getMemberPolicies(memberId)
      return policies
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
      }),
    },
  )

  // Attach policy to member
  .post(
    "/:memberId/policies",
    async ({ params: { memberId }, body }) => {
      const memberPolicy = await iamService.attachPolicyToMember({
        memberId,
        policyId: body.policyId,
        attachedBy: body.attachedBy,
      })
      return memberPolicy
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        policyId: t.String({ format: "uuid" }),
        attachedBy: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )

  // Detach policy from member
  .delete(
    "/:memberId/policies/:policyId",
    async ({ params: { memberId, policyId } }) => {
      await iamService.detachPolicyFromMember(memberId, policyId)
      return { success: true, message: "정책이 멤버에서 해제되었습니다." }
    },
    {
      params: t.Object({
        memberId: t.String({ format: "uuid" }),
        policyId: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Tier Boundaries Routes
// ============================================================================

export const iamTierBoundariesRoutes = new Elysia({ prefix: "/api/v1/iam/tier-boundaries" })
  // List tier boundaries
  .get(
    "/",
    async ({ query }) => {
      const tier = query.tier as "trial" | "basic" | "pro" | "enterprise" | undefined
      const boundaries = await iamService.listTierBoundaries(tier)
      return boundaries
    },
    {
      query: t.Object({
        tier: t.Optional(t.String()),
      }),
    },
  )

  // Get tier boundary by tier
  .get(
    "/:tier",
    async ({ params: { tier }, set }) => {
      const boundary = await iamService.getTierBoundary(tier as SubscriptionTier)
      if (!boundary) {
        set.status = 404
        return errorResponse("등급 권한 경계를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return boundary
    },
    {
      params: t.Object({
        tier: subscriptionTierSchema,
      }),
    },
  )

  // Update tier boundary
  .put(
    "/:tier",
    async ({ params: { tier }, body, set }) => {
      const boundary = await iamService.updateTierBoundary(tier as SubscriptionTier, body.policyId)
      if (!boundary) {
        set.status = 404
        return errorResponse("등급 권한 경계를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return boundary
    },
    {
      params: t.Object({
        tier: subscriptionTierSchema,
      }),
      body: t.Object({
        policyId: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// Audit Logs Routes
// ============================================================================

export const iamAuditLogsRoutes = new Elysia({ prefix: "/api/v1/iam/audit-logs" })
  // List audit logs
  .get(
    "/",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const filters = {
        workspaceId: query.workspaceId,
        userId: query.userId,
        action: query.action,
        targetType: query.targetType,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      }

      const data = await iamService.listAuditLogs(limit, offset, filters)
      const total = await iamService.countAuditLogs(filters)

      return { data, total, limit, offset }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        userId: t.Optional(t.String()),
        action: t.Optional(t.String()),
        targetType: t.Optional(t.String()),
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    },
  )

  // Get audit log by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const log = await iamService.getAuditLog(id)
      if (!log) {
        set.status = 404
        return errorResponse("감사 로그를 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }
      return log
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

// ============================================================================
// My Permissions Routes (현재 사용자의 권한 조회)
// ============================================================================

export const iamMyPermissionsRoutes = new Elysia({ prefix: "/api/v1/iam" })
  .use(iamAuth)

  // 현재 사용자의 워크스페이스 내 권한 조회
  .get(
    "/my-permissions",
    async ({ query, headers, set }) => {
      // Authorization 헤더에서 직접 userId 추출 (iamAuth가 workspaceId 없이도 동작하도록)
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const workspaceId = query.workspaceId

      // 1. 먼저 users 테이블에서 시스템 Admin 여부 확인
      const user = await userService.getUser(userId)
      const isSystemAdmin = user?.userRole === "admin" || user?.isSuperAdmin === true

      // 2. workspaceId가 없으면 시스템 Admin 여부만 반환
      if (!workspaceId) {
        return {
          memberId: null,
          roles: [],
          permissions: [],
          isAdmin: isSystemAdmin,
        }
      }

      // 3. 멤버 ID 조회
      const memberId = await iamService.getMemberIdByUserAndWorkspace(userId, workspaceId)

      if (!memberId) {
        // 워크스페이스 멤버가 아니어도 시스템 Admin이면 isAdmin: true
        return {
          memberId: null,
          roles: [],
          permissions: [],
          isAdmin: isSystemAdmin,
        }
      }

      // 4. 워크스페이스 내 권한 정보 조회 (TierBoundary 적용)
      const permissions = await iamService.getMemberPermissions(memberId, workspaceId)

      // 5. isAdmin은 오직 users.user_role === "admin"인 경우에만 true
      return {
        memberId,
        ...permissions,
        isAdmin: isSystemAdmin,
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String()),
      }),
    },
  )

  // 권한 체크 엔드포인트
  .post(
    "/check-permission",
    async ({ body, headers, set }) => {
      const userId = await getUserIdFromToken(headers.authorization)

      if (!userId) {
        set.status = 401
        return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
      }

      const { workspaceId, resource, action } = body

      if (!workspaceId) {
        return { hasPermission: false }
      }

      const memberId = await iamService.getMemberIdByUserAndWorkspace(userId, workspaceId)

      if (!memberId) {
        return { hasPermission: false }
      }

      const hasPermission = await iamService.checkPermission(memberId, resource, action)

      return { hasPermission }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
        resource: t.String(),
        action: t.String(),
      }),
    },
  )
