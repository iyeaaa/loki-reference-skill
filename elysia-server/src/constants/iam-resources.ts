/**
 * IAM Resources and Actions Constants
 *
 * AWS IAM 스타일의 리소스/액션 정의
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │                    AWS IAM 표준 권한 모델                                │
 * ├─────────────────────────────────────────────────────────────────────────┤
 * │                                                                         │
 * │  Resource 명명 규칙:                                                    │
 * │  - 단일 리소스: "leads", "sequences", "emails"                         │
 * │  - 하위 리소스: "leads:contacts", "settings:workspace"                 │
 * │  - 와일드카드: "*" (모든 리소스), "leads:*" (leads 하위 전체)           │
 * │                                                                         │
 * │  Action 명명 규칙:                                                      │
 * │  - 기본 CRUD: list, read, create, update, delete                       │
 * │  - 특수 액션: execute, send, export, import                            │
 * │  - 관리 액션: manage (전체 권한), invite (멤버 초대)                    │
 * │  - 와일드카드: "*" (모든 액션)                                          │
 * │                                                                         │
 * │  Action 계층 구조:                                                      │
 * │  - "*" → 모든 액션 포함                                                 │
 * │  - "manage" → list, read, create, update, delete 포함                  │
 * │  - "read" → list 포함 (읽기 권한이 있으면 목록도 조회 가능)             │
 * │                                                                         │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies.html
 */

// ============================================================================
// Resources - 리소스 정의
// ============================================================================

export const IAM_RESOURCES = {
  // ─────────────────────────────────────────────────────────────────────────
  // Dashboard & Analytics (메뉴: 홈, 분석)
  // ─────────────────────────────────────────────────────────────────────────
  /** 홈 대시보드 */
  DASHBOARD: "dashboard",
  /** 분석 대시보드 */
  ANALYTICS: "analytics",

  // ─────────────────────────────────────────────────────────────────────────
  // Leads & Customers (메뉴: 고객탐색, 고객관리)
  // ─────────────────────────────────────────────────────────────────────────
  /** 리드/고객 */
  LEADS: "leads",
  /** 리드 연락처 (하위 리소스) */
  LEADS_CONTACTS: "leads:contacts",
  /** 고객 탐색 (AI 기반 검색) */
  LEADS_DISCOVERY: "leads:discovery",
  /** 고객 그룹 */
  CUSTOMER_GROUPS: "customer-groups",

  // ─────────────────────────────────────────────────────────────────────────
  // Campaigns (메뉴: 캠페인)
  // ─────────────────────────────────────────────────────────────────────────
  /** 시퀀스/캠페인 */
  SEQUENCES: "sequences",
  /** 시퀀스 스텝 (하위 리소스) */
  SEQUENCES_STEPS: "sequences:steps",

  // ─────────────────────────────────────────────────────────────────────────
  // Email (메뉴: 인박스, 이메일 설정)
  // ─────────────────────────────────────────────────────────────────────────
  /** 이메일 (인박스/답장) */
  EMAILS: "emails",
  /** 이메일 템플릿 */
  EMAIL_TEMPLATES: "email-templates",
  /** 이메일 계정 */
  EMAIL_ACCOUNTS: "email-accounts",
  /** 대량 이메일 */
  BULK_EMAIL: "bulk-email",

  // ─────────────────────────────────────────────────────────────────────────
  // AI Features (메뉴: Rinda GPT)
  // ─────────────────────────────────────────────────────────────────────────
  /** AI 챗봇 (Rinda GPT) */
  AI_CHATBOT: "ai:chatbot",
  /** AI 검색 */
  AI_SEARCH: "ai:search",

  // ─────────────────────────────────────────────────────────────────────────
  // Visitor Analytics (메뉴: 설정 > 웹사이트 방문자)
  // ─────────────────────────────────────────────────────────────────────────
  /** 방문자 분석 */
  VISITORS: "visitors",

  // ─────────────────────────────────────────────────────────────────────────
  // Settings & Workspace (메뉴: 설정)
  // ─────────────────────────────────────────────────────────────────────────
  /** 설정 전체 */
  SETTINGS: "settings",
  /** 개인 프로필 설정 */
  SETTINGS_PROFILE: "settings:profile",
  /** 워크스페이스 설정 */
  SETTINGS_WORKSPACE: "settings:workspace",
  /** 워크스페이스 */
  WORKSPACES: "workspaces",
  /** 워크스페이스 멤버 */
  WORKSPACES_MEMBERS: "workspaces:members",

  // ─────────────────────────────────────────────────────────────────────────
  // IAM (Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  /** IAM 정책 */
  IAM_POLICIES: "iam:policies",
  /** IAM 역할 */
  IAM_ROLES: "iam:roles",
  /** IAM 멤버 */
  IAM_MEMBERS: "iam:members",
  /** IAM 감사 로그 */
  IAM_AUDIT: "iam:audit",

  // ─────────────────────────────────────────────────────────────────────────
  // Billing (Owner/Admin Only)
  // ─────────────────────────────────────────────────────────────────────────
  /** 빌링 전체 */
  BILLING: "billing",
  /** 구독 관리 */
  BILLING_SUBSCRIPTION: "billing:subscription",
  /** 인보이스/결제 내역 */
  BILLING_INVOICES: "billing:invoices",

  // ─────────────────────────────────────────────────────────────────────────
  // Wildcard
  // ─────────────────────────────────────────────────────────────────────────
  /** 모든 리소스 (와일드카드) */
  ALL: "*",
} as const

