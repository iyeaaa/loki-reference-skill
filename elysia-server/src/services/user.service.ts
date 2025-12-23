import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { billingPlans, billingProducts, subscriptions } from "../db/schema/billing"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailReplies, emails } from "../db/schema/emails"
import { iamMemberRoles } from "../db/schema/iam"
import { sequenceEnrollments } from "../db/schema/sequences"
import { departments, users } from "../db/schema/users"
import { workspaceMembers, workspaces } from "../db/schema/workspaces"
import { createDefaultRolesForWorkspace, syncMemberRoleToIamRole } from "../db/seed-iam"
import logger from "../utils/logger"
import { deleteGrant } from "./nylas.service"
import * as salesStrategyService from "./sales-strategy.service"
import * as workspaceService from "./workspace.service"

// ====================================
// USER CRUD OPERATIONS
// ====================================

// GetUser :one
export async function getUser(id: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      passwordHash: users.passwordHash,
      userRole: users.userRole,
      isActive: users.isActive,
      isSuperAdmin: users.isSuperAdmin,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.id, id))
    .limit(1)

  return result[0]
}

// CreateUser :one
// Trial is now managed by subscriptions table, not users table
export async function createUser(data: {
  username: string
  email: string
  passwordHash?: string
  userRole?: "user" | "admin"
  isActive?: boolean
  departmentId?: string
  employeeId?: string
}) {
  const [newUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash || null,
      userRole: data.userRole || "user",
      isActive: data.isActive !== undefined ? data.isActive : true,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })

  return newUser
}

// UpdateUser :one
export async function updateUser(
  id: string,
  data: {
    username: string
    email: string
    userRole: "user" | "admin"
    isActive: boolean
    departmentId: string | null
    employeeId: string | null
    profilePicture?: string | null
  },
) {
  // 기존 사용자 정보 조회 (역할 변경 감지용)
  const existingUser = await getUser(id)
  const previousRole = existingUser?.userRole

  const [updatedUser] = await db
    .update(users)
    .set({
      username: data.username,
      email: data.email,
      userRole: data.userRole,
      isActive: data.isActive,
      departmentId: data.departmentId,
      employeeId: data.employeeId,
      profilePicture: data.profilePicture,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      profilePicture: users.profilePicture,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })

  // 역할이 변경된 경우 IAM 역할 자동 동기화
  if (updatedUser && previousRole !== data.userRole) {
    const isPromotedToAdmin = data.userRole === "admin" && previousRole !== "admin"
    const isDemotedFromAdmin = previousRole === "admin" && data.userRole !== "admin"

    if (isPromotedToAdmin) {
      // 관리자로 승격: 모든 워크스페이스에서 Admin 역할 부여
      await syncUserIamRolesOnPromotion(id)
    } else if (isDemotedFromAdmin) {
      // 관리자에서 강등: 모든 워크스페이스에서 Member 역할로 변경
      await syncUserIamRolesOnDemotion(id)
    }
  }

  return updatedUser
}

// DeleteUser :exec（ハード削除 - アカウント削除にはsoftDeleteUserを使用）
export async function deleteUser(id: string) {
  await db.delete(users).where(eq(users.id, id))
}

