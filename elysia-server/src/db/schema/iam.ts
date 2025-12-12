/**
 * IAM (Identity and Access Management) 스키마
 *
 * AWS IAM 스타일의 권한 관리 시스템
 * - 정책(Policy) 기반 권한 정의
 * - 역할(Role)을 통한 권한 그룹화
 * - 멤버별 역할/정책 할당
 * - 구독 등급별 권한 경계(Tier Boundary)
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { policyEffectEnum, subscriptionTierEnum } from "./enums"
import { users } from "./users"
import { workspaceMembers, workspaces } from "./workspaces"

// Enum re-export for backward compatibility
export { policyEffectEnum } from "./enums"

// ============================================================================
// Tables (테이블)
// ============================================================================

/**
 * IAM 정책 테이블 (iam_policies)
 *
 * 권한 규칙을 정의하는 최소 단위
 * - 시스템 정책: workspaceId가 NULL (모든 워크스페이스에서 사용 가능)
 * - 커스텀 정책: workspaceId가 있음 (해당 워크스페이스에서만 사용)
 *
 * @field id - 기본 식별자 (UUID)
 * @field workspaceId - 워크스페이스 연결 (NULL이면 시스템 전역 정책, workspaces.id 참조)
 * @field name - 정책 이름 (워크스페이스 내에서 유일해야 함)
 * @field description - 정책 설명
 * @field version - 정책 버전 (변경 시 증가)
 * @field isManaged - 시스템 관리 정책 여부 (true면 사용자 수정 불가)
 * @field isActive - 활성화 여부
 * @field createdBy - 생성자 (users.id 참조)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index iam_policies_workspace_id_idx - 워크스페이스별 정책 조회
 * @index iam_policies_name_idx - 워크스페이스 내 정책 이름 검색
 * @index iam_policies_is_managed_idx - 시스템 관리 정책만 조회
 */
export const iamPolicies = pgTable(
  "iam_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    description: text("description"),
    version: integer("version").notNull().default(1),
    isManaged: boolean("is_managed").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index("iam_policies_workspace_id_idx").on(table.workspaceId),
    nameIdx: index("iam_policies_name_idx").on(table.workspaceId, table.name),
    isManagedIdx: index("iam_policies_is_managed_idx").on(table.isManaged),
  }),
)

/**
 * IAM 정책 명세 테이블 (iam_policy_statements)
 *
 * 정책의 구체적인 허용/거부 규칙 정의
 * 하나의 정책에 여러 명세 가능
 *
 * @field id - 기본 식별자 (UUID)
 * @field policyId - 정책 연결 (필수, iam_policies.id 참조)
 * @field sid - 명세 식별자 (선택적, 로깅/디버깅용)
 * @field effect - 효과 (allow: 허용, deny: 거부)
 * @field resources - 대상 리소스 목록 (TEXT[], 예: ['leads', 'leads:*', 'sequences'])
 * @field actions - 액션 목록 (TEXT[], 예: ['create', 'read', 'update', 'delete', '*'])
 * @field conditions - 추가 조건 (JSONB, 예: { maxCount: 20, ownOnly: true, draftOnly: true })
 * @field priority - 우선순위 (높을수록 먼저 평가, 같으면 deny 우선)
 * @field createdAt - 생성 시간
 *
 * @index iam_policy_statements_policy_id_idx - 정책별 명세 조회
 * @index iam_policy_statements_effect_idx - 효과별 조회 (deny 먼저 체크용)
 */
export const iamPolicyStatements = pgTable(
  "iam_policy_statements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => iamPolicies.id, { onDelete: "cascade" }),
    sid: varchar("sid", { length: 100 }),
    effect: policyEffectEnum("effect").notNull().default("allow"),
    resources: text("resources").array().notNull(),
    actions: text("actions").array().notNull(),
    conditions: jsonb("conditions").default({}),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    policyIdIdx: index("iam_policy_statements_policy_id_idx").on(table.policyId),
    effectIdx: index("iam_policy_statements_effect_idx").on(table.effect),
  }),
)

