import { and, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroupMembers, customerGroups } from "../db/schema/customer-groups"
import { leadContacts } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"

// ====================================
// CUSTOMER GROUP CRUD OPERATIONS
// ====================================

// GetCustomerGroup :one
export async function getCustomerGroup(id: string) {
  const result = await db
    .select({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(customerGroups)
    .leftJoin(workspaces, eq(customerGroups.workspaceId, workspaces.id))
    .leftJoin(users, eq(customerGroups.createdBy, users.id))
    .where(eq(customerGroups.id, id))
    .limit(1)

  return result[0]
}

// CreateCustomerGroup :one
export async function createCustomerGroup(data: {
  workspaceId: string
  name: string
  description?: string
  criteria?: Record<string, unknown>
  isDynamic?: boolean
  createdBy?: string
  csvData?: Array<{
    companyName: string
    foundCompanyName?: string
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
  }>
}) {
  const [newGroup] = await db
    .insert(customerGroups)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description || null,
      criteria: data.criteria || null,
      isDynamic: data.isDynamic !== undefined ? data.isDynamic : false,
      createdBy: data.createdBy || null,
    })
    .returning({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
    })

  // CSV 데이터가 있으면 리드들을 생성하고 그룹에 추가
  if (data.csvData && data.csvData.length > 0 && newGroup) {
    await createLeadsFromCSV(newGroup.id, data.csvData, data.createdBy)
  }

  return newGroup
}

// CreateLeadsFromCSV :exec - Create leads from CSV data and add to group
async function createLeadsFromCSV(
  groupId: string,
  csvData: Array<{
    companyName: string
    foundCompanyName?: string
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
    // 연락처 정보 추가
    primaryEmail?: string
    primaryPhone?: string
    secondaryEmail?: string
    secondaryPhone?: string
  }>,
  createdBy?: string,
) {
  const createdLeads = []

  for (const leadData of csvData) {
    // 리드 생성
    const [newLead] = await db
      .insert(leads)
      .values({
        workspaceId: (await getCustomerGroup(groupId))?.workspaceId || "",
        companyName: leadData.companyName,
        foundCompanyName: leadData.foundCompanyName || null,
        businessType: leadData.businessType || null,
        websiteUrl: leadData.websiteUrl || null,
        description: leadData.description || null,
        employeeCount: leadData.employeeCount || null,
        foundedYear: leadData.foundedYear || null,
        country: leadData.country || null,
        city: leadData.city || null,
        state: leadData.state || null,
        address: leadData.address || null,
        leadSource: leadData.leadSource || "CSV Import",
        leadStatus:
          (leadData.leadStatus as
            | "new"
            | "contacted"
            | "qualified"
            | "unqualified"
            | "converted"
            | "lost"
            | "unsubscribed") || "new",
        leadScore: leadData.leadScore || null,
        notes: leadData.notes || null,
        createdBy: createdBy || null,
      })
      .returning({ id: leads.id })

    if (newLead) {
      createdLeads.push(newLead.id)

      // 연락처 정보 추가
      const contactsToInsert = []

      // Primary Email
      if (leadData.primaryEmail) {
        contactsToInsert.push({
          leadId: newLead.id,
          contactType: "email" as const,
          contactValue: leadData.primaryEmail,
          label: "primary",
          isPrimary: true,
          isVerified: false,
        })
      }

      // Primary Phone
      if (leadData.primaryPhone) {
        contactsToInsert.push({
          leadId: newLead.id,
          contactType: "phone" as const,
          contactValue: leadData.primaryPhone,
          label: "primary",
          isPrimary: true,
          isVerified: false,
        })
      }

      // Secondary Email
      if (leadData.secondaryEmail) {
        contactsToInsert.push({
          leadId: newLead.id,
          contactType: "email" as const,
          contactValue: leadData.secondaryEmail,
          label: "secondary",
          isPrimary: false,
          isVerified: false,
        })
      }

      // Secondary Phone
      if (leadData.secondaryPhone) {
        contactsToInsert.push({
          leadId: newLead.id,
          contactType: "phone" as const,
          contactValue: leadData.secondaryPhone,
          label: "secondary",
          isPrimary: false,
          isVerified: false,
        })
      }

      // 연락처 정보 삽입
      if (contactsToInsert.length > 0) {
        await db.insert(leadContacts).values(contactsToInsert)
      }
    }
  }

  // 생성된 리드들을 그룹에 추가
  if (createdLeads.length > 0) {
    await bulkAddMembers({
      groupId,
      leadIds: createdLeads,
      addedBy: createdBy,
    })
  }

  return createdLeads.length
}

