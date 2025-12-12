/**
 * Activity Logger Plugin (중앙 활동 로깅)
 *
 * 비즈니스 활동을 자동/수동으로 기록하는 플러그인
 * - 수정/생성/삭제 작업에 대한 로깅
 * - 요청 컨텍스트(IP, User-Agent)를 자동으로 추출
 *
 * Usage:
 * 1. Manual logging in services:
 *    await logActivity(workspaceId, userId, 'lead', leadId, 'created', { name: lead.name })
 *
 * 2. Auto logging via context:
 *    const { activityLog } = context
 *    await activityLog.log('lead', leadId, 'created', { name: lead.name })
 */

import { Elysia } from "elysia"
import { createLog } from "../services/activity-log.service"
import logger from "../utils/logger"

// ====================================
// TYPES
// ====================================

export type EntityType =
  | "lead"
  | "email"
  | "sequence"
  | "template"
  | "workspace"
  | "user"
  | "customer_group"
  | "email_account"
  | "onboarding"
  | "subscription"
  | "policy"
  | "role"
  | "email_signature"
  | "department"
  | "sales_strategy"
  | "workspace_member"
  | "workspace_product"

export type ActionType =
  | "created"
  | "updated"
  | "deleted"
  | "sent"
  | "viewed"
  | "enrolled"
  | "unenrolled"
  | "activated"
  | "deactivated"
  | "imported"
  | "exported"
  | "bulk_created"
  | "bulk_updated"
  | "bulk_deleted"

export interface ActivityLogContext {
  log: (
    entityType: EntityType,
    entityId: string,
    action: ActionType,
    details?: Record<string, unknown>,
  ) => Promise<void>
  logBulk: (
    entityType: EntityType,
    entityIds: string[],
    action: ActionType,
    details?: Record<string, unknown>,
  ) => Promise<void>
}

// ====================================
// UTILITY FUNCTIONS (Manual logging)
// ====================================

/**
 * 활동 로그 기록 (수동)
 * 서비스에서 직접 호출할 때 사용
 */
export async function logActivity(
  workspaceId: string,
  userId: string | null,
  entityType: EntityType,
  entityId: string,
  action: ActionType,
  details?: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  try {
    await createLog(workspaceId, entityType, entityId, action, {
      userId,
      details,
      ipAddress,
      userAgent,
    })
  } catch (error) {
    // 로그 기록 실패가 비즈니스 로직에 영향을 주지 않도록
    logger.error(
      { error, workspaceId, entityType, entityId, action },
      "Failed to create activity log",
    )
  }
}

/**
 * 벌크 활동 로그 기록
 * 여러 엔티티에 대한 작업을 한 번에 기록
 */
export async function logBulkActivity(
  workspaceId: string,
  userId: string | null,
  entityType: EntityType,
  entityIds: string[],
  action: ActionType,
  details?: Record<string, unknown>,
  ipAddress?: string | null,
  userAgent?: string | null,
): Promise<void> {
  // 벌크 작업은 하나의 로그로 기록 (첫 번째 ID 사용, 나머지는 details에)
  if (entityIds.length === 0) return

  const firstEntityId = entityIds[0]
  if (!firstEntityId) return

  try {
    await createLog(workspaceId, entityType, firstEntityId, action, {
      userId,
      details: {
        ...details,
        affectedCount: entityIds.length,
        affectedIds: entityIds,
      },
      ipAddress,
      userAgent,
    })
  } catch (error) {
    logger.error(
      { error, workspaceId, entityType, entityIds, action },
      "Failed to create bulk activity log",
    )
  }
}

// ====================================
// ELYSIA PLUGIN (Context-based logging)
// ====================================

/**
 * Activity Logger Plugin
 *
 * 요청 컨텍스트에서 workspaceId, userId, IP, User-Agent를 자동 추출
 * 핸들러에서 context.activityLog.log() 형태로 사용
 */
export const activityLogger = new Elysia({ name: "activity-logger" }).derive(
  (context: {
    request: Request
    headers: Record<string, string | undefined>
    permission?: { workspaceId?: string | null; userId?: string | null }
  }) => {
    const { headers, permission } = context
    // Extract IP address
    const forwarded = headers["x-forwarded-for"]
    let ipAddress: string | null = null
    if (typeof forwarded === "string") {
      const firstIp = forwarded.split(",")[0]
      ipAddress = firstIp ? firstIp.trim() : null
    }

    // Extract User-Agent
    const userAgent = headers["user-agent"] || null

    // Get workspaceId and userId from permission context (from permission-guard plugin)
    const workspaceId = permission?.workspaceId || null
    const userId = permission?.userId || null

    const activityLog: ActivityLogContext = {
      log: async (
        entityType: EntityType,
        entityId: string,
        action: ActionType,
        details?: Record<string, unknown>,
      ) => {
        if (!workspaceId) {
          logger.warn({ entityType, entityId, action }, "Activity log skipped: no workspaceId")
          return
        }

        await logActivity(
          workspaceId,
          userId,
          entityType,
          entityId,
          action,
          details,
          ipAddress,
          userAgent,
        )
      },

      logBulk: async (
        entityType: EntityType,
        entityIds: string[],
        action: ActionType,
        details?: Record<string, unknown>,
      ) => {
        if (!workspaceId) {
          logger.warn(
            { entityType, entityIds, action },
            "Bulk activity log skipped: no workspaceId",
          )
          return
        }

        await logBulkActivity(
          workspaceId,
          userId,
          entityType,
          entityIds,
          action,
          details,
          ipAddress,
          userAgent,
        )
      },
    }

    return { activityLog }
  },
)

// ====================================
// ROUTE PATTERNS FOR AUTO-LOGGING
// ====================================

