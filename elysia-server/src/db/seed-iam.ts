/**
 * IAM 시드 스크립트
 *
 * 시스템 정책, 정책 명세, 티어 경계를 시드하고
 * 워크스페이스 생성 시 자동으로 기본 역할을 생성
 */

import { eq } from "drizzle-orm"
import logger from "../utils/logger"
import { db } from "./index"
import {
  iamMemberRoles,
  iamPolicies,
  iamPolicyStatements,
  iamRolePolicies,
  iamTierBoundaries,
  iamWorkspaceRoles,
} from "./schema/iam"
import { workspaceMembers, workspaces } from "./schema/workspaces"

// ============================================================================
// 시스템 정책 ID (고정 UUID)
// ============================================================================

export const SYSTEM_POLICY_IDS = {
  // Tier Boundaries
  TierBoundaryTrial: "00000000-0000-0000-0003-000000000001",
  TierBoundaryBasic: "00000000-0000-0000-0003-000000000002",
  TierBoundaryPro: "00000000-0000-0000-0003-000000000003",
  TierBoundaryEnterprise: "00000000-0000-0000-0003-000000000004",
  // Workspace Roles
  WorkspaceOwner: "00000000-0000-0000-0003-000000000010",
  WorkspaceAdmin: "00000000-0000-0000-0003-000000000011",
  WorkspaceMember: "00000000-0000-0000-0003-000000000012",
  WorkspaceViewer: "00000000-0000-0000-0003-000000000013",
  // System Admin
  SystemAdmin: "00000000-0000-0000-0003-000000000020",
}

// ============================================================================
// 시스템 정책 정의
// ============================================================================

const SYSTEM_POLICIES = [
  // Tier Boundaries
  {
    id: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    name: "TierBoundary:Trial",
    description: "체험판(Level 1) 등급의 최대 허용 권한. 대시보드 제한적, 인박스 5회 열람.",
  },
  {
    id: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    name: "TierBoundary:Basic",
    description: "Basic(Level 2) 등급의 최대 허용 권한. 대시보드, 인박스 무제한.",
  },
  {
    id: SYSTEM_POLICY_IDS.TierBoundaryPro,
    name: "TierBoundary:Pro",
    description: "Pro(Level 3) 등급의 최대 허용 권한. 고객 탐색, 고객 관리, 캠페인 포함.",
  },
  {
    id: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    name: "TierBoundary:Enterprise",
    description: "Enterprise(Level 4) 등급의 최대 허용 권한. Rinda GPT 포함 전체 기능.",
  },
  // Workspace Roles
  {
    id: SYSTEM_POLICY_IDS.WorkspaceOwner,
    name: "WorkspaceOwner",
    description: "워크스페이스 소유자 권한. 모든 리소스에 대한 전체 권한.",
  },
  {
    id: SYSTEM_POLICY_IDS.WorkspaceAdmin,
    name: "WorkspaceAdmin",
    description: "워크스페이스 관리자 권한. 멤버 관리 및 설정 변경 가능.",
  },
  {
    id: SYSTEM_POLICY_IDS.WorkspaceMember,
    name: "WorkspaceMember",
    description: "워크스페이스 멤버 권한. 기본 업무 수행 가능.",
  },
  {
    id: SYSTEM_POLICY_IDS.WorkspaceViewer,
    name: "WorkspaceViewer",
    description: "워크스페이스 뷰어 권한. 읽기 전용.",
  },
  // System Admin
  {
    id: SYSTEM_POLICY_IDS.SystemAdmin,
    name: "SystemAdmin",
    description: "시스템 관리자(Level 5) 권한. 모든 워크스페이스와 사용자 관리 가능.",
  },
]

// ============================================================================
// 정책 명세 정의
// ============================================================================

type PolicyStatement = {
  policyId: string
  sid: string
  effect: "allow" | "deny"
  resources: string[]
  actions: string[]
  priority: number
}

