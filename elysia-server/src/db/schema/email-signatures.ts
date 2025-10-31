import { relations } from "drizzle-orm"
import { boolean, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Email signatures table
export const emailSignatures = pgTable(
  "email_signatures",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Signature details
    name: varchar("name", { length: 100 }).notNull(),
    signatureHtml: text("signature_html").notNull(),
    signatureText: text("signature_text").notNull(),

    // Status
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("email_signatures_user_id_idx").on(table.userId),
    workspaceIdx: index("email_signatures_workspace_id_idx").on(table.workspaceId),
    isDefaultIdx: index("email_signatures_is_default_idx").on(table.isDefault),
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
