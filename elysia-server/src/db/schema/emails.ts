import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { userEmailAccounts } from "./email-accounts"
import { leads } from "./leads"
import { sequenceSteps, sequences } from "./sequences"
import { users } from "./users"
import { workspaces } from "./workspaces"

// Enums
export const emailDirectionEnum = pgEnum("email_direction_enum", ["outbound", "inbound"])

export const emailStatusEnum = pgEnum("email_status_enum", [
  "draft",
  "scheduled",
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "replied",
  "bounced",
  "failed",
  "spam",
  "unsubscribed",
])

export const emailBounceTypeEnum = pgEnum("email_bounce_type_enum", ["soft", "hard", "block"])

// emailThreadStatusEnum removed - not needed without email_threads table

export const emailReplySentimentEnum = pgEnum("email_reply_sentiment_enum", [
  "positive",
  "neutral",
  "negative",
  "interested",
  "not_interested",
])

export const emailEventTypeEnum = pgEnum("email_event_type_enum", [
  "processed",
  "delivered",
  "open",
  "click",
  "bounce",
  "dropped",
  "deferred",
  "spam_report",
  "unsubscribe",
])

// Emails table
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    userEmailAccountId: uuid("user_email_account_id")
      .notNull()
      .references(() => userEmailAccounts.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id").references(() => leads.id, {
      onDelete: "set null",
    }),
    sequenceId: uuid("sequence_id").references(() => sequences.id, {
      onDelete: "set null",
    }),
    stepId: uuid("step_id").references(() => sequenceSteps.id, {
      onDelete: "set null",
    }),

    direction: emailDirectionEnum("direction").notNull(),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    toEmail: varchar("to_email", { length: 255 }).notNull(),
    ccEmails: text("cc_emails").array(),
    bccEmails: text("bcc_emails").array(),

    subject: varchar("subject", { length: 500 }),
    bodyText: text("body_text"),
    bodyHtml: text("body_html"),
    rawEmail: text("raw_email"), // RFC 822 format raw email (for inbound emails)

    // Attachments metadata (stored as JSONB array)
    attachments: jsonb("attachments"), // Array of { filename, type, size }

    status: emailStatusEnum("status").notNull().default("draft"),

    // Timing
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    openedAt: timestamp("opened_at", { withTimezone: true }),
    clickedAt: timestamp("clicked_at", { withTimezone: true }),
    repliedAt: timestamp("replied_at", { withTimezone: true }),

    // Bounce information
    bounceType: emailBounceTypeEnum("bounce_type"),
    bounceReason: text("bounce_reason"),
    errorMessage: text("error_message"),

    // Provider IDs
    sendgridMessageId: varchar("sendgrid_message_id", { length: 500 }),
    messageId: varchar("message_id", { length: 500 }), // Standard email Message-ID header
    inReplyTo: varchar("in_reply_to", { length: 500 }), // For threading

    // Thread relationship (changed to varchar for messageId-based threading)
    threadId: varchar("thread_id", { length: 500 }),

    // Engagement metrics
    openCount: integer("open_count").notNull().default(0),
    clickCount: integer("click_count").notNull().default(0),

    // Denormalized fields for performance (避免 JOIN)
    leadName: varchar("lead_name", { length: 255 }),
    leadEmail: varchar("lead_email", { length: 255 }),
    sequenceName: varchar("sequence_name", { length: 255 }),

    // Unsubscribe/spam
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    spamReportedAt: timestamp("spam_reported_at", { withTimezone: true }),

    // UI state (for inbound emails)
    isImportant: boolean("is_important").notNull().default(false),
    isRead: boolean("is_read").notNull().default(false),

    // Retry logic
    retryCount: integer("retry_count").notNull().default(0),
    lastRetryAt: timestamp("last_retry_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // Composite index for most common query pattern
    workspaceUserIdx: index("emails_workspace_user_idx").on(
      table.workspaceId,
      table.userEmailAccountId,
    ),
    // Single field indexes
    leadIdx: index("emails_lead_id_idx").on(table.leadId),
    sequenceIdx: index("emails_sequence_id_idx").on(table.sequenceId),
    statusDirectionIdx: index("emails_status_direction_idx").on(table.status, table.direction),
    threadIdx: index("emails_thread_id_idx").on(table.threadId),
    scheduledIdx: index("emails_scheduled_at_idx").on(table.scheduledAt),
    messageIdIdx: index("emails_message_id_idx").on(table.messageId),
    inReplyToIdx: index("emails_in_reply_to_idx").on(table.inReplyTo),
  }),
)

