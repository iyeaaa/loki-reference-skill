/**
 * Permission Guard Plugin (중앙 권한 관리)
 *
 * 2025 베스트 프랙티스: Fail-Closed 하이브리드 방식
 * - 기본적으로 모든 요청 거부
 * - 명시적으로 허용된 라우트만 접근 가능
 * - 공개 라우트는 @public 데코레이터로 표시
 *
 * References:
 * - NCC Group: Code Patterns for API Authorization
 * - Permit.io: API Authorization Best Practices
 */

import { Elysia } from "elysia"
import {
  IAM_ACTIONS,
  IAM_RESOURCES,
  type IamAction,
  type IamResource,
} from "../constants/iam-resources"
import * as iamService from "../services/iam.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import { getUserIdFromToken } from "../utils/auth.util"
import logger from "../utils/logger"

// 공개 라우트 목록 (인증 불필요)
const PUBLIC_ROUTES = new Set([
  // Health checks
  "GET /health",
  "GET /health/ready",
  "GET /health/live",
  "GET /api/health",
  // Auth
  "POST /api/v1/auth/login",
  "POST /api/v1/auth/register",
  "POST /api/v1/auth/refresh",
  "POST /api/v1/auth/google",
  "GET /api/v1/auth/google/callback",
  // Webhooks (외부 서비스 콜백)
  "POST /api/v1/webhooks/sendgrid",
  "POST /api/v1/webhooks/nylas",
  "POST /api/v1/webhooks/stripe",
  "POST /api/v1/nylas/webhooks", // Nylas webhook (실제 경로)
  "POST /api/webhook/inbound",
  "POST /api/webhook/inbound-store",
  "POST /api/webhook/sendgrid-events",
  // Swagger
  "GET /swagger",
  "GET /swagger/json",
  // Root
  "GET /",
])

// 인증만 필요한 라우트 (권한 체크 불필요)
const AUTH_ONLY_ROUTES = new Set([
  // 사용자 본인 정보
  "GET /api/v1/users/me",
  "PUT /api/v1/users/me",
  // 워크스페이스 목록 (본인이 속한)
  "GET /api/v1/workspaces",
  "POST /api/v1/workspaces",
  // 본인 권한 조회
  "GET /api/v1/iam/my-permissions",
  "POST /api/v1/iam/check-permission",
  // 활동 로그 (Admin 전용 - 추후 권한 체크 추가 가능)
  "GET /api/v1/activity-logs",
  "GET /api/v1/activity-logs/search",
  "GET /api/v1/activity-logs/recent",
  "GET /api/v1/activity-logs/:id",
  "GET /api/v1/activity-logs/entity/:entityType/:entityId",
  "GET /api/v1/activity-logs/user/:userId",
  // 계정 삭제 (본인만)
  "GET /api/v1/auth/account/deletion-check",
  "DELETE /api/v1/auth/account",
])