// HardDeleteUser :exec
// 사용자 계정 완전 삭제 절차 (GDPR 완전 준수):
// Phase 1: 외부 서비스 정리 (트랜잭션 외부)
//   - Nylas 그랜트 취소
// Phase 2: 소유한 워크스페이스 데이터 삭제 (트랜잭션 내부)
//   - emails, email_replies (RESTRICT 제약으로 명시적 삭제 필요)
//   - workspaces 삭제 시 CASCADE로 자동 삭제되는 데이터:
//     leads, sequences, customer_groups, websets, iam_*, activity_logs,
//     subscriptions, onboarding_progress, openai_api_keys, workspace_products,
//     workspace_sales_strategies, email_templates, workspace_members 등
// Phase 3: 사용자 연결 데이터 삭제 (트랜잭션 내부)
//   - IAM 역할, 워크스페이스 멤버십, 이메일 계정
// Phase 4: RESTRICT FK 참조 NULL 처리 (트랜잭션 내부)
//   - createdBy, enrolledBy, addedBy 등 nullable FK 컬럼들
// Phase 5: 사용자 완전 삭제 (트랜잭션 내부)
//   - users 테이블에서 완전 삭제
//   - CASCADE로 billing_customers, user_signature_preferences 자동 삭제
export async function softDeleteUser(id: string) {
  logger.info({ userId: id }, "Starting hard delete user process")

  // ============================================================================
  // Phase 1: 외부 서비스 정리 (트랜잭션 외부 - 외부 API 호출)
  // ============================================================================

  // 1-1. 사용자가 소유한 워크스페이스 조회
  const ownedWorkspaces = await db
    .select({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.ownerId, id))

  const ownedWorkspaceIds = ownedWorkspaces.map((w) => w.id)

  logger.info(
    { userId: id, ownedWorkspaceCount: ownedWorkspaces.length },
    "Found owned workspaces for user deletion",
  )

  // 1-2. 소유한 워크스페이스의 모든 이메일 계정 + 사용자 본인의 이메일 계정 조회
  let allEmailAccounts: {
    id: string
    apiKey: string | null
    emailAddress: string
    workspaceId: string
  }[] = []

  if (ownedWorkspaceIds.length > 0) {
    allEmailAccounts = await db
      .select({
        id: userEmailAccounts.id,
        apiKey: userEmailAccounts.apiKey,
        emailAddress: userEmailAccounts.emailAddress,
        workspaceId: userEmailAccounts.workspaceId,
      })
      .from(userEmailAccounts)
      .where(
        sql`workspace_id IN (${sql.join(
          ownedWorkspaceIds.map((wid) => sql`${wid}`),
          sql`, `,
        )}) OR user_id = ${id}`,
      )
  } else {
    allEmailAccounts = await db
      .select({
        id: userEmailAccounts.id,
        apiKey: userEmailAccounts.apiKey,
        emailAddress: userEmailAccounts.emailAddress,
        workspaceId: userEmailAccounts.workspaceId,
      })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, id))
  }

  logger.info(
    { userId: id, emailAccountCount: allEmailAccounts.length },
    "Found email accounts for user deletion",
  )

  // 1-3. Nylas 그랜트 취소
  let nylasGrantsDeleted = 0
  let nylasGrantsFailed = 0

  for (const account of allEmailAccounts) {
    // Nylas grantId인 경우만 취소 ("SG"로 시작하는 SendGrid API 키 제외)
    if (account.apiKey && !account.apiKey.startsWith("SG")) {
      try {
        await deleteGrant(account.apiKey)
        nylasGrantsDeleted++
        logger.info(
          {
            grantId: account.apiKey,
            userId: id,
            emailAddress: account.emailAddress,
            workspaceId: account.workspaceId,
          },
          "Successfully deleted Nylas grant during account deletion",
        )
      } catch (error) {
        nylasGrantsFailed++
        // 로그만 출력하고 실패시키지 않음 - 그랜트가 이미 무효할 수 있음
        logger.warn(
          {
            err: error,
            grantId: account.apiKey,
            userId: id,
            emailAddress: account.emailAddress,
            workspaceId: account.workspaceId,
          },
          "Failed to delete Nylas grant during account deletion (may be already deleted)",
        )
      }
    }
  }

  logger.info(
    {
      userId: id,
      totalEmailAccounts: allEmailAccounts.length,
      nylasGrantsDeleted,
      nylasGrantsFailed,
    },
    "Completed Nylas grant deletion process",
  )

  // ============================================================================
  // Phase 2-5: 데이터베이스 작업 (트랜잭션 내부)
  // ============================================================================
  await db.transaction(async (tx) => {
    // ============================================================================
    // Phase 2: 소유한 워크스페이스 데이터 삭제
    // ============================================================================

    if (ownedWorkspaceIds.length > 0) {
      logger.info(
        { userId: id, workspaceIds: ownedWorkspaceIds },
        "Deleting owned workspace data (RESTRICT constraint tables first)",
      )

      // 2-1. emails 테이블 삭제 (RESTRICT 제약 - 명시적 삭제 필요)
      // email_events는 CASCADE로 자동 삭제됨
      const deletedEmails = await tx
        .delete(emails)
        .where(
          sql`workspace_id IN (${sql.join(
            ownedWorkspaceIds.map((wid) => sql`${wid}`),
            sql`, `,
          )})`,
        )
        .returning({ id: emails.id })
      logger.info(
        { userId: id, deletedEmailsCount: deletedEmails.length },
        "Deleted emails from owned workspaces",
      )

      // 2-2. email_replies 테이블 삭제 (RESTRICT 제약 - 명시적 삭제 필요)
      await tx.delete(emailReplies).where(
        sql`workspace_id IN (${sql.join(
          ownedWorkspaceIds.map((wid) => sql`${wid}`),
          sql`, `,
        )})`,
      )
      logger.info({ userId: id }, "Deleted email_replies from owned workspaces")

      // 2-3. sequence_enrollments 삭제 (user_email_account_id RESTRICT 제약)
      // sequence_enrollments -> user_email_accounts (RESTRICT)
      // workspaces 삭제 시 user_email_accounts가 CASCADE로 삭제되려 하지만
      // sequence_enrollments가 참조하고 있으면 RESTRICT 오류 발생
      // sequence_step_executions는 enrollment_id CASCADE로 자동 삭제됨
      await tx.execute(
        sql`DELETE FROM sequence_enrollments
            WHERE sequence_id IN (
              SELECT id FROM sequences WHERE workspace_id IN (${sql.join(
                ownedWorkspaceIds.map((wid) => sql`${wid}`),
                sql`, `,
              )})
            )`,
      )
      logger.info({ userId: id }, "Deleted sequence_enrollments from owned workspaces")

      // 2-4. workspaces 삭제 (CASCADE로 다음 테이블들 자동 삭제)
      // - leads (-> lead_contacts, lead_products, lead_social_media, lead_business_sectors,
      //          lead_product_categories, lead_industry_types CASCADE)
      // - sequences (-> sequence_steps, sequence_enrollments -> sequence_step_executions CASCADE)
      // - customer_groups (-> customer_group_members CASCADE)
      // - websets (-> webset_rows CASCADE)
      // - chat_conversations (-> chat_messages CASCADE)
      // - workspace_members (-> iam_member_roles, iam_member_policies CASCADE)
      // - iam_policies (-> iam_policy_statements, iam_role_policies, iam_member_policies CASCADE)
      // - iam_workspace_roles (-> iam_role_policies, iam_member_roles CASCADE)
      // - activity_logs
      // - subscriptions (-> subscription_history CASCADE)
      // - onboarding_progress
      // - openai_api_keys
      // - workspace_products
      // - workspace_sales_strategies
      // - email_templates
      // - email_signatures (SET NULL)
      // - user_email_accounts
      const deletedWorkspaces = await tx
        .delete(workspaces)
        .where(eq(workspaces.ownerId, id))
        .returning({ id: workspaces.id })
      logger.info(
        { userId: id, deletedWorkspacesCount: deletedWorkspaces.length },
        "Deleted owned workspaces (CASCADE deletes related data)",
      )
    }

    // ============================================================================
    // Phase 3: 사용자 연결 데이터 삭제 (다른 워크스페이스의 멤버십)
    // ============================================================================

    // 3-1. 멤버십 ID 조회 (다른 사람 워크스페이스의 멤버십)
    const memberIds = await tx
      .select({ id: workspaceMembers.id, workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, id))

    logger.info(
      { userId: id, membershipCount: memberIds.length },
      "Found remaining workspace memberships for user",
    )

    // 3-2. IAM 역할 할당 삭제 (workspace_members 삭제 전 필요)
    if (memberIds.length > 0) {
      const memberIdList = memberIds.map((m) => m.id)
      await tx.delete(iamMemberRoles).where(
        sql`member_id IN (${sql.join(
          memberIdList.map((mid) => sql`${mid}`),
          sql`, `,
        )})`,
      )
      logger.info({ userId: id, memberCount: memberIds.length }, "Deleted IAM role assignments")
    }

    // 3-3. 워크스페이스 멤버십 삭제
    await tx.delete(workspaceMembers).where(eq(workspaceMembers.userId, id))
    logger.info({ userId: id, membershipCount: memberIds.length }, "Deleted workspace memberships")

    // 3-4. 사용자의 남은 이메일 계정 관련 데이터 삭제 (다른 워크스페이스)
    const remainingEmailAccountIds = await tx
      .select({ id: userEmailAccounts.id })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, id))

    if (remainingEmailAccountIds.length > 0) {
      const accountIds = remainingEmailAccountIds.map((acc) => acc.id)

      // 3-4-1. sequence_enrollments 삭제 (user_email_account_id RESTRICT 제약)
      // 이 이메일 계정으로 등록된 시퀀스 enrollment들 삭제
      await tx.delete(sequenceEnrollments).where(
        sql`user_email_account_id IN (${sql.join(
          accountIds.map((aid) => sql`${aid}`),
          sql`, `,
        )})`,
      )
      logger.info(
        { userId: id, emailAccountCount: accountIds.length },
        "Deleted sequence_enrollments for remaining user email accounts",
      )

      // 3-4-2. workflow_executions의 user_email_account_id 처리
      // workflow_executions.user_email_account_id -> user_email_accounts (no onDelete = RESTRICT)
      await tx.execute(
        sql`DELETE FROM workflow_executions
            WHERE user_email_account_id IN (${sql.join(
              accountIds.map((aid) => sql`${aid}`),
              sql`, `,
            )})`,
      )
      logger.info({ userId: id }, "Deleted workflow_executions for remaining user email accounts")

      // 3-4-3. emails 삭제 (user_email_account_id RESTRICT 제약)
      const deletedEmails = await tx
        .delete(emails)
        .where(
          sql`user_email_account_id IN (${sql.join(
            accountIds.map((aid) => sql`${aid}`),
            sql`, `,
          )})`,
        )
        .returning({ id: emails.id })
      logger.info(
        { userId: id, deletedEmailsCount: deletedEmails.length },
        "Deleted emails for remaining user email accounts",
      )
    }

    // 3-5. 사용자 이메일 계정 삭제
    const deletedEmailAccounts = await tx
      .delete(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, id))
      .returning({ id: userEmailAccounts.id })
    logger.info(
      { userId: id, deletedEmailAccountsCount: deletedEmailAccounts.length },
      "Deleted user email accounts",
    )

    // ============================================================================
    // Phase 4: RESTRICT FK 참조 NULL 처리
    // users.id를 참조하는 nullable FK 컬럼들을 NULL로 설정
    // (onDelete 옵션이 없는 FK는 기본적으로 RESTRICT)
    // ============================================================================

    // sequences.createdBy
    await tx.execute(sql`UPDATE sequences SET created_by = NULL WHERE created_by = ${id}`)

    // sequence_enrollments.enrolledBy
    await tx.execute(
      sql`UPDATE sequence_enrollments SET enrolled_by = NULL WHERE enrolled_by = ${id}`,
    )

    // leads.createdBy
    await tx.execute(sql`UPDATE leads SET created_by = NULL WHERE created_by = ${id}`)

    // customer_groups.createdBy
    await tx.execute(sql`UPDATE customer_groups SET created_by = NULL WHERE created_by = ${id}`)

    // customer_group_members.addedBy
    await tx.execute(sql`UPDATE customer_group_members SET added_by = NULL WHERE added_by = ${id}`)

    // email_templates.createdBy
    await tx.execute(sql`UPDATE email_templates SET created_by = NULL WHERE created_by = ${id}`)

    // email_replies.assignedTo
    await tx.execute(sql`UPDATE email_replies SET assigned_to = NULL WHERE assigned_to = ${id}`)

    // iam_policies.createdBy
    await tx.execute(sql`UPDATE iam_policies SET created_by = NULL WHERE created_by = ${id}`)

    // iam_workspace_roles.createdBy
    await tx.execute(sql`UPDATE iam_workspace_roles SET created_by = NULL WHERE created_by = ${id}`)

    // iam_role_policies.attachedBy
    await tx.execute(sql`UPDATE iam_role_policies SET attached_by = NULL WHERE attached_by = ${id}`)

    // iam_member_roles.grantedBy
    await tx.execute(sql`UPDATE iam_member_roles SET granted_by = NULL WHERE granted_by = ${id}`)

    // iam_member_policies.attachedBy
    await tx.execute(
      sql`UPDATE iam_member_policies SET attached_by = NULL WHERE attached_by = ${id}`,
    )

    // subscription_history.changedBy
    await tx.execute(
      sql`UPDATE subscription_history SET changed_by = NULL WHERE changed_by = ${id}`,
    )

    // workspace_members.invitedBy
    await tx.execute(sql`UPDATE workspace_members SET invited_by = NULL WHERE invited_by = ${id}`)

    logger.info({ userId: id }, "Nullified all RESTRICT FK references")

    // ============================================================================
    // Phase 5: 사용자 완전 삭제
    // ============================================================================

    // CASCADE로 자동 삭제되는 항목:
    // - billing_customers (users CASCADE)
    // - user_signature_preferences (users CASCADE)
    // - chat_conversations (users CASCADE) - 이미 워크스페이스 삭제로 처리됨

    // SET NULL로 자동 처리되는 항목:
    // - email_signatures.userId (set null)
    // - activity_logs.userId (set null)
    // - iam_audit_logs.userId (set null)

    await tx.delete(users).where(eq(users.id, id))

    logger.info({ userId: id }, "User permanently deleted from database")
  })

  logger.info(
    {
      userId: id,
      ownedWorkspacesDeleted: ownedWorkspaces.length,
      emailAccountsProcessed: allEmailAccounts.length,
      nylasGrantsDeleted,
      nylasGrantsFailed,
    },
    "Hard delete user process completed successfully",
  )
}