export type IamResource = (typeof IAM_RESOURCES)[keyof typeof IAM_RESOURCES]

// ============================================================================
// Actions - 액션 정의
// ============================================================================

export const IAM_ACTIONS = {
  // ─────────────────────────────────────────────────────────────────────────
  // Standard CRUD
  // ─────────────────────────────────────────────────────────────────────────
  /** 목록 조회 */
  LIST: "list",
  /** 상세 조회 */
  READ: "read",
  /** 생성 */
  CREATE: "create",
  /** 수정 */
  UPDATE: "update",
  /** 삭제 */
  DELETE: "delete",

  // ─────────────────────────────────────────────────────────────────────────
  // Bulk Operations
  // ─────────────────────────────────────────────────────────────────────────
  /** 대량 생성 */
  BULK_CREATE: "bulk:create",
  /** 대량 수정 */
  BULK_UPDATE: "bulk:update",
  /** 대량 삭제 */
  BULK_DELETE: "bulk:delete",

  // ─────────────────────────────────────────────────────────────────────────
  // Special Actions
  // ─────────────────────────────────────────────────────────────────────────
  /** 이메일 발송 */
  SEND: "send",
  /** 시퀀스/AI 실행 */
  EXECUTE: "execute",
  /** 내보내기 */
  EXPORT: "export",
  /** 가져오기 */
  IMPORT: "import",

  // ─────────────────────────────────────────────────────────────────────────
  // Management Actions
  // ─────────────────────────────────────────────────────────────────────────
  /** 전체 관리 권한 (list, read, create, update, delete 포함) */
  MANAGE: "manage",
  /** 멤버 초대 */
  INVITE: "invite",
  /** 역할/권한 할당 */
  ASSIGN: "assign",

  // ─────────────────────────────────────────────────────────────────────────
  // Wildcard
  // ─────────────────────────────────────────────────────────────────────────
  /** 모든 액션 (와일드카드) */
  ALL: "*",
} as const

export type IamAction = (typeof IAM_ACTIONS)[keyof typeof IAM_ACTIONS]

// ============================================================================
// Action Hierarchy - 액션 계층 구조
// ============================================================================

/**
 * 액션 계층 구조
 * 상위 액션은 하위 액션을 포함합니다.
 *
 * @example
 * - "*" 권한이 있으면 모든 액션 가능
 * - "manage" 권한이 있으면 list, read, create, update, delete 가능
 * - "read" 권한이 있으면 list도 가능
 */
