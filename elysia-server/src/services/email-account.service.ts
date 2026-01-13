import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emails } from "../db/schema/emails"
import { sequenceEnrollments } from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import logger from "../utils/logger"

// ====================================
// EMAIL ACCOUNT CRUD OPERATIONS
// ====================================

// GetEmailAccount :one
export async function getEmailAccount(id: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      apiKey: userEmailAccounts.apiKey,
      sendgridVerifiedSenderId: userEmailAccounts.sendgridVerifiedSenderId,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      lastResetDaily: userEmailAccounts.lastResetDaily,
      lastResetMonthly: userEmailAccounts.lastResetMonthly,
      status: userEmailAccounts.status,
      lastError: userEmailAccounts.lastError,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .where(eq(userEmailAccounts.id, id))
    .limit(1)

  return result[0]
}

// CreateEmailAccount :one
export async function createEmailAccount(data: {
  userId: string
  workspaceId: string
  provider: "sendgrid" | "nylas" | "unipile"
  emailAddress: string
  displayName?: string
  apiKey: string
  sendgridVerifiedSenderId?: string
  isVerified?: boolean
  isDefault?: boolean
  dailyLimit?: number
  monthlyLimit?: number
  status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
}) {
  const [newAccount] = await db
    .insert(userEmailAccounts)
    .values({
      userId: data.userId,
      workspaceId: data.workspaceId,
      provider: data.provider,
      emailAddress: data.emailAddress,
      displayName: data.displayName || null,
      apiKey: data.apiKey,
      sendgridVerifiedSenderId: data.sendgridVerifiedSenderId || null,
      isVerified: data.isVerified || false,
      isDefault: data.isDefault || false,
      dailyLimit: data.dailyLimit || null,
      monthlyLimit: data.monthlyLimit || null,
      status: data.status || "inactive",
    })
    .returning({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
    })

  return newAccount
}

// UpdateEmailAccount :one
export async function updateEmailAccount(
  id: string,
  data: {
    emailAddress: string
    displayName?: string
    apiKey: string
    sendgridVerifiedSenderId?: string
    isVerified: boolean
    isDefault: boolean
    dailyLimit?: number
    monthlyLimit?: number
    status: "active" | "inactive" | "error" | "rate_limited" | "suspended"
  },
) {
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      emailAddress: data.emailAddress,
      displayName: data.displayName,
      apiKey: data.apiKey,
      sendgridVerifiedSenderId: data.sendgridVerifiedSenderId,
      isVerified: data.isVerified,
      isDefault: data.isDefault,
      dailyLimit: data.dailyLimit,
      monthlyLimit: data.monthlyLimit,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
    })

  return updatedAccount
}

// DeleteEmailAccount :exec
export async function deleteEmailAccount(id: string) {
  // 0. 이메일 계정 정보 조회 (Unipile 연동 확인용)
  const emailAccount = await db.query.userEmailAccounts.findFirst({
    where: eq(userEmailAccounts.id, id),
    columns: {
      id: true,
      provider: true,
      apiKey: true,
      emailAddress: true,
    },
  })

  if (!emailAccount) {
    logger.warn({ emailAccountId: id }, "Email account not found for deletion")
    return
  }

  // 0-1. Unipile 계정이면 Unipile API에서도 삭제
  if (emailAccount.provider === "unipile") {
    try {
      const unipileAccountId = emailAccount.apiKey
      const { deleteAccount } = await import("./unipile.service")
      const deleted = await deleteAccount(unipileAccountId)

      if (deleted) {
        logger.info(
          { emailAccountId: id, unipileAccountId },
          "✅ Unipile account deleted from Unipile API",
        )
      } else {
        logger.warn(
          { emailAccountId: id, unipileAccountId },
          "⚠️ Failed to delete Unipile account from Unipile API (continuing with local deletion)",
        )
      }

      // Unipile 계정이 모두 삭제되었는지 확인 (webhook 정리용)
      const remainingUnipileAccounts = await db.query.userEmailAccounts.findMany({
        where: and(
          eq(userEmailAccounts.provider, "unipile"),
          sql`${userEmailAccounts.id} != ${id}`, // 현재 삭제 중인 계정 제외
        ),
        columns: { id: true },
      })

      if (remainingUnipileAccounts.length === 0) {
        // 마지막 Unipile 계정 → webhook 삭제
        try {
          const { listWebhooks, deleteWebhook } = await import("./unipile.service")
          const { config } = await import("../config")
          const webhooksResult = await listWebhooks()
          const webhookUrl = `${config.appUrl}/api/v1/unipile/webhook`

          const existingWebhook = webhooksResult.webhooks?.find(
            (wh) => wh.request_url === webhookUrl && wh.events?.includes("mail_received"),
          )

          if (existingWebhook) {
            const webhookDeleted = await deleteWebhook(existingWebhook.id)
            if (webhookDeleted) {
              logger.info(
                { webhookId: existingWebhook.id },
                "✅ Unipile webhook deleted (no accounts remaining)",
              )
            }
          }
        } catch (webhookError) {
          logger.warn({ err: webhookError }, "⚠️ Error cleaning up Unipile webhook (non-critical)")
        }
      }
    } catch (unipileError) {
      logger.error(
        { err: unipileError, emailAccountId: id },
        "❌ Error deleting Unipile account (continuing with local deletion)",
      )
    }
  }

  // 1. 연관된 시퀀스 등록(sequence_enrollments)을 먼저 삭제 (FK 제약 조건 때문)
  const deletedEnrollments = await db
    .delete(sequenceEnrollments)
    .where(eq(sequenceEnrollments.userEmailAccountId, id))
    .returning({ id: sequenceEnrollments.id })

  if (deletedEnrollments.length > 0) {
    logger.info(
      { emailAccountId: id, deletedEnrollmentsCount: deletedEnrollments.length },
      "Deleted sequence enrollments associated with email account",
    )
  }

  // 2. 연관된 이메일들을 삭제 (FK 제약 조건 때문)
  const deletedEmails = await db
    .delete(emails)
    .where(eq(emails.userEmailAccountId, id))
    .returning({ id: emails.id })

  if (deletedEmails.length > 0) {
    logger.info(
      { emailAccountId: id, deletedEmailsCount: deletedEmails.length },
      "Deleted emails associated with email account",
    )
  }

  // 3. 이메일 계정 삭제
  await db.delete(userEmailAccounts).where(eq(userEmailAccounts.id, id))
  logger.info({ emailAccountId: id }, "Deleted email account")
}

