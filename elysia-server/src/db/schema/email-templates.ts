import { relations } from 'drizzle-orm'
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'
import { workspaces } from './workspaces'

// Email templates table
export const emailTemplates = pgTable(
  'email_templates',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    subject: varchar('subject', { length: 500 }).notNull(),
    bodyText: text('body_text'),
    bodyHtml: text('body_html'),
    variables: jsonb('variables'), // Store template variables/placeholders as JSON
    category: varchar('category', { length: 100 }),
    isShared: boolean('is_shared').notNull().default(false), // Whether template is shared across workspace
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('email_templates_workspace_id_idx').on(table.workspaceId),
    createdByIdx: index('email_templates_created_by_idx').on(table.createdBy),
    categoryIdx: index('email_templates_category_idx').on(table.category),
    nameIdx: index('email_templates_name_idx').on(table.name),
  }),
)

// Relations
export const emailTemplatesRelations = relations(emailTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [emailTemplates.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [emailTemplates.createdBy],
    references: [users.id],
  }),
}))

// Type exports
export type EmailTemplate = typeof emailTemplates.$inferSelect
export type NewEmailTemplate = typeof emailTemplates.$inferInsert