// 라우트별 권한 매핑 (Resource:Action)
const ROUTE_PERMISSIONS: Record<string, { resource: IamResource; action: IamAction }> = {
  // ==================== LEADS ====================
  "GET /api/v1/leads": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },
  "GET /api/v1/leads/search": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },
  "GET /api/v1/leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.READ },
  "POST /api/v1/leads": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.CREATE },
  "POST /api/v1/leads/bulk": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.BULK_CREATE },
  "PUT /api/v1/leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.UPDATE },
  "DELETE /api/v1/leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.DELETE },
  "GET /api/v1/leads/workspace/:workspaceId": {
    resource: IAM_RESOURCES.LEADS,
    action: IAM_ACTIONS.LIST,
  },
  // Admin leads
  "PUT /api/v1/admin/leads/bulk/status": {
    resource: IAM_RESOURCES.LEADS,
    action: IAM_ACTIONS.BULK_UPDATE,
  },
  "DELETE /api/v1/admin/leads/bulk": {
    resource: IAM_RESOURCES.LEADS,
    action: IAM_ACTIONS.BULK_DELETE,
  },
  "GET /api/v1/admin/leads/download/csv": {
    resource: IAM_RESOURCES.LEADS,
    action: IAM_ACTIONS.EXPORT,
  },

  // ==================== CUSTOMER GROUPS ====================
  "GET /api/v1/customer-groups": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.LIST,
  },
  "GET /api/v1/customer-groups/:id": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/customer-groups": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.CREATE,
  },
  "PUT /api/v1/customer-groups/:id": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /api/v1/customer-groups/:id": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.DELETE,
  },

  // ==================== SEQUENCES ====================
  "GET /api/v1/sequences": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },
  "GET /api/v1/sequences/search": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },
  "GET /api/v1/sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.READ },
  "POST /api/v1/sequences": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.CREATE },
  "PUT /api/v1/sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.UPDATE },
  "DELETE /api/v1/sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.DELETE },
  "POST /api/v1/sequences/:id/generate": {
    resource: IAM_RESOURCES.SEQUENCES,
    action: IAM_ACTIONS.EXECUTE,
  },
  "POST /api/v1/sequences/:id/activate-step-based": {
    resource: IAM_RESOURCES.SEQUENCES,
    action: IAM_ACTIONS.EXECUTE,
  },
  "GET /api/v1/sequences/:id/steps": {
    resource: IAM_RESOURCES.SEQUENCES_STEPS,
    action: IAM_ACTIONS.LIST,
  },
  "POST /api/v1/sequences/:id/steps": {
    resource: IAM_RESOURCES.SEQUENCES_STEPS,
    action: IAM_ACTIONS.CREATE,
  },
  "PUT /api/v1/sequences/:id/steps/:stepId": {
    resource: IAM_RESOURCES.SEQUENCES_STEPS,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /api/v1/sequences/:id/steps/:stepId": {
    resource: IAM_RESOURCES.SEQUENCES_STEPS,
    action: IAM_ACTIONS.DELETE,
  },

  // ==================== EMAILS ====================
  "GET /api/v1/emails": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.LIST },
  "GET /api/v1/emails/:id": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.READ },
  "POST /api/v1/emails/send": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.SEND },
  "POST /api/v1/bulk-email/send": { resource: IAM_RESOURCES.BULK_EMAIL, action: IAM_ACTIONS.SEND },

  // ==================== EMAIL TEMPLATES ====================
  "GET /api/v1/email-templates": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.LIST,
  },
  "GET /api/v1/email-templates/:id": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/email-templates": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.CREATE,
  },
  "PUT /api/v1/email-templates/:id": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /api/v1/email-templates/:id": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.DELETE,
  },

  // ==================== EMAIL ACCOUNTS ====================
  "GET /api/v1/email-accounts": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.LIST,
  },
  "GET /api/v1/email-accounts/:id": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/email-accounts": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.CREATE,
  },
  "PUT /api/v1/email-accounts/:id": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /api/v1/email-accounts/:id": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.DELETE,
  },

  // ==================== WORKSPACES ====================
  "GET /api/v1/workspaces/:id": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.READ },
  "PUT /api/v1/workspaces/:id": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.UPDATE },
  "DELETE /api/v1/workspaces/:id": {
    resource: IAM_RESOURCES.WORKSPACES,
    action: IAM_ACTIONS.DELETE,
  },
  "GET /api/v1/workspaces/:id/members": {
    resource: IAM_RESOURCES.WORKSPACES_MEMBERS,
    action: IAM_ACTIONS.LIST,
  },
  "POST /api/v1/workspaces/:id/members/invite": {
    resource: IAM_RESOURCES.WORKSPACES_MEMBERS,
    action: IAM_ACTIONS.INVITE,
  },

  // ==================== IAM (Admin Only) ====================
  "GET /api/v1/iam/policies": { resource: IAM_RESOURCES.IAM_POLICIES, action: IAM_ACTIONS.LIST },
  "GET /api/v1/iam/policies/:id": {
    resource: IAM_RESOURCES.IAM_POLICIES,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/iam/policies": { resource: IAM_RESOURCES.IAM_POLICIES, action: IAM_ACTIONS.CREATE },
  "PUT /api/v1/iam/policies/:id": {
    resource: IAM_RESOURCES.IAM_POLICIES,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /api/v1/iam/policies/:id": {
    resource: IAM_RESOURCES.IAM_POLICIES,
    action: IAM_ACTIONS.DELETE,
  },
  "GET /api/v1/iam/roles": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.LIST },
  "GET /api/v1/iam/roles/:id": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.READ },
  "POST /api/v1/iam/roles": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.CREATE },
  "PUT /api/v1/iam/roles/:id": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.UPDATE },
  "DELETE /api/v1/iam/roles/:id": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.DELETE },
  "GET /api/v1/iam/members/:memberId/roles": {
    resource: IAM_RESOURCES.IAM_MEMBERS,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/iam/members/:memberId/roles": {
    resource: IAM_RESOURCES.IAM_MEMBERS,
    action: IAM_ACTIONS.ASSIGN,
  },
  "GET /api/v1/iam/audit-logs": { resource: IAM_RESOURCES.IAM_AUDIT, action: IAM_ACTIONS.LIST },

  // ==================== BILLING ====================
  "GET /api/v1/billing": { resource: IAM_RESOURCES.BILLING, action: IAM_ACTIONS.READ },
  "GET /api/v1/billing/subscription": {
    resource: IAM_RESOURCES.BILLING_SUBSCRIPTION,
    action: IAM_ACTIONS.READ,
  },
  "POST /api/v1/billing/subscribe": {
    resource: IAM_RESOURCES.BILLING_SUBSCRIPTION,
    action: IAM_ACTIONS.CREATE,
  },
  "GET /api/v1/billing/invoices": {
    resource: IAM_RESOURCES.BILLING_INVOICES,
    action: IAM_ACTIONS.LIST,
  },

  // ==================== AI ====================
  "POST /api/v1/ai/chatbot": { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },
  "POST /api/v1/chatbot/query": { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },

  // ==================== ANALYTICS ====================
  "GET /api/v1/dashboard": {
    resource: IAM_RESOURCES.ANALYTICS,
    action: IAM_ACTIONS.READ,
  },
}

