import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Enums
export const leadStatusEnum = pgEnum("lead_status_enum", [
  "new",
  "contacted",
  "qualified",
  "unqualified",
  "converted",
  "lost",
  "unsubscribed",
])

// Leads table
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Company information
    companyName: varchar("company_name", { length: 255 }),
    foundCompanyName: varchar("found_company_name", { length: 255 }),
    websiteUrl: varchar("website_url", { length: 500 }),
    finalUrl: varchar("final_url", { length: 500 }),
    httpStatus: integer("http_status"),
    nameUrlMatch: boolean("name_url_match"),
    businessType: varchar("business_type", { length: 100 }),
    isBusinessTypeMatched: boolean("is_business_type_matched"),
    description: text("description"),

    // Location
    address: text("address"),
    country: varchar("country", { length: 100 }),
    city: varchar("city", { length: 100 }),
    state: varchar("state", { length: 100 }),
    foundedYear: integer("founded_year"),

    // Business details
    employeeCount: varchar("employee_count", { length: 50 }),

    // Lead management
    leadSource: varchar("lead_source", { length: 100 }),
    leadStatus: leadStatusEnum("lead_status").notNull().default("new"),
    leadScore: integer("lead_score"),
    notes: text("notes"),

    // Processing metadata
    crawlTimeSeconds: decimal("crawl_time_seconds", { precision: 10, scale: 2 }),
    gptTimeSeconds: decimal("gpt_time_seconds", { precision: 10, scale: 2 }),
    collectedAt: timestamp("collected_at", { withTimezone: true }),
    errorMessage: text("error_message"),

    // Audit fields
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
  },
  (table) => ({
    workspaceIdx: index("leads_workspace_id_idx").on(table.workspaceId),
    statusIdx: index("leads_lead_status_idx").on(table.leadStatus),
    createdByIdx: index("leads_created_by_idx").on(table.createdBy),
    companyNameIdx: index("leads_company_name_idx").on(table.companyName),
  }),
)

// Type exports
export type Lead = typeof leads.$inferSelect
export type NewLead = typeof leads.$inferInsert