/**
 * 워크스페이스 역할 테이블 (iam_workspace_roles)
 *
 * 정책들을 묶어서 역할로 정의
 * - 시스템 역할: isSystem = true (삭제/수정 불가)
 * - 커스텀 역할: isSystem = false (자유롭게 관리)
 * - 기본 역할: isDefault = true (새 멤버에게 자동 할당)
 *
 * @field id - 기본 식별자 (UUID)
 * @field workspaceId - 워크스페이스 연결 (필수, workspaces.id 참조)
 * @field name - 역할 이름 (워크스페이스 내에서 유일)
 * @field description - 역할 설명
 * @field isDefault - 기본 역할 여부 (새 멤버 자동 할당, 워크스페이스당 하나만)
 * @field isSystem - 시스템 역할 여부 (삭제/이름변경 불가, Owner/Admin/Member/Viewer 등)
 * @field priority - 우선순위 (권한 충돌 시 높은 것 우선)
 * @field createdBy - 생성자 (users.id 참조)
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index iam_workspace_roles_workspace_id_idx - 워크스페이스별 역할 조회
 * @index iam_workspace_roles_is_default_idx - 기본 역할 조회
 * @unique iam_workspace_roles_workspace_name_unique - 워크스페이스 내 역할 이름 유일성
 */
export const iamWorkspaceRoles = pgTable(
  "iam_workspace_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 50 }).notNull(),
    description: text("description"),
    isDefault: boolean("is_default").notNull().default(false),
    isSystem: boolean("is_system").notNull().default(false),
    priority: integer("priority").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index("iam_workspace_roles_workspace_id_idx").on(table.workspaceId),
    isDefaultIdx: index("iam_workspace_roles_is_default_idx").on(
      table.workspaceId,
      table.isDefault,
    ),
    workspaceNameUnique: unique("iam_workspace_roles_workspace_name_unique").on(
      table.workspaceId,
      table.name,
    ),
  }),
)

/**
 * 역할-정책 연결 테이블 (iam_role_policies)
 *
 * 역할에 정책을 연결 (N:M 관계)
 * 하나의 역할에 여러 정책, 하나의 정책을 여러 역할에 연결 가능
 *
 * @field id - 기본 식별자 (UUID)
 * @field roleId - 역할 연결 (필수, iam_workspace_roles.id 참조)
 * @field policyId - 정책 연결 (필수, iam_policies.id 참조)
 * @field attachedBy - 연결한 사용자 (users.id 참조)
 * @field attachedAt - 연결 시간
 *
 * @index iam_role_policies_role_id_idx - 역할별 정책 조회
 * @index iam_role_policies_policy_id_idx - 정책별 역할 조회
 * @unique iam_role_policies_role_policy_unique - 역할-정책 조합 유일성
 */
export const iamRolePolicies = pgTable(
  "iam_role_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    roleId: uuid("role_id")
      .notNull()
      .references(() => iamWorkspaceRoles.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => iamPolicies.id, { onDelete: "cascade" }),
    attachedBy: uuid("attached_by").references(() => users.id),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    roleIdIdx: index("iam_role_policies_role_id_idx").on(table.roleId),
    policyIdIdx: index("iam_role_policies_policy_id_idx").on(table.policyId),
    rolePolicyUnique: unique("iam_role_policies_role_policy_unique").on(
      table.roleId,
      table.policyId,
    ),
  }),
)

/**
 * 멤버-역할 할당 테이블 (iam_member_roles)
 *
 * 워크스페이스 멤버에게 역할 할당 (N:M 관계)
 * 한 멤버가 여러 역할 보유 가능, 역할의 모든 정책 권한을 상속
 *
 * @field id - 기본 식별자 (UUID)
 * @field memberId - 멤버 연결 (필수, workspace_members.id 참조)
 * @field roleId - 역할 연결 (필수, iam_workspace_roles.id 참조)
 * @field grantedBy - 부여한 사용자 (users.id 참조)
 * @field grantedAt - 부여 시간
 *
 * @index iam_member_roles_member_id_idx - 멤버별 역할 조회
 * @index iam_member_roles_role_id_idx - 역할별 멤버 조회
 * @unique iam_member_roles_member_role_unique - 멤버-역할 조합 유일성
 */
export const iamMemberRoles = pgTable(
  "iam_member_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => iamWorkspaceRoles.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => users.id),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberIdIdx: index("iam_member_roles_member_id_idx").on(table.memberId),
    roleIdIdx: index("iam_member_roles_role_id_idx").on(table.roleId),
    memberRoleUnique: unique("iam_member_roles_member_role_unique").on(
      table.memberId,
      table.roleId,
    ),
  }),
)