export const ACTION_HIERARCHY: Record<string, string[]> = {
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
 * 액션 계층 구조에 따라 액션을 확장합니다.
 * @param actions - 원본 액션 배열
 * @returns 확장된 액션 배열
 */
export function expandActions(actions: string[]): string[] {
  const expanded = new Set<string>()

  for (const action of actions) {
    expanded.add(action)

    const includes = ACTION_HIERARCHY[action]
    if (includes) {
      for (const a of includes) {
        expanded.add(a)
      }
    }
  }

  return Array.from(expanded)
}

// ============================================================================
// All Resources/Actions Lists - 와일드카드 확장용
// ============================================================================

/** 모든 리소스 목록 (와일드카드 확장용) */
export const ALL_RESOURCES: string[] = [
  "dashboard",
  "analytics",
  "leads",
  "leads:contacts",
  "leads:discovery",
  "customer-groups",
  "sequences",
  "sequences:steps",
  "emails",
  "email-templates",
  "email-accounts",
  "bulk-email",
  "ai:chatbot",
  "ai:search",
  "visitors",
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

/** 모든 액션 목록 (와일드카드 확장용) */
export const ALL_ACTIONS: string[] = [
  "list",
  "read",
  "create",
  "update",
  "delete",
  "bulk:create",
  "bulk:update",
  "bulk:delete",
  "send",
  "execute",
  "export",
  "import",
  "manage",
  "invite",
  "assign",
]

// ============================================================================
// Route Permission Mapping
// ============================================================================

/**
 * 라우트별 필요 권한 매핑
 * 각 API 엔드포인트가 어떤 resource:action 조합을 필요로 하는지 정의
 */
export const ROUTE_PERMISSIONS: Record<string, { resource: IamResource; action: IamAction }> = {
  // Leads
  "GET /leads": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.LIST },
  "GET /leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.READ },
  "POST /leads": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.CREATE },
  "PUT /leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.UPDATE },
  "DELETE /leads/:id": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.DELETE },
  "POST /leads/bulk": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.BULK_CREATE },
  "POST /leads/import": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.IMPORT },
  "GET /leads/export": { resource: IAM_RESOURCES.LEADS, action: IAM_ACTIONS.EXPORT },

  // Lead Discovery (LangGraph AI + Simple Enrichment)
  "GET /lead-discovery": { resource: IAM_RESOURCES.LEADS_DISCOVERY, action: IAM_ACTIONS.READ },
  "GET /lead-discovery/health": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.READ,
  },
  "POST /lead-discovery/search": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.EXECUTE,
  },
  "POST /lead-discovery/select": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.EXECUTE,
  },
  "POST /lead-discovery/score": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.EXECUTE,
  },
  "POST /lead-discovery/enrich": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.EXECUTE,
  },
  "GET /lead-discovery/session/:sessionId": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.READ,
  },
  "DELETE /lead-discovery/sessions": {
    resource: IAM_RESOURCES.LEADS_DISCOVERY,
    action: IAM_ACTIONS.DELETE,
  },

  // Customer Groups
  "GET /customer-groups": { resource: IAM_RESOURCES.CUSTOMER_GROUPS, action: IAM_ACTIONS.LIST },
  "GET /customer-groups/:id": { resource: IAM_RESOURCES.CUSTOMER_GROUPS, action: IAM_ACTIONS.READ },
  "POST /customer-groups": { resource: IAM_RESOURCES.CUSTOMER_GROUPS, action: IAM_ACTIONS.CREATE },
  "PUT /customer-groups/:id": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /customer-groups/:id": {
    resource: IAM_RESOURCES.CUSTOMER_GROUPS,
    action: IAM_ACTIONS.DELETE,
  },

  // Sequences
  "GET /sequences": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.LIST },
  "GET /sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.READ },
  "POST /sequences": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.CREATE },
  "PUT /sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.UPDATE },
  "DELETE /sequences/:id": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.DELETE },
  "POST /sequences/:id/execute": { resource: IAM_RESOURCES.SEQUENCES, action: IAM_ACTIONS.EXECUTE },

  // Emails
  "GET /emails": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.LIST },
  "GET /emails/:id": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.READ },
  "POST /emails/send": { resource: IAM_RESOURCES.EMAILS, action: IAM_ACTIONS.SEND },
  "POST /bulk-email/send": { resource: IAM_RESOURCES.BULK_EMAIL, action: IAM_ACTIONS.SEND },

  // Email Templates
  "GET /email-templates": { resource: IAM_RESOURCES.EMAIL_TEMPLATES, action: IAM_ACTIONS.LIST },
  "GET /email-templates/:id": { resource: IAM_RESOURCES.EMAIL_TEMPLATES, action: IAM_ACTIONS.READ },
  "POST /email-templates": { resource: IAM_RESOURCES.EMAIL_TEMPLATES, action: IAM_ACTIONS.CREATE },
  "PUT /email-templates/:id": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.UPDATE,
  },
  "DELETE /email-templates/:id": {
    resource: IAM_RESOURCES.EMAIL_TEMPLATES,
    action: IAM_ACTIONS.DELETE,
  },

  // Email Accounts
  "GET /email-accounts": { resource: IAM_RESOURCES.EMAIL_ACCOUNTS, action: IAM_ACTIONS.LIST },
  "POST /email-accounts": { resource: IAM_RESOURCES.EMAIL_ACCOUNTS, action: IAM_ACTIONS.CREATE },
  "PUT /email-accounts/:id": { resource: IAM_RESOURCES.EMAIL_ACCOUNTS, action: IAM_ACTIONS.UPDATE },
  "DELETE /email-accounts/:id": {
    resource: IAM_RESOURCES.EMAIL_ACCOUNTS,
    action: IAM_ACTIONS.DELETE,
  },

  // AI Chatbot
  "POST /ai/chatbot": { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.EXECUTE },
  "GET /ai/chatbot/history": { resource: IAM_RESOURCES.AI_CHATBOT, action: IAM_ACTIONS.READ },

  // Analytics
  "GET /analytics": { resource: IAM_RESOURCES.ANALYTICS, action: IAM_ACTIONS.READ },
  "GET /analytics/dashboard": { resource: IAM_RESOURCES.ANALYTICS, action: IAM_ACTIONS.READ },

  // Settings
  "GET /settings": { resource: IAM_RESOURCES.SETTINGS, action: IAM_ACTIONS.READ },
  "GET /settings/profile": { resource: IAM_RESOURCES.SETTINGS_PROFILE, action: IAM_ACTIONS.READ },
  "PUT /settings/profile": { resource: IAM_RESOURCES.SETTINGS_PROFILE, action: IAM_ACTIONS.UPDATE },
  "GET /settings/workspace": {
    resource: IAM_RESOURCES.SETTINGS_WORKSPACE,
    action: IAM_ACTIONS.READ,
  },
  "PUT /settings/workspace": {
    resource: IAM_RESOURCES.SETTINGS_WORKSPACE,
    action: IAM_ACTIONS.UPDATE,
  },

  // Workspaces
  "GET /workspaces": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.LIST },
  "POST /workspaces": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.CREATE },
  "GET /workspaces/:id": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.READ },
  "PUT /workspaces/:id": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.UPDATE },
  "DELETE /workspaces/:id": { resource: IAM_RESOURCES.WORKSPACES, action: IAM_ACTIONS.DELETE },
  "GET /workspaces/:id/members": {
    resource: IAM_RESOURCES.WORKSPACES_MEMBERS,
    action: IAM_ACTIONS.LIST,
  },
  "POST /workspaces/:id/members/invite": {
    resource: IAM_RESOURCES.WORKSPACES_MEMBERS,
    action: IAM_ACTIONS.INVITE,
  },
  "DELETE /workspaces/:id/members/:memberId": {
    resource: IAM_RESOURCES.WORKSPACES_MEMBERS,
    action: IAM_ACTIONS.DELETE,
  },

  // IAM
  "GET /iam/policies": { resource: IAM_RESOURCES.IAM_POLICIES, action: IAM_ACTIONS.LIST },
  "POST /iam/policies": { resource: IAM_RESOURCES.IAM_POLICIES, action: IAM_ACTIONS.CREATE },
  "GET /iam/roles": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.LIST },
  "POST /iam/roles": { resource: IAM_RESOURCES.IAM_ROLES, action: IAM_ACTIONS.CREATE },
  "GET /iam/audit-logs": { resource: IAM_RESOURCES.IAM_AUDIT, action: IAM_ACTIONS.READ },

  // Billing
  "GET /billing": { resource: IAM_RESOURCES.BILLING, action: IAM_ACTIONS.READ },
  "GET /billing/subscription": {
    resource: IAM_RESOURCES.BILLING_SUBSCRIPTION,
    action: IAM_ACTIONS.READ,
  },
  "POST /billing/subscribe": {
    resource: IAM_RESOURCES.BILLING_SUBSCRIPTION,
    action: IAM_ACTIONS.CREATE,
  },
  "DELETE /billing/subscription": {
    resource: IAM_RESOURCES.BILLING_SUBSCRIPTION,
    action: IAM_ACTIONS.DELETE,
  },
  "GET /billing/invoices": { resource: IAM_RESOURCES.BILLING_INVOICES, action: IAM_ACTIONS.LIST },
}