/**
 * 사용자 삭제 전 관련 데이터 카운트 조회 (디버깅용)
 * Hard Delete 전에 얼마나 많은 데이터가 삭제될지 확인
 */
export async function getUserDataCounts(userId: string) {
  try {
    // 1. 소유한 워크스페이스 확인
    const ownedWorkspaces = await db
      .select({ count: count() })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId))

    // 2. 이메일 계정 확인
    const emailAccounts = await db
      .select({ count: count() })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, userId))

    // 3. 워크스페이스 멤버십 확인
    const memberships = await db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))

    // 4. 사용자가 보낸 이메일 확인 (user_email_account를 통해)
    const sentEmails = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(emails)
      .innerJoin(userEmailAccounts, eq(emails.userEmailAccountId, userEmailAccounts.id))
      .where(eq(userEmailAccounts.userId, userId))

    return {
      ownedWorkspaceCount: Number(ownedWorkspaces[0]?.count || 0),
      emailAccountCount: Number(emailAccounts[0]?.count || 0),
      membershipCount: Number(memberships[0]?.count || 0),
      emailCount: Number(sentEmails[0]?.count || 0),
    }
  } catch (error) {
    logger.error({ err: error, userId }, "Failed to get user data counts")
    return null
  }
}

// ====================================
// USER QUERY AND SEARCH OPERATIONS
// ====================================