/**
 * 멤버 직접 정책 테이블 (iam_member_policies)
 *
 * 멤버에게 역할 없이 직접 정책 할당 (인라인 정책)
 * 예외적 권한 부여/제한에 사용, 역할 변경 없이 특정 멤버만 권한 조정 가능
 *
 * @field id - 기본 식별자 (UUID)
 * @field memberId - 멤버 연결 (필수, workspace_members.id 참조)
 * @field policyId - 정책 연결 (필수, iam_policies.id 참조)
 * @field attachedBy - 연결한 사용자 (users.id 참조)
 * @field attachedAt - 연결 시간
 *
 * @index iam_member_policies_member_id_idx - 멤버별 직접 정책 조회
 * @index iam_member_policies_policy_id_idx - 정책별 멤버 조회
 * @unique iam_member_policies_member_policy_unique - 멤버-정책 조합 유일성
 */
export const iamMemberPolicies = pgTable(
  "iam_member_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => workspaceMembers.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => iamPolicies.id, { onDelete: "cascade" }),
    attachedBy: uuid("attached_by").references(() => users.id),
    attachedAt: timestamp("attached_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    memberIdIdx: index("iam_member_policies_member_id_idx").on(table.memberId),
    policyIdIdx: index("iam_member_policies_policy_id_idx").on(table.policyId),
    memberPolicyUnique: unique("iam_member_policies_member_policy_unique").on(
      table.memberId,
      table.policyId,
    ),
  }),
)

/**
 * 구독 등급별 권한 경계 테이블 (iam_tier_boundaries)
 *
 * 각 구독 등급의 최대 허용 권한 정의
 * 멤버의 최종 권한 = 역할 권한 ∩ Tier Boundary
 * 아무리 많은 권한을 부여해도 Boundary를 넘을 수 없음
 *
 * @field id - 기본 식별자 (UUID)
 * @field tier - 구독 등급 (유일, trial/basic/pro/enterprise)
 * @field policyId - 경계 정책 연결 (필수, iam_policies.id 참조, 이 정책의 명세가 최대 권한 정의)
 * @field description - 설명
 * @field createdAt - 생성 시간
 * @field updatedAt - 수정 시간
 *
 * @index iam_tier_boundaries_tier_idx - 등급별 조회
 */
export const iamTierBoundaries = pgTable(
  "iam_tier_boundaries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tier: subscriptionTierEnum("tier").notNull().unique(),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => iamPolicies.id, { onDelete: "restrict" }),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tierIdx: index("iam_tier_boundaries_tier_idx").on(table.tier),
  }),
)

/**
 * IAM 감사 로그 테이블 (iam_audit_logs)
 *
 * 권한 관련 모든 변경사항 기록
 * 정책/역할 생성/수정/삭제, 권한 부여/해제 등
 *
 * @field id - 기본 식별자 (UUID)
 * @field workspaceId - 워크스페이스 (선택적, 삭제 시 NULL 유지, workspaces.id 참조)
 * @field userId - 수행한 사용자 (선택적, 삭제 시 NULL 유지, users.id 참조)
 * @field action - 수행한 액션 (policy_created/updated/deleted, role_created/updated/deleted 등)
 * @field targetType - 대상 타입 (policy, role, member_role, member_policy 등)
 * @field targetId - 대상 ID (UUID)
 * @field targetName - 대상 이름 (삭제되어도 로그에서 확인 가능)
 * @field oldValue - 변경 전 값 (JSONB)
 * @field newValue - 변경 후 값 (JSONB)
 * @field ipAddress - 요청 IP 주소
 * @field userAgent - 요청 User Agent
 * @field createdAt - 생성 시간
 *
 * @index iam_audit_logs_workspace_id_idx - 워크스페이스별 로그 조회
 * @index iam_audit_logs_user_id_idx - 사용자별 로그 조회
 * @index iam_audit_logs_action_idx - 액션별 조회
 * @index iam_audit_logs_target_idx - 대상별 조회
 * @index iam_audit_logs_created_at_idx - 시간순 조회
 */
export const iamAuditLogs = pgTable(
  "iam_audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 50 }).notNull(),
    targetType: varchar("target_type", { length: 50 }).notNull(),
    targetId: uuid("target_id").notNull(),
    targetName: varchar("target_name", { length: 255 }),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdIdx: index("iam_audit_logs_workspace_id_idx").on(table.workspaceId),
    userIdIdx: index("iam_audit_logs_user_id_idx").on(table.userId),
    actionIdx: index("iam_audit_logs_action_idx").on(table.action),
    targetIdx: index("iam_audit_logs_target_idx").on(table.targetType, table.targetId),
    createdAtIdx: index("iam_audit_logs_created_at_idx").on(table.createdAt),
  }),
)

