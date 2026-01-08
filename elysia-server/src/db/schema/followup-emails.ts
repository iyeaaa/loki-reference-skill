/**
 * Followup Emails Schema
 *
 * 환영 이메일 및 팔로업 이메일 발송 기록 관리
 * - 환영 이메일 (가입 즉시)
 * - 단계별 팔로업 이메일 (온보딩 중단 시)
 * - 중복 발송 방지 (user_id + email_type unique)
 * - 이메일 오픈/클릭 추적
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// ============================================================================
// Enum
// ============================================================================

/**
 * 팔로업 이메일 타입 (온보딩 퍼널 기준)
 *
 * - welcome: 환영 이메일 (가입 즉시)
 * - signup_only: 구글 로그인 후 Step 1(회사정보 입력) 미진행 (24시간 경과)
 * - before_connect: Step 1 완료 → Step 2+3 자동 완료 → Unipile 이메일 연동 미진행 (48시간 경과)
 * - no_campaign: Unipile 이메일 연동 완료 후 캠페인 미발송 (48시간 경과)
 * - inactive_7days: 7일간 접속 없음
 */
export const followupEmailTypeEnum = pgEnum("followup_email_type", [
  "welcome",
  "signup_only",
  "before_connect",
  "no_campaign",
  "inactive_7days",
])

// ============================================================================
// Table
// ============================================================================

export const followupEmails = pgTable(
  "followup_emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 관계
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, { onDelete: "set null" }),

    // 이메일 정보
    emailType: followupEmailTypeEnum("email_type").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    loopsMessageId: varchar("loops_message_id", { length: 255 }),

    // 추적 정보 (Loops webhook으로 업데이트)
    opened: boolean("opened").default(false),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clicked: boolean("clicked").default(false),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),

    // 메타
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 인덱스
    userIdIdx: index("idx_followup_emails_user_id").on(table.userId),
    emailTypeIdx: index("idx_followup_emails_email_type").on(table.emailType),
    sentAtIdx: index("idx_followup_emails_sent_at").on(table.sentAt),
    typeOpenedIdx: index("idx_followup_emails_type_opened").on(table.emailType, table.opened),

    // 중복 발송 방지: 사용자당 이메일 타입별 1회만
    uniqueUserEmailType: unique("unique_user_email_type").on(table.userId, table.emailType),
  }),
)

// ============================================================================
// Relations
// ============================================================================

export const followupEmailsRelations = relations(followupEmails, ({ one }) => ({
  user: one(users, {
    fields: [followupEmails.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [followupEmails.workspaceId],
    references: [workspaces.id],
  }),
}))

// ============================================================================
// Types
// ============================================================================

export type FollowupEmail = typeof followupEmails.$inferSelect
export type NewFollowupEmail = typeof followupEmails.$inferInsert
export type FollowupEmailType = (typeof followupEmailTypeEnum.enumValues)[number]