// ListUsers :many
// 삭제된 계정(isActive: false)은 제외
export async function listUsers(limit: number, offset: number) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.isActive, true))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetAllUsers - 페이지네이션 없이 모든 유저 조회 (활성 유저만)
// 삭제된 계정(isActive: false)은 제외
export async function getAllUsers() {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.isActive, true))
    .orderBy(desc(users.createdAt))

  return result
}

// ListUsersWithFilters :many
export async function listUsersWithFilters(
  limit: number,
  offset: number,
  filters?: {
    role?: "user" | "admin"
    isActive?: boolean
    search?: string
    departmentIds?: string[]
  },
) {
  const conditions = []

  if (filters?.role) {
    conditions.push(eq(users.userRole, filters.role))
  }

  // isActive 필터가 명시적으로 지정되지 않으면 기본적으로 활성 사용자만 표시
  if (filters?.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive))
  } else {
    conditions.push(eq(users.isActive, true))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(users.email, `%${filters.search}%`),
      ilike(users.username, `%${filters.search}%`),
      ilike(users.employeeId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.departmentIds && filters.departmentIds.length > 0) {
    const departmentCondition = or(...filters.departmentIds.map((id) => eq(users.departmentId, id)))
    if (departmentCondition) {
      conditions.push(departmentCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetUserByEmail :one
export async function getUserByEmail(email: string) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      passwordHash: users.passwordHash,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(eq(users.email, email))
    .limit(1)

  return result[0]
}

// GetAssignableUsers :many
export async function getAssignableUsers() {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.isActive, true), eq(users.userRole, "admin")))
    .orderBy(users.username)

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountUsers :one
export async function countUsers() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(users)

  return result[0]?.count ?? 0
}

