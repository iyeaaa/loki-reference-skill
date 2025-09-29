import { relations } from 'drizzle-orm'
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const addressBookGroups = pgTable(
  'address_book_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index('address_book_groups_name_idx').on(table.name),
  }),
)

export const addressBookContacts = pgTable(
  'address_book_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    groupId: uuid('group_id')
      .notNull()
      .references(() => addressBookGroups.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 160 }).notNull(),
    email: varchar('email', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    groupIdx: index('address_book_contacts_group_id_idx').on(table.groupId),
    emailIdx: index('address_book_contacts_email_idx').on(table.email),
  }),
)

export const addressBookGroupsRelations = relations(addressBookGroups, ({ many }) => ({
  contacts: many(addressBookContacts),
}))

export const addressBookContactsRelations = relations(addressBookContacts, ({ one }) => ({
  group: one(addressBookGroups, {
    fields: [addressBookContacts.groupId],
    references: [addressBookGroups.id],
  }),
}))

export type AddressBookGroup = typeof addressBookGroups.$inferSelect
export type NewAddressBookGroup = typeof addressBookGroups.$inferInsert
export type AddressBookContact = typeof addressBookContacts.$inferSelect
export type NewAddressBookContact = typeof addressBookContacts.$inferInsert