// ============================================================================
// Helper Types & Functions
// ============================================================================

export interface PermissionDefinition {
  resource: IamResource
  action: IamAction
}

/**
 * 권한 체크를 위한 헬퍼 함수
 */
export function createPermissionGuard(
  resource: IamResource,
  action: IamAction,
): PermissionDefinition {
  return { resource, action }
}

/**
 * 리소스 패턴 매칭
 * @param patterns - 정책에 정의된 리소스 패턴들 (예: ["*", "leads", "sequences:*"])
 * @param target - 체크할 리소스 (예: "leads", "sequences:steps")
 */
export function matchResource(patterns: string[], target: string): boolean {
  return patterns.some((pattern) => {
    if (pattern === "*") return true
    if (pattern === target) return true
    // "leads:*" 패턴은 "leads" 및 "leads:xxx" 모두 매칭
    if (pattern.endsWith(":*")) {
      const prefix = pattern.slice(0, -2)
      return target === prefix || target.startsWith(`${prefix}:`)
    }
    return false
  })
}

/**
 * 액션 패턴 매칭 (계층 구조 고려)
 * @param patterns - 정책에 정의된 액션들 (예: ["*", "read", "create"])
 * @param target - 체크할 액션 (예: "list", "delete")
 */
export function matchAction(patterns: string[], target: string): boolean {
  // 먼저 패턴을 계층 구조에 따라 확장
  const expandedPatterns = expandActions(patterns)
  return expandedPatterns.includes(target) || expandedPatterns.includes("*")
}