// ============================================================================
// Relations (관계 정의)
// ============================================================================

export const iamPoliciesRelations = relations(iamPolicies, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [iamPolicies.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [iamPolicies.createdBy],
    references: [users.id],
  }),
  statements: many(iamPolicyStatements),
  rolePolicies: many(iamRolePolicies),
  memberPolicies: many(iamMemberPolicies),
  tierBoundaries: many(iamTierBoundaries),
}))

export const iamPolicyStatementsRelations = relations(iamPolicyStatements, ({ one }) => ({
  policy: one(iamPolicies, {
    fields: [iamPolicyStatements.policyId],
    references: [iamPolicies.id],
  }),
}))

export const iamWorkspaceRolesRelations = relations(iamWorkspaceRoles, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [iamWorkspaceRoles.workspaceId],
    references: [workspaces.id],
  }),
  creator: one(users, {
    fields: [iamWorkspaceRoles.createdBy],
    references: [users.id],
  }),
  rolePolicies: many(iamRolePolicies),
  memberRoles: many(iamMemberRoles),
}))

export const iamRolePoliciesRelations = relations(iamRolePolicies, ({ one }) => ({
  role: one(iamWorkspaceRoles, {
    fields: [iamRolePolicies.roleId],
    references: [iamWorkspaceRoles.id],
  }),
  policy: one(iamPolicies, {
    fields: [iamRolePolicies.policyId],
    references: [iamPolicies.id],
  }),
  attacher: one(users, {
    fields: [iamRolePolicies.attachedBy],
    references: [users.id],
  }),
}))

export const iamMemberRolesRelations = relations(iamMemberRoles, ({ one }) => ({
  member: one(workspaceMembers, {
    fields: [iamMemberRoles.memberId],
    references: [workspaceMembers.id],
  }),
  role: one(iamWorkspaceRoles, {
    fields: [iamMemberRoles.roleId],
    references: [iamWorkspaceRoles.id],
  }),
  granter: one(users, {
    fields: [iamMemberRoles.grantedBy],
    references: [users.id],
  }),
}))

export const iamMemberPoliciesRelations = relations(iamMemberPolicies, ({ one }) => ({
  member: one(workspaceMembers, {
    fields: [iamMemberPolicies.memberId],
    references: [workspaceMembers.id],
  }),
  policy: one(iamPolicies, {
    fields: [iamMemberPolicies.policyId],
    references: [iamPolicies.id],
  }),
  attacher: one(users, {
    fields: [iamMemberPolicies.attachedBy],
    references: [users.id],
  }),
}))

export const iamTierBoundariesRelations = relations(iamTierBoundaries, ({ one }) => ({
  policy: one(iamPolicies, {
    fields: [iamTierBoundaries.policyId],
    references: [iamPolicies.id],
  }),
}))

export const iamAuditLogsRelations = relations(iamAuditLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [iamAuditLogs.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [iamAuditLogs.userId],
    references: [users.id],
  }),
}))

// ============================================================================
// Type Exports (타입 내보내기)
// ============================================================================

export type IamPolicy = typeof iamPolicies.$inferSelect
export type NewIamPolicy = typeof iamPolicies.$inferInsert
export type IamPolicyStatement = typeof iamPolicyStatements.$inferSelect
export type NewIamPolicyStatement = typeof iamPolicyStatements.$inferInsert
export type IamWorkspaceRole = typeof iamWorkspaceRoles.$inferSelect
export type NewIamWorkspaceRole = typeof iamWorkspaceRoles.$inferInsert
export type IamRolePolicy = typeof iamRolePolicies.$inferSelect
export type NewIamRolePolicy = typeof iamRolePolicies.$inferInsert
export type IamMemberRole = typeof iamMemberRoles.$inferSelect
export type NewIamMemberRole = typeof iamMemberRoles.$inferInsert
export type IamMemberPolicy = typeof iamMemberPolicies.$inferSelect
export type NewIamMemberPolicy = typeof iamMemberPolicies.$inferInsert
export type IamTierBoundary = typeof iamTierBoundaries.$inferSelect
export type NewIamTierBoundary = typeof iamTierBoundaries.$inferInsert
export type IamAuditLog = typeof iamAuditLogs.$inferSelect
export type NewIamAuditLog = typeof iamAuditLogs.$inferInsert

export type { PolicyEffect } from "./enums"
