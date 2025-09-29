import { relations } from 'drizzle-orm'
import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { users } from './users'

export const addressBookGroups = pgTable(
  'address_book_groups',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userNameIdx: index('address_book_groups_user_name_idx').on(table.userId, table.name),
    nameIdx: index('address_book_groups_name_idx').on(table.name),
  }),
)

export const addressBookContacts = pgTable(
  'address_book_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => addressBookGroups.id, { onDelete: 'cascade' }),
    company: varchar('company', { length: 160 }).notNull(),
    email: varchar('email', { length: 200 }).notNull(),
    industryType: varchar('industry_type', { length: 100 }),
    productCategory: varchar('product_category', { length: 100 }),
    description: varchar('description', { length: 1000 }),
    websiteUrl: varchar('website_url', { length: 500 }),
    country: varchar('country', { length: 100 }),
    linkedinUrl: varchar('linkedin_url', { length: 500 }),
    facebookUrl: varchar('facebook_url', { length: 500 }),
    instagramUrl: varchar('instagram_url', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    userGroupIdx: index('address_book_contacts_user_group_idx').on(table.userId, table.groupId),
    groupIdx: index('address_book_contacts_group_id_idx').on(table.groupId),
    emailIdx: index('address_book_contacts_email_idx').on(table.email),
  }),
)

export const addressBookGroupsRelations = relations(addressBookGroups, ({ one, many }) => ({
  user: one(users, {
    fields: [addressBookGroups.userId],
    references: [users.id],
  }),
  contacts: many(addressBookContacts),
}))

export const addressBookContactsRelations = relations(addressBookContacts, ({ one }) => ({
  user: one(users, {
    fields: [addressBookContacts.userId],
    references: [users.id],
  }),
  group: one(addressBookGroups, {
    fields: [addressBookContacts.groupId],
    references: [addressBookGroups.id],
  }),
}))

export type AddressBookGroup = typeof addressBookGroups.$inferSelect
export type NewAddressBookGroup = typeof addressBookGroups.$inferInsert
export type AddressBookContact = typeof addressBookContacts.$inferSelect
export type NewAddressBookContact = typeof addressBookContacts.$inferInsert