// ====================================
// EMAIL ACCOUNT QUERY AND SEARCH OPERATIONS
// ====================================

// ListEmailAccounts :many
export async function listEmailAccounts(limit: number, offset: number) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      status: userEmailAccounts.status,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .orderBy(desc(userEmailAccounts.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListEmailAccountsWithFilters :many
export async function listEmailAccountsWithFilters(
  limit: number,
  offset: number,
  filters?: {
    status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
    isVerified?: boolean
    isDefault?: boolean
    search?: string
    userIds?: string[]
    workspaceIds?: string[]
  },
) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(userEmailAccounts.status, filters.status))
  }

  if (filters?.isVerified !== undefined) {
    conditions.push(eq(userEmailAccounts.isVerified, filters.isVerified))
  }

  if (filters?.isDefault !== undefined) {
    conditions.push(eq(userEmailAccounts.isDefault, filters.isDefault))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(userEmailAccounts.emailAddress, `%${filters.search}%`),
      ilike(userEmailAccounts.displayName, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(userEmailAccounts.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(userEmailAccounts.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      status: userEmailAccounts.status,
      lastSyncAt: userEmailAccounts.lastSyncAt,
      createdAt: userEmailAccounts.createdAt,
      updatedAt: userEmailAccounts.updatedAt,
      username: users.username,
      userEmail: users.email,
      workspaceName: workspaces.name,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .innerJoin(workspaces, eq(userEmailAccounts.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(userEmailAccounts.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetEmailAccountsByUser :many
export async function getEmailAccountsByUser(userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .where(eq(userEmailAccounts.userId, userId))
    .orderBy(desc(userEmailAccounts.isDefault), desc(userEmailAccounts.createdAt))

  return result
}

// GetEmailAccountsByWorkspace :many
export async function getEmailAccountsByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      username: users.username,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .innerJoin(users, eq(userEmailAccounts.userId, users.id))
    .where(eq(userEmailAccounts.workspaceId, workspaceId))
    .orderBy(desc(userEmailAccounts.createdAt))

  return result
}

// GetActiveEmailAccounts :many
export async function getActiveEmailAccounts(workspaceId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
    })
    .from(userEmailAccounts)
    .where(
      and(eq(userEmailAccounts.workspaceId, workspaceId), eq(userEmailAccounts.status, "active")),
    )
    .orderBy(userEmailAccounts.emailAddress)

  return result
}

// GetEmailAccountByWorkspaceAndUser :one
export async function getEmailAccountByWorkspaceAndUser(workspaceId: string, userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      displayName: userEmailAccounts.displayName,
      isVerified: userEmailAccounts.isVerified,
      isDefault: userEmailAccounts.isDefault,
      status: userEmailAccounts.status,
      dailyLimit: userEmailAccounts.dailyLimit,
      monthlyLimit: userEmailAccounts.monthlyLimit,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
      createdAt: userEmailAccounts.createdAt,
    })
    .from(userEmailAccounts)
    .where(
      and(
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.userId, userId),
        eq(userEmailAccounts.status, "active"),
      ),
    )
    .limit(1)

  return result[0]
}

// GetEmailAccountByWorkspaceAndUserAny :one (includes inactive/trial accounts)
// Use this when you need to find accounts regardless of status (e.g., TRIAL_PREVIEW accounts)
export async function getEmailAccountByWorkspaceAndUserAny(workspaceId: string, userId: string) {
  const result = await db
    .select({
      id: userEmailAccounts.id,
      userId: userEmailAccounts.userId,
      workspaceId: userEmailAccounts.workspaceId,
      emailAddress: userEmailAccounts.emailAddress,
      apiKey: userEmailAccounts.apiKey, // Need this to check TRIAL_PREVIEW
      status: userEmailAccounts.status,
    })
    .from(userEmailAccounts)
    .where(
      and(eq(userEmailAccounts.workspaceId, workspaceId), eq(userEmailAccounts.userId, userId)),
    )
    .limit(1)

  return result[0]
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountEmailAccounts :one
export async function countEmailAccounts() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(userEmailAccounts)

  return result[0]?.count ?? 0
}

// CountEmailAccountsWithFilters :one
export async function countEmailAccountsWithFilters(filters?: {
  status?: "active" | "inactive" | "error" | "rate_limited" | "suspended"
  isVerified?: boolean
  isDefault?: boolean
  search?: string
  userIds?: string[]
  workspaceIds?: string[]
}) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(userEmailAccounts.status, filters.status))
  }

  if (filters?.isVerified !== undefined) {
    conditions.push(eq(userEmailAccounts.isVerified, filters.isVerified))
  }

  if (filters?.isDefault !== undefined) {
    conditions.push(eq(userEmailAccounts.isDefault, filters.isDefault))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(userEmailAccounts.emailAddress, `%${filters.search}%`),
      ilike(userEmailAccounts.displayName, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.userIds && filters.userIds.length > 0) {
    const userCondition = or(...filters.userIds.map((id) => eq(userEmailAccounts.userId, id)))
    if (userCondition) {
      conditions.push(userCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(userEmailAccounts.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(userEmailAccounts)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(
  accountIds: string[],
  status: "active" | "inactive" | "error" | "rate_limited" | "suspended",
) {
  const idCondition = or(...accountIds.map((id) => eq(userEmailAccounts.id, id)))
  if (!idCondition) {
    return 0
  }

  const result = await db
    .update(userEmailAccounts)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(idCondition)
    .returning({ id: userEmailAccounts.id })

  return result.length
}

// UpdateSentCount :one
export async function updateSentCount(id: string) {
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      dailySentCount: sql`${userEmailAccounts.dailySentCount} + 1`,
      monthlySentCount: sql`${userEmailAccounts.monthlySentCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      dailySentCount: userEmailAccounts.dailySentCount,
      monthlySentCount: userEmailAccounts.monthlySentCount,
    })

  return updatedAccount
}

// ResetDailySentCount :exec
export async function resetDailySentCount(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      dailySentCount: 0,
      lastResetDaily: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// ResetMonthlySentCount :exec
export async function resetMonthlySentCount(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      monthlySentCount: 0,
      lastResetMonthly: new Date().toISOString().split("T")[0],
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// UpdateLastError :exec
export async function updateLastError(id: string, errorMessage: string) {
  await db
    .update(userEmailAccounts)
    .set({
      lastError: errorMessage,
      status: "error",
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// UpdateLastSync :exec
export async function updateLastSync(id: string) {
  await db
    .update(userEmailAccounts)
    .set({
      lastSyncAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
}

// SetAsDefault :one
export async function setAsDefault(id: string, userId: string, workspaceId: string) {
  // First, unset all other defaults for this user in this workspace
  await db
    .update(userEmailAccounts)
    .set({ isDefault: false })
    .where(
      and(eq(userEmailAccounts.userId, userId), eq(userEmailAccounts.workspaceId, workspaceId)),
    )

  // Then set the specified account as default
  const [updatedAccount] = await db
    .update(userEmailAccounts)
    .set({
      isDefault: true,
      updatedAt: new Date(),
    })
    .where(eq(userEmailAccounts.id, id))
    .returning({
      id: userEmailAccounts.id,
      isDefault: userEmailAccounts.isDefault,
    })

  return updatedAccount
}

// ====================================
// TRIAL EXPIRATION - UNIPILE DISCONNECT
// ====================================

/**
 * 워크스페이스의 모든 Unipile 계정 해지
 * Trial 만료 후 유예 기간 종료 시 호출
 *
 * 참고: suspended 상태의 계정은 유료 플랜 재구독 시 다시 연동 가능합니다.
 *
 * @param workspaceId - 대상 워크스페이스 ID
 * @param reason - 해지 사유 (로그용)
 * @returns 해지된 계정 수
 */
export async function disconnectWorkspaceUnipileAccounts(
  workspaceId: string,
  reason: string,
): Promise<number> {
  // 1. 해당 워크스페이스의 Unipile 계정 조회 (active 상태만)
  const unipileAccounts = await db
    .select({
      id: userEmailAccounts.id,
      apiKey: userEmailAccounts.apiKey, // Unipile account_id
      emailAddress: userEmailAccounts.emailAddress,
    })
    .from(userEmailAccounts)
    .where(
      and(
        eq(userEmailAccounts.workspaceId, workspaceId),
        eq(userEmailAccounts.provider, "unipile"),
        eq(userEmailAccounts.status, "active"),
      ),
    )

  if (unipileAccounts.length === 0) {
    logger.info({ workspaceId }, "[UnipileDisconnect] No active Unipile accounts to disconnect")
    return 0
  }

  let disconnectedCount = 0

  for (const account of unipileAccounts) {
    try {
      // 2. Unipile API에서 계정 삭제
      const { deleteAccount } = await import("./unipile.service")
      await deleteAccount(account.apiKey)

      // 3. DB에서 계정 상태를 suspended로 변경 (삭제하지 않고 보존 - 재구독 시 복구 가능)
      // 복구 안내 메시지 포함
      const suspendReason = `${reason} | 유료 플랜 구독 시 이메일 계정을 다시 연동할 수 있습니다.`
      await db
        .update(userEmailAccounts)
        .set({
          status: "suspended",
          lastError: suspendReason,
          updatedAt: new Date(),
        })
        .where(eq(userEmailAccounts.id, account.id))

      disconnectedCount++

      logger.info(
        { workspaceId, accountId: account.id, email: account.emailAddress },
        "[UnipileDisconnect] Unipile account suspended (recoverable with paid subscription)",
      )
    } catch (error) {
      // API 실패해도 다른 계정 처리 계속 진행
      logger.error(
        { error, workspaceId, accountId: account.id },
        "[UnipileDisconnect] Failed to disconnect Unipile account",
      )
    }
  }

  return disconnectedCount
}

/**
 * Unipile 해지 예정 워크스페이스 조회 (알림용)
 * Trial 만료 후 4일 경과 ~ 7일 미만인 워크스페이스
 * 이 함수를 사용하여 해지 3일 전에 고객에게 알림을 보낼 수 있습니다.
 *
 * @returns 해지 예정 워크스페이스 목록 (알림 발송용)
 */
export async function getUnipileDisconnectWarningTargets(): Promise<
  Array<{
    workspaceId: string
    trialEnd: Date | null
    daysUntilDisconnect: number
  }>
> {
  const now = new Date()
  const { subscriptions, billingPlans, billingProducts } = await import("../db/schema/billing")
  const { lt, and, eq } = await import("drizzle-orm")

  // 4일 전 ~ 7일 전 범위 계산
  const warningStartCutoff = new Date(now)
  warningStartCutoff.setDate(warningStartCutoff.getDate() - 7) // 7일 전

  const warningEndCutoff = new Date(now)
  warningEndCutoff.setDate(warningEndCutoff.getDate() - 4) // 4일 전

  const targets = await db
    .select({
      workspaceId: subscriptions.workspaceId,
      trialEnd: subscriptions.trialEnd,
    })
    .from(subscriptions)
    .innerJoin(billingPlans, eq(subscriptions.planId, billingPlans.id))
    .innerJoin(billingProducts, eq(billingPlans.productId, billingProducts.id))
    .where(
      and(
        eq(subscriptions.status, "expired"),
        lt(subscriptions.trialEnd, warningEndCutoff), // 4일 이상 경과
        eq(billingProducts.tier, "trial"),
        eq(subscriptions.isPrimary, true),
      ),
    )

  return targets
    .filter((t) => t.trialEnd && t.trialEnd > warningStartCutoff)
    .map((t) => ({
      workspaceId: t.workspaceId,
      trialEnd: t.trialEnd,
      daysUntilDisconnect: t.trialEnd
        ? Math.ceil((7 - (now.getTime() - t.trialEnd.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10
        : 0,
    }))
}
