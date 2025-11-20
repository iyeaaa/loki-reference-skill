import { relations } from "drizzle-orm"
import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core"
import { emailSignatures } from "./email-signatures"
import { users } from "./users"

// User signature preferences table
// 유저별 기본 이메일 서명 설정 (워크스페이스 무관)
export const userSignaturePreferences = pgTable(
  "user_signature_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signatureId: uuid("signature_id")
      .notNull()
      .references(() => emailSignatures.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("idx_user_signature_preferences_user_id").on(table.userId),
    signatureIdx: index("idx_user_signature_preferences_signature_id").on(table.signatureId),
    uniqueUser: uniqueIndex("unique_user_signature").on(table.userId),
  }),
)

// Relations
export const userSignaturePreferencesRelations = relations(userSignaturePreferences, ({ one }) => ({
  user: one(users, {
    fields: [userSignaturePreferences.userId],
    references: [users.id],
  }),
  signature: one(emailSignatures, {
    fields: [userSignaturePreferences.signatureId],
    references: [emailSignatures.id],
  }),
}))

// Type exports
export type UserSignaturePreference = typeof userSignaturePreferences.$inferSelect
export type NewUserSignaturePreference = typeof userSignaturePreferences.$inferInsert
