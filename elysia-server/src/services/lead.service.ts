import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../db/index'
import {
  leadBusinessSectors,
  leadContacts,
  leadIndustryTypes,
  leadProductCategories,
  leadProducts,
  leadSocialMedia,
} from '../db/schema/lead-details'
import { leads } from '../db/schema/leads'
import { users } from '../db/schema/users'
import { workspaces } from '../db/schema/workspaces'

// ====================================
// LEAD CRUD OPERATIONS
// ====================================

// GetLead :one
export async function getLead(id: string) {
  const result = await db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      websiteUrl: leads.websiteUrl,
      finalUrl: leads.finalUrl,
      httpStatus: leads.httpStatus,
      nameUrlMatch: leads.nameUrlMatch,
      businessType: leads.businessType,
      isBusinessTypeMatched: leads.isBusinessTypeMatched,
      description: leads.description,
      address: leads.address,
      country: leads.country,
      city: leads.city,
      state: leads.state,
      foundedYear: leads.foundedYear,
      employeeCount: leads.employeeCount,
      leadSource: leads.leadSource,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      notes: leads.notes,
      crawlTimeSeconds: leads.crawlTimeSeconds,
      gptTimeSeconds: leads.gptTimeSeconds,
      collectedAt: leads.collectedAt,
      errorMessage: leads.errorMessage,
      createdBy: leads.createdBy,
      createdByUsername: users.username,
      createdByEmail: users.email,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .innerJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .leftJoin(users, eq(leads.createdBy, users.id))
    .where(eq(leads.id, id))
    .limit(1)

  return result[0]
}

// CreateLead :one
export async function createLead(data: {
  workspaceId: string
  companyName?: string
  foundCompanyName?: string
  websiteUrl?: string
  finalUrl?: string
  httpStatus?: number
  nameUrlMatch?: boolean
  businessType?: string
  isBusinessTypeMatched?: boolean
  description?: string
  address?: string
  country?: string
  city?: string
  state?: string
  foundedYear?: number
  employeeCount?: string
  leadSource?: string
  leadStatus?:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'unqualified'
    | 'converted'
    | 'lost'
    | 'unsubscribed'
  leadScore?: number
  notes?: string
  crawlTimeSeconds?: string
  gptTimeSeconds?: string
  collectedAt?: Date
  errorMessage?: string
  createdBy?: string
  contacts?: Array<{
    contactType: 'phone' | 'email' | 'fax' | 'other'
    contactValue: string
    label?: string
    isPrimary?: boolean
  }>
  socialMedia?: Array<{
    platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin'
    url: string
    username?: string
  }>
}) {
  const [newLead] = await db
    .insert(leads)
    .values({
      workspaceId: data.workspaceId,
      companyName: data.companyName,
      foundCompanyName: data.foundCompanyName,
      websiteUrl: data.websiteUrl,
      finalUrl: data.finalUrl,
      httpStatus: data.httpStatus,
      nameUrlMatch: data.nameUrlMatch,
      businessType: data.businessType,
      isBusinessTypeMatched: data.isBusinessTypeMatched,
      description: data.description,
      address: data.address,
      country: data.country,
      city: data.city,
      state: data.state,
      foundedYear: data.foundedYear,
      employeeCount: data.employeeCount,
      leadSource: data.leadSource,
      leadStatus: data.leadStatus || 'new',
      leadScore: data.leadScore,
      notes: data.notes,
      crawlTimeSeconds: data.crawlTimeSeconds,
      gptTimeSeconds: data.gptTimeSeconds,
      collectedAt: data.collectedAt,
      errorMessage: data.errorMessage,
      createdBy: data.createdBy,
    })
    .returning({
      id: leads.id,
      workspaceId: leads.workspaceId,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      country: leads.country,
      city: leads.city,
      createdBy: leads.createdBy,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
    })

  // Insert contacts if provided
  if (data.contacts && data.contacts.length > 0) {
    await db.insert(leadContacts).values(
      data.contacts.map((contact) => ({
        leadId: newLead.id,
        contactType: contact.contactType,
        contactValue: contact.contactValue,
        label: contact.label,
        isPrimary: contact.isPrimary || false,
        isVerified: false,
      })),
    )
  }

  // Insert social media if provided
  if (data.socialMedia && data.socialMedia.length > 0) {
    await db.insert(leadSocialMedia).values(
      data.socialMedia.map((social) => ({
        leadId: newLead.id,
        platform: social.platform,
        url: social.url,
        username: social.username,
        isVerified: false,
      })),
    )
  }

  return newLead
}

