import { relations } from 'drizzle-orm'
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
} from 'drizzle-orm/pg-core'
import { userEmailAccounts } from './email-accounts'
import { leads } from './leads'
import { sequenceSteps, sequences } from './sequences'
import { users } from './users'
import { workspaces } from './workspaces'

// Enums
export const emailDirectionEnum = pgEnum('email_direction_enum', ['outbound', 'inbound'])

export const emailStatusEnum = pgEnum('email_status_enum', [
  'draft',
  'scheduled',
  'queued',
  'sent',
  'delivered',
  'opened',
  'clicked',
  'replied',
  'bounced',
  'failed',
  'spam',
  'unsubscribed',
])

export const emailBounceTypeEnum = pgEnum('email_bounce_type_enum', ['soft', 'hard', 'block'])

export const emailThreadStatusEnum = pgEnum('email_thread_status_enum', [
  'active',
  'archived',
  'snoozed',
])

export const emailReplySentimentEnum = pgEnum('email_reply_sentiment_enum', [
  'positive',
  'neutral',
  'negative',
  'interested',
  'not_interested',
])

export const emailEventTypeEnum = pgEnum('email_event_type_enum', [
  'processed',
  'delivered',
  'open',
  'click',
  'bounce',
  'dropped',
  'deferred',
  'spam_report',
  'unsubscribe',
])

// Emails table
export const emails = pgTable(
  'emails',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userEmailAccountId: uuid('user_email_account_id')
      .notNull()
      .references(() => userEmailAccounts.id, { onDelete: 'restrict' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    sequenceId: uuid('sequence_id').references(() => sequences.id, { onDelete: 'set null' }),
    stepId: uuid('step_id').references(() => sequenceSteps.id, { onDelete: 'set null' }),

    direction: emailDirectionEnum('direction').notNull(),
    fromEmail: varchar('from_email', { length: 255 }).notNull(),
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    ccEmails: text('cc_emails').array(),
    bccEmails: text('bcc_emails').array(),

    subject: varchar('subject', { length: 500 }),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),

    status: emailStatusEnum('status').notNull().default('draft'),

    // Timing
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    repliedAt: timestamp('replied_at', { withTimezone: true }),

    // Bounce information
    bounceType: emailBounceTypeEnum('bounce_type'),
    bounceReason: text('bounce_reason'),
    errorMessage: text('error_message'),

    // Provider IDs
    sendgridMessageId: varchar('sendgrid_message_id', { length: 500 }),
    messageId: varchar('message_id', { length: 500 }), // Standard email Message-ID header
    inReplyTo: varchar('in_reply_to', { length: 500 }), // For threading

    // Thread relationship
    threadId: uuid('thread_id'),

    // Engagement metrics
    openCount: integer('open_count').notNull().default(0),
    clickCount: integer('click_count').notNull().default(0),

    // Unsubscribe/spam
    unsubscribedAt: timestamp('unsubscribed_at', { withTimezone: true }),
    spamReportedAt: timestamp('spam_reported_at', { withTimezone: true }),

    // Retry logic
    retryCount: integer('retry_count').notNull().default(0),
    lastRetryAt: timestamp('last_retry_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('emails_workspace_id_idx').on(table.workspaceId),
    emailAccountIdx: index('emails_user_email_account_id_idx').on(table.userEmailAccountId),
    leadIdx: index('emails_lead_id_idx').on(table.leadId),
    sequenceIdx: index('emails_sequence_id_idx').on(table.sequenceId),
    statusIdx: index('emails_status_idx').on(table.status),
    threadIdx: index('emails_thread_id_idx').on(table.threadId),
    scheduledIdx: index('emails_scheduled_at_idx').on(table.scheduledAt),
    messageIdIdx: index('emails_message_id_idx').on(table.messageId),
    inReplyToIdx: index('emails_in_reply_to_idx').on(table.inReplyTo),
  }),
)

