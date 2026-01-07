/**
 * Notification Service
 *
 * 알림 CRUD 및 관리 기능
 * - 알림 생성/조회/삭제
 * - 읽음 상태 관리
 * - 온보딩 SSE 이벤트 연동
 * - 실시간 알림 SSE 이벤트 발행
 */

import { and, count, desc, eq, isNull, lt, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import {
  type CreateNotificationParams,
  type Notification,
  type NotificationFilter,
  type NotificationMetadata,
  type NotificationPriority,
  type NotificationType,
  notifications,
} from "../db/schema/notifications"
import {
  createNotificationCreatedEvent,
  createNotificationDeletedEvent,
  createNotificationReadAllEvent,
  createNotificationReadEvent,
  createNotificationUpdatedEvent,
  emitNotificationEvent,
} from "../lib/redis/notification-events"
import type { OnboardingProgressEvent } from "../lib/redis/onboarding-events"
import logger from "../utils/logger"

// ============================================================================
// Constants
// ============================================================================

const MAX_NOTIFICATIONS_PER_USER = 100
const DEFAULT_EXPIRY_DAYS = 30

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * 알림 생성
 */
export async function createNotification(params: CreateNotificationParams): Promise<Notification> {
  const {
    userId,
    workspaceId,
    type,
    priority = "normal",
    title,
    message,
    metadata,
    entityType,
    entityId,
    expiresAt,
  } = params

  // 기본 만료 시간 설정 (30일)
  const defaultExpiry = new Date()
  defaultExpiry.setDate(defaultExpiry.getDate() + DEFAULT_EXPIRY_DAYS)

  const result = await db
    .insert(notifications)
    .values({
      userId,
      workspaceId,
      type,
      priority,
      title,
      message,
      metadata,
      entityType,
      entityId,
      expiresAt: expiresAt ?? defaultExpiry,
    })
    .returning()

  const notification = result[0]
  if (!notification) {
    throw new Error("Failed to create notification")
  }

  logger.debug({ notificationId: notification.id, userId, type }, "[Notification] Created")

  // 실시간 SSE 이벤트 발행
  await emitNotificationEvent(
    createNotificationCreatedEvent(userId, workspaceId ?? undefined, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      read: notification.read,
      metadata: notification.metadata ?? undefined,
      createdAt: notification.createdAt.toISOString(),
    }),
  )

  // 오래된 알림 정리 (최대 개수 초과 시)
  await cleanupOldNotifications(userId)

  return notification
}

/**
 * 사용자의 알림 목록 조회 (단일 쿼리 최적화)
 *
 * PostgreSQL 윈도우 함수를 사용하여 단일 쿼리로 목록 + 전체 개수 + 읽지 않은 개수 조회
 */
