import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"

// Enums
export const userRoleEnum = pgEnum("user_role_enum", ["user", "admin"])
export const authProviderEnum = pgEnum("auth_provider_enum", ["local", "google"])

// Departments table
export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    code: varchar("code", { length: 20 }).notNull().unique(),
    description: text("description"),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (table) => ({
    codeIdx: index("departments_code_idx").on(table.code),
    isActiveIdx: index("departments_is_active_idx").on(table.isActive),
  }),
)

// Users table
export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    username: varchar("username", { length: 50 }).notNull(), // Removed unique constraint
    email: varchar("email", { length: 100 }).notNull().unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    userRole: userRoleEnum("user_role").notNull().default("user"),
    isActive: boolean("is_active").notNull().default(true),

    // 슈퍼 관리자 여부 (모든 권한 체크 우회)
    // true인 경우 IAM 권한 평가 없이 전체 접근 허용
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),

    departmentId: uuid("department_id").references(() => departments.id),
    employeeId: varchar("employee_id", { length: 20 }),
    // OAuth and SSO fields
    authProvider: authProviderEnum("auth_provider").notNull().default("local"),
    oauthId: varchar("oauth_id", { length: 255 }), // Google user ID or other OAuth provider ID
    profilePicture: text("profile_picture"), // Profile picture URL from OAuth provider
    // Trial period fields
    trialStartDate: timestamp("trial_start_date", { withTimezone: true }),
    trialEndDate: timestamp("trial_end_date", { withTimezone: true }),
    isTrialActive: boolean("is_trial_active").default(false),

    // Onboarding fields
    // 사전 설문 결과 저장 (industry, target, country, experience, lang)
    onboardingSurvey: jsonb("onboarding_survey").$type<{
      industry?: string
      target?: string
      country?: string
      experience?: string
      lang?: string
      completedAt?: string
    }>(),
    // 온보딩 진행 단계 (0: 미시작, 1-4: 진행중, 5: 완료)
    onboardingStep: integer("onboarding_step").default(0),
    // 온보딩 완료 시간
    onboardingCompletedAt: timestamp("onboarding_completed_at", { withTimezone: true }),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (table) => ({
    departmentIdx: index("users_department_id_idx").on(table.departmentId),
    authProviderIdx: index("users_auth_provider_idx").on(table.authProvider),
    oauthIdIdx: index("users_oauth_id_idx").on(table.oauthId),
    trialActiveIdx: index("users_trial_active_idx").on(table.isTrialActive),
    onboardingStepIdx: index("users_onboarding_step_idx").on(table.onboardingStep),
  }),
)

// Relations
export const departmentsRelations = relations(departments, ({ many }) => ({
  users: many(users),
}))

export const usersRelations = relations(users, ({ one }) => ({
  department: one(departments, {
    fields: [users.departmentId],
    references: [departments.id],
  }),
}))

// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Department = typeof departments.$inferSelect
export type NewDepartment = typeof departments.$inferInsert