// Email threads table
export const emailThreads = pgTable(
  'email_threads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id').references(() => leads.id, { onDelete: 'set null' }),
    subject: varchar('subject', { length: 500 }),
    firstEmailId: uuid('first_email_id'),
    lastEmailId: uuid('last_email_id'),
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }),
    status: emailThreadStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('email_threads_workspace_id_idx').on(table.workspaceId),
    leadIdx: index('email_threads_lead_id_idx').on(table.leadId),
    lastActivityIdx: index('email_threads_last_activity_idx').on(table.lastActivityAt),
  }),
)

// Email replies table
export const emailReplies = pgTable(
  'email_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    originalEmailId: uuid('original_email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    replyEmailId: uuid('reply_email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    sentiment: emailReplySentimentEnum('sentiment'),
    intent: varchar('intent', { length: 255 }),
    aiSummary: text('ai_summary'),
    isRead: boolean('is_read').notNull().default(false),
    assignedTo: uuid('assigned_to').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('email_replies_workspace_id_idx').on(table.workspaceId),
    originalEmailIdx: index('email_replies_original_email_id_idx').on(table.originalEmailId),
    replyEmailIdx: index('email_replies_reply_email_id_idx').on(table.replyEmailId),
    sentimentIdx: index('email_replies_sentiment_idx').on(table.sentiment),
    isReadIdx: index('email_replies_is_read_idx').on(table.isRead),
  }),
)

// Email events table (webhook events from SendGrid, etc.)
export const emailEvents = pgTable(
  'email_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    emailId: uuid('email_id')
      .notNull()
      .references(() => emails.id, { onDelete: 'cascade' }),
    eventType: emailEventTypeEnum('event_type').notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    sendgridEventId: varchar('sendgrid_event_id', { length: 500 }),
    userAgent: text('user_agent'),
    ipAddress: varchar('ip_address', { length: 50 }),
    url: text('url'), // For click events
    bounceType: varchar('bounce_type', { length: 50 }),
    bounceReason: text('bounce_reason'),
    smtpResponse: text('smtp_response'),
    rawEventData: jsonb('raw_event_data'), // Store full webhook payload
    processed: boolean('processed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: index('email_events_email_id_idx').on(table.emailId),
    eventTypeIdx: index('email_events_event_type_idx').on(table.eventType),
    timestampIdx: index('email_events_timestamp_idx').on(table.timestamp),
    processedIdx: index('email_events_processed_idx').on(table.processed),
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
  thread: one(emailThreads, {
    fields: [emails.threadId],
    references: [emailThreads.id],
  }),
  events: many(emailEvents),
}))

export const emailThreadsRelations = relations(emailThreads, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [emailThreads.workspaceId],
    references: [workspaces.id],
  }),
  lead: one(leads, {
    fields: [emailThreads.leadId],
    references: [leads.id],
  }),
  firstEmail: one(emails, {
    fields: [emailThreads.firstEmailId],
    references: [emails.id],
    relationName: 'threadFirstEmail',
  }),
  lastEmail: one(emails, {
    fields: [emailThreads.lastEmailId],
    references: [emails.id],
    relationName: 'threadLastEmail',
  }),
  emails: many(emails),
}))

export const emailRepliesRelations = relations(emailReplies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [emailReplies.workspaceId],
    references: [workspaces.id],
  }),
  originalEmail: one(emails, {
    fields: [emailReplies.originalEmailId],
    references: [emails.id],
    relationName: 'originalEmail',
  }),
  replyEmail: one(emails, {
    fields: [emailReplies.replyEmailId],
    references: [emails.id],
    relationName: 'replyEmail',
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
export type EmailThread = typeof emailThreads.$inferSelect
export type NewEmailThread = typeof emailThreads.$inferInsert
export type EmailReply = typeof emailReplies.$inferSelect
export type NewEmailReply = typeof emailReplies.$inferInsert
export type EmailEvent = typeof emailEvents.$inferSelect
export type NewEmailEvent = typeof emailEvents.$inferInsert