// UpdateCustomerGroup :one
export async function updateCustomerGroup(
  id: string,
  data: {
    name: string
    description?: string
    criteria?: Record<string, unknown>
    isDynamic: boolean
  },
) {
  const [updatedGroup] = await db
    .update(customerGroups)
    .set({
      name: data.name,
      description: data.description || null,
      criteria: data.criteria || null,
      isDynamic: data.isDynamic,
      updatedAt: new Date(),
    })
    .where(eq(customerGroups.id, id))
    .returning({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
    })

  return updatedGroup
}

// DeleteCustomerGroup :exec
export async function deleteCustomerGroup(id: string) {
  await db.delete(customerGroups).where(eq(customerGroups.id, id))
}

// ====================================
// CUSTOMER GROUP QUERY OPERATIONS
// ====================================

// ListCustomerGroups :many
export async function listCustomerGroups(limit: number, offset: number) {
  const result = await db
    .select({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(customerGroups)
    .leftJoin(workspaces, eq(customerGroups.workspaceId, workspaces.id))
    .leftJoin(users, eq(customerGroups.createdBy, users.id))
    .orderBy(desc(customerGroups.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListCustomerGroupsWithFilters :many
export async function listCustomerGroupsWithFilters(
  limit: number,
  offset: number,
  filters?: {
    isDynamic?: boolean
    search?: string
    workspaceIds?: string[]
    createdByIds?: string[]
  },
) {
  const conditions = []

  if (filters?.isDynamic !== undefined) {
    conditions.push(eq(customerGroups.isDynamic, filters.isDynamic))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(customerGroups.name, `%${filters.search}%`),
      ilike(customerGroups.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(customerGroups.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(
      ...filters.createdByIds.map((id) => eq(customerGroups.createdBy, id)),
    )
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(customerGroups)
    .leftJoin(workspaces, eq(customerGroups.workspaceId, workspaces.id))
    .leftJoin(users, eq(customerGroups.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(customerGroups.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetGroupsByWorkspace :many
export async function getGroupsByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: customerGroups.id,
      workspaceId: customerGroups.workspaceId,
      name: customerGroups.name,
      description: customerGroups.description,
      criteria: customerGroups.criteria,
      isDynamic: customerGroups.isDynamic,
      createdBy: customerGroups.createdBy,
      createdAt: customerGroups.createdAt,
      updatedAt: customerGroups.updatedAt,
      createdByUsername: users.username,
      createdByEmail: users.email,
      leadCount: sql<number>`(
        SELECT COUNT(*)::int 
        FROM customer_group_members 
        WHERE group_id = ${customerGroups.id}
      )`,
    })
    .from(customerGroups)
    .leftJoin(users, eq(customerGroups.createdBy, users.id))
    .where(eq(customerGroups.workspaceId, workspaceId))
    .orderBy(desc(customerGroups.createdAt))

  return result
}

// ====================================
// STATISTICS AND UTILITY QUERIES
// ====================================

// CountCustomerGroups :one
export async function countCustomerGroups() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(customerGroups)

  return result[0]?.count ?? 0
}

// CountCustomerGroupsWithFilters :one
export async function countCustomerGroupsWithFilters(filters?: {
  isDynamic?: boolean
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.isDynamic !== undefined) {
    conditions.push(eq(customerGroups.isDynamic, filters.isDynamic))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(customerGroups.name, `%${filters.search}%`),
      ilike(customerGroups.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(customerGroups.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(
      ...filters.createdByIds.map((id) => eq(customerGroups.createdBy, id)),
    )
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerGroups)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// ====================================
// BULK OPERATIONS
// ====================================

// BulkDeleteCustomerGroups :exec
export async function bulkDeleteCustomerGroups(groupIds: string[]) {
  const deleteCondition = or(...groupIds.map((id) => eq(customerGroups.id, id)))
  if (!deleteCondition) {
    return 0
  }

  const result = await db
    .delete(customerGroups)
    .where(deleteCondition)
    .returning({ id: customerGroups.id })

  return result.length
}

// ====================================
// CUSTOMER GROUP MEMBER CRUD OPERATIONS
// ====================================

// AddGroupMember :one
export async function addGroupMember(data: { groupId: string; leadId: string; addedBy?: string }) {
  const [newMember] = await db
    .insert(customerGroupMembers)
    .values({
      groupId: data.groupId,
      leadId: data.leadId,
      addedBy: data.addedBy || null,
    })
    .returning({
      id: customerGroupMembers.id,
      groupId: customerGroupMembers.groupId,
      leadId: customerGroupMembers.leadId,
      addedBy: customerGroupMembers.addedBy,
      addedAt: customerGroupMembers.addedAt,
    })

  return newMember
}

// RemoveGroupMember :exec
export async function removeGroupMember(groupId: string, leadId: string) {
  await db
    .delete(customerGroupMembers)
    .where(and(eq(customerGroupMembers.groupId, groupId), eq(customerGroupMembers.leadId, leadId)))
}

// GetGroupMembers :many
export async function getGroupMembers(groupId: string, limit: number, offset: number) {
  const result = await db
    .select({
      id: customerGroupMembers.id,
      groupId: customerGroupMembers.groupId,
      leadId: customerGroupMembers.leadId,
      addedBy: customerGroupMembers.addedBy,
      addedAt: customerGroupMembers.addedAt,
      leadCompanyName: leads.companyName,
      leadWebsiteUrl: leads.websiteUrl,
      leadStatus: leads.leadStatus,
      addedByUsername: users.username,
      addedByEmail: users.email,
    })
    .from(customerGroupMembers)
    .leftJoin(leads, eq(customerGroupMembers.leadId, leads.id))
    .leftJoin(users, eq(customerGroupMembers.addedBy, users.id))
    .where(eq(customerGroupMembers.groupId, groupId))
    .orderBy(desc(customerGroupMembers.addedAt))
    .limit(limit)
    .offset(offset)

  return result
}

// CountGroupMembers :one
export async function countGroupMembers(groupId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, groupId))

  return result[0]?.count ?? 0
}

// GetLeadGroups :many
export async function getLeadGroups(leadId: string) {
  const result = await db
    .select({
      id: customerGroupMembers.id,
      groupId: customerGroupMembers.groupId,
      leadId: customerGroupMembers.leadId,
      addedBy: customerGroupMembers.addedBy,
      addedAt: customerGroupMembers.addedAt,
      groupName: customerGroups.name,
      groupDescription: customerGroups.description,
      groupIsDynamic: customerGroups.isDynamic,
      workspaceId: customerGroups.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(customerGroupMembers)
    .leftJoin(customerGroups, eq(customerGroupMembers.groupId, customerGroups.id))
    .leftJoin(workspaces, eq(customerGroups.workspaceId, workspaces.id))
    .where(eq(customerGroupMembers.leadId, leadId))
    .orderBy(desc(customerGroupMembers.addedAt))

  return result
}

// ====================================
// BULK MEMBER OPERATIONS
// ====================================

// BulkAddMembers :exec
export async function bulkAddMembers(data: {
  groupId: string
  leadIds: string[]
  addedBy?: string
}) {
  // 이미 존재하는 멤버 조회 (중복 방지)
  const existing = await db
    .select({ leadId: customerGroupMembers.leadId })
    .from(customerGroupMembers)
    .where(eq(customerGroupMembers.groupId, data.groupId))

  const existingIds = new Set(existing.map((e) => e.leadId))
  const newLeadIds = data.leadIds.filter((id) => !existingIds.has(id))

  // 이미 모두 추가된 경우
  if (newLeadIds.length === 0) {
    return 0
  }

  const values = newLeadIds.map((leadId) => ({
    groupId: data.groupId,
    leadId,
    addedBy: data.addedBy || null,
  }))

  const result = await db
    .insert(customerGroupMembers)
    .values(values)
    .returning({ id: customerGroupMembers.id })

  return result.length
}

// BulkRemoveMembers :exec
export async function bulkRemoveMembers(groupId: string, leadIds: string[]) {
  const leadCondition = or(...leadIds.map((leadId) => eq(customerGroupMembers.leadId, leadId)))
  if (!leadCondition) {
    return 0
  }

  const result = await db
    .delete(customerGroupMembers)
    .where(and(eq(customerGroupMembers.groupId, groupId), leadCondition))
    .returning({ id: customerGroupMembers.id })

  return result.length
}

// ====================================
// SEQUENCE ENROLLMENT OPERATIONS
// ====================================

// GetGroupMembersWithEmails :many - Get group members with their email contacts
export async function getGroupMembersWithEmails(groupId: string) {
  const result = await db
    .select({
      leadId: leads.id,
      companyName: leads.companyName,
      websiteUrl: leads.websiteUrl,
      leadStatus: leads.leadStatus,
      primaryEmail: sql<string>`COALESCE(
        (SELECT contact_value FROM ${leadContacts} 
         WHERE ${leadContacts.leadId} = ${leads.id} 
         AND ${leadContacts.contactType} = 'email' 
         AND ${leadContacts.isPrimary} = true 
         LIMIT 1),
        LOWER(REPLACE(${leads.companyName}, ' ', '.')) || '@example.com'
      )`.as("primaryEmail"),
    })
    .from(customerGroupMembers)
    .innerJoin(leads, eq(customerGroupMembers.leadId, leads.id))
    .where(eq(customerGroupMembers.groupId, groupId))
    .orderBy(leads.companyName)

  return result
}
