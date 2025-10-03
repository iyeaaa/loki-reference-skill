import { relations } from "drizzle-orm"
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Activity logs table
export const activityLogs = pgTable(
  "activity_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // Set null if user is deleted
    entityType: varchar("entity_type", { length: 100 }).notNull(), // e.g., 'lead', 'email', 'sequence'
    entityId: uuid("entity_id").notNull(), // The ID of the entity being acted upon
    action: varchar("action", { length: 100 }).notNull(), // e.g., 'created', 'updated', 'deleted', 'sent'
    details: jsonb("details"), // Additional contextual information
    ipAddress: varchar("ip_address", { length: 50 }),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("activity_logs_workspace_id_idx").on(table.workspaceId),
    userIdx: index("activity_logs_user_id_idx").on(table.userId),
    entityTypeIdx: index("activity_logs_entity_type_idx").on(table.entityType),
    entityIdx: index("activity_logs_entity_idx").on(table.entityType, table.entityId),
    actionIdx: index("activity_logs_action_idx").on(table.action),
    createdAtIdx: index("activity_logs_created_at_idx").on(table.createdAt),
  }),
)

// Relations
export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [activityLogs.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}))

// Type exports
export type ActivityLog = typeof activityLogs.$inferSelect
export type NewActivityLog = typeof activityLogs.$inferInsert
