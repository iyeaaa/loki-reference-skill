import { relations } from "drizzle-orm"
import { index, jsonb, pgEnum, pgTable, timestamp, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

// Enums
export const salesStrategyIndustryEnum = pgEnum("sales_strategy_industry_enum", [
  "manufacturing",
  "it_saas",
  "beauty",
  "food",
  "fashion",
  "electronics",
  "healthcare",
  "guitar",
])

export const salesStrategyTargetEnum = pgEnum("sales_strategy_target_enum", ["b2b", "b2c", "both"])

export const salesStrategyCountryEnum = pgEnum("sales_strategy_country_enum", [
  "jp",
  "us",
  "sea",
  "eu",
  "cn",
  "ae",
])

export const salesStrategyExperienceEnum = pgEnum("sales_strategy_experience_enum", [
  "none",
  "some",
  "experienced",
])

// Main sales strategies table
export const salesStrategiesTable = pgTable(
  "sales_strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Input fields (required)
    industry: salesStrategyIndustryEnum("industry").notNull(),
    target: salesStrategyTargetEnum("target").notNull(),
    country: salesStrategyCountryEnum("country").notNull(),
    experience: salesStrategyExperienceEnum("experience").notNull(),

    // Complex data as JSONB (optional)
    rindaSolution: jsonb("linda_solution"),
    strategies: jsonb("strategies"), // Array of SalesStrategy objects
    proofPoints: jsonb("proof_points"),
    emailBenchmarks: jsonb("email_benchmarks"),

    // Audit fields
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    industryIdx: index("sales_strategies_industry_idx").on(table.industry),
    countryIdx: index("sales_strategies_country_idx").on(table.country),
  }),
)

// Junction table linking workspaces to sales strategies
export const workspaceSalesStrategies = pgTable(
  "workspace_sales_strategies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    salesStrategyId: uuid("sales_strategy_id")
      .notNull()
      .references(() => salesStrategiesTable.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("workspace_sales_strategies_workspace_id_idx").on(table.workspaceId),
    salesStrategyIdx: index("workspace_sales_strategies_sales_strategy_id_idx").on(
      table.salesStrategyId,
    ),
  }),
)

// Relations
export const salesStrategiesRelations = relations(salesStrategiesTable, ({ many }) => ({
  workspaceLinks: many(workspaceSalesStrategies),
}))

export const workspaceSalesStrategiesRelations = relations(workspaceSalesStrategies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceSalesStrategies.workspaceId],
    references: [workspaces.id],
  }),
  salesStrategy: one(salesStrategiesTable, {
    fields: [workspaceSalesStrategies.salesStrategyId],
    references: [salesStrategiesTable.id],
  }),
}))

// Type exports
export type SalesStrategy = typeof salesStrategiesTable.$inferSelect
export type NewSalesStrategy = typeof salesStrategiesTable.$inferInsert
export type WorkspaceSalesStrategy = typeof workspaceSalesStrategies.$inferSelect
export type NewWorkspaceSalesStrategy = typeof workspaceSalesStrategies.$inferInsert
