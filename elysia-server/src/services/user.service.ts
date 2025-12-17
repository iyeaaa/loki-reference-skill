import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { iamMemberRoles } from "../db/schema/iam"
import { departments, users } from "../db/schema/users"
import { workspaceMembers } from "../db/schema/workspaces"
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
export async function createUser(data: {
  username: string
  email: string
  passwordHash?: string
  userRole?: "user" | "admin"
  isActive?: boolean
  departmentId?: string
  employeeId?: string
}) {
  // Calculate trial period (7 days from now)
  const trialStartDate = new Date()
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 7)

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
      trialStartDate,
      trialEndDate,
      isTrialActive: true,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      userRole: users.userRole,
      isActive: users.isActive,
      departmentId: users.departmentId,
      employeeId: users.employeeId,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
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

// SoftDeleteUser :exec
// ユーザーアカウントのソフト削除手順:
// 1. すべてのNylasグラント（メール接続）を取り消し - トランザクション外で実行
// 2. IAMロール割り当てを削除（ワークスペースメンバー削除前に実行必須）
// 3. すべてのワークスペースメンバーシップを削除
// 4. GDPR準拠のため個人データを匿名化
// 5. isActiveをfalseに設定
export async function softDeleteUser(id: string) {
  const timestamp = Date.now()
  const anonymizedEmail = `deleted_${timestamp}_${id.slice(0, 8)}@deleted.local`
  const anonymizedUsername = `deleted_user_${timestamp}`

  logger.info({ userId: id }, "Starting soft delete user process")

  // 1. このユーザーのメールアカウントのすべてのNylasグラントを取り消し（トランザクション外 - 外部API呼び出し）
  const emailAccounts = await db
    .select({
      id: userEmailAccounts.id,
      apiKey: userEmailAccounts.apiKey,
      emailAddress: userEmailAccounts.emailAddress,
      workspaceId: userEmailAccounts.workspaceId,
    })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.userId, id))

  logger.info(
    { userId: id, emailAccountCount: emailAccounts.length },
    "Found email accounts for user deletion",
  )

  let nylasGrantsDeleted = 0
  let nylasGrantsFailed = 0

  for (const account of emailAccounts) {
    // NylasのgrantIdの場合のみ取り消し（"SG"で始まるSendGrid APIキーは除外）
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
        // ログ出力のみで失敗させない - グラントが既に無効な可能性あり
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
      totalEmailAccounts: emailAccounts.length,
      nylasGrantsDeleted,
      nylasGrantsFailed,
    },
    "Completed Nylas grant deletion process",
  )

  // 2-5. データベース操作をトランザクション内で実行
  await db.transaction(async (tx) => {
    // 2. 削除前にワークスペースメンバーIDを取得（IAMロールクリーンアップに必要）
    const memberIds = await tx
      .select({ id: workspaceMembers.id, workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, id))

    logger.info(
      { userId: id, membershipCount: memberIds.length },
      "Found workspace memberships for user",
    )

    // 3. すべてのIAMロール割り当てを削除（ワークスペースメンバー削除前に実行必須）
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

    // 4. すべてのワークスペースメンバーシップを削除
    await tx.delete(workspaceMembers).where(eq(workspaceMembers.userId, id))
    logger.info({ userId: id, membershipCount: memberIds.length }, "Deleted workspace memberships")

    // 5. ユーザーのメールアカウントIDを取得
    const userEmailAccountIds = await tx
      .select({ id: userEmailAccounts.id })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, id))

    // 6. これらのメールアカウントから送信されたすべてのメールを削除（FK制約のため先に削除）
    if (userEmailAccountIds.length > 0) {
      const accountIds = userEmailAccountIds.map((acc) => acc.id)
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
        "Deleted emails for user email accounts",
      )
    }

    // 7. すべてのユーザーメールアカウントを削除
    // 注意: Soft deleteなのでcascadeが作動しない。明示的に削除が必要
    const deletedEmailAccounts = await tx
      .delete(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, id))
      .returning({ id: userEmailAccounts.id })
    logger.info(
      { userId: id, deletedEmailAccountsCount: deletedEmailAccounts.length },
      "Deleted user email accounts",
    )

    // 6. ユーザーをソフト削除して匿名化
    // Google OAuth 연결 (oauthId)도 null로 설정하여 완전히 연결 해제
    await tx
      .update(users)
      .set({
        isActive: false,
        email: anonymizedEmail,
        username: anonymizedUsername,
        passwordHash: null,
        profilePicture: null,
        oauthId: null, // Google OAuth 연결 해제
        employeeId: null,
        departmentId: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))

    logger.info(
      { userId: id, anonymizedEmail, anonymizedUsername },
      "User anonymized and soft deleted successfully",
    )
  })

  logger.info(
    {
      userId: id,
      emailAccountsProcessed: emailAccounts.length,
      nylasGrantsDeleted,
      nylasGrantsFailed,
    },
    "Soft delete user process completed successfully",
  )

  // 삭제 후 검증: 남은 데이터가 있는지 확인
  await verifyUserDeletion(id)
}

