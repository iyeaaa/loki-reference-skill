import { relations } from 'drizzle-orm'
import { boolean, index, jsonb, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { leads } from './leads'
import { users } from './users'
import { workspaces } from './workspaces'

// Customer groups table
export const customerGroups = pgTable(
  'customer_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    criteria: jsonb('criteria'), // Store filter/segmentation criteria as JSON
    isDynamic: boolean('is_dynamic').notNull().default(false), // Dynamic groups auto-update based on criteria
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    workspaceIdx: index('customer_groups_workspace_id_idx').on(table.workspaceId),
    createdByIdx: index('customer_groups_created_by_idx').on(table.createdBy),
    nameIdx: index('customer_groups_name_idx').on(table.name),
  }),
)

// Customer group members table (many-to-many relationship)
export const customerGroupMembers = pgTable(
  'customer_group_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => customerGroups.id, { onDelete: 'cascade' }),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    addedBy: uuid('added_by').references(() => users.id),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    groupIdx: index('customer_group_members_group_id_idx').on(table.groupId),
    leadIdx: index('customer_group_members_lead_id_idx').on(table.leadId),
  }),
)

// Relations
export const customerGroupsRelations = relations(customerGroups, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [customerGroups.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [customerGroups.createdBy],
    references: [users.id],
  }),
  members: many(customerGroupMembers),
}))

export const customerGroupMembersRelations = relations(customerGroupMembers, ({ one }) => ({
  group: one(customerGroups, {
    fields: [customerGroupMembers.groupId],
    references: [customerGroups.id],
  }),
  lead: one(leads, {
    fields: [customerGroupMembers.leadId],
    references: [leads.id],
  }),
  addedByUser: one(users, {
    fields: [customerGroupMembers.addedBy],
    references: [users.id],
  }),
}))

// Type exports
export type CustomerGroup = typeof customerGroups.$inferSelect
export type NewCustomerGroup = typeof customerGroups.$inferInsert
export type CustomerGroupMember = typeof customerGroupMembers.$inferSelect
export type NewCustomerGroupMember = typeof customerGroupMembers.$inferInsert
