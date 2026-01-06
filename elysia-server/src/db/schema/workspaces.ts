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
import { subscriptionStatusEnum, subscriptionTierEnum } from "./enums"
import { users } from "./users"

// Enums
export const workspaceMemberRoleEnum = pgEnum("workspace_member_role_enum", [
  "owner",
  "admin",
  "member",
  "viewer",
])

export const workspaceMemberStatusEnum = pgEnum("workspace_member_status_enum", [
  "active",
  "inactive",
  "removed",
])

// Workspaces table
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => users.id),

    // Company information
    companyName: varchar("company_name", { length: 255 }),
    companyNameEn: varchar("company_name_en", { length: 255 }),
    companyWebsite: varchar("company_website", { length: 500 }),
    companyPhone: varchar("company_phone", { length: 50 }),
    industry: varchar("industry", { length: 100 }),
    companySize: varchar("company_size", { length: 50 }),
    companyAddress: text("company_address"),
    companyDescription: text("company_description"),

    // New research and analysis fields
    websiteAnalysis: jsonb("website_analysis"),
    targetAudiences: jsonb("target_audiences"), // Store as JSON array
    expansionGoals: jsonb("expansion_goals"), // Store as JSON array
    competitiveAdvantages: jsonb("competitive_advantages"), // Store as JSON array
    rawResearchOutput: jsonb("raw_research_output"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    isActive: boolean("is_active").notNull().default(true),

    // =========================================================================
    // 구독 관련 필드 (Subscription Fields)
    // =========================================================================

    // 현재 구독 등급 (캐시용, subscriptions 테이블과 동기화 필요)
    // IAM 권한 체크 시 빠른 조회를 위해 비정규화
    subscriptionTier: subscriptionTierEnum("subscription_tier").notNull().default("trial"),

    // 현재 구독 상태 (캐시용)
    subscriptionStatus: subscriptionStatusEnum("subscription_status").notNull().default("trialing"),

    // 구독 만료 시간 (빠른 만료 체크용)
    subscriptionValidUntil: timestamp("subscription_valid_until", {
      withTimezone: true,
    }),

    // 등급 변경 시간 (권한 캐시 무효화 판단용)
    tierChangedAt: timestamp("tier_changed_at", { withTimezone: true }),
  },
  (table) => ({
    ownerIdx: index("workspaces_owner_id_idx").on(table.ownerId),
    isActiveIdx: index("workspaces_is_active_idx").on(table.isActive),
    // 구독 등급별 조회
    tierIdx: index("workspaces_subscription_tier_idx").on(table.subscriptionTier),
    // 구독 만료 체크용 인덱스
    subValidIdx: index("workspaces_subscription_valid_idx").on(table.subscriptionValidUntil),
  }),
)

// Workspace members table
export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceMemberRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invited_by").references(() => users.id),
    invitedAt: timestamp("invited_at", { withTimezone: true }).notNull().defaultNow(),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    status: workspaceMemberStatusEnum("status").notNull().default("active"),
  },
  (table) => ({
    workspaceIdx: index("workspace_members_workspace_id_idx").on(table.workspaceId),
    userIdx: index("workspace_members_user_id_idx").on(table.userId),
    statusIdx: index("workspace_members_status_idx").on(table.status),
  }),
)

// Relations
// 주의: subscriptions 관계는 billing.ts에서 정의 (순환 참조 방지)
export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, {
    fields: [workspaces.ownerId],
    references: [users.id],
  }),
  members: many(workspaceMembers),
}))

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [workspaceMembers.invitedBy],
    references: [users.id],
  }),
}))

// Type exports
export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type WorkspaceMember = typeof workspaceMembers.$inferSelect
export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert
