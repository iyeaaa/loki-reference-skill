/**
 * IAM 시드 스크립트
 *
 * 워크스페이스 생성 시 자동으로 기본 역할을 생성하고
 * 시스템 정책과 연결하는 시드 데이터
 */

import { eq } from "drizzle-orm"
import logger from "../utils/logger"
import { db } from "./index"
import { iamMemberRoles, iamRolePolicies, iamWorkspaceRoles } from "./schema/iam"
import { workspaceMembers, workspaces } from "./schema/workspaces"

// 시스템 정책 ID (seed.sql에서 정의된 고정 UUID)
const SYSTEM_POLICY_IDS = {
  WorkspaceOwner: "00000000-0000-0000-0003-000000000010",
  WorkspaceAdmin: "00000000-0000-0000-0003-000000000011",
  WorkspaceMember: "00000000-0000-0000-0003-000000000012",
  WorkspaceViewer: "00000000-0000-0000-0003-000000000013",
}

// 기본 역할 템플릿
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

// 직접 실행 시
if (require.main === module) {
  seedDefaultRolesForAllWorkspaces()
    .then(() => {
      logger.info("Seed completed successfully")
      process.exit(0)
    })
    .catch((error) => {
      logger.error({ error }, "Seed failed")
      process.exit(1)
    })
}
