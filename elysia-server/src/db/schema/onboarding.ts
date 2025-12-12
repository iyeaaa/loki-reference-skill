/**
 * Onboarding Schema
 *
 * 온보딩 진행 상태 및 데이터를 워크스페이스 기반으로 저장
 * - 사전 설문 결과
 * - 회사 정보 (워크스페이스에서 관리)
 * - 리드 검색 결과 (leads 테이블 참조)
 * - 시퀀스 정보 (sequences 테이블 참조)
 */

import { relations } from "drizzle-orm"
import { index, integer, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

// 온보딩 상태 enum
export const onboardingStatusEnum = pgEnum("onboarding_status_enum", [
  "not_started", // 시작 안함
  "survey_completed", // 사전 설문 완료
  "company_info", // 회사 정보 입력 중
  "lead_search", // 리드 검색 중
  "email_generation", // 이메일 생성 중
  "email_link", // 이메일 연동 중
  "completed", // 완료
])

// 온보딩 진행 상태 테이블
export const onboardingProgress = pgTable(
  "onboarding_progress",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // 워크스페이스 연결 (1:1 관계)
    workspaceId: uuid("workspace_id")
      .notNull()
      .unique()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // 현재 상태
    status: onboardingStatusEnum("status").notNull().default("not_started"),

    // 현재 스텝 (1-4, 0=미시작, 5=완료)
    currentStep: integer("current_step").notNull().default(0),

    // 사전 설문 결과 (industry, target, country, experience, lang)
    surveyData: jsonb("survey_data").$type<{
      industry?: string
      target?: string
      country?: string
      experience?: string
      lang?: string
    }>(),

    // Step 1: 회사 정보 (워크스페이스 테이블의 데이터 참조용 플래그)
    companyInfoCompleted: timestamp("company_info_completed_at", { withTimezone: true }),

    // Step 2: 선택된 리드 ID 목록 및 고객 그룹
    selectedLeadIds: jsonb("selected_lead_ids").$type<string[]>(),
    customerGroupId: uuid("customer_group_id"),
    leadSearchCompleted: timestamp("lead_search_completed_at", { withTimezone: true }),

    // Step 3: 생성된 시퀀스 ID
    generatedSequenceId: uuid("generated_sequence_id"),
    emailGenerationCompleted: timestamp("email_generation_completed_at", { withTimezone: true }),

    // Step 4: 이메일 연동 완료
    emailLinkCompleted: timestamp("email_link_completed_at", { withTimezone: true }),

    // 온보딩 완료 시간
    completedAt: timestamp("completed_at", { withTimezone: true }),

    // 메타데이터
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("onboarding_progress_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("onboarding_progress_status_idx").on(table.status),
    currentStepIdx: index("onboarding_progress_current_step_idx").on(table.currentStep),
  }),
)

// Relations
export const onboardingProgressRelations = relations(onboardingProgress, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [onboardingProgress.workspaceId],
    references: [workspaces.id],
  }),
}))

// Type exports
export type OnboardingProgress = typeof onboardingProgress.$inferSelect
export type NewOnboardingProgress = typeof onboardingProgress.$inferInsert
export type OnboardingStatus = (typeof onboardingStatusEnum.enumValues)[number]
