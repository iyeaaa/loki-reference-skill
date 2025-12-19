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
 * 사용자의 알림 목록 조회
 */
export async function getNotifications(filter: NotificationFilter): Promise<{
  notifications: Notification[]
  total: number
  unreadCount: number
}> {
  const { userId, workspaceId, type, read, limit = 50, offset = 0 } = filter

  // 필터 조건 구성
  const conditions = [eq(notifications.userId, userId)]

  if (workspaceId) {
    conditions.push(eq(notifications.workspaceId, workspaceId))
  }

  if (type) {
    conditions.push(eq(notifications.type, type))
  }

  if (read !== undefined) {
    conditions.push(eq(notifications.read, read))
  }

  // 만료되지 않은 알림만 조회
  conditions.push(
    or(isNull(notifications.expiresAt), lt(sql`NOW()`, notifications.expiresAt)) ?? sql`true`,
  )

  // 알림 목록 조회
  const notificationList = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset)

  // 전체 개수 조회
  const totalResult = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(...conditions))
  const total = totalResult[0]?.total ?? 0

  // 읽지 않은 알림 개수 조회
  const unreadResult = await db
    .select({ unreadCount: count() })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.read, false),
        or(isNull(notifications.expiresAt), lt(sql`NOW()`, notifications.expiresAt)) ?? sql`true`,
      ),
    )
  const unreadCount = unreadResult[0]?.unreadCount ?? 0

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
 * 온보딩 SSE 이벤트로부터 알림 생성
 */
export async function createOnboardingNotification(
  userId: string,
  event: OnboardingProgressEvent,
): Promise<Notification> {
  const isComplete = event.phase === "complete"
  const isError = event.phase === "error"

  let type: NotificationType
  let priority: NotificationPriority
  let title: string

  if (isComplete) {
    type = "success"
    priority = "high"
    title = "맞춤 리드 생성 완료"
  } else if (isError) {
    type = "error"
    priority = "urgent"
    title = "리드 생성 중 문제 발생"
  } else {
    type = "onboarding"
    priority = "normal"
    title = "맞춤 리드 생성 중"
  }

  const metadata: NotificationMetadata = {
    phase: event.phase,
    progressPercent: event.progressPercent,
    jobId: event.jobId,
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
    type,
    priority,
    title,
    message: event.messageKr || event.message,
    metadata,
    entityType: "onboarding",
    entityId: event.workspaceId,
    expiresAt,
  })
}

/**
 * 진행 중인 온보딩 알림 업데이트 (기존 알림 대체)
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

  // 기존 알림 업데이트 또는 새로 생성
  if (existing) {
    const metadata: NotificationMetadata = {
      phase: event.phase,
      progressPercent: event.progressPercent,
      jobId: event.jobId,
      ...event.details,
    }

    await db
      .update(notifications)
      .set({
        message: event.messageKr || event.message,
        metadata,
        read: false, // 업데이트 시 다시 안읽음 처리
        readAt: null,
      })
      .where(eq(notifications.id, existing.id))

    const updatedNotification = {
      ...existing,
      message: event.messageKr || event.message,
      metadata,
    } as Notification

    // 실시간 SSE 이벤트 발행 (업데이트)
    await emitNotificationEvent(
      createNotificationUpdatedEvent(userId, event.workspaceId, {
        id: existing.id,
        type: existing.type,
        title: existing.title,
        message: event.messageKr || event.message,
        read: false,
        metadata,
        createdAt: existing.createdAt.toISOString(),
      }),
    )

    return updatedNotification
  }

  return createOnboardingNotification(userId, event)
}
