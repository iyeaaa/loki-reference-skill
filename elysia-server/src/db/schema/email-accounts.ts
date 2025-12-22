import { relations } from "drizzle-orm"
import {
  boolean,
  date,
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
export const emailAccountStatusEnum = pgEnum("email_account_status_enum", [
  "active",
  "inactive",
  "error",
  "rate_limited",
  "suspended",
])

export const emailProviderEnum = pgEnum("email_provider_enum", ["sendgrid", "nylas", "unipile"])

// User email accounts table (supports SendGrid, Nylas, Unipile)
export const userEmailAccounts = pgTable(
  "user_email_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),

    // Multi-provider Email configuration
    provider: emailProviderEnum("provider").notNull().default("sendgrid"),
    emailAddress: varchar("email_address", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    apiKey: text("api_key").notNull(), // SendGrid API key (starts with "SG") OR Nylas grantId OR Unipile account_id
    sendgridVerifiedSenderId: varchar("sendgrid_verified_sender_id", { length: 255 }),

    // Status and verification
    isVerified: boolean("is_verified").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),

    // Rate limiting
    dailyLimit: integer("daily_limit"),
    monthlyLimit: integer("monthly_limit"),
    dailySentCount: integer("daily_sent_count").notNull().default(0),
    monthlySentCount: integer("monthly_sent_count").notNull().default(0),
    lastResetDaily: date("last_reset_daily"),
    lastResetMonthly: date("last_reset_monthly"),

    status: emailAccountStatusEnum("status").notNull().default("inactive"),
    lastError: text("last_error"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_email_accounts_user_id_idx").on(table.userId),
    workspaceIdx: index("user_email_accounts_workspace_id_idx").on(table.workspaceId),
    emailIdx: index("user_email_accounts_email_address_idx").on(table.emailAddress),
    statusIdx: index("user_email_accounts_status_idx").on(table.status),
    isDefaultIdx: index("user_email_accounts_is_default_idx").on(table.isDefault),
    providerIdx: index("user_email_accounts_provider_idx").on(table.provider),
  }),
)

// Relations
export const userEmailAccountsRelations = relations(userEmailAccounts, ({ one }) => ({
  user: one(users, {
    fields: [userEmailAccounts.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [userEmailAccounts.workspaceId],
    references: [workspaces.id],
  }),
}))

// Type exports
export type UserEmailAccount = typeof userEmailAccounts.$inferSelect
export type NewUserEmailAccount = typeof userEmailAccounts.$inferInsert