/**
 * 라우트 패턴 매칭
 * /api/v1/leads/123 -> /api/v1/leads/:id
 */
function normalizeRoutePath(method: string, path: string): string {
  // UUID 패턴을 :id로 변환
  const normalizedPath = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    // 숫자만 있는 경로도 :id로 변환
    .replace(/\/\d+/g, "/:id")
    // stepId, enrollmentId 등 특수 파라미터 처리
    .replace(/\/:id\/:id/g, "/:id/:stepId")

  return `${method} ${normalizedPath}`
}

/**
 * 워크스페이스 ID 추출
 */
function extractWorkspaceId(
  params: Record<string, string>,
  body: unknown,
  query: Record<string, string>,
): string | null {
  // 1. URL 파라미터에서
  if (params?.workspaceId) return params.workspaceId
  if (params?.id && !params?.stepId && !params?.enrollmentId) {
    // /workspaces/:id 패턴인 경우
    return params.id
  }

  // 2. Body에서 (body가 null이 아닐 때만)
  if (body && typeof body === "object" && "workspaceId" in body) {
    return (body as { workspaceId: string }).workspaceId
  }

  // 3. Query에서
  if (query?.workspaceId) return query.workspaceId

  return null
}

export interface PermissionContext {
  userId: string | null
  memberId: string | null
  workspaceId: string | null
  isAuthenticated: boolean
  isAdmin: boolean
}

/**
 * 중앙 권한 관리 플러그인
 *
 * 모든 요청에 대해:
 * 1. 공개 라우트 체크
 * 2. 인증 체크
 * 3. 워크스페이스 멤버십 체크
 * 4. 권한 체크 (ROUTE_PERMISSIONS 기반)
 */