/**
 * 자동 로깅이 필요한 라우트 패턴 정의
 * onAfterHandle에서 자동으로 로그 기록
 */
export const AUTO_LOG_ROUTES: Record<
  string,
  {
    entityType: EntityType
    action: ActionType
    getEntityId: (response: unknown, params?: Record<string, string>) => string | null
  }
> = {
  // ====================================
  // Leads
  // ====================================
  "POST /api/v1/leads": {
    entityType: "lead",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/leads/:id": {
    entityType: "lead",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/leads/:id": {
    entityType: "lead",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Sequences
  // ====================================
  "POST /api/v1/sequences": {
    entityType: "sequence",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/sequences/:id": {
    entityType: "sequence",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/sequences/:id": {
    entityType: "sequence",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Email Templates
  // ====================================
  "POST /api/v1/email-templates": {
    entityType: "template",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/email-templates/:id": {
    entityType: "template",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/email-templates/:id": {
    entityType: "template",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Customer Groups
  // ====================================
  "POST /api/v1/customer-groups": {
    entityType: "customer_group",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/customer-groups/:id": {
    entityType: "customer_group",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/customer-groups/:id": {
    entityType: "customer_group",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Emails
  // ====================================
  "POST /api/v1/emails": {
    entityType: "email",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "POST /api/v1/emails/send": {
    entityType: "email",
    action: "sent",
    getEntityId: (res: unknown) => (res as { email?: { id?: string } })?.email?.id || null,
  },
  "DELETE /api/v1/emails/:id": {
    entityType: "email",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Email Accounts
  // ====================================
  "POST /api/v1/email-accounts": {
    entityType: "email_account",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/email-accounts/:id": {
    entityType: "email_account",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/email-accounts/:id": {
    entityType: "email_account",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Users
  // ====================================
  "POST /api/v1/users": {
    entityType: "user",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/users/:id": {
    entityType: "user",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/users/:id": {
    entityType: "user",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Workspaces
  // ====================================
  "POST /api/v1/workspaces": {
    entityType: "workspace",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/workspaces/:id": {
    entityType: "workspace",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/workspaces/:id": {
    entityType: "workspace",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // Workspace Members
  "POST /api/v1/workspaces/:id/members": {
    entityType: "workspace_member",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/workspaces/:id/members/:id": {
    entityType: "workspace_member",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // Workspace Products
  "POST /api/v1/admin/workspaces/:id/products": {
    entityType: "workspace_product",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/admin/workspaces/:id/products/:id": {
    entityType: "workspace_product",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/admin/workspaces/:id/products/:id": {
    entityType: "workspace_product",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // IAM - Policies
  // ====================================
  "POST /api/v1/iam/policies": {
    entityType: "policy",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/iam/policies/:id": {
    entityType: "policy",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/iam/policies/:id": {
    entityType: "policy",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // IAM - Roles
  // ====================================
  "POST /api/v1/iam/roles": {
    entityType: "role",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/iam/roles/:id": {
    entityType: "role",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/iam/roles/:id": {
    entityType: "role",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Email Signatures
  // ====================================
  "POST /api/v1/email-signatures": {
    entityType: "email_signature",
    action: "created",
    getEntityId: (res: unknown) => (res as { data?: { id?: string } })?.data?.id || null,
  },
  "PUT /api/v1/email-signatures/:id": {
    entityType: "email_signature",
    action: "updated",
    getEntityId: (res: unknown) => (res as { data?: { id?: string } })?.data?.id || null,
  },
  "DELETE /api/v1/email-signatures/:id": {
    entityType: "email_signature",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Departments
  // ====================================
  "POST /api/v1/departments": {
    entityType: "department",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/departments/:id": {
    entityType: "department",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/departments/:id": {
    entityType: "department",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },

  // ====================================
  // Sales Strategies
  // ====================================
  "POST /api/v1/sales-strategies": {
    entityType: "sales_strategy",
    action: "created",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "PUT /api/v1/sales-strategies/:id": {
    entityType: "sales_strategy",
    action: "updated",
    getEntityId: (res: unknown) => (res as { id?: string })?.id || null,
  },
  "DELETE /api/v1/sales-strategies/:id": {
    entityType: "sales_strategy",
    action: "deleted",
    getEntityId: (_: unknown, params?: Record<string, string>) => params?.id || null,
  },
}

/**
 * 라우트 정규화 (UUID를 :id로 변환)
 */
function normalizeRoute(method: string, path: string): string {
  const normalized = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/\d+/g, "/:id")

  return `${method} ${normalized}`
}

/**
 * Auto Activity Logger Plugin
 *
 * 성공적인 CUD 작업 후 자동으로 활동 로그 기록
 * permissionGuard 및 activityLogger 플러그인 후에 사용
 */
export const autoActivityLogger = new Elysia({ name: "auto-activity-logger" }).onAfterHandle(
  async (context: {
    request: Request
    response: unknown
    activityLog?: ActivityLogContext
    params?: Record<string, string>
  }) => {
    const { request, response, activityLog, params } = context
    // Skip if no activityLog context
    if (!activityLog || typeof activityLog.log !== "function") return

    const method = request.method
    const url = new URL(request.url)
    const routeKey = normalizeRoute(method, url.pathname)

    const config = AUTO_LOG_ROUTES[routeKey]
    if (!config) return

    // GET 요청은 로깅하지 않음
    if (method === "GET") return

    try {
      const entityId = config.getEntityId(response, params)
      if (entityId) {
        await activityLog.log(config.entityType, entityId, config.action)
      }
    } catch (error) {
      logger.error({ error, routeKey }, "Auto activity logging failed")
    }
  },
)
