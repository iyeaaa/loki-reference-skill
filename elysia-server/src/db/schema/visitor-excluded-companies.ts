/**
 * Visitor Excluded Companies Schema
 *
 * 워크스페이스별 방문자 분석에서 제외할 회사 목록 관리
 * - companyDomain 기반으로 제외 (같은 회사의 모든 방문자 일괄 제외)
 * - 누가 언제 왜 제외했는지 추적 가능
 */

import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

/**
 * Visitor Excluded Companies Table
 * 워크스페이스별 제외할 회사 도메인 관리
 */
export const visitorExcludedCompanies = pgTable(
  "visitor_excluded_companies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // 제외할 회사 정보
    companyDomain: varchar("company_domain", { length: 255 }).notNull(),
    companyName: varchar("company_name", { length: 255 }), // 표시용 (선택)

    // 감사 정보
    excludedBy: uuid("excluded_by")
      .notNull()
      .references(() => users.id),
    excludedAt: timestamp("excluded_at", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"), // 제외 사유 (선택)

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Indexes
    workspaceIdx: index("visitor_excluded_companies_workspace_idx").on(table.workspaceId),
    domainIdx: index("visitor_excluded_companies_domain_idx").on(table.companyDomain),
    excludedByIdx: index("visitor_excluded_companies_excluded_by_idx").on(table.excludedBy),
    // Unique constraint: 워크스페이스당 도메인은 하나만
    workspaceDomainUnique: unique("visitor_excluded_companies_workspace_domain_unique").on(
      table.workspaceId,
      table.companyDomain,
    ),
  }),
)

// Relations
export const visitorExcludedCompaniesRelations = relations(visitorExcludedCompanies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [visitorExcludedCompanies.workspaceId],
    references: [workspaces.id],
  }),
  excluder: one(users, {
    fields: [visitorExcludedCompanies.excludedBy],
    references: [users.id],
  }),
}))

// Type exports
export type VisitorExcludedCompany = typeof visitorExcludedCompanies.$inferSelect
export type NewVisitorExcludedCompany = typeof visitorExcludedCompanies.$inferInsert