/**
 * 사용자 삭제 후 남은 데이터 검증
 * 찌꺼기 데이터가 남아있는지 확인
 */
async function verifyUserDeletion(userId: string) {
  try {
    // 1. 이메일 계정 확인
    const remainingEmailAccounts = await db
      .select({ count: count() })
      .from(userEmailAccounts)
      .where(eq(userEmailAccounts.userId, userId))

    // 2. 워크스페이스 멤버십 확인
    const remainingMemberships = await db
      .select({ count: count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))

    // 3. IAM 역할 확인 (member_id를 통해 확인)
    const remainingIamRoles = await db
      .select({ count: count() })
      .from(iamMemberRoles)
      .innerJoin(workspaceMembers, eq(iamMemberRoles.memberId, workspaceMembers.id))
      .where(eq(workspaceMembers.userId, userId))

    // 4. 사용자 정보 확인 (익명화 확인)
    const [user] = await db
      .select({
        isActive: users.isActive,
        email: users.email,
        oauthId: users.oauthId,
        passwordHash: users.passwordHash,
        profilePicture: users.profilePicture,
      })
      .from(users)
      .where(eq(users.id, userId))

    const emailAccountCount = Number(remainingEmailAccounts[0]?.count || 0)
    const membershipCount = Number(remainingMemberships[0]?.count || 0)
    const iamRoleCount = Number(remainingIamRoles[0]?.count || 0)

    const isAnonymized =
      user &&
      !user.isActive &&
      user.email.includes("@deleted.local") &&
      user.oauthId === null &&
      user.passwordHash === null &&
      user.profilePicture === null

    const hasLeftoverData = emailAccountCount > 0 || membershipCount > 0 || iamRoleCount > 0

    if (hasLeftoverData || !isAnonymized) {
      logger.error(
        {
          userId,
          emailAccountCount,
          membershipCount,
          iamRoleCount,
          isAnonymized,
          userEmail: user?.email,
        },
        "⚠️ WARNING: User deletion verification failed - leftover data detected!",
      )
    } else {
      logger.info(
        {
          userId,
          emailAccountCount,
          membershipCount,
          iamRoleCount,
          isAnonymized,
        },
        "✅ User deletion verification passed - no leftover data",
      )
    }
  } catch (error) {
    logger.error({ err: error, userId }, "Failed to verify user deletion")
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

  // Calculate trial period (7 days from now)
  const trialStartDate = new Date()
  const trialEndDate = new Date()
  trialEndDate.setDate(trialEndDate.getDate() + 7)

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
      trialStartDate,
      trialEndDate,
      isTrialActive: true,
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
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
      onboardingSurvey: users.onboardingSurvey,
      onboardingStep: users.onboardingStep,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
    })

  // Create default workspace for new trial users
  if (!existingUser && upsertedUser?.isTrialActive) {
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
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
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

// CheckTrialStatus :one
export async function checkTrialStatus(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return null
  }

  // Check if trial has expired
  const now = new Date()
  const isTrialExpired = user.trialEndDate && now > user.trialEndDate

  return {
    ...user,
    isTrialExpired,
    daysRemaining: user.trialEndDate
      ? Math.max(
          0,
          Math.ceil((user.trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : null,
  }
}

// UpdateTrialStatus :one
export async function updateTrialStatus(userId: string, isTrialActive: boolean) {
  const [updatedUser] = await db
    .update(users)
    .set({
      isTrialActive,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      isTrialActive: users.isTrialActive,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
    })

  return updatedUser
}

// ExtendTrial :one
export async function extendTrial(userId: string, additionalDays: number) {
  const user = await checkTrialStatus(userId)
  if (!user) {
    throw new Error("User not found")
  }

  const newEndDate = new Date()
  if (user.trialEndDate && user.trialEndDate > new Date()) {
    // Extend from current end date if trial is still active
    newEndDate.setTime(user.trialEndDate.getTime())
  }
  newEndDate.setDate(newEndDate.getDate() + additionalDays)

  const [updatedUser] = await db
    .update(users)
    .set({
      trialEndDate: newEndDate,
      isTrialActive: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      trialStartDate: users.trialStartDate,
      trialEndDate: users.trialEndDate,
      isTrialActive: users.isTrialActive,
    })

  return updatedUser
}

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