const POLICY_STATEMENTS: PolicyStatement[] = [
  // ---- TierBoundary:Trial ----
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialDashboard",
    effect: "allow",
    resources: ["dashboard"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialInbox",
    effect: "allow",
    resources: ["emails"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialSettings",
    effect: "allow",
    resources: ["settings", "settings:profile", "settings:workspace", "email-templates"],
    actions: ["read", "update"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialDenyAnalytics",
    effect: "deny",
    resources: ["analytics"],
    actions: ["*"],
    priority: 200,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialDenyProFeatures",
    effect: "deny",
    resources: [
      "leads:discovery",
      "leads",
      "leads:*",
      "customer-groups",
      "sequences",
      "sequences:*",
    ],
    actions: ["*"],
    priority: 200,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    sid: "TrialDenyChatbot",
    effect: "deny",
    resources: ["ai:chatbot", "ai:search"],
    actions: ["*"],
    priority: 200,
  },

  // ---- TierBoundary:Basic ----
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    sid: "BasicDashboard",
    effect: "allow",
    resources: ["dashboard", "analytics"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    sid: "BasicInbox",
    effect: "allow",
    resources: ["emails", "emails:*"],
    actions: ["read", "list", "update"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    sid: "BasicSettings",
    effect: "allow",
    resources: ["settings", "settings:*"],
    actions: ["read", "update"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    sid: "BasicDenyProFeatures",
    effect: "deny",
    resources: [
      "leads:discovery",
      "leads",
      "leads:*",
      "customer-groups",
      "sequences",
      "sequences:*",
    ],
    actions: ["*"],
    priority: 200,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    sid: "BasicDenyChatbot",
    effect: "deny",
    resources: ["ai:chatbot", "ai:search"],
    actions: ["*"],
    priority: 200,
  },

  // ---- TierBoundary:Pro ----
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProDashboard",
    effect: "allow",
    resources: ["dashboard", "analytics"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProLeadDiscovery",
    effect: "allow",
    resources: ["leads:discovery"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProLeads",
    effect: "allow",
    resources: ["leads", "leads:*", "customer-groups", "customer-groups:*"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProSequences",
    effect: "allow",
    resources: ["sequences", "sequences:*"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProEmails",
    effect: "allow",
    resources: ["emails", "emails:*", "email-templates", "email-accounts", "bulk-email"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProSettings",
    effect: "allow",
    resources: ["settings", "settings:*", "workspaces:members"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    sid: "ProDenyChatbot",
    effect: "deny",
    resources: ["ai:chatbot", "ai:search"],
    actions: ["*"],
    priority: 200,
  },

  // ---- TierBoundary:Enterprise ----
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseDashboard",
    effect: "allow",
    resources: ["dashboard", "analytics"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseLeadDiscovery",
    effect: "allow",
    resources: ["leads:discovery"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseLeads",
    effect: "allow",
    resources: ["leads", "leads:*", "customer-groups", "customer-groups:*"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseSequences",
    effect: "allow",
    resources: ["sequences", "sequences:*"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseEmails",
    effect: "allow",
    resources: ["emails", "emails:*", "email-templates", "email-accounts", "bulk-email"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseChatbot",
    effect: "allow",
    resources: ["ai:chatbot", "ai:search"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    sid: "EnterpriseSettings",
    effect: "allow",
    resources: ["settings", "settings:*", "workspaces:members"],
    actions: ["*"],
    priority: 100,
  },

  // ---- WorkspaceOwner ----
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceOwner,
    sid: "OwnerFullAccess",
    effect: "allow",
    resources: ["*"],
    actions: ["*"],
    priority: 100,
  },

  // ---- WorkspaceAdmin ----
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceAdmin,
    sid: "AdminManageResources",
    effect: "allow",
    resources: [
      "dashboard",
      "analytics",
      "leads:discovery",
      "leads",
      "leads:*",
      "customer-groups",
      "customer-groups:*",
      "sequences",
      "sequences:*",
      "emails",
      "emails:*",
      "email-templates",
      "email-accounts",
      "bulk-email",
      "ai:chatbot",
      "ai:search",
      "settings",
      "settings:*",
    ],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceAdmin,
    sid: "AdminManageMembers",
    effect: "allow",
    resources: ["workspaces:members"],
    actions: ["list", "read", "create", "update", "invite"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceAdmin,
    sid: "AdminDenyDeleteWorkspace",
    effect: "deny",
    resources: ["workspaces"],
    actions: ["delete"],
    priority: 200,
  },

  // ---- WorkspaceMember ----
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberReadDashboard",
    effect: "allow",
    resources: ["dashboard", "analytics"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberReadLeadDiscovery",
    effect: "allow",
    resources: ["leads:discovery"],
    actions: ["read", "list", "execute"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberReadLeads",
    effect: "allow",
    resources: ["leads", "customer-groups"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberManageOwnLeads",
    effect: "allow",
    resources: ["leads:own"],
    actions: ["create", "update", "delete"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberReadSequences",
    effect: "allow",
    resources: ["sequences"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberManageOwnSequences",
    effect: "allow",
    resources: ["sequences:own"],
    actions: ["create", "update", "delete", "execute"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberReadEmails",
    effect: "allow",
    resources: ["emails"],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberManageOwnEmails",
    effect: "allow",
    resources: ["emails:own"],
    actions: ["create", "update", "delete", "send"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberUseChatbot",
    effect: "allow",
    resources: ["ai:chatbot"],
    actions: ["read", "execute"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberSettings",
    effect: "allow",
    resources: ["settings", "settings:profile", "settings:workspace", "email-templates"],
    actions: ["read", "update"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
    sid: "MemberDenyAdmin",
    effect: "deny",
    resources: ["workspaces:members", "settings:workspace"],
    actions: ["create", "update", "delete", "invite"],
    priority: 200,
  },

  // ---- WorkspaceViewer ----
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceViewer,
    sid: "ViewerReadAll",
    effect: "allow",
    resources: [
      "dashboard",
      "analytics",
      "leads:discovery",
      "leads",
      "customer-groups",
      "sequences",
      "emails",
      "settings",
    ],
    actions: ["read", "list"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.WorkspaceViewer,
    sid: "ViewerDenyWrite",
    effect: "deny",
    resources: ["*"],
    actions: ["create", "update", "delete", "execute", "send", "import", "export", "invite"],
    priority: 200,
  },

  // ---- SystemAdmin ----
  {
    policyId: SYSTEM_POLICY_IDS.SystemAdmin,
    sid: "SystemAdminFullAccess",
    effect: "allow",
    resources: ["*"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.SystemAdmin,
    sid: "SystemAdminIAM",
    effect: "allow",
    resources: ["iam:policies", "iam:roles", "iam:members", "iam:audit"],
    actions: ["*"],
    priority: 100,
  },
  {
    policyId: SYSTEM_POLICY_IDS.SystemAdmin,
    sid: "SystemAdminBilling",
    effect: "allow",
    resources: ["billing", "billing:*"],
    actions: ["*"],
    priority: 100,
  },
]

// ============================================================================
// 티어 경계 정의
// ============================================================================

const TIER_BOUNDARIES = [
  {
    id: "00000000-0000-0000-0005-000000000001",
    tier: "trial" as const,
    policyId: SYSTEM_POLICY_IDS.TierBoundaryTrial,
    description: "체험판(Level 1): 대시보드 제한, 인박스 5회 열람, Paywall 적용",
  },
  {
    id: "00000000-0000-0000-0005-000000000002",
    tier: "basic" as const,
    policyId: SYSTEM_POLICY_IDS.TierBoundaryBasic,
    description: "Basic(Level 2): 대시보드, 인박스 무제한, 관리자 대행 서비스",
  },
  {
    id: "00000000-0000-0000-0005-000000000003",
    tier: "pro" as const,
    policyId: SYSTEM_POLICY_IDS.TierBoundaryPro,
    description: "Pro(Level 3): 고객 탐색, 고객 관리, 캠페인 - 셀프 서빙",
  },
  {
    id: "00000000-0000-0000-0005-000000000004",
    tier: "enterprise" as const,
    policyId: SYSTEM_POLICY_IDS.TierBoundaryEnterprise,
    description: "Enterprise(Level 4): Rinda GPT 포함 전체 기능",
  },
]

// ============================================================================
// 기본 역할 템플릿
// ============================================================================

const DEFAULT_ROLE_TEMPLATES = [
  {
    name: "Owner",
    description: "워크스페이스 소유자. 모든 리소스에 대한 전체 권한을 가집니다.",
    isSystem: true,
    isDefault: false,
    priority: 100,
    policyId: SYSTEM_POLICY_IDS.WorkspaceOwner,
  },
  {
    name: "Admin",
    description: "워크스페이스 관리자. 멤버 관리 및 대부분의 설정 변경이 가능합니다.",
    isSystem: true,
    isDefault: false,
    priority: 80,
    policyId: SYSTEM_POLICY_IDS.WorkspaceAdmin,
  },
  {
    name: "Member",
    description: "일반 멤버. 기본적인 업무 수행이 가능하며, 자신의 리소스를 관리할 수 있습니다.",
    isSystem: true,
    isDefault: true, // 새 멤버에게 자동 할당
    priority: 50,
    policyId: SYSTEM_POLICY_IDS.WorkspaceMember,
  },
  {
    name: "Viewer",
    description: "읽기 전용 멤버. 모든 리소스를 조회할 수 있지만 수정은 불가합니다.",
    isSystem: true,
    isDefault: false,
    priority: 10,
    policyId: SYSTEM_POLICY_IDS.WorkspaceViewer,
  },
]

// ============================================================================
// 시스템 정책 시드 함수
// ============================================================================

/**
 * 시스템 정책 시드 (iam_policies, iam_policy_statements, iam_tier_boundaries)
 * db:seed 실행 시 호출되어야 함
 */
export async function seedSystemPolicies(): Promise<void> {
  logger.info("Seeding IAM system policies...")

  // 1. 시스템 정책 시드
  for (const policy of SYSTEM_POLICIES) {
    const existing = await db
      .select()
      .from(iamPolicies)
      .where(eq(iamPolicies.id, policy.id))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(iamPolicies).values({
        id: policy.id,
        workspaceId: null, // 시스템 정책은 워크스페이스 없음
        name: policy.name,
        description: policy.description,
        version: 1,
        isManaged: true,
        isActive: true,
      })
      logger.info({ policyId: policy.id, name: policy.name }, "Created system policy")
    } else {
      logger.info({ policyId: policy.id, name: policy.name }, "System policy already exists")
    }
  }

  // 2. 정책 명세 시드 (기존 명세 삭제 후 재생성)
  // managed 정책의 기존 statements 삭제
  const managedPolicyIds = SYSTEM_POLICIES.map((p) => p.id)

  for (const policyId of managedPolicyIds) {
    await db.delete(iamPolicyStatements).where(eq(iamPolicyStatements.policyId, policyId))
  }

  // 새 statements 삽입
  for (const stmt of POLICY_STATEMENTS) {
    await db.insert(iamPolicyStatements).values({
      policyId: stmt.policyId,
      sid: stmt.sid,
      effect: stmt.effect,
      resources: stmt.resources,
      actions: stmt.actions,
      priority: stmt.priority,
    })
  }
  logger.info({ count: POLICY_STATEMENTS.length }, "Created policy statements")

  // 3. 티어 경계 시드
  for (const boundary of TIER_BOUNDARIES) {
    const existing = await db
      .select()
      .from(iamTierBoundaries)
      .where(eq(iamTierBoundaries.id, boundary.id))
      .limit(1)

    if (existing.length === 0) {
      await db.insert(iamTierBoundaries).values({
        id: boundary.id,
        tier: boundary.tier,
        policyId: boundary.policyId,
        description: boundary.description,
      })
      logger.info({ tier: boundary.tier }, "Created tier boundary")
    } else {
      logger.info({ tier: boundary.tier }, "Tier boundary already exists")
    }
  }

  logger.info("IAM system policies seeding completed")
}

// ============================================================================
// 워크스페이스 역할 관련 함수
// ============================================================================

/**
 * 워크스페이스에 기본 역할 생성
 */
export async function createDefaultRolesForWorkspace(workspaceId: string): Promise<void> {
  logger.info({ workspaceId }, "Creating default roles for workspace")

  for (const template of DEFAULT_ROLE_TEMPLATES) {
    // 이미 존재하는지 확인
    const existing = await db
      .select()
      .from(iamWorkspaceRoles)
      .where(eq(iamWorkspaceRoles.workspaceId, workspaceId))
      .limit(1)

    // 같은 이름의 역할이 이미 있으면 건너뜀
    const existingRole = existing.find((r) => r.name === template.name)
    if (existingRole) {
      logger.info({ workspaceId, role: template.name }, "Role already exists, skipping")
      continue
    }

    // 역할 생성
    const [newRole] = await db
      .insert(iamWorkspaceRoles)
      .values({
        workspaceId,
        name: template.name,
        description: template.description,
        isSystem: template.isSystem,
        isDefault: template.isDefault,
        priority: template.priority,
      })
      .returning()

    if (newRole) {
      // 역할에 정책 연결
      await db.insert(iamRolePolicies).values({
        roleId: newRole.id,
        policyId: template.policyId,
      })

      logger.info(
        { workspaceId, roleId: newRole.id, roleName: template.name },
        "Created role with policy",
      )
    }
  }
}

/**
 * 멤버에게 기본 역할 자동 할당
 */
export async function assignDefaultRoleToMember(
  memberId: string,
  workspaceId: string,
): Promise<void> {
  // 기본 역할 조회 (isDefault = true)
  const [defaultRole] = await db
    .select()
    .from(iamWorkspaceRoles)
    .where(eq(iamWorkspaceRoles.workspaceId, workspaceId))
    .limit(10)

  const memberDefaultRole = defaultRole
    ? await db
        .select()
        .from(iamWorkspaceRoles)
        .where(eq(iamWorkspaceRoles.workspaceId, workspaceId))
        .then((roles) => roles.find((r) => r.isDefault))
    : null

  if (!memberDefaultRole) {
    logger.warn({ workspaceId }, "No default role found for workspace")
    return
  }

  // 이미 할당되어 있는지 확인
  const existingAssignment = await db
    .select()
    .from(iamMemberRoles)
    .where(eq(iamMemberRoles.memberId, memberId))
    .limit(1)

  if (existingAssignment.length > 0) {
    logger.info({ memberId }, "Member already has roles assigned")
    return
  }

  // 기본 역할 할당
  await db.insert(iamMemberRoles).values({
    memberId,
    roleId: memberDefaultRole.id,
  })

  logger.info(
    { memberId, roleId: memberDefaultRole.id, roleName: memberDefaultRole.name },
    "Assigned default role to member",
  )
}

/**
 * 멤버 역할에 따라 IAM 역할 자동 할당
 */
export async function syncMemberRoleToIamRole(
  memberId: string,
  workspaceId: string,
  memberRole: string,
): Promise<void> {
  // 멤버 역할에 대응하는 IAM 역할 이름 매핑
  const roleMapping: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    member: "Member",
    viewer: "Viewer",
  }

  const iamRoleName = roleMapping[memberRole]
  if (!iamRoleName) {
    logger.warn({ memberRole }, "Unknown member role, cannot map to IAM role")
    return
  }

  // 해당 워크스페이스의 IAM 역할 조회
  const workspaceRoles = await db
    .select()
    .from(iamWorkspaceRoles)
    .where(eq(iamWorkspaceRoles.workspaceId, workspaceId))

  const targetRole = workspaceRoles.find((r) => r.name === iamRoleName)
  if (!targetRole) {
    logger.warn(
      { workspaceId, iamRoleName },
      "IAM role not found for workspace, creating default roles first",
    )
    await createDefaultRolesForWorkspace(workspaceId)
    return syncMemberRoleToIamRole(memberId, workspaceId, memberRole)
  }

  // 기존 역할 제거 후 새 역할 할당
  await db.delete(iamMemberRoles).where(eq(iamMemberRoles.memberId, memberId))

  await db.insert(iamMemberRoles).values({
    memberId,
    roleId: targetRole.id,
  })

  logger.info(
    { memberId, roleId: targetRole.id, roleName: iamRoleName },
    "Synced member role to IAM role",
  )
}

/**
 * 모든 기존 워크스페이스에 기본 역할 시드
 */
export async function seedDefaultRolesForAllWorkspaces(): Promise<void> {
  logger.info("Seeding default roles for all existing workspaces")

  const allWorkspaces = await db.select().from(workspaces)

  for (const workspace of allWorkspaces) {
    await createDefaultRolesForWorkspace(workspace.id)

    // 기존 멤버들에게 역할 동기화
    const members = await db
      .select()
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspace.id))

    for (const member of members) {
      await syncMemberRoleToIamRole(member.id, workspace.id, member.role)
    }
  }

  logger.info({ count: allWorkspaces.length }, "Completed seeding default roles")
}

// ============================================================================
// 직접 실행
// ============================================================================

if (import.meta.main) {
  seedSystemPolicies()
    .then(() => seedDefaultRolesForAllWorkspaces())
    .then(() => {
      logger.info("IAM seed completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      logger.error({ error }, "IAM seed failed")
      process.exit(1)
    })
}