export async function getNotifications(filter: NotificationFilter): Promise<{
  notifications: Notification[]
  total: number
  unreadCount: number
}> {
  const { userId, workspaceId, type, read, limit = 50, offset = 0 } = filter

  // 동적 필터 조건 구성 - CTE에서 사용하기 위해 raw 컬럼명 사용
  const workspaceCondition = workspaceId ? sql`AND workspace_id = ${workspaceId}` : sql``
  const typeCondition = type ? sql`AND type = ${type}` : sql``
  const readCondition = read !== undefined ? sql`AND read = ${read}` : sql``

  // 단일 쿼리로 목록 + 전체 개수 + 읽지 않은 개수 조회
  const result = await db.execute<{
    id: string
    user_id: string
    workspace_id: string | null
    type: string
    priority: string
    title: string
    message: string
    read: boolean
    read_at: Date | null
    metadata: Record<string, unknown> | null
    entity_type: string | null
    entity_id: string | null
    expires_at: Date | null
    created_at: Date
    updated_at: Date
    total: string
    unread_count: string
  }>(sql`
    WITH base_filter AS (
      SELECT *
      FROM ${notifications}
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR NOW() < expires_at)
    ),
    counts AS (
      SELECT
        COUNT(*) FILTER (WHERE true ${workspaceCondition} ${typeCondition} ${readCondition}) as total,
        COUNT(*) FILTER (WHERE read = false ${workspaceCondition}) as unread_count
      FROM base_filter
    )
    SELECT
      n.*,
      c.total,
      c.unread_count
    FROM base_filter n
    CROSS JOIN counts c
    WHERE true ${workspaceCondition} ${typeCondition} ${readCondition}
    ORDER BY n.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `)

  // 결과가 없는 경우 개수만 조회
  if (result.rows.length === 0) {
    const countResult = await db.execute<{ total: string; unread_count: string }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE true ${workspaceCondition} ${typeCondition} ${readCondition}) as total,
        COUNT(*) FILTER (WHERE read = false ${workspaceCondition}) as unread_count
      FROM ${notifications}
      WHERE user_id = ${userId}
        AND (expires_at IS NULL OR NOW() < expires_at)
    `)

    return {
      notifications: [],
      total: Number(countResult.rows[0]?.total ?? 0),
      unreadCount: Number(countResult.rows[0]?.unread_count ?? 0),
    }
  }

  // 첫 번째 row에서 total, unread_count 추출
  const total = Number(result.rows[0]?.total ?? 0)
  const unreadCount = Number(result.rows[0]?.unread_count ?? 0)

  // snake_case → camelCase 변환
  const notificationList: Notification[] = result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    type: row.type as Notification["type"],
    priority: row.priority as Notification["priority"],
    title: row.title,
    message: row.message,
    read: row.read,
    readAt: row.read_at,
    metadata: row.metadata,
    entityType: row.entity_type,
    entityId: row.entity_id,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return {
    notifications: notificationList,
    total,
    unreadCount,
  }
}

/**
 * 알림 상세 조회
 */
export async function getNotificationById(
  notificationId: string,
  userId: string,
): Promise<Notification | null> {
  const [notification] = await db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .limit(1)

  return notification ?? null
}

/**
 * 읽지 않은 알림 개수 조회
 */
export async function getUnreadCount(userId: string, workspaceId?: string): Promise<number> {
  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.read, false),
    or(isNull(notifications.expiresAt), lt(sql`NOW()`, notifications.expiresAt)) ?? sql`true`,
  ]

  if (workspaceId) {
    conditions.push(eq(notifications.workspaceId, workspaceId))
  }

  const result = await db
    .select({ unreadCount: count() })
    .from(notifications)
    .where(and(...conditions))

  return result[0]?.unreadCount ?? 0
}

/**
 * 알림 읽음 처리
 */
export async function markAsRead(notificationId: string, userId: string): Promise<boolean> {
  const result = await db
    .update(notifications)
    .set({
      read: true,
      readAt: new Date(),
    })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id })

  const success = result.length > 0
  if (success) {
    logger.debug({ notificationId, userId }, "[Notification] Marked as read")
    // 실시간 SSE 이벤트 발행
    await emitNotificationEvent(createNotificationReadEvent(userId, notificationId))
  }

  return success
}

/**
 * 모든 알림 읽음 처리
 */
export async function markAllAsRead(userId: string, workspaceId?: string): Promise<number> {
  const conditions = [eq(notifications.userId, userId), eq(notifications.read, false)]

  if (workspaceId) {
    conditions.push(eq(notifications.workspaceId, workspaceId))
  }

  const result = await db
    .update(notifications)
    .set({
      read: true,
      readAt: new Date(),
    })
    .where(and(...conditions))
    .returning({ id: notifications.id })

  logger.debug({ userId, workspaceId, count: result.length }, "[Notification] Marked all as read")

  // 실시간 SSE 이벤트 발행
  if (result.length > 0) {
    await emitNotificationEvent(createNotificationReadAllEvent(userId, result.length))
  }

  return result.length
}

/**
 * 알림 삭제
 */
export async function deleteNotification(notificationId: string, userId: string): Promise<boolean> {
  const result = await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
    .returning({ id: notifications.id })

  const success = result.length > 0
  if (success) {
    logger.debug({ notificationId, userId }, "[Notification] Deleted")
    // 실시간 SSE 이벤트 발행
    await emitNotificationEvent(createNotificationDeletedEvent(userId, notificationId))
  }

  return success
}

/**
 * 모든 알림 삭제
 */
export async function deleteAllNotifications(
  userId: string,
  workspaceId?: string,
): Promise<number> {
  const conditions = [eq(notifications.userId, userId)]

  if (workspaceId) {
    conditions.push(eq(notifications.workspaceId, workspaceId))
  }

  const result = await db
    .delete(notifications)
    .where(and(...conditions))
    .returning({ id: notifications.id })

  logger.debug({ userId, workspaceId, count: result.length }, "[Notification] Deleted all")

  return result.length
}

// ============================================================================
// Cleanup Operations
// ============================================================================

/**
 * 오래된 알림 정리 (사용자별 최대 개수 유지)
 */
async function cleanupOldNotifications(userId: string): Promise<void> {
  try {
    // 현재 알림 개수 확인
    const totalResult = await db
      .select({ total: count() })
      .from(notifications)
      .where(eq(notifications.userId, userId))
    const total = totalResult[0]?.total ?? 0

    if (total > MAX_NOTIFICATIONS_PER_USER) {
      // 오래된 알림 삭제 (최대 개수 초과분)
      const toDelete = total - MAX_NOTIFICATIONS_PER_USER

      // 서브쿼리로 삭제할 ID 조회
      const oldNotifications = await db
        .select({ id: notifications.id })
        .from(notifications)
        .where(eq(notifications.userId, userId))
        .orderBy(notifications.createdAt) // 오래된 것부터
        .limit(toDelete)

      if (oldNotifications.length > 0) {
        const idsToDelete = oldNotifications.map((n) => n.id)
        await db
          .delete(notifications)
          .where(
            and(eq(notifications.userId, userId), sql`${notifications.id} = ANY(${idsToDelete})`),
          )

        logger.debug(
          { userId, deletedCount: oldNotifications.length },
          "[Notification] Cleaned up old notifications",
        )
      }
    }
  } catch (error) {
    logger.warn({ error, userId }, "[Notification] Failed to cleanup old notifications")
  }
}

/**
 * 만료된 알림 정리 (정기 작업용)
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const result = await db
    .delete(notifications)
    .where(
      and(sql`${notifications.expiresAt} IS NOT NULL`, lt(notifications.expiresAt, sql`NOW()`)),
    )
    .returning({ id: notifications.id })

  if (result.length > 0) {
    logger.info({ deletedCount: result.length }, "[Notification] Cleaned up expired notifications")
  }

  return result.length
}

// ============================================================================
// Onboarding Integration
// ============================================================================

/**
 * 온보딩 알림 메시지 템플릿
 */
function getOnboardingNotificationContent(event: OnboardingProgressEvent): {
  type: NotificationType
  priority: NotificationPriority
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
} {
  const { phase, details } = event
  const leadsFound = details.leadsFound || 0
  const previewsGenerated = details.previewsGenerated || 0

  switch (phase) {
    case "complete":
      return {
        type: "success",
        priority: "high",
        title: "바이어 찾기 완료! 🎉",
        message: `바이어 ${leadsFound}명과 이메일 ${previewsGenerated}개가 준비되었습니다`,
        // 체험판 유저는 결과 확인 불가하므로 CTA 제거
      }

    case "error":
      return {
        type: "error",
        priority: "urgent",
        title: "잠깐 문제가 생겼어요",
        message: details.error || "다시 시도해 주세요",
        actionUrl: "/app/trial?step=2",
        actionLabel: "다시 시도",
      }

    case "discovery":
      return {
        type: "onboarding",
        priority: "normal",
        title: "바이어 찾는 중",
        message: leadsFound > 0 ? `${leadsFound}명 찾았어요` : "바이어 검색 중...",
      }

    case "previews": {
      const totalPreviews = details.totalPreviews || 0
      return {
        type: "onboarding",
        priority: "normal",
        title: "이메일 작성 중",
        message:
          totalPreviews > 0 ? `${previewsGenerated}/${totalPreviews}개 완료` : "이메일 생성 중...",
      }
    }

    default:
      return {
        type: "onboarding",
        priority: "normal",
        title: "바이어 찾는 중",
        message: event.messageKr || event.message,
      }
  }
}

/**
 * 온보딩 SSE 이벤트로부터 알림 생성
 */
export async function createOnboardingNotification(
  userId: string,
  event: OnboardingProgressEvent,
): Promise<Notification> {
  const isComplete = event.phase === "complete"
  const isError = event.phase === "error"

  const content = getOnboardingNotificationContent(event)

  const metadata: NotificationMetadata = {
    phase: event.phase,
    progressPercent: event.progressPercent,
    jobId: event.jobId,
    leadsFound: event.details.leadsFound,
    previewsGenerated: event.details.previewsGenerated,
    totalPreviews: event.details.totalPreviews,
    actionUrl: content.actionUrl,
    actionLabel: content.actionLabel,
    parallelProgress: event.parallelProgress, // 병렬 진행률 정보 추가
    ...event.details,
  }

  // 완료/오류가 아닌 경우 1시간 후 만료
  let expiresAt: Date | undefined
  if (!isComplete && !isError) {
    expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)
  }

  return createNotification({
    userId,
    workspaceId: event.workspaceId,
    type: content.type,
    priority: content.priority,
    title: content.title,
    message: content.message,
    metadata,
    entityType: "onboarding",
    entityId: event.workspaceId,
    expiresAt,
  })
}

/**
 * 진행 중인 온보딩 알림 업데이트 (기존 알림 대체)
 *
 * 최적화:
 * - 완료/오류 시 기존 진행 알림 삭제 후 새 알림 생성
 * - 진행 중일 때는 기존 알림 업데이트 (스팸 방지)
 * - 의미있는 변화만 업데이트 (10% 이상 변화 또는 phase 변경)
 */
export async function upsertOnboardingProgressNotification(
  userId: string,
  event: OnboardingProgressEvent,
): Promise<Notification> {
  // 기존 진행 중 알림 찾기
  const [existing] = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.workspaceId, event.workspaceId),
        eq(notifications.type, "onboarding"),
        eq(notifications.entityType, "onboarding"),
      ),
    )
    .orderBy(desc(notifications.createdAt))
    .limit(1)

  // 완료/오류 이벤트는 새 알림 생성
  if (event.phase === "complete" || event.phase === "error") {
    // 기존 진행 중 알림 삭제
    if (existing) {
      await deleteNotification(existing.id, userId)
    }
    return createOnboardingNotification(userId, event)
  }

  // 기존 알림이 있으면 업데이트
  if (existing) {
    const existingMetadata = existing.metadata as NotificationMetadata | null
    const existingProgress = (existingMetadata?.progressPercent as number) || 0
    const existingPhase = existingMetadata?.phase as string | undefined

    // 의미있는 변화인지 확인 (5% 이상 변화 또는 phase 변경)
    const progressDiff = Math.abs(event.progressPercent - existingProgress)
    const phaseChanged = existingPhase !== event.phase
    const shouldUpdate = progressDiff >= 5 || phaseChanged

    if (!shouldUpdate) {
      // 변화가 미미하면 업데이트 스킵 (SSE 이벤트도 발행하지 않음)
      return existing
    }

    const content = getOnboardingNotificationContent(event)
    const metadata: NotificationMetadata = {
      phase: event.phase,
      progressPercent: event.progressPercent,
      jobId: event.jobId,
      leadsFound: event.details.leadsFound,
      previewsGenerated: event.details.previewsGenerated,
      totalPreviews: event.details.totalPreviews,
      parallelProgress: event.parallelProgress, // 병렬 진행률 정보 추가
      ...event.details,
    }

    await db
      .update(notifications)
      .set({
        title: content.title,
        message: content.message,
        metadata,
        read: false, // 업데이트 시 다시 안읽음 처리
        readAt: null,
      })
      .where(eq(notifications.id, existing.id))

    const updatedNotification = {
      ...existing,
      title: content.title,
      message: content.message,
      metadata,
      read: false,
      readAt: null,
    } as Notification

    // 실시간 SSE 이벤트 발행 (업데이트)
    await emitNotificationEvent(
      createNotificationUpdatedEvent(userId, event.workspaceId, {
        id: existing.id,
        type: existing.type,
        title: content.title,
        message: content.message,
        read: false,
        metadata,
        createdAt: existing.createdAt.toISOString(),
      }),
    )

    logger.debug(
      {
        notificationId: existing.id,
        phase: event.phase,
        progress: event.progressPercent,
      },
      "[Notification] Onboarding progress updated",
    )

    return updatedNotification
  }

  // 기존 알림이 없으면 새로 생성
  return createOnboardingNotification(userId, event)
}