// Email threads table removed - using threadId field in emails table instead

// Email replies table
export const emailReplies = pgTable(
  "email_replies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "restrict" }),
    originalEmailId: uuid("original_email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    replyEmailId: uuid("reply_email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    sentiment: emailReplySentimentEnum("sentiment"),
    intent: varchar("intent", { length: 255 }),
    aiSummary: text("ai_summary"),
    isRead: boolean("is_read").notNull().default(false),
    assignedTo: uuid("assigned_to").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index("email_replies_workspace_id_idx").on(table.workspaceId),
    originalEmailIdx: index("email_replies_original_email_id_idx").on(table.originalEmailId),
    replyEmailIdx: index("email_replies_reply_email_id_idx").on(table.replyEmailId),
    sentimentIdx: index("email_replies_sentiment_idx").on(table.sentiment),
    isReadIdx: index("email_replies_is_read_idx").on(table.isRead),
  }),
)

// Email events table (webhook events from SendGrid, etc.)
export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    emailId: uuid("email_id")
      .notNull()
      .references(() => emails.id, { onDelete: "cascade" }),
    eventType: emailEventTypeEnum("event_type").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    sendgridEventId: varchar("sendgrid_event_id", { length: 500 }),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 50 }),
    url: text("url"), // For click events
    bounceType: varchar("bounce_type", { length: 50 }),
    bounceReason: text("bounce_reason"),
    smtpResponse: text("smtp_response"),
    rawEventData: jsonb("raw_event_data"), // Store full webhook payload
    processed: boolean("processed").notNull().default(false),
    possiblyBot: boolean("possibly_bot").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index("email_events_email_id_idx").on(table.emailId),
    eventTypeIdx: index("email_events_event_type_idx").on(table.eventType),
    timestampIdx: index("email_events_timestamp_idx").on(table.timestamp),
    processedIdx: index("email_events_processed_idx").on(table.processed),
  }),
)

// Relations
export const emailsRelations = relations(emails, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [emails.workspaceId],
    references: [workspaces.id],
  }),
  emailAccount: one(userEmailAccounts, {
    fields: [emails.userEmailAccountId],
    references: [userEmailAccounts.id],
  }),
  lead: one(leads, {
    fields: [emails.leadId],
    references: [leads.id],
  }),
  sequence: one(sequences, {
    fields: [emails.sequenceId],
    references: [sequences.id],
  }),
  step: one(sequenceSteps, {
    fields: [emails.stepId],
    references: [sequenceSteps.id],
  }),
  // thread relation removed - using threadId string field instead
  events: many(emailEvents),
}))

// emailThreadsRelations removed - table no longer exists

export const emailRepliesRelations = relations(emailReplies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [emailReplies.workspaceId],
    references: [workspaces.id],
  }),
  originalEmail: one(emails, {
    fields: [emailReplies.originalEmailId],
    references: [emails.id],
    relationName: "originalEmail",
  }),
  replyEmail: one(emails, {
    fields: [emailReplies.replyEmailId],
    references: [emails.id],
    relationName: "replyEmail",
  }),
  assignedToUser: one(users, {
    fields: [emailReplies.assignedTo],
    references: [users.id],
  }),
}))

export const emailEventsRelations = relations(emailEvents, ({ one }) => ({
  email: one(emails, {
    fields: [emailEvents.emailId],
    references: [emails.id],
  }),
}))

// Type exports
export type Email = typeof emails.$inferSelect
export type NewEmail = typeof emails.$inferInsert
// EmailThread and NewEmailThread types removed - table no longer exists
export type EmailReply = typeof emailReplies.$inferSelect
export type NewEmailReply = typeof emailReplies.$inferInsert
export type EmailEvent = typeof emailEvents.$inferSelect
export type NewEmailEvent = typeof emailEvents.$inferInsert
