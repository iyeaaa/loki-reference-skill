// IAM (Identity and Access Management) API Types

// ============================================================================
// Enums
// ============================================================================

export type PolicyEffect = "allow" | "deny"
export type SubscriptionTier = "trial" | "basic" | "pro" | "enterprise"

// ============================================================================
// Entities
// ============================================================================

export type IamPolicy = {
  id: string
  workspaceId: string | null
  name: string
  description: string | null
  version: number
  isManaged: boolean
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  // Relations (enhanced)
  workspace?: {
    id: string
    name: string
  } | null
  creator?: {
    id: string
    username: string
  } | null
  statements?: IamPolicyStatement[]
  statementsCount?: number
}

export type IamPolicyStatement = {
  id: string
  policyId: string
  sid: string | null
  effect: PolicyEffect
  resources: string[]
  actions: string[]
  conditions: Record<string, unknown>
  priority: number
  createdAt: string
}

export type IamWorkspaceRole = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  isDefault: boolean
  isSystem: boolean
  priority: number
  createdBy: string | null
  createdAt: string
  updatedAt: string
  // Relations (enhanced)
  workspace?: {
    id: string
    name: string
  } | null
  creator?: {
    id: string
    username: string
  } | null
  policiesCount?: number
  membersCount?: number
}

export type IamRolePolicy = {
  id: string
  roleId: string
  policyId: string
  attachedBy: string | null
  attachedAt: string
  // Relations
  role?: IamWorkspaceRole
  policy?: IamPolicy
}

export type IamMemberRole = {
  id: string
  memberId: string
  roleId: string
  grantedBy: string | null
  grantedAt: string
  // Relations
  role?: IamWorkspaceRole
  member?: {
    id: string
    user: {
      id: string
      username: string
      email: string
    }
  }
}

export type IamMemberPolicy = {
  id: string
  memberId: string
  policyId: string
  attachedBy: string | null
  attachedAt: string
  // Relations
  policy?: IamPolicy
}

export type IamTierBoundary = {
  id: string
  tier: SubscriptionTier
  policyId: string
  description: string | null
  createdAt: string
  updatedAt: string
  // Relations
  policy?: IamPolicy
}

export type IamAuditLog = {
  id: string
  workspaceId: string | null
  userId: string | null
  action: string
  targetType: string
  targetId: string
  targetName: string | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  // Relations
  workspace?: {
    id: string
    name: string
  }
  user?: {
    id: string
    username: string
  }
}

// ============================================================================
// API Params
// ============================================================================

export type IamPoliciesParams = {
  page?: number
  limit?: number
  workspaceId?: string
  isManaged?: boolean
  isActive?: boolean
  search?: string
  filterForWorkspace?: boolean // true이면 워크스페이스에서 사용 가능한 정책만 반환
}

export type IamRolesParams = {
  page?: number
  limit?: number
  workspaceId?: string
  isSystem?: boolean
  isDefault?: boolean
  search?: string
}

export type IamAuditLogsParams = {
  page?: number
  limit?: number
  workspaceId?: string
  userId?: string
  action?: string
  targetType?: string
  startDate?: string
  endDate?: string
}

export type IamTierBoundariesParams = {
  tier?: SubscriptionTier
}

// ============================================================================
// API Requests
// ============================================================================

export type CreateIamPolicyRequest = {
  workspaceId?: string
  name: string
  description?: string
  isActive?: boolean
  statements?: CreatePolicyStatementRequest[]
}

export type UpdateIamPolicyRequest = {
  name?: string
  description?: string
  isActive?: boolean
}

export type CreatePolicyStatementRequest = {
  sid?: string
  effect: PolicyEffect
  resources: string[]
  actions: string[]
  conditions?: Record<string, unknown>
  priority?: number
}

export type UpdatePolicyStatementRequest = {
  sid?: string
  effect?: PolicyEffect
  resources?: string[]
  actions?: string[]
  conditions?: Record<string, unknown>
  priority?: number
}

export type CreateIamRoleRequest = {
  workspaceId: string
  name: string
  description?: string
  isDefault?: boolean
  priority?: number
}

export type UpdateIamRoleRequest = {
  name?: string
  description?: string
  isDefault?: boolean
  priority?: number
}

export type AttachPolicyToRoleRequest = {
  roleId: string
  policyId: string
}

export type GrantRoleToMemberRequest = {
  memberId: string
  roleId: string
}

export type AttachPolicyToMemberRequest = {
  memberId: string
  policyId: string
}

// ============================================================================
// API Responses
// ============================================================================

export type PaginatedResponse<T> = {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type IamPoliciesResponse = PaginatedResponse<IamPolicy>
export type IamRolesResponse = PaginatedResponse<IamWorkspaceRole>
export type IamAuditLogsResponse = PaginatedResponse<IamAuditLog>

// ============================================================================
// Display Helpers
// ============================================================================

export const POLICY_EFFECT_LABELS: Record<PolicyEffect, string> = {
  allow: "허용",
  deny: "거부",
}

export const POLICY_EFFECT_VARIANTS: Record<PolicyEffect, "success" | "error"> = {
  allow: "success",
  deny: "error",
}

export const IAM_AUDIT_ACTION_LABELS: Record<string, string> = {
  policy_created: "정책 생성",
  policy_updated: "정책 수정",
  policy_deleted: "정책 삭제",
  role_created: "역할 생성",
  role_updated: "역할 수정",
  role_deleted: "역할 삭제",
  role_policy_attached: "역할에 정책 연결",
  role_policy_detached: "역할에서 정책 해제",
  member_role_granted: "멤버에 역할 부여",
  member_role_revoked: "멤버에서 역할 해제",
  member_policy_attached: "멤버에 정책 연결",
  member_policy_detached: "멤버에서 정책 해제",
}

export const IAM_TARGET_TYPE_LABELS: Record<string, string> = {
  policy: "정책",
  role: "역할",
  member_role: "멤버 역할",
  member_policy: "멤버 정책",
  role_policy: "역할 정책",
}

// ============================================================================
// Common Resources & Actions
// ============================================================================

export const COMMON_RESOURCES = [
  { value: "*", label: "모든 리소스" },
  { value: "leads", label: "리드" },
  { value: "leads:*", label: "리드 (전체)" },
  { value: "sequences", label: "시퀀스" },
  { value: "sequences:*", label: "시퀀스 (전체)" },
  { value: "templates", label: "템플릿" },
  { value: "templates:*", label: "템플릿 (전체)" },
  { value: "email_accounts", label: "이메일 계정" },
  { value: "email_accounts:*", label: "이메일 계정 (전체)" },
  { value: "workspaces", label: "워크스페이스" },
  { value: "workspaces:settings", label: "워크스페이스 설정" },
  { value: "workspaces:members", label: "워크스페이스 멤버" },
  { value: "billing", label: "결제" },
  { value: "billing:*", label: "결제 (전체)" },
]

export const COMMON_ACTIONS = [
  { value: "*", label: "모든 액션" },
  { value: "create", label: "생성" },
  { value: "read", label: "조회" },
  { value: "update", label: "수정" },
  { value: "delete", label: "삭제" },
  { value: "list", label: "목록 조회" },
  { value: "export", label: "내보내기" },
  { value: "import", label: "가져오기" },
  { value: "execute", label: "실행" },
  { value: "pause", label: "일시정지" },
  { value: "resume", label: "재개" },
]