// CountUsersWithFilters :one
export async function countUsersWithFilters(filters?: {
  role?: "user" | "admin"
  isActive?: boolean
  search?: string
  departmentIds?: string[]
}) {
  const conditions = []

  if (filters?.role) {
    conditions.push(eq(users.userRole, filters.role))
  }

  if (filters?.isActive !== undefined) {
    conditions.push(eq(users.isActive, filters.isActive))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(users.email, `%${filters.search}%`),
      ilike(users.username, `%${filters.search}%`),
      ilike(users.employeeId, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.departmentIds && filters.departmentIds.length > 0) {
    const departmentCondition = or(...filters.departmentIds.map((id) => eq(users.departmentId, id)))
    if (departmentCondition) {
      conditions.push(departmentCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// CheckAccountExists :one
export async function checkAccountExists(email: string) {
  const result = await db
    .select({
      exists: sql<boolean>`EXISTS(SELECT 1 FROM ${users} WHERE email = ${email})`,
    })
    .from(users)
    .limit(1)

  return result[0]?.exists ?? false
}

// ====================================
// AUTHENTICATION AND PASSWORD QUERIES
// ====================================

// UpdateUserPassword :one
export async function updateUserPassword(id: string, passwordHash: string) {
  const [updatedUser] = await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
    })

  return updatedUser
}

// Onboarding survey type
export interface OnboardingSurvey {
  industry?: string
  target?: string
  country?: string
  experience?: string
  lang?: string
  completedAt?: string
}

// CreateOrUpdateGoogleUser :one
export async function createOrUpdateGoogleUser(data: {
  username: string
  email: string
  oauthId: string
  profilePicture?: string
  userRole?: "user" | "admin"
  isActive?: boolean
  departmentId?: string
  employeeId?: string
  onboardingParams?: {
    industry?: string | null
    target?: string | null
    country?: string | null
    experience?: string | null
    lang?: string | null
  }
}) {
  // Check if user already exists
  const existingUser = await getUserByEmail(data.email)

  // Prepare onboarding survey data
  const { industry, target, country, experience, lang } = data.onboardingParams || {}
  const hasOnboardingSurvey = industry || target || country || experience
  const onboardingSurvey: OnboardingSurvey | null = hasOnboardingSurvey
    ? {
        industry: industry || undefined,
        target: target || undefined,
        country: country || undefined,
        experience: experience || undefined,
        lang: lang || undefined,
        completedAt: new Date().toISOString(),
      }
    : null

  const [upsertedUser] = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      userRole: data.userRole || "user",
      isActive: data.isActive ?? true,
      departmentId: data.departmentId || null,
      employeeId: data.employeeId || null,
      authProvider: "google",
      oauthId: data.oauthId,
      profilePicture: data.profilePicture,
      lastLoginAt: new Date(),
      // 온보딩 데이터 저장
      onboardingSurvey,
      onboardingStep: hasOnboardingSurvey ? 1 : 0, // 설문 완료 시 step 1부터 시작
    })
    .onConflictDoUpdate({
      target: users.email,
      set: {
        lastLoginAt: new Date(),
        updatedAt: new Date(),
        profilePicture: data.profilePicture,
        // 기존 사용자도 온보딩 설문이 있으면 업데이트
        ...(onboardingSurvey && { onboardingSurvey }),
      },
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      authProvider: users.authProvider,
      oauthId: users.oauthId,
      profilePicture: users.profilePicture,
      onboardingSurvey: users.onboardingSurvey,
      onboardingStep: users.onboardingStep,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
    })

  // Create default workspace for new users (trial subscription will be created automatically)
  if (!existingUser) {
    try {
      const workspace = await workspaceService.createWorkspace({
        name: `${upsertedUser.username}의 워크스페이스`,
        description: "기본 워크스페이스",
        ownerId: upsertedUser.id,
        isActive: true,
      })

      // Link sales strategy if all 4 onboarding fields are provided
      if (workspace && industry && target && country && experience) {
        try {
          await salesStrategyService.findOrCreateAndLinkSalesStrategy(workspace.id, {
            industry: industry as
              | "manufacturing"
              | "it_saas"
              | "beauty"
              | "food"
              | "fashion"
              | "electronics"
              | "healthcare"
              | "guitar",
            target: target as "b2b" | "b2c" | "both",
            country: country as "jp" | "us" | "sea" | "eu" | "cn" | "ae",
            experience: experience as "none" | "some" | "experienced",
          })
        } catch (strategyError) {
          console.error("Failed to link sales strategy for trial user:", strategyError)
        }
      }
    } catch (error) {
      console.error("Failed to create default workspace for trial user:", error)
      // Don't throw error here to avoid breaking user registration
    }
  }

  return upsertedUser
}

// UpdateLastLogin :exec
export async function updateLastLogin(id: string) {
  await db
    .update(users)
    .set({
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(userIds: string[], isActive: boolean) {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  const result = await db
    .update(users)
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  return result.length
}

// BulkUpdateRole :exec
export async function bulkUpdateRole(userIds: string[], userRole: "user" | "admin") {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  // 기존 역할 조회 (각 사용자별)
  const existingUsers = await db
    .select({ id: users.id, userRole: users.userRole })
    .from(users)
    .where(userCondition)

  const result = await db
    .update(users)
    .set({
      userRole,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  // 각 사용자에 대해 IAM 역할 동기화
  const isTargetAdmin = userRole === "admin"

  for (const user of existingUsers) {
    const wasAdmin = user.userRole === "admin"

    if (isTargetAdmin && !wasAdmin) {
      // 관리자로 승격
      await syncUserIamRolesOnPromotion(user.id)
    } else if (!isTargetAdmin && wasAdmin) {
      // 관리자에서 강등
      await syncUserIamRolesOnDemotion(user.id)
    }
  }

  return result.length
}

// BulkUpdateDepartment :exec
export async function bulkUpdateDepartment(userIds: string[], departmentId: string) {
  const userCondition = or(...userIds.map((id) => eq(users.id, id)))
  if (!userCondition) {
    return 0
  }

  const result = await db
    .update(users)
    .set({
      departmentId,
      updatedAt: new Date(),
    })
    .where(userCondition)
    .returning({ id: users.id })

  return result.length
}

// ====================================
// TRIAL PERIOD AND OAUTH QUERIES
// ====================================

// GetUserByOAuthId :one
export async function getUserByOAuthId(oauthId: string, authProvider: "google") {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      authProvider: users.authProvider,
      oauthId: users.oauthId,
      profilePicture: users.profilePicture,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      departmentName: departments.name,
      departmentCode: departments.code,
    })
    .from(users)
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .where(and(eq(users.oauthId, oauthId), eq(users.authProvider, authProvider)))
    .limit(1)

  return user
}

/**
 * Get user's trial status from workspace subscription
 * subscription 기반 trial 상태 조회 (workspace의 primary subscription 확인)
 *
 * @param userId - 사용자 ID
 * @returns trial 상태 정보 (subscription 기반)
 */
export async function getUserTrialStatusFromSubscription(userId: string) {
  // 1. 사용자가 소유한 workspace 조회
  const ownedWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
    })
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .limit(1)

  if (!ownedWorkspaces[0]) {
    // workspace가 없으면 trial 없음
    return {
      id: userId,
      isTrialActive: false,
      isTrialExpired: true,
      trialStartDate: null,
      trialEndDate: null,
      daysRemaining: 0,
    }
  }

  const workspaceId = ownedWorkspaces[0].id

  // 2. workspace의 primary subscription 조회
  const [subscription] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      trialStart: subscriptions.trialStart,
      trialEnd: subscriptions.trialEnd,
      tier: billingProducts.tier,
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(eq(subscriptions.workspaceId, workspaceId), eq(subscriptions.isPrimary, true)),
    )
    .limit(1)

  if (!subscription) {
    // subscription이 없으면 trial 없음
    return {
      id: userId,
      isTrialActive: false,
      isTrialExpired: true,
      trialStartDate: null,
      trialEndDate: null,
      daysRemaining: 0,
    }
  }

  // 3. trial 상태 계산
  const now = new Date()
  const isTrialActive = subscription.status === "trialing"
  const isTrialExpired = subscription.trialEnd && now > subscription.trialEnd

  return {
    id: userId,
    isTrialActive: isTrialActive && !isTrialExpired,
    isTrialExpired: !!isTrialExpired,
    trialStartDate: subscription.trialStart,
    trialEndDate: subscription.trialEnd,
    daysRemaining: subscription.trialEnd
      ? Math.max(
          0,
          Math.ceil(
            (subscription.trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
          ),
        )
      : 0,
  }
}

// CheckTrialStatus :one
// subscription 기반으로 trial 상태 조회 (users 테이블의 trial 필드는 더 이상 사용하지 않음)
export async function checkTrialStatus(userId: string) {
  return getUserTrialStatusFromSubscription(userId)
}

// Note: updateTrialStatus and extendTrial functions have been removed.
// Trial status is now managed directly through the subscriptions table.
// To update trial status, modify the subscription record instead.

// ====================================
// ONBOARDING OPERATIONS
// ====================================

/**
 * 사용자의 온보딩 상태 조회
 */
export async function getOnboardingStatus(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      onboardingSurvey: users.onboardingSurvey,
      onboardingStep: users.onboardingStep,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return null
  }

  return {
    userId: user.id,
    survey: user.onboardingSurvey,
    currentStep: user.onboardingStep || 0,
    isCompleted: user.onboardingCompletedAt !== null,
    completedAt: user.onboardingCompletedAt,
  }
}

/**
 * 온보딩 진행 단계 업데이트
 * @param userId - 사용자 ID
 * @param step - 현재 진행 단계 (1-4)
 */
export async function updateOnboardingStep(userId: string, step: number) {
  const [updatedUser] = await db
    .update(users)
    .set({
      onboardingStep: step,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      onboardingStep: users.onboardingStep,
    })

  return updatedUser
}

/**
 * 온보딩 완료 처리
 * @param userId - 사용자 ID
 */
export async function completeOnboarding(userId: string) {
  const [updatedUser] = await db
    .update(users)
    .set({
      onboardingStep: 5, // 완료 상태
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      onboardingStep: users.onboardingStep,
      onboardingCompletedAt: users.onboardingCompletedAt,
    })

  return updatedUser
}

/**
 * 온보딩 설문 데이터 업데이트
 */
export async function updateOnboardingSurvey(userId: string, survey: OnboardingSurvey) {
  const [updatedUser] = await db
    .update(users)
    .set({
      onboardingSurvey: {
        ...survey,
        completedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      onboardingSurvey: users.onboardingSurvey,
    })

  return updatedUser
}

/**
 * 온보딩 미완료 사용자 조회 (분석용)
 */
export async function getIncompleteOnboardingUsers(limit = 100) {
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      username: users.username,
      onboardingStep: users.onboardingStep,
      onboardingSurvey: users.onboardingSurvey,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(
      and(
        sql`${users.onboardingCompletedAt} IS NULL`,
        sql`${users.onboardingStep} IS NOT NULL`,
        sql`${users.onboardingStep} > 0`,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(limit)

  return result
}

// ====================================
// IAM ROLE SYNC FOR ADMIN PROMOTION
// ====================================

/**
 * 사용자가 관리자로 승격될 때 모든 워크스페이스의 IAM 역할을 Admin으로 동기화
 * @param userId - 사용자 ID
 */
export async function syncUserIamRolesOnPromotion(
  userId: string,
): Promise<{ workspaceId: string; roleName: string }[]> {
  // 사용자가 속한 모든 워크스페이스 멤버십 조회
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
      currentRole: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))

  const results: { workspaceId: string; roleName: string }[] = []

  for (const membership of memberships) {
    // 워크스페이스에 기본 역할이 없으면 생성
    await createDefaultRolesForWorkspace(membership.workspaceId)

    // IAM 역할 동기화 (Admin)
    await syncMemberRoleToIamRole(membership.memberId, membership.workspaceId, "admin")

    // workspace_members 테이블의 role 필드도 업데이트
    await db
      .update(workspaceMembers)
      .set({ role: "admin" })
      .where(eq(workspaceMembers.id, membership.memberId))

    results.push({
      workspaceId: membership.workspaceId,
      roleName: "Admin",
    })
  }

  return results
}

/**
 * 사용자가 관리자에서 일반 사용자로 강등될 때 IAM 역할을 Member로 동기화
 * @param userId - 사용자 ID
 */
export async function syncUserIamRolesOnDemotion(
  userId: string,
): Promise<{ workspaceId: string; roleName: string }[]> {
  // 사용자가 속한 모든 워크스페이스 멤버십 조회
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))

  const results: { workspaceId: string; roleName: string }[] = []

  for (const membership of memberships) {
    // IAM 역할을 Member로 동기화
    await syncMemberRoleToIamRole(membership.memberId, membership.workspaceId, "member")

    // workspace_members 테이블의 role 필드도 업데이트
    await db
      .update(workspaceMembers)
      .set({ role: "member" })
      .where(eq(workspaceMembers.id, membership.memberId))

    results.push({
      workspaceId: membership.workspaceId,
      roleName: "Member",
    })
  }

  return results
}

