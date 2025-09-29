import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { leads } from './leads'
import { users } from './users'
import { workspaces } from './workspaces'

// Enums
export const contactTypeEnum = pgEnum('contact_type_enum', ['phone', 'email', 'fax', 'other'])

export const socialMediaPlatformEnum = pgEnum('social_media_platform_enum', [
  'facebook',
  'instagram',
  'twitter',
  'linkedin',
])

// Lead contacts table (for phone numbers, emails, etc.)
export const leadContacts = pgTable(
  'lead_contacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    contactType: contactTypeEnum('contact_type').notNull(),
    contactValue: varchar('contact_value', { length: 255 }).notNull(),
    label: varchar('label', { length: 100 }), // e.g., 'main', 'support', 'sales'
    isPrimary: boolean('is_primary').notNull().default(false),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_contacts_lead_id_idx').on(table.leadId),
    typeIdx: index('lead_contacts_contact_type_idx').on(table.contactType),
    isPrimaryIdx: index('lead_contacts_is_primary_idx').on(table.isPrimary),
  }),
)

// Lead social media table
export const leadSocialMedia = pgTable(
  'lead_social_media',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    platform: socialMediaPlatformEnum('platform').notNull(),
    url: varchar('url', { length: 500 }).notNull(),
    username: varchar('username', { length: 255 }),
    followerCount: varchar('follower_count', { length: 50 }), // Store as string for flexibility (e.g., '10K', '1.5M')
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_social_media_lead_id_idx').on(table.leadId),
    platformIdx: index('lead_social_media_platform_idx').on(table.platform),
  }),
)

// Lead products table
export const leadProducts = pgTable(
  'lead_products',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    productName: varchar('product_name', { length: 255 }).notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_products_lead_id_idx').on(table.leadId),
    nameIdx: index('lead_products_product_name_idx').on(table.productName),
  }),
)

// Lead business sectors table
export const leadBusinessSectors = pgTable(
  'lead_business_sectors',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    sectorName: varchar('sector_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_business_sectors_lead_id_idx').on(table.leadId),
    sectorIdx: index('lead_business_sectors_sector_name_idx').on(table.sectorName),
  }),
)

// Lead product categories table
export const leadProductCategories = pgTable(
  'lead_product_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    categoryName: varchar('category_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_product_categories_lead_id_idx').on(table.leadId),
    categoryIdx: index('lead_product_categories_category_name_idx').on(table.categoryName),
  }),
)

// Lead industry types table
export const leadIndustryTypes = pgTable(
  'lead_industry_types',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    leadId: uuid('lead_id')
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    industryName: varchar('industry_name', { length: 255 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    leadIdx: index('lead_industry_types_lead_id_idx').on(table.leadId),
    industryIdx: index('lead_industry_types_industry_name_idx').on(table.industryName),
  }),
)

// Relations
export const leadContactsRelations = relations(leadContacts, ({ one }) => ({
  lead: one(leads, {
    fields: [leadContacts.leadId],
    references: [leads.id],
  }),
}))

export const leadSocialMediaRelations = relations(leadSocialMedia, ({ one }) => ({
  lead: one(leads, {
    fields: [leadSocialMedia.leadId],
    references: [leads.id],
  }),
}))

export const leadProductsRelations = relations(leadProducts, ({ one }) => ({
  lead: one(leads, {
    fields: [leadProducts.leadId],
    references: [leads.id],
  }),
}))

export const leadBusinessSectorsRelations = relations(leadBusinessSectors, ({ one }) => ({
  lead: one(leads, {
    fields: [leadBusinessSectors.leadId],
    references: [leads.id],
  }),
}))

export const leadProductCategoriesRelations = relations(leadProductCategories, ({ one }) => ({
  lead: one(leads, {
    fields: [leadProductCategories.leadId],
    references: [leads.id],
  }),
}))

export const leadIndustryTypesRelations = relations(leadIndustryTypes, ({ one }) => ({
  lead: one(leads, {
    fields: [leadIndustryTypes.leadId],
    references: [leads.id],
  }),
}))

// Leads relations (defined here to avoid circular dependency)
export const leadsRelations = relations(leads, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [leads.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [leads.createdBy],
    references: [users.id],
  }),
  contacts: many(leadContacts),
  socialMedia: many(leadSocialMedia),
  products: many(leadProducts),
  businessSectors: many(leadBusinessSectors),
  productCategories: many(leadProductCategories),
  industryTypes: many(leadIndustryTypes),
}))

// Type exports
export type LeadContact = typeof leadContacts.$inferSelect
export type NewLeadContact = typeof leadContacts.$inferInsert
export type LeadSocialMedia = typeof leadSocialMedia.$inferSelect
export type NewLeadSocialMedia = typeof leadSocialMedia.$inferInsert
export type LeadProduct = typeof leadProducts.$inferSelect
export type NewLeadProduct = typeof leadProducts.$inferInsert
export type LeadBusinessSector = typeof leadBusinessSectors.$inferSelect
export type NewLeadBusinessSector = typeof leadBusinessSectors.$inferInsert
export type LeadProductCategory = typeof leadProductCategories.$inferSelect
export type NewLeadProductCategory = typeof leadProductCategories.$inferInsert
export type LeadIndustryType = typeof leadIndustryTypes.$inferSelect
export type NewLeadIndustryType = typeof leadIndustryTypes.$inferInsert
