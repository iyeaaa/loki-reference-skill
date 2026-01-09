import { relations } from "drizzle-orm"
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { emailSignatures } from "./email-signatures"
import { users } from "./users"
import { workspaces } from "./workspaces"

// User signature preferences table
// 유저별 + 워크스페이스별 기본 이메일 서명 설정
// 같은 유저가 다른 워크스페이스에서 다른 기본 서명 사용 가능
export const userSignaturePreferences = pgTable(
  "user_signature_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    signatureId: uuid("signature_id")
      .notNull()
      .references(() => emailSignatures.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_user_signature_preferences_user_id").on(table.userId),
    workspaceIdx: index("idx_user_signature_preferences_workspace_id").on(table.workspaceId),
    signatureIdx: index("idx_user_signature_preferences_signature_id").on(table.signatureId),
    // 복합 unique: 유저 + 워크스페이스당 하나의 기본 서명만 허용
    uniqueUserWorkspace: uniqueIndex("unique_user_workspace_signature").on(
      table.userId,
      table.workspaceId,
    ),
  }),
)

// Relations
export const userSignaturePreferencesRelations = relations(userSignaturePreferences, ({ one }) => ({
  user: one(users, {
    fields: [userSignaturePreferences.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [userSignaturePreferences.workspaceId],
    references: [workspaces.id],
  }),
  signature: one(emailSignatures, {
    fields: [userSignaturePreferences.signatureId],
    references: [emailSignatures.id],
  }),
}))

// Type exports
export type UserSignaturePreference = typeof userSignaturePreferences.$inferSelect
export type NewUserSignaturePreference = typeof userSignaturePreferences.$inferInsert
