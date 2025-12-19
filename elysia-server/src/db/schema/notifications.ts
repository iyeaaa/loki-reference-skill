/**
 * Notifications Schema
 *
 * 사용자/워크스페이스 알림 관리
 * - 온보딩 진행 상황 알림
 * - 시스템 알림
 * - 읽음/안읽음 상태 관리
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// ============================================================================
// Enums
// ============================================================================

/**
 * 알림 타입
 * - onboarding: 온보딩 진행 상황
 * - system: 시스템 알림 (점검, 업데이트 등)
 * - success: 성공 알림
 * - error: 오류 알림
 * - info: 정보성 알림
 * - warning: 경고 알림
 */
export const notificationTypeEnum = pgEnum("notification_type_enum", [
  "onboarding",
  "system",
  "success",
  "error",
  "info",
  "warning",
])

/**
 * 알림 우선순위
 * - low: 낮음 (일반 정보)
 * - normal: 보통
 * - high: 높음 (중요)
 * - urgent: 긴급 (즉시 확인 필요)
 */
export const notificationPriorityEnum = pgEnum("notification_priority_enum", [
  "low",
  "normal",
  "high",
  "urgent",
])

// ============================================================================
// Tables
// ============================================================================

/**
 * Notifications 테이블
 *
 * 사용자별/워크스페이스별 알림 저장
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 연관 관계
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "cascade" }),

    // 알림 내용
    type: notificationTypeEnum("type").notNull().default("info"),
    priority: notificationPriorityEnum("priority").notNull().default("normal"),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message").notNull(),

    // 상태
    read: boolean("read").notNull().default(false),
    readAt: timestamp("read_at", { withTimezone: true }),

    // 메타데이터 (온보딩 진행률, 에러 정보 등)
    metadata: jsonb("metadata").$type<NotificationMetadata>(),

    // 관련 엔티티 (온보딩, 시퀀스 등)
    entityType: varchar("entity_type", { length: 50 }), // 'onboarding', 'sequence', 'lead', etc.
    entityId: uuid("entity_id"),

    // 만료 시간 (자동 삭제용)
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    // 타임스탬프
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    // 사용자별 알림 조회 최적화
    userIdIdx: index("notifications_user_id_idx").on(table.userId),
    // 워크스페이스별 알림 조회
    workspaceIdIdx: index("notifications_workspace_id_idx").on(table.workspaceId),
    // 읽지 않은 알림 조회 최적화
    userUnreadIdx: index("notifications_user_unread_idx").on(table.userId, table.read),
    // 타입별 조회
    typeIdx: index("notifications_type_idx").on(table.type),
    // 생성일 기준 정렬 최적화
    createdAtIdx: index("notifications_created_at_idx").on(table.createdAt),
    // 만료된 알림 정리용
    expiresAtIdx: index("notifications_expires_at_idx").on(table.expiresAt),
    // 복합 인덱스: 사용자 + 읽지않음 + 최신순
    userUnreadCreatedIdx: index("notifications_user_unread_created_idx").on(
      table.userId,
      table.read,
      table.createdAt,
    ),
  }),
)

// ============================================================================
// Relations
// ============================================================================

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
}))

// ============================================================================
// Types
// ============================================================================

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
export type NotificationType = (typeof notificationTypeEnum.enumValues)[number]
export type NotificationPriority = (typeof notificationPriorityEnum.enumValues)[number]

/**
 * 알림 메타데이터 타입
 */
export interface NotificationMetadata {
  // 온보딩 관련
  phase?: string
  progressPercent?: number
  jobId?: string

  // 오류 관련
  errorCode?: string
  errorDetails?: string

  // 액션 버튼
  actionUrl?: string
  actionLabel?: string

  // 기타 데이터
  [key: string]: unknown
}

/**
 * 알림 생성 파라미터
 */
export interface CreateNotificationParams {
  userId: string
  workspaceId?: string
  type: NotificationType
  priority?: NotificationPriority
  title: string
  message: string
  metadata?: NotificationMetadata
  entityType?: string
  entityId?: string
  expiresAt?: Date
}

/**
 * 알림 조회 필터
 */
export interface NotificationFilter {
  userId: string
  workspaceId?: string
  type?: NotificationType
  read?: boolean
  limit?: number
  offset?: number
}
