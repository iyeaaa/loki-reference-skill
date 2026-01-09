import { relations } from "drizzle-orm"
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Email signatures table
// 서명은 워크스페이스에 속함 (워크스페이스별 관리)
export const emailSignatures = pgTable(
  "email_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // nullable: 생성자 추적용 (선택적)
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }), // 필수: 워크스페이스별 관리

    // Signature details
    name: varchar("name", { length: 100 }).notNull(),
    signatureHtml: text("signature_html").notNull(),
    signatureText: text("signature_text").notNull(),

    // Status
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("email_signatures_user_id_idx").on(table.userId),
    workspaceIdx: index("email_signatures_workspace_id_idx").on(table.workspaceId),
    isActiveIdx: index("email_signatures_is_active_idx").on(table.isActive),
  }),
)

// Relations
export const emailSignaturesRelations = relations(emailSignatures, ({ one }) => ({
  user: one(users, {
    fields: [emailSignatures.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [emailSignatures.workspaceId],
    references: [workspaces.id],
  }),
}))

// Type exports
export type EmailSignature = typeof emailSignatures.$inferSelect
export type NewEmailSignature = typeof emailSignatures.$inferInsert
