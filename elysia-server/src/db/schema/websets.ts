import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

// Websets table - stores CSV headers and query metadata
export const websets = pgTable(
  "websets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Metadata
    title: varchar("title", { length: 255 }),
    query: text("query").notNull(),
    criterias: text("criterias").array(), // Array of validation questions
    targetValidatedRows: integer("target_validated_rows"), // Target count of validated rows

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("websets_workspace_id_idx").on(table.workspaceId),
  }),
)

// Webset rows table - stores individual CSV rows
export const websetRows = pgTable(
  "webset_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    websetId: uuid("webset_id")
      .notNull()
      .references(() => websets.id, { onDelete: "cascade" }),

    // Row data
    data: jsonb("data").notNull(), // Flexible CSV row data
    criteriaAnswers: boolean("criteria_answers").array(), // Boolean answers matching criterias order

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    websetIdx: index("webset_rows_webset_id_idx").on(table.websetId),
  }),
)

// Relations
export const websetsRelations = relations(websets, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [websets.workspaceId],
    references: [workspaces.id],
  }),
  rows: many(websetRows),
}))

export const websetRowsRelations = relations(websetRows, ({ one }) => ({
  webset: one(websets, {
    fields: [websetRows.websetId],
    references: [websets.id],
  }),
}))

// Type exports
export type Webset = typeof websets.$inferSelect
export type NewWebset = typeof websets.$inferInsert
export type WebsetRow = typeof websetRows.$inferSelect
export type NewWebsetRow = typeof websetRows.$inferInsert
