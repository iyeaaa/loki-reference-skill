/**
 * Visitor Sessions Schema
 *
 * Stores visitor IP intelligence data for landing page analytics.
 * Integrates with ipapi.is for IP enrichment.
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

/**
 * Visitor Sessions Table
 * Stores enriched IP data for each unique visitor per workspace
 */
export const visitorSessions = pgTable(
  "visitor_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Core identification
    ipAddress: varchar("ip_address", { length: 50 }).notNull(),
    userAgent: text("user_agent"),
    referrer: varchar("referrer", { length: 500 }),
    landingPage: varchar("landing_page", { length: 500 }),

    // ipapi.is full response (for flexibility)
    ipapiData: jsonb("ipapi_data"),

    // Extracted location fields (for querying/indexing)
    country: varchar("country", { length: 100 }),
    countryCode: varchar("country_code", { length: 10 }),
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }),
    latitude: real("latitude"),
    longitude: real("longitude"),
    timezone: varchar("timezone", { length: 50 }),
    continent: varchar("continent", { length: 50 }),

    // Company info (if detected)
    companyName: varchar("company_name", { length: 255 }),
    companyDomain: varchar("company_domain", { length: 255 }),
    companyType: varchar("company_type", { length: 100 }),

    // ASN info
    asnNumber: integer("asn_number"),
    asnOrg: varchar("asn_org", { length: 255 }),
    asnType: varchar("asn_type", { length: 50 }),

    // Security/Risk flags
    isVpn: boolean("is_vpn").default(false),
    isProxy: boolean("is_proxy").default(false),
    isTor: boolean("is_tor").default(false),
    isDatacenter: boolean("is_datacenter").default(false),
    isCrawler: boolean("is_crawler").default(false),
    isMobile: boolean("is_mobile").default(false),
    isAbuser: boolean("is_abuser").default(false),

    // Session metrics
    visitCount: integer("visit_count").default(1),
    firstVisitAt: timestamp("first_visit_at", { withTimezone: true }).notNull().defaultNow(),
    lastVisitAt: timestamp("last_visit_at", { withTimezone: true }).notNull().defaultNow(),

    // Audit
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Performance indexes
    workspaceIdx: index("visitor_sessions_workspace_id_idx").on(table.workspaceId),
    ipIdx: index("visitor_sessions_ip_address_idx").on(table.ipAddress),
    workspaceIpIdx: index("visitor_sessions_workspace_ip_idx").on(
      table.workspaceId,
      table.ipAddress,
    ),
    countryIdx: index("visitor_sessions_country_idx").on(table.country),
    companyIdx: index("visitor_sessions_company_name_idx").on(table.companyName),
    firstVisitIdx: index("visitor_sessions_first_visit_idx").on(table.firstVisitAt),
    lastVisitIdx: index("visitor_sessions_last_visit_idx").on(table.lastVisitAt),
  }),
)

// Relations
export const visitorSessionsRelations = relations(visitorSessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [visitorSessions.workspaceId],
    references: [workspaces.id],
  }),
}))

// Types
export type VisitorSession = typeof visitorSessions.$inferSelect
export type NewVisitorSession = typeof visitorSessions.$inferInsert
