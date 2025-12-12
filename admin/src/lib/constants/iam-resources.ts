/**
 * IAM Resources and Actions Constants (Frontend)
 *
 * AWS IAM 스타일의 리소스/액션 정의
 * Backend와 동기화 필요: elysia-server/src/constants/iam-resources.ts
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
// Re-exports for backward compatibility
// ============================================================================

export type { RoutePermission } from "@/lib/permission"
export { getRoutePermission, ROUTE_PERMISSIONS } from "@/lib/permission"
