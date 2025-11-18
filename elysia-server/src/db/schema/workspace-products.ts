import { relations } from "drizzle-orm"
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

// Workspace products table
export const workspaceProducts = pgTable(
  "workspace_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }),
    description: text("description"),
    category: varchar("category", { length: 255 }),
    features: jsonb("features"), // Store as JSON array
    priceRange: varchar("price_range", { length: 255 }),
    targetAudience: varchar("target_audience", { length: 500 }),
    imageUrl: varchar("image_url", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("workspace_products_workspace_id_idx").on(table.workspaceId),
    categoryIdx: index("workspace_products_category_idx").on(table.category),
  }),
)

// Relations
export const workspaceProductsRelations = relations(workspaceProducts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceProducts.workspaceId],
    references: [workspaces.id],
  }),
}))

// Type exports
export type WorkspaceProduct = typeof workspaceProducts.$inferSelect
export type NewWorkspaceProduct = typeof workspaceProducts.$inferInsert
