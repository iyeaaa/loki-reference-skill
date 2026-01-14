import { relations } from "drizzle-orm"
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

/**
 * Trial Statistics Exclusions Table
 * 체험판 통계에서 제외할 워크스페이스 관리
 *
 * - 모든 관리자가 공유하는 제외 목록
 * - 제외한 관리자, 시점, 사유 추적 가능
 */
export const trialStatExclusions = pgTable(
  "trial_stat_exclusions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" })
      .unique(), // 워크스페이스당 하나의 제외 레코드
    excludedBy: uuid("excluded_by")
      .notNull()
      .references(() => users.id),
    excludedAt: timestamp("excluded_at", { withTimezone: true }).notNull().defaultNow(),
    reason: text("reason"), // 제외 사유 (선택)
  },
  (table) => ({
    workspaceIdx: index("trial_stat_exclusions_workspace_idx").on(table.workspaceId),
    excludedByIdx: index("trial_stat_exclusions_excluded_by_idx").on(table.excludedBy),
    excludedAtIdx: index("trial_stat_exclusions_excluded_at_idx").on(table.excludedAt),
  }),
)

// Relations
export const trialStatExclusionsRelations = relations(trialStatExclusions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [trialStatExclusions.workspaceId],
    references: [workspaces.id],
  }),
  excluder: one(users, {
    fields: [trialStatExclusions.excludedBy],
    references: [users.id],
  }),
}))

// Type exports
export type TrialStatExclusion = typeof trialStatExclusions.$inferSelect
export type NewTrialStatExclusion = typeof trialStatExclusions.$inferInsert