/**
 * 사용자의 현재 IAM 역할 정보 조회
 * @param userId - 사용자 ID
 */
export async function getUserIamRoles(userId: string): Promise<
  {
    workspaceId: string
    workspaceName: string
    iamRoles: string[]
  }[]
> {
  const memberships = await db
    .select({
      memberId: workspaceMembers.id,
      workspaceId: workspaceMembers.workspaceId,
    })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId))

  const results: { workspaceId: string; workspaceName: string; iamRoles: string[] }[] = []

  for (const membership of memberships) {
    // 워크스페이스 정보 조회
    const [workspace] = await db
      .select({ name: sql<string>`name` })
      .from(sql`workspaces`)
      .where(sql`id = ${membership.workspaceId}`)
      .limit(1)

    // 멤버의 IAM 역할 조회
    const memberRoles = await db
      .select({ roleName: sql<string>`r.name` })
      .from(iamMemberRoles)
      .innerJoin(sql`iam_workspace_roles r`, sql`${iamMemberRoles.roleId} = r.id`)
      .where(eq(iamMemberRoles.memberId, membership.memberId))

    results.push({
      workspaceId: membership.workspaceId,
      workspaceName: workspace?.name || "Unknown",
      iamRoles: memberRoles.map((r) => r.roleName),
    })
  }

  return results
}
