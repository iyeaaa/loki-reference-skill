import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroupMembers } from "../db/schema/customer-groups"
import {
  leadBusinessSectors,
  leadContacts,
  leadIndustryTypes,
  leadProductCategories,
  leadProducts,
  leadSocialMedia,
} from "../db/schema/lead-details"
import { type leadStatusEnum, leads } from "../db/schema/leads"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

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
      contactName: leads.contactName,
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
  contactName?: string
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
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed"
  leadScore?: number
  notes?: string
  crawlTimeSeconds?: string
  gptTimeSeconds?: string
  collectedAt?: Date
  errorMessage?: string
  createdBy?: string
  contacts?: Array<{
    contactType: "phone" | "email" | "fax" | "other"
    contactValue: string
    contactName?: string | null
    label?: string | null
    isPrimary?: boolean
  }>
  socialMedia?: Array<{
    platform: "facebook" | "instagram" | "twitter" | "linkedin"
    url: string
    username?: string | null
  }>
}) {
  const [newLead] = await db
    .insert(leads)
    .values({
      workspaceId: data.workspaceId,
      companyName: data.companyName,
      foundCompanyName: data.foundCompanyName,
      contactName: data.contactName,
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
      leadStatus: data.leadStatus || "new",
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

  if (!newLead) {
    throw new Error("Failed to create lead")
  }

  // Insert contacts if provided
  if (data.contacts && data.contacts.length > 0) {
    // Validate that all required fields are present
    const validContacts = data.contacts.filter(
      (contact) =>
        contact.contactType && contact.contactValue && contact.contactValue.trim() !== "",
    )

    if (validContacts.length > 0) {
      await db.insert(leadContacts).values(
        validContacts.map((contact) => ({
          leadId: newLead.id,
          contactType: contact.contactType,
          contactValue: contact.contactValue,
          contactName: contact.contactName,
          label: contact.label,
          isPrimary: contact.isPrimary || false,
          isVerified: false,
        })),
      )
    }
  }

  // Insert social media if provided
  if (data.socialMedia && data.socialMedia.length > 0) {
    // Validate that all required fields are present
    const validSocialMedia = data.socialMedia.filter(
      (social) => social.platform && social.url && social.url.trim() !== "",
    )

    if (validSocialMedia.length > 0) {
      await db.insert(leadSocialMedia).values(
        validSocialMedia.map((social) => ({
          leadId: newLead.id,
          platform: social.platform,
          url: social.url,
          username: social.username,
          isVerified: false,
        })),
      )
    }
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
    contactName?: string
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
      | "new"
      | "contacted"
      | "qualified"
      | "unqualified"
      | "converted"
      | "lost"
      | "unsubscribed"
    leadScore?: number
    notes?: string
    crawlTimeSeconds?: string
    gptTimeSeconds?: string
    collectedAt?: Date
    errorMessage?: string
    lastContactedAt?: Date
    contacts?: Array<{
      contactType: "phone" | "email" | "fax" | "other"
      contactValue: string
      contactName?: string | null
      label?: string | null
      isPrimary?: boolean
    }>
    socialMedia?: Array<{
      platform: "facebook" | "instagram" | "twitter" | "linkedin"
      url: string
      username?: string | null
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
      // Validate that all required fields are present
      const validContacts = contacts.filter(
        (contact) =>
          contact.contactType && contact.contactValue && contact.contactValue.trim() !== "",
      )

      if (validContacts.length > 0) {
        await db.insert(leadContacts).values(
          validContacts.map((contact) => ({
            leadId: id,
            contactType: contact.contactType,
            contactValue: contact.contactValue,
            contactName: contact.contactName,
            label: contact.label,
            isPrimary: contact.isPrimary || false,
            isVerified: false,
          })),
        )
      }
    }
  }

  // Update social media if provided
  if (socialMedia !== undefined) {
    // Delete existing social media
    await db.delete(leadSocialMedia).where(eq(leadSocialMedia.leadId, id))

    // Insert new social media
    if (socialMedia.length > 0) {
      // Validate that all required fields are present
      const validSocialMedia = socialMedia.filter(
        (social) => social.platform && social.url && social.url.trim() !== "",
      )

      if (validSocialMedia.length > 0) {
        await db.insert(leadSocialMedia).values(
          validSocialMedia.map((social) => ({
            leadId: id,
            platform: social.platform,
            url: social.url,
            username: social.username,
            isVerified: false,
          })),
        )
      }
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
      contactName: leads.contactName,
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
      | "new"
      | "contacted"
      | "qualified"
      | "unqualified"
      | "converted"
      | "lost"
      | "unsubscribed"
    businessType?: string
    country?: string
    city?: string
    search?: string
    searchType?: "all" | "company" | "country" | "email" | "website" | "industry" | "category"
    workspaceIds?: string[]
    createdByIds?: string[]
    customerGroupId?: string
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
    let searchCondition: ReturnType<typeof or> | undefined

    switch (filters.searchType) {
      case "company":
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.foundCompanyName, `%${filters.search}%`),
        )
        break
      case "country":
        searchCondition = ilike(leads.country, `%${filters.search}%`)
        break
      case "email":
        // 이메일은 contacts 테이블에서 검색해야 하므로 별도 처리 필요
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.contactName, `%${filters.search}%`),
        )
        break
      case "website":
        searchCondition = or(
          ilike(leads.websiteUrl, `%${filters.search}%`),
          ilike(leads.finalUrl, `%${filters.search}%`),
        )
        break
      case "industry":
        searchCondition = ilike(leads.businessType, `%${filters.search}%`)
        break
      case "category":
        // 제품 카테고리는 별도 테이블에서 검색해야 하므로 임시로 설명으로 검색
        searchCondition = ilike(leads.description, `%${filters.search}%`)
        break
      default: // "all" 또는 undefined
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.foundCompanyName, `%${filters.search}%`),
          ilike(leads.contactName, `%${filters.search}%`),
          ilike(leads.websiteUrl, `%${filters.search}%`),
          ilike(leads.country, `%${filters.search}%`),
          ilike(leads.businessType, `%${filters.search}%`),
        )
    }

    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(...filters.workspaceIds.map((id) => eq(leads.workspaceId, id)))
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(leads.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get basic lead data
  const baseQuery = db
    .select({
      id: leads.id,
      workspaceId: leads.workspaceId,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      contactName: leads.contactName,
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

  // If customerGroupId is specified, join with customerGroupMembers table
  let result: Awaited<ReturnType<typeof baseQuery.orderBy>>
  if (filters?.customerGroupId) {
    result = await baseQuery
      .innerJoin(customerGroupMembers, eq(leads.id, customerGroupMembers.leadId))
      .where(and(eq(customerGroupMembers.groupId, filters.customerGroupId), whereClause))
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset)
  } else if (whereClause) {
    result = await baseQuery
      .where(whereClause)
      .orderBy(desc(leads.createdAt))
      .limit(limit)
      .offset(offset)
  } else {
    result = await baseQuery.orderBy(desc(leads.createdAt)).limit(limit).offset(offset)
  }

  // Get all related data for each lead
  const leadIds = result.map((lead) => lead.id)

  const contactsMap = new Map()
  const socialMediaMap = new Map()
  const productsMap = new Map()
  const businessSectorsMap = new Map()
  const productCategoriesMap = new Map()
  const industryTypesMap = new Map()

  if (leadIds.length > 0) {
    const leadIdCondition = or(...leadIds.map((id) => eq(leadContacts.leadId, id)))
    const leadIdSocialCondition = or(...leadIds.map((id) => eq(leadSocialMedia.leadId, id)))
    const leadIdProductsCondition = or(...leadIds.map((id) => eq(leadProducts.leadId, id)))
    const leadIdBusinessSectorsCondition = or(
      ...leadIds.map((id) => eq(leadBusinessSectors.leadId, id)),
    )
    const leadIdProductCategoriesCondition = or(
      ...leadIds.map((id) => eq(leadProductCategories.leadId, id)),
    )
    const leadIdIndustryTypesCondition = or(
      ...leadIds.map((id) => eq(leadIndustryTypes.leadId, id)),
    )

    // Get contacts for all leads
    const allContacts = leadIdCondition
      ? await db
          .select()
          .from(leadContacts)
          .where(leadIdCondition)
          .orderBy(desc(leadContacts.isPrimary))
      : []

    // Get social media for all leads
    const allSocialMedia = leadIdSocialCondition
      ? await db.select().from(leadSocialMedia).where(leadIdSocialCondition)
      : []

    // Get products for all leads
    const allProducts = leadIdProductsCondition
      ? await db.select().from(leadProducts).where(leadIdProductsCondition)
      : []

    // Get business sectors for all leads
    const allBusinessSectors = leadIdBusinessSectorsCondition
      ? await db.select().from(leadBusinessSectors).where(leadIdBusinessSectorsCondition)
      : []

    // Get product categories for all leads
    const allProductCategories = leadIdProductCategoriesCondition
      ? await db.select().from(leadProductCategories).where(leadIdProductCategoriesCondition)
      : []

    // Get industry types for all leads
    const allIndustryTypes = leadIdIndustryTypesCondition
      ? await db.select().from(leadIndustryTypes).where(leadIdIndustryTypesCondition)
      : []

    // Group by leadId
    allContacts.forEach((contact) => {
      if (!contactsMap.has(contact.leadId)) {
        contactsMap.set(contact.leadId, [])
      }
      contactsMap.get(contact.leadId)?.push(contact)
    })

    allSocialMedia.forEach((social) => {
      if (!socialMediaMap.has(social.leadId)) {
        socialMediaMap.set(social.leadId, [])
      }
      socialMediaMap.get(social.leadId)?.push(social)
    })

    allProducts.forEach((product) => {
      if (!productsMap.has(product.leadId)) {
        productsMap.set(product.leadId, [])
      }
      productsMap.get(product.leadId)?.push(product)
    })

    allBusinessSectors.forEach((sector) => {
      if (!businessSectorsMap.has(sector.leadId)) {
        businessSectorsMap.set(sector.leadId, [])
      }
      businessSectorsMap.get(sector.leadId)?.push(sector)
    })

    allProductCategories.forEach((category) => {
      if (!productCategoriesMap.has(category.leadId)) {
        productCategoriesMap.set(category.leadId, [])
      }
      productCategoriesMap.get(category.leadId)?.push(category)
    })

    allIndustryTypes.forEach((industry) => {
      if (!industryTypesMap.has(industry.leadId)) {
        industryTypesMap.set(industry.leadId, [])
      }
      industryTypesMap.get(industry.leadId)?.push(industry)
    })
  }

  // Combine data
  return result.map((lead) => ({
    ...lead,
    contacts: contactsMap.get(lead.id) || [],
    socialMedia: socialMediaMap.get(lead.id) || [],
    products: productsMap.get(lead.id) || [],
    businessSectors: businessSectorsMap.get(lead.id) || [],
    productCategories: productCategoriesMap.get(lead.id) || [],
    industryTypes: industryTypesMap.get(lead.id) || [],
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
      contactName: leads.contactName,
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
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed",
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
      contactName: leads.contactName,
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
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed"
  businessType?: string
  country?: string
  city?: string
  search?: string
  searchType?: "all" | "company" | "country" | "email" | "website" | "industry" | "category"
  workspaceIds?: string[]
  createdByIds?: string[]
  customerGroupId?: string
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
    let searchCondition: ReturnType<typeof or> | undefined

    switch (filters.searchType) {
      case "company":
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.foundCompanyName, `%${filters.search}%`),
        )
        break
      case "country":
        searchCondition = ilike(leads.country, `%${filters.search}%`)
        break
      case "email":
        // 이메일은 contacts 테이블에서 검색해야 하므로 별도 처리 필요
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.contactName, `%${filters.search}%`),
        )
        break
      case "website":
        searchCondition = or(
          ilike(leads.websiteUrl, `%${filters.search}%`),
          ilike(leads.finalUrl, `%${filters.search}%`),
        )
        break
      case "industry":
        searchCondition = ilike(leads.businessType, `%${filters.search}%`)
        break
      case "category":
        // 제품 카테고리는 별도 테이블에서 검색해야 하므로 임시로 설명으로 검색
        searchCondition = ilike(leads.description, `%${filters.search}%`)
        break
      default: // "all" 또는 undefined
        searchCondition = or(
          ilike(leads.companyName, `%${filters.search}%`),
          ilike(leads.foundCompanyName, `%${filters.search}%`),
          ilike(leads.contactName, `%${filters.search}%`),
          ilike(leads.websiteUrl, `%${filters.search}%`),
          ilike(leads.country, `%${filters.search}%`),
          ilike(leads.businessType, `%${filters.search}%`),
        )
    }

    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(...filters.workspaceIds.map((id) => eq(leads.workspaceId, id)))
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(leads.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // If customerGroupId is specified, join with customerGroupMembers table
  let result: { count: number }[]
  if (filters?.customerGroupId) {
    result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .innerJoin(customerGroupMembers, eq(leads.id, customerGroupMembers.leadId))
      .where(and(eq(customerGroupMembers.groupId, filters.customerGroupId), whereClause))
  } else if (whereClause) {
    result = await db.select({ count: sql<number>`count(*)::int` }).from(leads).where(whereClause)
  } else {
    result = await db.select({ count: sql<number>`count(*)::int` }).from(leads)
  }

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
    | "new"
    | "contacted"
    | "qualified"
    | "unqualified"
    | "converted"
    | "lost"
    | "unsubscribed",
) {
  const leadCondition = or(...leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    return 0
  }

  const result = await db
    .update(leads)
    .set({
      leadStatus,
      updatedAt: new Date(),
    })
    .where(leadCondition)
    .returning({ id: leads.id })

  return result.length
}

// BulkDelete :exec
export async function bulkDelete(leadIds: string[]) {
  const leadCondition = or(...leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    return 0
  }

  const result = await db.delete(leads).where(leadCondition).returning({ id: leads.id })

  return result.length
}

// BulkUpdateBusinessType :exec
export async function bulkUpdateBusinessType(leadIds: string[], businessType: string) {
  const leadCondition = or(...leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    return 0
  }

  const result = await db
    .update(leads)
    .set({
      businessType,
      updatedAt: new Date(),
    })
    .where(leadCondition)
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

// ====================================
// BULK LEAD CREATION
// ====================================

// BulkCreateLeads :many
export async function bulkCreateLeads(data: {
  workspaceId: string
  leads: Array<{
    companyName: string
    foundCompanyName?: string
    contactName?: string
    businessType?: string
    websiteUrl?: string
    description?: string
    employeeCount?: string
    foundedYear?: number
    country?: string
    city?: string
    state?: string
    address?: string
    leadSource?: string
    leadStatus?: string
    leadScore?: number
    notes?: string
    primaryEmail?: string
    primaryPhone?: string
    secondaryEmail?: string
    secondaryPhone?: string
  }>
  createdBy?: string
}) {
  // 대량 데이터 처리를 위한 배치 크기 제한
  const BATCH_SIZE = 10
  const totalLeads = data.leads.length

  if (totalLeads === 0) {
    return []
  }

  const allCreatedLeads = []

  try {
    // 배치 단위로 처리
    for (let i = 0; i < totalLeads; i += BATCH_SIZE) {
      const batch = data.leads.slice(i, i + BATCH_SIZE)

      try {
        const batchResult = await processBatch(batch, data.workspaceId, data.createdBy)
        allCreatedLeads.push(...batchResult)
        console.log(
          `Successfully processed batch ${
            Math.floor(i / BATCH_SIZE) + 1
          }/${Math.ceil(totalLeads / BATCH_SIZE)}`,
        )
      } catch (error) {
        console.error(`Error processing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error)
        console.error("Batch data sample:", JSON.stringify(batch[0], null, 2))

        // 개별 리드로 재시도
        console.log(`Retrying batch ${Math.floor(i / BATCH_SIZE) + 1} as individual leads...`)
        for (const lead of batch) {
          try {
            const individualResult = await processBatch([lead], data.workspaceId, data.createdBy)
            allCreatedLeads.push(...individualResult)
            console.log(`Successfully processed individual lead: ${lead.companyName}`)
          } catch (individualError) {
            console.error(`Failed to process individual lead ${lead.companyName}:`, individualError)
            // 개별 리드도 실패하면 스킵하고 계속 진행
            console.log(`Skipping lead: ${lead.companyName}`)
          }
        }
      }
    }
    return allCreatedLeads
  } catch (error) {
    console.error("Bulk create failed:", error)
    console.error("Total leads:", totalLeads)
    console.error("Workspace ID:", data.workspaceId)
    throw error
  }
}

async function processBatch(
  batchLeads: Array<{
    companyName: string
    foundCompanyName?: string
    contactName?: string
    businessType?: string
    websiteUrl?: string
    description?: string
    employeeCount?: string
    foundedYear?: number
    country?: string
    city?: string
    state?: string
    address?: string
    leadSource?: string
    leadStatus?: string
    leadScore?: number
    notes?: string
    primaryEmail?: string
    primaryPhone?: string
    secondaryEmail?: string
    secondaryPhone?: string
  }>,
  workspaceId: string,
  createdBy?: string,
) {
  try {
    const leadValues = batchLeads.map((lead) => ({
      workspaceId,
      companyName: lead.companyName,
      foundCompanyName: lead.foundCompanyName || null,
      contactName: lead.contactName || null,
      businessType: lead.businessType ? lead.businessType.substring(0, 100) : null,
      websiteUrl: lead.websiteUrl || null,
      finalUrl: lead.websiteUrl || null,
      description: lead.description || null,
      employeeCount: lead.employeeCount || null,
      foundedYear: lead.foundedYear || null,
      country: lead.country ? lead.country.substring(0, 100) : null,
      city: lead.city ? lead.city.substring(0, 100) : null,
      state: lead.state ? lead.state.substring(0, 100) : null,
      address: lead.address || null,
      leadSource: lead.leadSource ? lead.leadSource.substring(0, 100) : null,
      leadStatus:
        (lead.leadStatus as
          | "new"
          | "contacted"
          | "qualified"
          | "unqualified"
          | "converted"
          | "lost"
          | "unsubscribed") || "new",
      leadScore: lead.leadScore || null,
      notes: lead.notes || null,
      createdBy: createdBy || null,
    }))

    console.log(`Processing ${leadValues.length} leads for workspace ${workspaceId}`)

    const createdLeads = await db.insert(leads).values(leadValues).returning({
      id: leads.id,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      businessType: leads.businessType,
      websiteUrl: leads.websiteUrl,
      description: leads.description,
      country: leads.country,
      city: leads.city,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      createdBy: leads.createdBy,
      createdAt: leads.createdAt,
    })

    console.log(`Successfully inserted ${createdLeads.length} leads`)

    // 연락처 정보가 있는 경우 leadContacts 테이블에 추가
    const contactValues: Array<{
      leadId: string
      contactType: "email" | "phone" | "fax" | "other"
      contactValue: string
      isPrimary: boolean
    }> = []
    for (let i = 0; i < batchLeads.length; i++) {
      const lead = batchLeads[i]
      const createdLead = createdLeads[i]

      if (!lead || !createdLead) continue

      if (lead.primaryEmail) {
        contactValues.push({
          leadId: createdLead.id,
          contactType: "email",
          contactValue: lead.primaryEmail,
          isPrimary: true,
        })
      }
      if (lead.primaryPhone) {
        contactValues.push({
          leadId: createdLead.id,
          contactType: "phone",
          contactValue: lead.primaryPhone,
          isPrimary: true,
        })
      }
      if (lead.secondaryEmail) {
        contactValues.push({
          leadId: createdLead.id,
          contactType: "email",
          contactValue: lead.secondaryEmail,
          isPrimary: false,
        })
      }
      if (lead.secondaryPhone) {
        contactValues.push({
          leadId: createdLead.id,
          contactType: "phone",
          contactValue: lead.secondaryPhone,
          isPrimary: false,
        })
      }
    }

    if (contactValues.length > 0) {
      await db.insert(leadContacts).values(contactValues)
      console.log(`Successfully inserted ${contactValues.length} contacts`)
    }

    return createdLeads
  } catch (error) {
    console.error("Error in processBatch:", error)
    console.error("Workspace ID:", workspaceId)
    console.error("Batch size:", batchLeads.length)
    console.error("Sample lead data:", JSON.stringify(batchLeads[0], null, 2))
    throw error
  }
}

// ====================================
// CSV EXPORT
// ====================================

export async function exportLeadsToCSV(filters: {
  leadStatus?: string
  businessType?: string
  country?: string
  city?: string
  search?: string
  workspaceIds?: string[]
  customerGroupId?: string
}) {
  // Build where conditions
  const conditions = []

  if (filters.leadStatus && filters.leadStatus !== "all") {
    conditions.push(
      eq(leads.leadStatus, filters.leadStatus as (typeof leadStatusEnum.enumValues)[number]),
    )
  }

  if (filters.businessType) {
    conditions.push(ilike(leads.businessType, `%${filters.businessType}%`))
  }

  if (filters.country) {
    conditions.push(ilike(leads.country, `%${filters.country}%`))
  }

  if (filters.city) {
    conditions.push(ilike(leads.city, `%${filters.city}%`))
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(leads.companyName, `%${filters.search}%`),
        ilike(leads.foundCompanyName, `%${filters.search}%`),
        ilike(leads.websiteUrl, `%${filters.search}%`),
        ilike(leads.description, `%${filters.search}%`),
      ),
    )
  }

  if (filters.workspaceIds && filters.workspaceIds.length > 0) {
    conditions.push(inArray(leads.workspaceId, filters.workspaceIds))
  }

  if (filters.customerGroupId) {
    conditions.push(
      sql`${leads.id} IN (
        SELECT lead_id FROM customer_group_members 
        WHERE customer_group_id = ${filters.customerGroupId}
      )`,
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get all leads with related data
  const leadsData = await db
    .select({
      id: leads.id,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      contactName: leads.contactName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      description: leads.description,
      country: leads.country,
      city: leads.city,
      foundedYear: leads.foundedYear,
      employeeCount: leads.employeeCount,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      notes: leads.notes,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .where(whereClause)
    .orderBy(desc(leads.createdAt))

  // Get contacts for all leads
  const leadIds = leadsData.map((lead) => lead.id)
  const contactsData =
    leadIds.length > 0
      ? await db
          .select({
            leadId: leadContacts.leadId,
            contactType: leadContacts.contactType,
            contactValue: leadContacts.contactValue,
            isPrimary: leadContacts.isPrimary,
          })
          .from(leadContacts)
          .where(inArray(leadContacts.leadId, leadIds))
          .orderBy(leadContacts.leadId, leadContacts.isPrimary)
      : []

  // Get social media for all leads
  const socialMediaData =
    leadIds.length > 0
      ? await db
          .select({
            leadId: leadSocialMedia.leadId,
            platform: leadSocialMedia.platform,
            url: leadSocialMedia.url,
            username: leadSocialMedia.username,
          })
          .from(leadSocialMedia)
          .where(inArray(leadSocialMedia.leadId, leadIds))
          .orderBy(leadSocialMedia.leadId)
      : []

  // Group contacts and social media by lead ID
  const contactsByLead = contactsData.reduce(
    (acc, contact) => {
      if (!acc[contact.leadId]) acc[contact.leadId] = []
      acc[contact.leadId]?.push(contact)
      return acc
    },
    {} as Record<string, typeof contactsData>,
  )

  const socialMediaByLead = socialMediaData.reduce(
    (acc, social) => {
      if (!acc[social.leadId]) acc[social.leadId] = []
      acc[social.leadId]?.push(social)
      return acc
    },
    {} as Record<string, typeof socialMediaData>,
  )

  // Create CSV headers
  const headers = [
    "ID",
    "워크스페이스",
    "회사명",
    "발견된 회사명",
    "담당자명",
    "웹사이트",
    "업종",
    "설명",
    "국가",
    "도시",
    "설립년도",
    "직원수",
    "상태",
    "리드 점수",
    "메모",
    "이메일",
    "전화번호",
    "Facebook",
    "Instagram",
    "Twitter",
    "LinkedIn",
    "생성일",
  ]

  // Create CSV rows
  const rows = leadsData.map((lead) => {
    const contacts = contactsByLead[lead.id] || []
    const socialMedia = socialMediaByLead[lead.id] || []

    const emails = contacts
      .filter((c) => c.contactType === "email")
      .map((c) => c.contactValue)
      .join("; ")

    const phones = contacts
      .filter((c) => c.contactType === "phone")
      .map((c) => c.contactValue)
      .join("; ")

    const facebook = socialMedia
      .filter((s) => s.platform === "facebook")
      .map((s) => s.url)
      .join("; ")

    const instagram = socialMedia
      .filter((s) => s.platform === "instagram")
      .map((s) => s.url)
      .join("; ")

    const twitter = socialMedia
      .filter((s) => s.platform === "twitter")
      .map((s) => s.url)
      .join("; ")

    const linkedin = socialMedia
      .filter((s) => s.platform === "linkedin")
      .map((s) => s.url)
      .join("; ")

    return [
      lead.id,
      lead.workspaceName || "",
      lead.companyName || "",
      lead.foundCompanyName || "",
      lead.contactName || "",
      lead.websiteUrl || "",
      lead.businessType || "",
      (lead.description || "").replace(/"/g, '""'), // Escape quotes
      lead.country || "",
      lead.city || "",
      lead.foundedYear || "",
      lead.employeeCount || "",
      lead.leadStatus || "",
      lead.leadScore || "",
      (lead.notes || "").replace(/"/g, '""'), // Escape quotes
      emails,
      phones,
      facebook,
      instagram,
      twitter,
      linkedin,
      lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ko-KR") : "",
    ]
  })

  // Convert to CSV format
  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  // Add BOM for proper UTF-8 encoding in Excel
  return `\uFEFF${csvContent}`
}

// AddLeadToCustomerGroup :exec
export async function addLeadToCustomerGroup(
  leadId: string,
  customerGroupId: string,
  addedBy?: string,
) {
  await db.insert(customerGroupMembers).values({
    groupId: customerGroupId,
    leadId: leadId,
    addedBy: addedBy || undefined,
  })
}

// BulkAddLeadsToCustomerGroup :exec
export async function bulkAddLeadsToCustomerGroup(
  leadIds: string[],
  customerGroupId: string,
  addedBy?: string,
) {
  if (leadIds.length === 0) return

  const memberValues = leadIds.map((leadId) => ({
    groupId: customerGroupId,
    leadId: leadId,
    addedBy: addedBy || undefined,
  }))

  await db.insert(customerGroupMembers).values(memberValues)
}

export async function exportSelectedLeadsToCSV(leadIds: string[]) {
  if (leadIds.length === 0) {
    return (
      "\uFEFF" +
      '"ID","워크스페이스","회사명","발견된 회사명","담당자명","웹사이트","업종","설명","국가","도시","설립년도","직원수","상태","리드 점수","메모","이메일","전화번호","Facebook","Instagram","Twitter","LinkedIn","생성일"\n'
    )
  }

  // Get all leads with related data by IDs
  const leadsData = await db
    .select({
      id: leads.id,
      workspaceName: workspaces.name,
      companyName: leads.companyName,
      foundCompanyName: leads.foundCompanyName,
      contactName: leads.contactName,
      websiteUrl: leads.websiteUrl,
      businessType: leads.businessType,
      description: leads.description,
      country: leads.country,
      city: leads.city,
      foundedYear: leads.foundedYear,
      employeeCount: leads.employeeCount,
      leadStatus: leads.leadStatus,
      leadScore: leads.leadScore,
      notes: leads.notes,
      createdAt: leads.createdAt,
    })
    .from(leads)
    .leftJoin(workspaces, eq(leads.workspaceId, workspaces.id))
    .where(inArray(leads.id, leadIds))
    .orderBy(desc(leads.createdAt))

  // Get contacts for all leads
  const contactsData = await db
    .select({
      leadId: leadContacts.leadId,
      contactType: leadContacts.contactType,
      contactValue: leadContacts.contactValue,
      isPrimary: leadContacts.isPrimary,
    })
    .from(leadContacts)
    .where(inArray(leadContacts.leadId, leadIds))
    .orderBy(leadContacts.leadId, leadContacts.isPrimary)

  // Get social media for all leads
  const socialMediaData = await db
    .select({
      leadId: leadSocialMedia.leadId,
      platform: leadSocialMedia.platform,
      url: leadSocialMedia.url,
      username: leadSocialMedia.username,
    })
    .from(leadSocialMedia)
    .where(inArray(leadSocialMedia.leadId, leadIds))
    .orderBy(leadSocialMedia.leadId)

  // Group contacts and social media by lead ID
  const contactsByLead = contactsData.reduce(
    (acc, contact) => {
      if (!acc[contact.leadId]) acc[contact.leadId] = []
      acc[contact.leadId]?.push(contact)
      return acc
    },
    {} as Record<string, typeof contactsData>,
  )

  const socialMediaByLead = socialMediaData.reduce(
    (acc, social) => {
      if (!acc[social.leadId]) acc[social.leadId] = []
      acc[social.leadId]?.push(social)
      return acc
    },
    {} as Record<string, typeof socialMediaData>,
  )

  // Create CSV headers
  const headers = [
    "ID",
    "워크스페이스",
    "회사명",
    "발견된 회사명",
    "담당자명",
    "웹사이트",
    "업종",
    "설명",
    "국가",
    "도시",
    "설립년도",
    "직원수",
    "상태",
    "리드 점수",
    "메모",
    "이메일",
    "전화번호",
    "Facebook",
    "Instagram",
    "Twitter",
    "LinkedIn",
    "생성일",
  ]

  // Create CSV rows
  const rows = leadsData.map((lead) => {
    const contacts = contactsByLead[lead.id] || []
    const socialMedia = socialMediaByLead[lead.id] || []

    const emails = contacts
      .filter((c) => c.contactType === "email")
      .map((c) => c.contactValue)
      .join("; ")

    const phones = contacts
      .filter((c) => c.contactType === "phone")
      .map((c) => c.contactValue)
      .join("; ")

    const facebook = socialMedia
      .filter((s) => s.platform === "facebook")
      .map((s) => s.url)
      .join("; ")

    const instagram = socialMedia
      .filter((s) => s.platform === "instagram")
      .map((s) => s.url)
      .join("; ")

    const twitter = socialMedia
      .filter((s) => s.platform === "twitter")
      .map((s) => s.url)
      .join("; ")

    const linkedin = socialMedia
      .filter((s) => s.platform === "linkedin")
      .map((s) => s.url)
      .join("; ")

    return [
      lead.id,
      lead.workspaceName || "",
      lead.companyName || "",
      lead.foundCompanyName || "",
      lead.contactName || "",
      lead.websiteUrl || "",
      lead.businessType || "",
      (lead.description || "").replace(/"/g, '""'), // Escape quotes
      lead.country || "",
      lead.city || "",
      lead.foundedYear || "",
      lead.employeeCount || "",
      lead.leadStatus || "",
      lead.leadScore || "",
      (lead.notes || "").replace(/"/g, '""'), // Escape quotes
      emails,
      phones,
      facebook,
      instagram,
      twitter,
      linkedin,
      lead.createdAt ? new Date(lead.createdAt).toLocaleDateString("ko-KR") : "",
    ]
  })

  // Convert to CSV format
  const csvContent = [
    headers.map((h) => `"${h}"`).join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n")

  // Add BOM for proper UTF-8 encoding in Excel
  return `\uFEFF${csvContent}`
}
