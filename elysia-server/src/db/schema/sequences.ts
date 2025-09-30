import { relations } from 'drizzle-orm'
import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { userEmailAccounts } from './email-accounts'
import { emailTemplates } from './email-templates'
import { leads } from './leads'
import { users } from './users'
import { workspaces } from './workspaces'

// Enums
export const sequenceStatusEnum = pgEnum('sequence_status_enum', [
  'draft',
  'active',
  'paused',
  'archived',
])

export const enrollmentStatusEnum = pgEnum('enrollment_status_enum', [
  'active',
  'paused',
  'completed',
  'stopped',
  'bounced',
  'unsubscribed',
])

export const stepExecutionStatusEnum = pgEnum('step_execution_status_enum', [
  'pending',
  'scheduled',
  'sent',
  'failed',
  'skipped',
])

// Sequences table
export const sequences = pgTable(
  'sequences',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    status: sequenceStatusEnum('status').notNull().default('draft'),
    workflowData: text('workflow_data'), // JSON data for React Flow workflow
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('sequences_workspace_id_idx').on(table.workspaceId),
    statusIdx: index('sequences_status_idx').on(table.status),
    createdByIdx: index('sequences_created_by_idx').on(table.createdBy),
  }),
)

// Sequence steps table
export const sequenceSteps = pgTable(
  'sequence_steps',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    stepOrder: integer('step_order').notNull(), // Order of the step in the sequence
    delayDays: integer('delay_days').notNull().default(0), // Days to wait before sending
    emailSubject: varchar('email_subject', { length: 500 }).notNull(),
    emailBodyText: text('email_body_text'),
    emailBodyHtml: text('email_body_html'),
    emailTemplateId: uuid('email_template_id'), // Reference to email_templates (we'll add this relation later)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    sequenceIdx: index('sequence_steps_sequence_id_idx').on(table.sequenceId),
    orderIdx: index('sequence_steps_order_idx').on(table.sequenceId, table.stepOrder),
  }),
)

// Sequence enrollments table
export const sequenceEnrollments = pgTable(
  'sequence_enrollments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequenceId: uuid('sequence_id')
      .notNull()
      .references(() => sequences.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    userEmailAccountId: uuid('user_email_account_id')
      .notNull()
      .references(() => userEmailAccounts.id, { onDelete: 'restrict' }),
    currentStepOrder: integer('current_step_order').notNull().default(0),
    status: enrollmentStatusEnum('status').notNull().default('active'),
    enrolledBy: uuid('enrolled_by').references(() => users.id),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    firstEmailSentAt: timestamp('first_email_sent_at', { withTimezone: true }),
    lastEmailSentAt: timestamp('last_email_sent_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    nextStepScheduledAt: timestamp('next_step_scheduled_at', { withTimezone: true }),
  },
  (table) => ({
    sequenceIdx: index('sequence_enrollments_sequence_id_idx').on(table.sequenceId),
    leadIdx: index('sequence_enrollments_lead_id_idx').on(table.leadId),
    statusIdx: index('sequence_enrollments_status_idx').on(table.status),
    nextStepIdx: index('sequence_enrollments_next_step_idx').on(table.nextStepScheduledAt),
    emailAccountIdx: index('sequence_enrollments_email_account_idx').on(table.userEmailAccountId),
  }),
)

// Sequence step executions table
export const sequenceStepExecutions = pgTable(
  'sequence_step_executions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    enrollmentId: uuid('enrollment_id')
      .notNull()
      .references(() => sequenceEnrollments.id, { onDelete: 'cascade' }),
    stepId: uuid('step_id')
      .notNull()
      .references(() => sequenceSteps.id, { onDelete: 'restrict' }),
    stepOrder: integer('step_order').notNull(),
    status: stepExecutionStatusEnum('status').notNull().default('pending'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    emailId: uuid('email_id'), // Reference to emails table (we'll add this relation later)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    enrollmentIdx: index('sequence_step_executions_enrollment_id_idx').on(table.enrollmentId),
    stepIdx: index('sequence_step_executions_step_id_idx').on(table.stepId),
    statusIdx: index('sequence_step_executions_status_idx').on(table.status),
    scheduledIdx: index('sequence_step_executions_scheduled_idx').on(table.scheduledAt),
  }),
)

// Relations
export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [sequences.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [sequences.createdBy],
    references: [users.id],
  }),
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}))

export const sequenceStepsRelations = relations(sequenceSteps, ({ one, many }) => ({
  sequence: one(sequences, {
    fields: [sequenceSteps.sequenceId],
    references: [sequences.id],
  }),
  emailTemplate: one(emailTemplates, {
    fields: [sequenceSteps.emailTemplateId],
    references: [emailTemplates.id],
  }),
  executions: many(sequenceStepExecutions),
}))

export const sequenceEnrollmentsRelations = relations(sequenceEnrollments, ({ one, many }) => ({
  sequence: one(sequences, {
    fields: [sequenceEnrollments.sequenceId],
    references: [sequences.id],
  }),
  lead: one(leads, {
    fields: [sequenceEnrollments.leadId],
    references: [leads.id],
  }),
  emailAccount: one(userEmailAccounts, {
    fields: [sequenceEnrollments.userEmailAccountId],
    references: [userEmailAccounts.id],
  }),
  enrolledByUser: one(users, {
    fields: [sequenceEnrollments.enrolledBy],
    references: [users.id],
  }),
  stepExecutions: many(sequenceStepExecutions),
}))

export const sequenceStepExecutionsRelations = relations(sequenceStepExecutions, ({ one }) => ({
  enrollment: one(sequenceEnrollments, {
    fields: [sequenceStepExecutions.enrollmentId],
    references: [sequenceEnrollments.id],
  }),
  step: one(sequenceSteps, {
    fields: [sequenceStepExecutions.stepId],
    references: [sequenceSteps.id],
  }),
}))

// Type exports
export type Sequence = typeof sequences.$inferSelect
export type NewSequence = typeof sequences.$inferInsert
export type SequenceStep = typeof sequenceSteps.$inferSelect
export type NewSequenceStep = typeof sequenceSteps.$inferInsert
export type SequenceEnrollment = typeof sequenceEnrollments.$inferSelect
export type NewSequenceEnrollment = typeof sequenceEnrollments.$inferInsert
export type SequenceStepExecution = typeof sequenceStepExecutions.$inferSelect
export type NewSequenceStepExecution = typeof sequenceStepExecutions.$inferInsert