// UpdateLead :one
export async function updateLead(
  id: string,
  data: {
    workspaceId?: string
    companyName?: string
    foundCompanyName?: string
    websiteUrl?: string
    finalUrl?: string
    httpStatus?: number
    nameUrlMatch?: boolean
    businessType?: string
    isBusinessTypeMatched?: boolean
    description?: string
    address?: string
    country?: string
    city?: string
    state?: string
    foundedYear?: number
    employeeCount?: string
    leadSource?: string
    leadStatus?:
      | 'new'
      | 'contacted'
      | 'qualified'
      | 'unqualified'
      | 'converted'
      | 'lost'
      | 'unsubscribed'
    leadScore?: number
    notes?: string
    crawlTimeSeconds?: string
    gptTimeSeconds?: string
    collectedAt?: Date
    errorMessage?: string
    lastContactedAt?: Date
    contacts?: Array<{
      contactType: 'phone' | 'email' | 'fax' | 'other'
      contactValue: string
      label?: string
      isPrimary?: boolean
    }>
    socialMedia?: Array<{
      platform: 'facebook' | 'instagram' | 'twitter' | 'linkedin'
      url: string
      username?: string
    }>
  },
) {
  // Extract contacts and socialMedia from data
  const { contacts, socialMedia, ...leadData } = data
  const [updatedLead] = await db
    .update(leads)
    .set({
      ...leadData,
      updatedAt: new Date(),
    })
    .where(eq(leads.id, id))
    .returning({
      id: leads.id,
      workspaceId: leads.workspaceId,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      country: leads.country,
      city: leads.city,
      createdBy: leads.createdBy,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })

  // Update contacts if provided
  if (contacts !== undefined) {
    // Delete existing contacts
    await db.delete(leadContacts).where(eq(leadContacts.leadId, id))

    // Insert new contacts
    if (contacts.length > 0) {
      await db.insert(leadContacts).values(
        contacts.map((contact) => ({
          leadId: id,
          contactType: contact.contactType,
          contactValue: contact.contactValue,
          label: contact.label,
          isPrimary: contact.isPrimary || false,
          isVerified: false,
        })),
      )
    }
  }

  // Update social media if provided
  if (socialMedia !== undefined) {
    // Delete existing social media
    await db.delete(leadSocialMedia).where(eq(leadSocialMedia.leadId, id))

    // Insert new social media
    if (socialMedia.length > 0) {
      await db.insert(leadSocialMedia).values(
        socialMedia.map((social) => ({
          leadId: id,
          platform: social.platform,
          url: social.url,
          username: social.username,
          isVerified: false,
        })),
      )
    }
  }

  return updatedLead
}

// DeleteLead :exec
export async function deleteLead(id: string) {
  await db.delete(leads).where(eq(leads.id, id))
}

// ====================================
// LEAD QUERY AND SEARCH OPERATIONS
// ====================================