export const permissionGuard = new Elysia({ name: "permission-guard" })
  .derive(
    async ({ request, headers, params, query }): Promise<{ permission: PermissionContext }> => {
      const method = request.method
      const url = new URL(request.url)
      const path = url.pathname
      const routeKey = normalizeRoutePath(method, path)

      // 1. 공개 라우트 체크 (body 파싱 전에 먼저 체크!)
      if (PUBLIC_ROUTES.has(routeKey) || PUBLIC_ROUTES.has(`${method} ${path}`)) {
        return {
          permission: {
            userId: null,
            memberId: null,
            workspaceId: null,
            isAuthenticated: false,
            isAdmin: false,
          },
        }
      }

      // 2. 토큰에서 userId 추출
      const authorization = headers.authorization
      const userId = await getUserIdFromToken(authorization)

      if (!userId) {
        return {
          permission: {
            userId: null,
            memberId: null,
            workspaceId: null,
            isAuthenticated: false,
            isAdmin: false,
          },
        }
      }

      // 3. 워크스페이스 ID 추출 (body는 request에서 직접 읽지 않음)
      const workspaceId = extractWorkspaceId(
        params as Record<string, string>,
        null, // body를 null로 전달하여 파싱 방지
        query as Record<string, string>,
      )

      // 4. 멤버 ID 조회
      let memberId: string | null = null
      let isAdmin = false

      if (workspaceId) {
        memberId = await iamService.getMemberIdByUserAndWorkspace(userId, workspaceId)
        if (memberId) {
          isAdmin = await iamService.isMemberAdmin(memberId)
        }
      }

      return {
        permission: {
          userId,
          memberId,
          workspaceId,
          isAuthenticated: true,
          isAdmin,
        },
      }
    },
  )
  .onBeforeHandle(async ({ request, permission, set }) => {
    const method = request.method
    const url = new URL(request.url)
    const path = url.pathname
    const routeKey = normalizeRoutePath(method, path)

    // OPTIONS 요청은 통과
    if (method === "OPTIONS") return

    // 공개 라우트는 통과
    if (PUBLIC_ROUTES.has(routeKey) || PUBLIC_ROUTES.has(`${method} ${path}`)) {
      return
    }

    // 인증 체크
    if (!permission.isAuthenticated || !permission.userId) {
      logger.warn({ path, method }, "Unauthorized access attempt")
      set.status = 401
      return errorResponse("인증이 필요합니다.", ResponseCode.UNAUTHORIZED)
    }

    // 인증만 필요한 라우트는 통과
    if (AUTH_ONLY_ROUTES.has(routeKey) || AUTH_ONLY_ROUTES.has(`${method} ${path}`)) {
      return
    }

    // 권한 매핑 조회
    const requiredPermission = ROUTE_PERMISSIONS[routeKey]

    if (!requiredPermission) {
      // 매핑되지 않은 라우트는 기본적으로 인증된 사용자에게 허용
      // (점진적 마이그레이션을 위해)
      // 프로덕션에서는 아래 주석 해제하여 fail-closed 적용
      // logger.warn({ path, method, routeKey }, "Unmapped route - access denied")
      // set.status = 403
      // return errorResponse("이 API에 대한 권한이 정의되지 않았습니다.", ResponseCode.FORBIDDEN)
      logger.debug({ path, method, routeKey }, "Unmapped route - allowing authenticated user")
      return
    }

    // 워크스페이스가 필요한 라우트인데 워크스페이스가 없는 경우
    if (!permission.workspaceId) {
      // 일부 라우트는 워크스페이스 없이도 조회 가능 (예: 본인의 모든 리드 조회)
      // 이 경우는 서비스 레이어에서 필터링
      return
    }

    // 멤버십 체크
    if (!permission.memberId) {
      logger.warn(
        { userId: permission.userId, workspaceId: permission.workspaceId },
        "User is not a member of workspace",
      )
      set.status = 403
      return errorResponse("해당 워크스페이스에 접근 권한이 없습니다.", ResponseCode.FORBIDDEN)
    }

    // 권한 체크
    const { resource, action } = requiredPermission
    const hasPermission = await iamService.checkPermission(permission.memberId, resource, action)

    if (!hasPermission) {
      logger.warn(
        {
          userId: permission.userId,
          memberId: permission.memberId,
          resource,
          action,
          path,
        },
        "Permission denied",
      )
      set.status = 403
      return errorResponse(
        `이 작업을 수행할 권한이 없습니다. (${resource}:${action})`,
        ResponseCode.FORBIDDEN,
      )
    }

    // 감사 로그 (선택적)
    logger.debug(
      {
        userId: permission.userId,
        memberId: permission.memberId,
        resource,
        action,
        path,
      },
      "Permission granted",
    )
  })

/**
 * 특정 리소스/액션에 대한 권한 체크 헬퍼
 * 라우트 핸들러 내에서 추가 권한 체크가 필요한 경우 사용
 */
export async function checkResourcePermission(
  memberId: string | null,
  resource: IamResource,
  action: IamAction,
): Promise<boolean> {
  if (!memberId) return false
  return iamService.checkPermission(memberId, resource, action)
}

/**
 * Tier Boundary 체크 (구독 등급별 제한)
 * TODO: checkPermission에 통합 필요
 */
export async function checkTierBoundary(
  _workspaceId: string,
  _resource: IamResource,
  _action: IamAction,
): Promise<{ allowed: boolean; reason?: string }> {
  // 워크스페이스의 구독 등급 조회
  // const workspace = await workspaceService.getWorkspace(_workspaceId)
  // const tierBoundary = await iamService.getTierBoundary(workspace.subscriptionTier)
  // ... 구현 필요

  return { allowed: true }
}
