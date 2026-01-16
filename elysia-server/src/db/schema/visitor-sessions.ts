/**
 * Visitor Sessions Schema
 *
 * Stores visitor IP intelligence data for landing page analytics.
 * Integrates with ipapi.is for IP enrichment.
 *
 * B2B Intelligence Features:
 * - Visitor type classification (isp, hosting, business, education, government, residential)
 * - Lead scoring based on company/organization data
 * - Full ipapi.is field extraction for analytics
 */

import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces"

/**
 * Visitor type classification based on ASN and company data
 * - isp: Internet Service Provider (KT, SKT, LG U+) - typically residential
 * - hosting: Cloud/Hosting provider (AWS, NAVER Cloud) - could be B2B
 * - business: Identified business organization - high B2B value
 * - education: Educational institution
 * - government: Government organization
 * - residential: Residential/Consumer IP
 * - unknown: Unable to classify
 */
export type VisitorType =
  | "isp"
  | "hosting"
  | "business"
  | "education"
  | "government"
  | "residential"
  | "unknown"

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

    // ========================================================================
    // B2B Intelligence Fields
    // ========================================================================

    // Visitor classification
    visitorType: varchar("visitor_type", { length: 20 }).$type<VisitorType>().default("unknown"),
    isB2bLead: boolean("is_b2b_lead").default(false),
    leadScore: smallint("lead_score").default(0), // 0-100

    // ========================================================================
    // Location Fields (from ipapi.is location)
    // ========================================================================
    country: varchar("country", { length: 100 }),
    countryCode: varchar("country_code", { length: 10 }),
    city: varchar("city", { length: 100 }),
    region: varchar("region", { length: 100 }),
    latitude: real("latitude"),
    longitude: real("longitude"),
    timezone: varchar("timezone", { length: 50 }),
    continent: varchar("continent", { length: 50 }),
    zip: varchar("zip", { length: 20 }),
    isEuMember: boolean("is_eu_member").default(false),
    callingCode: varchar("calling_code", { length: 10 }),
    currencyCode: varchar("currency_code", { length: 10 }),

    // ========================================================================
    // Company Fields (from ipapi.is company)
    // ========================================================================
    companyName: varchar("company_name", { length: 255 }),
    companyDomain: varchar("company_domain", { length: 255 }),
    companyType: varchar("company_type", { length: 100 }),
    companyNetwork: varchar("company_network", { length: 50 }),
    companyAbuserScore: varchar("company_abuser_score", { length: 20 }),

    // ========================================================================
    // ASN Fields (from ipapi.is asn)
    // ========================================================================
    asnNumber: integer("asn_number"),
    asnOrg: varchar("asn_org", { length: 255 }),
    asnType: varchar("asn_type", { length: 50 }),
    asnRoute: varchar("asn_route", { length: 50 }),
    asnDescr: varchar("asn_descr", { length: 255 }),
    asnDomain: varchar("asn_domain", { length: 255 }),
    asnCountry: varchar("asn_country", { length: 10 }),
    asnAbuseEmail: varchar("asn_abuse_email", { length: 255 }),
    asnAbuserScore: varchar("asn_abuser_score", { length: 20 }),

    // ========================================================================
    // Datacenter Fields (from ipapi.is datacenter)
    // ========================================================================
    datacenterName: varchar("datacenter_name", { length: 255 }),
    datacenterDomain: varchar("datacenter_domain", { length: 255 }),
    datacenterNetwork: varchar("datacenter_network", { length: 50 }),

    // ========================================================================
    // Security/Risk Flags
    // ========================================================================
    isVpn: boolean("is_vpn").default(false),
    isProxy: boolean("is_proxy").default(false),
    isTor: boolean("is_tor").default(false),
    isDatacenter: boolean("is_datacenter").default(false),
    isCrawler: boolean("is_crawler").default(false),
    isMobile: boolean("is_mobile").default(false),
    isAbuser: boolean("is_abuser").default(false),
    isBogon: boolean("is_bogon").default(false),
    isSatellite: boolean("is_satellite").default(false),

    // ========================================================================
    // Session Metrics
    // ========================================================================
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
    // B2B indexes
    visitorTypeIdx: index("visitor_sessions_visitor_type_idx").on(table.visitorType),
    isB2bLeadIdx: index("visitor_sessions_is_b2b_lead_idx").on(table.isB2bLead),
    leadScoreIdx: index("visitor_sessions_lead_score_idx").on(table.leadScore),
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