// ListLeads :many
export async function listLeads(limit: number, offset: number) {
  const result = await db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      country: leads.country,
      city: leads.city,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      createdBy: leads.createdBy,
      createdByUsername: users.username,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .innerJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .leftJoin(users, eq(leads.createdBy, users.id))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListLeadsWithFilters :many
export async function listLeadsWithFilters(
  limit: number,
  offset: number,
  filters?: {
    leadStatus?:
      | 'new'
      | 'contacted'
      | 'qualified'
      | 'unqualified'
      | 'converted'
      | 'lost'
      | 'unsubscribed'
    businessType?: string
    country?: string
    city?: string
    search?: string
    workspaceIds?: string[]
    createdByIds?: string[]
  },
) {
  const conditions = []

  if (filters?.leadStatus) {
    conditions.push(eq(leads.leadStatus, filters.leadStatus))
  }

  if (filters?.businessType) {
    conditions.push(ilike(leads.businessType, `%${filters.businessType}%`))
  }

  if (filters?.country) {
    conditions.push(ilike(leads.country, `%${filters.country}%`))
  }

  if (filters?.city) {
    conditions.push(ilike(leads.city, `%${filters.city}%`))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(leads.companyName, `%${filters.search}%`),
        ilike(leads.foundCompanyName, `%${filters.search}%`),
        ilike(leads.websiteUrl, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    conditions.push(or(...filters.workspaceIds.map((id) => eq(leads.workspaceId, id)))!)
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    conditions.push(or(...filters.createdByIds.map((id) => eq(leads.createdBy, id)))!)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get basic lead data
  const result = await db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      country: leads.country,
      city: leads.city,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      createdBy: leads.createdBy,
      createdByUsername: users.username,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .innerJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .leftJoin(users, eq(leads.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)

  // Get contacts and social media for each lead
  const leadIds = result.map((lead) => lead.id)

  const contactsMap = new Map()
  const socialMediaMap = new Map()

  if (leadIds.length > 0) {
    // Get contacts for all leads
    const allContacts = await db
      .select()
      .from(leadContacts)
      .where(or(...leadIds.map((id) => eq(leadContacts.leadId, id)))!)
      .orderBy(desc(leadContacts.isPrimary))

    // Get social media for all leads
    const allSocialMedia = await db
      .select()
      .from(leadSocialMedia)
      .where(or(...leadIds.map((id) => eq(leadSocialMedia.leadId, id)))!)

    // Group by leadId
    allContacts.forEach((contact) => {
      if (!contactsMap.has(contact.leadId)) {
        contactsMap.set(contact.leadId, [])
      }
      contactsMap.get(contact.leadId).push(contact)
    })

    allSocialMedia.forEach((social) => {
      if (!socialMediaMap.has(social.leadId)) {
        socialMediaMap.set(social.leadId, [])
      }
      socialMediaMap.get(social.leadId).push(social)
    })
  }

  // Combine data
  return result.map((lead) => ({
    ...lead,
    contacts: contactsMap.get(lead.id) || [],
    socialMedia: socialMediaMap.get(lead.id) || [],
  }))
}

// GetLeadsByWorkspace :many
export async function getLeadsByWorkspace(workspaceId: string, limit: number, offset: number) {
  const result = await db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      country: leads.country,
      city: leads.city,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      createdBy: leads.createdBy,
      createdByUsername: users.username,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .leftJoin(users, eq(leads.createdBy, users.id))
    .where(eq(leads.workspaceId, workspaceId))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetLeadsByStatus :many
export async function getLeadsByStatus(
  leadStatus:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'unqualified'
    | 'converted'
    | 'lost'
    | 'unsubscribed',
  limit: number,
  offset: number,
) {
  const result = await db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      country: leads.country,
      city: leads.city,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      createdBy: leads.createdBy,
      createdByUsername: users.username,
      createdAt: leads.createdAt,
      updatedAt: leads.updatedAt,
      lastContactedAt: leads.lastContactedAt,
    })
    .from(leads)
    .innerJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .leftJoin(users, eq(leads.createdBy, users.id))
    .where(eq(leads.leadStatus, leadStatus))
    .orderBy(desc(leads.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountLeads :one
export async function countLeads() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(leads)

  return result[0]?.count ?? 0
}

// CountLeadsWithFilters :one
export async function countLeadsWithFilters(filters?: {
  leadStatus?:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'unqualified'
    | 'converted'
    | 'lost'
    | 'unsubscribed'
  businessType?: string
  country?: string
  city?: string
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.leadStatus) {
    conditions.push(eq(leads.leadStatus, filters.leadStatus))
  }

  if (filters?.businessType) {
    conditions.push(ilike(leads.businessType, `%${filters.businessType}%`))
  }

  if (filters?.country) {
    conditions.push(ilike(leads.country, `%${filters.country}%`))
  }

  if (filters?.city) {
    conditions.push(ilike(leads.city, `%${filters.city}%`))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(leads.companyName, `%${filters.search}%`),
        ilike(leads.foundCompanyName, `%${filters.search}%`),
        ilike(leads.websiteUrl, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    conditions.push(or(...filters.workspaceIds.map((id) => eq(leads.workspaceId, id)))!)
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    conditions.push(or(...filters.createdByIds.map((id) => eq(leads.createdBy, id)))!)
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// CountLeadsByWorkspace :one
export async function countLeadsByWorkspace(workspaceId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(leads)
    .where(eq(leads.workspaceId, workspaceId))

  return result[0]?.count ?? 0
}

// ====================================
// BULK UPDATE OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(
  leadIds: string[],
  leadStatus:
    | 'new'
    | 'contacted'
    | 'qualified'
    | 'unqualified'
    | 'converted'
    | 'lost'
    | 'unsubscribed',
) {
  const result = await db
    .update(leads)
    .set({
      leadStatus,
      updatedAt: new Date(),
    })
    .where(or(...leadIds.map((id) => eq(leads.id, id)))!)
    .returning({ id: leads.id })

  return result.length
}

// BulkDelete :exec
export async function bulkDelete(leadIds: string[]) {
  const result = await db
    .delete(leads)
    .where(or(...leadIds.map((id) => eq(leads.id, id)))!)
    .returning({ id: leads.id })

  return result.length
}

// BulkUpdateBusinessType :exec
export async function bulkUpdateBusinessType(leadIds: string[], businessType: string) {
  const result = await db
    .update(leads)
    .set({
      businessType,
      updatedAt: new Date(),
    })
    .where(or(...leadIds.map((id) => eq(leads.id, id)))!)
    .returning({ id: leads.id })

  return result.length
}

// ====================================
// LEAD DETAILS OPERATIONS
// ====================================

// GetLeadContacts :many
export async function getLeadContacts(leadId: string) {
  const result = await db
    .select()
    .from(leadContacts)
    .where(eq(leadContacts.leadId, leadId))
    .orderBy(desc(leadContacts.isPrimary), desc(leadContacts.createdAt))

  return result
}

// GetLeadSocialMedia :many
export async function getLeadSocialMedia(leadId: string) {
  const result = await db
    .select()
    .from(leadSocialMedia)
    .where(eq(leadSocialMedia.leadId, leadId))
    .orderBy(desc(leadSocialMedia.createdAt))

  return result
}

// GetLeadProducts :many
export async function getLeadProducts(leadId: string) {
  const result = await db
    .select()
    .from(leadProducts)
    .where(eq(leadProducts.leadId, leadId))
    .orderBy(desc(leadProducts.createdAt))

  return result
}

// GetLeadBusinessSectors :many
export async function getLeadBusinessSectors(leadId: string) {
  const result = await db
    .select()
    .from(leadBusinessSectors)
    .where(eq(leadBusinessSectors.leadId, leadId))
    .orderBy(desc(leadBusinessSectors.createdAt))

  return result
}

// GetLeadProductCategories :many
export async function getLeadProductCategories(leadId: string) {
  const result = await db
    .select()
    .from(leadProductCategories)
    .where(eq(leadProductCategories.leadId, leadId))
    .orderBy(desc(leadProductCategories.createdAt))

  return result
}

// GetLeadIndustryTypes :many
export async function getLeadIndustryTypes(leadId: string) {
  const result = await db
    .select()
    .from(leadIndustryTypes)
    .where(eq(leadIndustryTypes.leadId, leadId))
    .orderBy(desc(leadIndustryTypes.createdAt))

  return result
}
