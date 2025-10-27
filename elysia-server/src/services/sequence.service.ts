import { and, desc, eq, ilike, lte, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailEvents, emails as emailsTable } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { users } from "../db/schema/users"
import { workspaces } from "../db/schema/workspaces"
import { calculateScheduledTime } from "../utils/timezone"

// ====================================
// SEQUENCE CRUD OPERATIONS
// ====================================

// GetSequence :one
export async function getSequence(id: string) {
  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      customerGroupName: customerGroups.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .where(eq(sequences.id, id))
    .limit(1)

  return result[0]
}

// CreateSequence :one
export async function createSequence(data: {
  workspaceId: string
  customerGroupId?: string
  name: string
  description?: string
  status?: "draft" | "active" | "paused" | "archived"
  workflowData?: string
  selectedLeadIds?: string[] // Array of lead IDs to target
  createdBy?: string
}) {
  const [newSequence] = await db
    .insert(sequences)
    .values({
      workspaceId: data.workspaceId,
      customerGroupId: data.customerGroupId,
      name: data.name,
      description: data.description || null,
      status: data.status || "draft",
      workflowData: data.workflowData || null,
      selectedLeadIds: data.selectedLeadIds ? JSON.stringify(data.selectedLeadIds) : null,
      createdBy: data.createdBy || null,
    })
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
    })

  return newSequence
}

// UpdateSequence :one
export async function updateSequence(
  id: string,
  data: {
    name?: string
    description?: string
    status?: "draft" | "active" | "paused" | "archived"
    workflowData?: string
    customerGroupId?: string
    selectedLeadIds?: string[] // Array of lead IDs to target
  },
) {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.status !== undefined) updateData.status = data.status
  if (data.workflowData !== undefined) updateData.workflowData = data.workflowData
  if (data.customerGroupId !== undefined) updateData.customerGroupId = data.customerGroupId
  if (data.selectedLeadIds !== undefined)
    updateData.selectedLeadIds = data.selectedLeadIds ? JSON.stringify(data.selectedLeadIds) : null

  const [updatedSequence] = await db
    .update(sequences)
    .set(updateData)
    .where(eq(sequences.id, id))
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      workflowData: sequences.workflowData,
      selectedLeadIds: sequences.selectedLeadIds,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
    })

  return updatedSequence
}

// DeleteSequence :exec
export async function deleteSequence(id: string) {
  await db.delete(sequences).where(eq(sequences.id, id))
}

// ====================================
// SEQUENCE QUERY OPERATIONS
// ====================================

// ListSequences :many
export async function listSequences(limit: number, offset: number) {
  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      selectedLeadIds: sequences.selectedLeadIds,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      customerGroupName: customerGroups.name,
      createdByUsername: users.username,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .orderBy(desc(sequences.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// ListSequencesWithFilters :many
export async function listSequencesWithFilters(
  limit: number,
  offset: number,
  filters?: {
    status?: "draft" | "active" | "paused" | "archived"
    search?: string
    workspaceIds?: string[]
    createdByIds?: string[]
  },
) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(sequences.status, filters.status))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(sequences.name, `%${filters.search}%`),
      ilike(sequences.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
      createdByEmail: users.email,
      stepsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceSteps}
        WHERE ${sequenceSteps.sequenceId} = ${sequences.id}
      )`,
      enrollmentsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceEnrollments}
        WHERE ${sequenceEnrollments.sequenceId} = ${sequences.id}
      )`,
      completedEnrollmentsCount: sql<number>`(
        SELECT COUNT(*)::int
        FROM ${sequenceEnrollments}
        WHERE ${sequenceEnrollments.sequenceId} = ${sequences.id}
        AND ${sequenceEnrollments.status} = 'completed'
      )`,
      customerGroupId: sequences.customerGroupId,
      customerGroupName: customerGroups.name,
      selectedLeadIds: sequences.selectedLeadIds,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .where(whereClause)
    .orderBy(desc(sequences.createdAt))
    .limit(limit)
    .offset(offset)

  return result
}

// GetSequencesByWorkspace :many
export async function getSequencesByWorkspace(workspaceId: string) {
  const result = await db
    .select({
      id: sequences.id,
      customerGroupId: sequences.customerGroupId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      selectedLeadIds: sequences.selectedLeadIds,
      createdAt: sequences.createdAt,
      customerGroupName: customerGroups.name,
    })
    .from(sequences)
    .leftJoin(customerGroups, eq(sequences.customerGroupId, customerGroups.id))
    .where(eq(sequences.workspaceId, workspaceId))
    .orderBy(desc(sequences.createdAt))

  return result
}

// ====================================
// SEQUENCE STEPS OPERATIONS
// ====================================

// GetSequenceSteps :many
export async function getSequenceSteps(sequenceId: string) {
  const result = await db
    .select({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      emailTemplateId: sequenceSteps.emailTemplateId,
      createdAt: sequenceSteps.createdAt,
      updatedAt: sequenceSteps.updatedAt,
    })
    .from(sequenceSteps)
    .where(eq(sequenceSteps.sequenceId, sequenceId))
    .orderBy(sequenceSteps.stepOrder)

  return result
}

// CreateSequenceStep :one
export async function createSequenceStep(data: {
  sequenceId: string
  stepOrder: number
  delayDays: number
  scheduledHour?: number
  scheduledMinute?: number
  timezone?: string
  emailSubject: string
  emailBodyText?: string
  emailBodyHtml?: string
  emailTemplateId?: string
}) {
  // Markdown을 HTML로 변환
  const { markdownToHtml } = await import("../utils/markdown")
  const emailBodyHtml =
    data.emailBodyHtml || (data.emailBodyText ? markdownToHtml(data.emailBodyText) : null)

  const [newStep] = await db
    .insert(sequenceSteps)
    .values({
      sequenceId: data.sequenceId,
      stepOrder: data.stepOrder,
      delayDays: data.delayDays,
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
      timezone: data.timezone ?? "Asia/Seoul",
      emailSubject: data.emailSubject,
      emailBodyText: data.emailBodyText || null,
      emailBodyHtml: emailBodyHtml,
      emailTemplateId: data.emailTemplateId || null,
    })
    .returning({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      createdAt: sequenceSteps.createdAt,
      updatedAt: sequenceSteps.updatedAt,
    })

  return newStep
}

// UpdateSequenceStep :one
export async function updateSequenceStep(
  id: string,
  data: {
    stepOrder: number
    delayDays: number
    scheduledHour?: number
    scheduledMinute?: number
    timezone?: string
    emailSubject: string
    emailBodyText?: string
    emailBodyHtml?: string
    emailTemplateId?: string
  },
) {
  // Markdown을 HTML로 변환
  const { markdownToHtml } = await import("../utils/markdown")
  const emailBodyHtml =
    data.emailBodyHtml || (data.emailBodyText ? markdownToHtml(data.emailBodyText) : null)
  const [updatedStep] = await db
    .update(sequenceSteps)
    .set({
      ...data,
      emailBodyHtml: emailBodyHtml,
      scheduledHour: data.scheduledHour ?? 9,
      scheduledMinute: data.scheduledMinute ?? 0,
      timezone: data.timezone ?? "Asia/Seoul",
      updatedAt: new Date(),
    })
    .where(eq(sequenceSteps.id, id))
    .returning({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
      scheduledHour: sequenceSteps.scheduledHour,
      scheduledMinute: sequenceSteps.scheduledMinute,
      timezone: sequenceSteps.timezone,
      emailSubject: sequenceSteps.emailSubject,
      updatedAt: sequenceSteps.updatedAt,
    })

  return updatedStep
}

// DeleteSequenceStep :exec
export async function deleteSequenceStep(id: string) {
  await db.delete(sequenceSteps).where(eq(sequenceSteps.id, id))
}

// ====================================
// SEQUENCE ENROLLMENTS OPERATIONS
// ====================================

// GetSequenceEnrollments :many
export async function getSequenceEnrollments(sequenceId: string, limit: number, offset: number) {
  const result = await db
    .select({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      userEmailAccountId: sequenceEnrollments.userEmailAccountId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      status: sequenceEnrollments.status,
      enrolledBy: sequenceEnrollments.enrolledBy,
      enrolledAt: sequenceEnrollments.enrolledAt,
      firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
      completedAt: sequenceEnrollments.completedAt,
      stoppedAt: sequenceEnrollments.stoppedAt,
      nextStepScheduledAt: sequenceEnrollments.nextStepScheduledAt,
      leadCompanyName: leads.companyName,
      leadEmail: leads.websiteUrl,
      emailAccountAddress: userEmailAccounts.emailAddress,
    })
    .from(sequenceEnrollments)
    .leftJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .leftJoin(userEmailAccounts, eq(sequenceEnrollments.userEmailAccountId, userEmailAccounts.id))
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))
    .orderBy(desc(sequenceEnrollments.enrolledAt))
    .limit(limit)
    .offset(offset)

  return result
}

// CreateSequenceEnrollment :one
export async function createSequenceEnrollment(data: {
  sequenceId: string
  leadId: string
  userEmailAccountId: string
  enrolledBy?: string
  status?: "active" | "paused" | "completed" | "stopped" | "bounced" | "unsubscribed"
}) {
  const [newEnrollment] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId: data.sequenceId,
      leadId: data.leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy || null,
      status: data.status || "active",
    })
    .returning({
      id: sequenceEnrollments.id,
      sequenceId: sequenceEnrollments.sequenceId,
      leadId: sequenceEnrollments.leadId,
      userEmailAccountId: sequenceEnrollments.userEmailAccountId,
      status: sequenceEnrollments.status,
      enrolledAt: sequenceEnrollments.enrolledAt,
    })

  return newEnrollment
}

// UpdateEnrollmentStatus :one
export async function updateEnrollmentStatus(
  id: string,
  status: "active" | "paused" | "completed" | "stopped" | "bounced" | "unsubscribed",
) {
  const [updatedEnrollment] = await db
    .update(sequenceEnrollments)
    .set({
      status,
      stoppedAt: status === "stopped" ? new Date() : undefined,
      completedAt: status === "completed" ? new Date() : undefined,
    })
    .where(eq(sequenceEnrollments.id, id))
    .returning({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      completedAt: sequenceEnrollments.completedAt,
      stoppedAt: sequenceEnrollments.stoppedAt,
    })

  return updatedEnrollment
}

// ====================================
// STATISTICS
// ====================================

// CountSequences :one
export async function countSequences() {
  const result = await db.select({ count: sql<number>`count(*)::int` }).from(sequences)

  return result[0]?.count ?? 0
}

// CountSequencesWithFilters :one
export async function countSequencesWithFilters(filters?: {
  status?: "draft" | "active" | "paused" | "archived"
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(sequences.status, filters.status))
  }

  if (filters?.search) {
    const searchCondition = or(
      ilike(sequences.name, `%${filters.search}%`),
      ilike(sequences.description, `%${filters.search}%`),
    )
    if (searchCondition) {
      conditions.push(searchCondition)
    }
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    const workspaceCondition = or(
      ...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)),
    )
    if (workspaceCondition) {
      conditions.push(workspaceCondition)
    }
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    const createdByCondition = or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))
    if (createdByCondition) {
      conditions.push(createdByCondition)
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequences)
    .where(whereClause)

  return result[0]?.count ?? 0
}

// CountEnrollments :one
export async function countEnrollments(sequenceId: string) {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))

  return result[0]?.count ?? 0
}

// ====================================
// BULK OPERATIONS
// ====================================

// BulkUpdateStatus :exec
export async function bulkUpdateStatus(
  sequenceIds: string[],
  status: "draft" | "active" | "paused" | "archived",
) {
  const sequenceCondition = or(...sequenceIds.map((id) => eq(sequences.id, id)))
  if (!sequenceCondition) {
    return 0
  }

  const result = await db
    .update(sequences)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(sequenceCondition)
    .returning({ id: sequences.id })

  return result.length
}

// BulkDelete :exec
export async function bulkDelete(sequenceIds: string[]) {
  const sequenceCondition = or(...sequenceIds.map((id) => eq(sequences.id, id)))
  if (!sequenceCondition) {
    return 0
  }

  const result = await db.delete(sequences).where(sequenceCondition).returning({ id: sequences.id })

  return result.length
}

// BulkEnroll :exec
export async function bulkEnroll(data: {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const values = data.leadIds.map((leadId) => ({
    sequenceId: data.sequenceId,
    leadId,
    userEmailAccountId: data.userEmailAccountId,
    enrolledBy: data.enrolledBy || null,
  }))

  const result = await db
    .insert(sequenceEnrollments)
    .values(values)
    .returning({ id: sequenceEnrollments.id })

  return result.length
}

// BulkUnenroll :exec
export async function bulkUnenroll(enrollmentIds: string[]) {
  const enrollmentCondition = or(...enrollmentIds.map((id) => eq(sequenceEnrollments.id, id)))
  if (!enrollmentCondition) {
    return 0
  }

  const result = await db
    .update(sequenceEnrollments)
    .set({
      status: "stopped",
      stoppedAt: new Date(),
    })
    .where(enrollmentCondition)
    .returning({ id: sequenceEnrollments.id })

  return result.length
}

// ====================================
// ADVANCED ENROLLMENT OPERATIONS
// ====================================

// BulkEnrollWithScheduling - Enroll leads and create step executions with scheduling
export async function bulkEnrollWithScheduling(data: {
  sequenceId: string
  leadIds: string[]
  userEmailAccountId: string
  enrolledBy?: string
}) {
  const { default: logger } = await import("../utils/logger")

  logger.info(
    {
      sequenceId: data.sequenceId,
      leadCount: data.leadIds.length,
      userEmailAccountId: data.userEmailAccountId,
    },
    "🔄 [STEP-BASED] Starting bulk enrollment with scheduling",
  )

  // Get sequence steps to create schedules
  const steps = await getSequenceSteps(data.sequenceId)

  if (steps.length === 0) {
    logger.error({ sequenceId: data.sequenceId }, "❌ [STEP-BASED] No steps found in sequence")
    throw new Error("시퀀스에 스텝이 없습니다.")
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      stepsCount: steps.length,
      steps: steps.map((s) => ({
        stepOrder: s.stepOrder,
        delayDays: s.delayDays,
        scheduledHour: s.scheduledHour,
        scheduledMinute: s.scheduledMinute,
        timezone: s.timezone,
      })),
    },
    "📋 [STEP-BASED] Found sequence steps",
  )

  // Filter leads with valid email contacts
  const leadCondition = or(...data.leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    logger.warn({ sequenceId: data.sequenceId }, "⚠️ [STEP-BASED] No lead IDs provided")
    return {
      enrolledCount: 0,
      updatedCount: 0,
      totalSteps: steps.length,
      scheduledExecutions: 0,
    }
  }

  const leadsWithEmails = await db
    .select({
      leadId: leads.id,
      email: leadContacts.contactValue,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(
      and(leadCondition, eq(leadContacts.contactType, "email"), eq(leadContacts.isPrimary, true)),
    )

  if (leadsWithEmails.length === 0) {
    logger.error(
      { sequenceId: data.sequenceId, requestedLeadCount: data.leadIds.length },
      "❌ [STEP-BASED] No leads with valid email found",
    )
    throw new Error("이메일이 있는 리드가 없습니다.")
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalLeads: data.leadIds.length,
      leadsWithEmail: leadsWithEmails.length,
    },
    "✅ [STEP-BASED] Found leads with valid email",
  )

  const validLeadIds = leadsWithEmails.map((l) => l.leadId)

  // Check for existing enrollments
  const existingEnrollments = await db
    .select({
      id: sequenceEnrollments.id,
      leadId: sequenceEnrollments.leadId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
      status: sequenceEnrollments.status,
    })
    .from(sequenceEnrollments)
    .where(
      and(
        eq(sequenceEnrollments.sequenceId, data.sequenceId),
        or(...validLeadIds.map((id) => eq(sequenceEnrollments.leadId, id))),
      ),
    )

  // Separate active and completed enrollments
  const activeEnrollments = existingEnrollments.filter((e) => e.status === "active")
  const completedEnrollments = existingEnrollments.filter((e) => e.status === "completed")
  const completedLeadIds = new Set(completedEnrollments.map((e) => e.leadId))

  // Check if all leads are already completed
  if (completedLeadIds.size === validLeadIds.length) {
    logger.warn(
      {
        sequenceId: data.sequenceId,
        completedCount: completedLeadIds.size,
        totalRequested: validLeadIds.length,
      },
      "⚠️ [STEP-BASED] All leads are already completed in this sequence",
    )
    throw new Error("모든 리드가 이미 완료된 시퀀스입니다. 중복 실행을 방지합니다.")
  }

  const existingLeadIds = new Set(existingEnrollments.map((e) => e.leadId))
  let newLeadIds = validLeadIds.filter((id) => !existingLeadIds.has(id))

  // ====================================
  // 🔍 이메일 중복 체크 (같은 시퀀스 내)
  // ====================================
  if (newLeadIds.length > 0) {
    // 이 시퀀스에 이미 등록된 모든 enrollment의 이메일 주소 조회
    const existingEnrollmentsWithEmails = await db
      .select({
        enrollmentId: sequenceEnrollments.id,
        leadId: sequenceEnrollments.leadId,
        email: leadContacts.contactValue,
      })
      .from(sequenceEnrollments)
      .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
      .innerJoin(
        leadContacts,
        and(
          eq(leadContacts.leadId, leads.id),
          eq(leadContacts.contactType, "email"),
          eq(leadContacts.isPrimary, true),
        ),
      )
      .where(eq(sequenceEnrollments.sequenceId, data.sequenceId))

    // 이미 등록된 이메일 주소 Set
    const enrolledEmails = new Set(existingEnrollmentsWithEmails.map((e) => e.email.toLowerCase()))

    logger.info(
      {
        sequenceId: data.sequenceId,
        enrolledEmailsCount: enrolledEmails.size,
      },
      "📧 [STEP-BASED] Found existing enrolled emails in this sequence",
    )

    // 새로 등록하려는 lead들의 이메일과 비교
    const leadEmailMap = new Map(leadsWithEmails.map((l) => [l.leadId, l.email.toLowerCase()]))

    const duplicateEmailLeads: Array<{ leadId: string; email: string }> = []
    const filteredNewLeadIds = newLeadIds.filter((leadId) => {
      const email = leadEmailMap.get(leadId)
      if (email && enrolledEmails.has(email)) {
        duplicateEmailLeads.push({ leadId, email })
        return false // 중복 이메일이므로 제외
      }
      return true // 중복되지 않으므로 등록 가능
    })

    if (duplicateEmailLeads.length > 0) {
      logger.warn(
        {
          sequenceId: data.sequenceId,
          duplicateCount: duplicateEmailLeads.length,
          duplicates: duplicateEmailLeads.map((d) => ({
            leadId: d.leadId,
            email: d.email,
          })),
        },
        "⚠️ [STEP-BASED] Skipping leads with duplicate emails already enrolled in this sequence",
      )
    }

    newLeadIds = filteredNewLeadIds
  }

  // Count duplicates for logging
  const duplicateEmailCount =
    validLeadIds.filter((id) => !existingLeadIds.has(id)).length - newLeadIds.length

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalValidLeads: validLeadIds.length,
      existingEnrollments: existingEnrollments.length,
      activeEnrollments: activeEnrollments.length,
      completedEnrollments: completedLeadIds.size,
      duplicateEmailsSkipped: duplicateEmailCount,
      newLeadsToEnroll: newLeadIds.length,
    },
    "📊 [STEP-BASED] Checked existing enrollments and duplicate emails",
  )

  // Create enrollments only for new leads
  let newEnrollments: Array<{ id: string; leadId: string; enrolledAt: Date }> = []
  if (newLeadIds.length > 0) {
    const enrollmentValues = newLeadIds.map((leadId) => ({
      sequenceId: data.sequenceId,
      leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy || null,
      currentStepOrder: 0,
      status: "active" as const,
    }))

    newEnrollments = await db.insert(sequenceEnrollments).values(enrollmentValues).returning({
      id: sequenceEnrollments.id,
      leadId: sequenceEnrollments.leadId,
      enrolledAt: sequenceEnrollments.enrolledAt,
    })

    logger.info(
      {
        sequenceId: data.sequenceId,
        enrollmentsCreated: newEnrollments.length,
        enrollmentIds: newEnrollments.map((e) => e.id),
      },
      "✅ [STEP-BASED] Created new enrollments",
    )
  }

  // Combine active enrollments and new enrollments for processing
  // (Skip completed enrollments to prevent re-sending)
  const enrollments = [
    ...activeEnrollments.map((e) => ({
      id: e.id,
      leadId: e.leadId,
      enrolledAt: new Date(),
      isExisting: true,
      currentStepOrder: e.currentStepOrder,
    })),
    ...newEnrollments.map((e) => ({
      id: e.id,
      leadId: e.leadId,
      enrolledAt: e.enrolledAt,
      isExisting: false,
      currentStepOrder: 0,
    })),
  ]

  logger.info(
    {
      sequenceId: data.sequenceId,
      totalEnrollments: enrollments.length,
      newEnrollments: newEnrollments.length,
      activeEnrollments: activeEnrollments.length,
      skippedCompleted: completedLeadIds.size,
      enrollmentIds: enrollments.map((e) => e.id),
    },
    "✅ [STEP-BASED] Processing enrollments (skipped completed to prevent duplicates)",
  )

  // For active enrollments, get their existing step executions
  let existingStepExecutions: Array<{
    enrollmentId: string
    stepId: string
    stepOrder: number
    scheduledAt: Date
  }> = []

  if (activeEnrollments.length > 0) {
    existingStepExecutions = await db
      .select({
        enrollmentId: sequenceStepExecutions.enrollmentId,
        stepId: sequenceStepExecutions.stepId,
        stepOrder: sequenceStepExecutions.stepOrder,
        scheduledAt: sequenceStepExecutions.scheduledAt,
      })
      .from(sequenceStepExecutions)
      .where(or(...activeEnrollments.map((e) => eq(sequenceStepExecutions.enrollmentId, e.id))))
  }

  // Create maps for quick lookup
  // enrollmentId -> Set of existing stepIds
  const existingStepExecutionsMap = new Map<string, Set<string>>()
  // (enrollmentId + stepId) -> scheduledAt
  const existingStepScheduleMap = new Map<string, Date>()

  for (const exec of existingStepExecutions) {
    if (!existingStepExecutionsMap.has(exec.enrollmentId)) {
      existingStepExecutionsMap.set(exec.enrollmentId, new Set())
    }
    const existingSet = existingStepExecutionsMap.get(exec.enrollmentId)
    if (existingSet) {
      existingSet.add(exec.stepId)
    }
    // Store scheduledAt with compound key
    existingStepScheduleMap.set(`${exec.enrollmentId}:${exec.stepId}`, exec.scheduledAt)
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      existingExecutionsCount: existingStepExecutions.length,
    },
    "📊 [STEP-BASED] Loaded existing step executions",
  )

  // Create step executions for each enrollment with KST scheduling
  const stepExecutionValues = []

  for (const enrollment of enrollments) {
    const existingStepIds = existingStepExecutionsMap.get(enrollment.id) || new Set()

    // Always start from enrolledAt, then update baseDate as we traverse steps
    let baseDate = new Date(enrollment.enrolledAt)

    logger.debug(
      {
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        isExisting: enrollment.isExisting,
        existingStepsCount: existingStepIds.size,
        initialBaseDate: baseDate.toISOString(),
      },
      enrollment.isExisting
        ? "📅 [STEP-BASED] Processing existing enrollment - will only add new steps"
        : "📅 [STEP-BASED] Processing new enrollment - will add all steps",
    )

    for (const step of steps) {
      // Skip if this step already has an execution for this enrollment
      if (existingStepIds.has(step.id)) {
        // Get the scheduled time of this existing step to use as base for next step
        const existingScheduledAt = existingStepScheduleMap.get(`${enrollment.id}:${step.id}`)

        if (existingScheduledAt) {
          baseDate = existingScheduledAt
          logger.debug(
            {
              enrollmentId: enrollment.id,
              stepId: step.id,
              stepOrder: step.stepOrder,
              scheduledAt: baseDate.toISOString(),
            },
            "⏭️ [STEP-BASED] Skipping existing step, updated baseDate",
          )
        } else {
          logger.debug(
            {
              enrollmentId: enrollment.id,
              stepId: step.id,
              stepOrder: step.stepOrder,
            },
            "⏭️ [STEP-BASED] Skipping existing step (no execution found)",
          )
        }
        continue
      }

      // Calculate scheduled time in KST
      const scheduledAt = calculateScheduledTime(
        baseDate,
        step.delayDays,
        step.scheduledHour ?? 9,
        step.scheduledMinute ?? 0,
        step.timezone ?? "Asia/Seoul",
      )

      logger.debug(
        {
          enrollmentId: enrollment.id,
          stepOrder: step.stepOrder,
          delayDays: step.delayDays,
          scheduledHour: step.scheduledHour ?? 9,
          scheduledMinute: step.scheduledMinute ?? 0,
          timezone: step.timezone ?? "Asia/Seoul",
          baseDate: baseDate.toISOString(),
          scheduledAt: scheduledAt.toISOString(),
        },
        "⏰ [STEP-BASED] Scheduled step execution",
      )

      stepExecutionValues.push({
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: "pending" as const,
        scheduledAt,
      })

      // Use this step's scheduled time as the base for the next step
      baseDate = scheduledAt
    }
  }

  if (stepExecutionValues.length > 0) {
    await db.insert(sequenceStepExecutions).values(stepExecutionValues)
    logger.info(
      {
        sequenceId: data.sequenceId,
        totalExecutions: stepExecutionValues.length,
        executionsPerEnrollment: steps.length,
      },
      "✅ [STEP-BASED] Created step executions",
    )
  }

  // Update nextStepScheduledAt for enrollments
  for (const enrollment of enrollments) {
    const firstStep = steps[0]
    if (!firstStep) continue

    // Calculate first step scheduled time in KST
    const nextScheduledAt = calculateScheduledTime(
      new Date(enrollment.enrolledAt),
      firstStep.delayDays,
      firstStep.scheduledHour ?? 9,
      firstStep.scheduledMinute ?? 0,
      firstStep.timezone ?? "Asia/Seoul",
    )

    await db
      .update(sequenceEnrollments)
      .set({ nextStepScheduledAt: nextScheduledAt })
      .where(eq(sequenceEnrollments.id, enrollment.id))

    logger.debug(
      {
        enrollmentId: enrollment.id,
        nextStepScheduledAt: nextScheduledAt.toISOString(),
      },
      "📅 [STEP-BASED] Updated enrollment next step schedule",
    )
  }

  const result = {
    enrolledCount: newEnrollments.length,
    updatedCount: activeEnrollments.length,
    skippedCompleted: completedLeadIds.size,
    totalSteps: steps.length,
    scheduledExecutions: stepExecutionValues.length,
  }

  logger.info(
    {
      sequenceId: data.sequenceId,
      ...result,
    },
    "🎉 [STEP-BASED] Bulk enrollment with scheduling completed successfully",
  )

  return result
}

// GetLeadsWithEmails - Get leads from a list that have email contacts
export async function getLeadsWithEmails(leadIds: string[]) {
  const leadCondition = or(...leadIds.map((id) => eq(leads.id, id)))
  if (!leadCondition) {
    return []
  }

  const result = await db
    .select({
      leadId: leads.id,
      companyName: leads.companyName,
      email: leadContacts.contactValue,
      isPrimary: leadContacts.isPrimary,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(and(leadCondition, eq(leadContacts.contactType, "email")))
    .orderBy(leads.companyName, desc(leadContacts.isPrimary))

  return result
}

// GetPendingStepExecutions - Get step executions that need to be sent
export async function getPendingStepExecutions(limit: number = 100) {
  const { default: logger } = await import("../utils/logger")
  const now = new Date()

  logger.debug(
    {
      currentTime: now.toISOString(),
      limit,
    },
    "🔍 [STEP-BASED] Querying pending step executions",
  )

  const result = await db
    .select({
      executionId: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepId: sequenceStepExecutions.stepId,
      stepOrder: sequenceStepExecutions.stepOrder,
      scheduledAt: sequenceStepExecutions.scheduledAt,
      emailSubject: sequenceSteps.emailSubject,
      emailBodyText: sequenceSteps.emailBodyText,
      emailBodyHtml: sequenceSteps.emailBodyHtml,
      leadId: sequenceEnrollments.leadId,
      leadCompanyName: leads.companyName,
      emailAccountId: sequenceEnrollments.userEmailAccountId,
      sequenceId: sequenceEnrollments.sequenceId,
      sequenceName: sequences.name,
      workspaceId: sequences.workspaceId,
      userId: sequences.createdBy, // 시퀀스 생성자 ID를 userId로 사용
    })
    .from(sequenceStepExecutions)
    .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
    .innerJoin(sequenceEnrollments, eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id))
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .innerJoin(sequences, eq(sequenceEnrollments.sequenceId, sequences.id))
    .where(
      and(
        eq(sequenceStepExecutions.status, "pending"),
        lte(sequenceStepExecutions.scheduledAt, now),
        eq(sequenceEnrollments.status, "active"),
        eq(sequences.status, "active"),
      ),
    )
    .orderBy(sequenceStepExecutions.scheduledAt)
    .limit(limit)

  if (result.length > 0) {
    logger.info(
      {
        count: result.length,
        sequences: [...new Set(result.map((r) => r.sequenceName))],
        earliestSchedule: result[0]?.scheduledAt,
      },
      "📬 [STEP-BASED] Found pending step executions",
    )
  }

  return result
}

// UpdateStepExecutionStatus - Update step execution status after sending
export async function updateStepExecutionStatus(
  executionId: string,
  status: "sent" | "delivered" | "failed" | "skipped",
  errorMessage?: string,
  emailId?: string,
) {
  const [updated] = await db
    .update(sequenceStepExecutions)
    .set({
      status,
      executedAt: new Date(),
      errorMessage: errorMessage || null,
      emailId: emailId || null,
    })
    .where(eq(sequenceStepExecutions.id, executionId))
    .returning({
      id: sequenceStepExecutions.id,
      enrollmentId: sequenceStepExecutions.enrollmentId,
      stepOrder: sequenceStepExecutions.stepOrder,
    })

  return updated
}

// UpdateEnrollmentProgress - Update enrollment progress after step execution
export async function updateEnrollmentProgress(enrollmentId: string, stepOrder: number) {
  const { default: logger } = await import("../utils/logger")

  logger.debug(
    {
      enrollmentId,
      stepOrder,
    },
    "📊 [STEP-BASED] Updating enrollment progress",
  )

  // Get total steps for this enrollment
  const enrollment = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enrollment[0]) {
    logger.error({ enrollmentId }, "❌ [STEP-BASED] Enrollment not found")
    return null
  }

  const steps = await getSequenceSteps(enrollment[0].sequenceId)
  const isLastStep = stepOrder >= steps.length

  logger.info(
    {
      enrollmentId,
      sequenceId: enrollment[0].sequenceId,
      currentStepOrder: stepOrder,
      totalSteps: steps.length,
      isLastStep,
    },
    "📈 [STEP-BASED] Enrollment progress check",
  )

  const updateData: {
    currentStepOrder: number
    lastEmailSentAt: Date
    firstEmailSentAt?: Date
    status?: "active" | "paused" | "completed" | "stopped"
    completedAt?: Date
    nextStepScheduledAt?: Date | null
  } = {
    currentStepOrder: stepOrder,
    lastEmailSentAt: new Date(),
  }

  // If first email
  const enr = await db
    .select({ firstEmailSentAt: sequenceEnrollments.firstEmailSentAt })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enr[0]?.firstEmailSentAt) {
    updateData.firstEmailSentAt = new Date()
    logger.info({ enrollmentId }, "🎉 [STEP-BASED] First email sent for this enrollment")
  }

  // If last step, mark as completed
  if (isLastStep) {
    updateData.status = "completed"
    updateData.completedAt = new Date()
    updateData.nextStepScheduledAt = null
    logger.info(
      { enrollmentId, sequenceId: enrollment[0].sequenceId },
      "🏁 [STEP-BASED] Enrollment completed - all steps sent",
    )
  } else {
    // Schedule next step with KST timezone
    const nextStep = steps.find((s) => s.stepOrder === stepOrder + 1)
    if (nextStep) {
      const baseDate = new Date()
      const nextScheduledAt = calculateScheduledTime(
        baseDate,
        nextStep.delayDays,
        nextStep.scheduledHour ?? 9,
        nextStep.scheduledMinute ?? 0,
        nextStep.timezone ?? "Asia/Seoul",
      )
      updateData.nextStepScheduledAt = nextScheduledAt
      logger.info(
        {
          enrollmentId,
          nextStepOrder: nextStep.stepOrder,
          nextStepDelayDays: nextStep.delayDays,
          nextScheduledAt: nextScheduledAt.toISOString(),
        },
        "⏭️ [STEP-BASED] Scheduled next step",
      )
    }
  }

  const [updated] = await db
    .update(sequenceEnrollments)
    .set(updateData)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .returning({
      id: sequenceEnrollments.id,
      status: sequenceEnrollments.status,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })

  if (updated) {
    logger.info(
      {
        enrollmentId: updated.id,
        status: updated.status,
        currentStepOrder: updated.currentStepOrder,
      },
      "✅ [STEP-BASED] Enrollment progress updated",
    )
  }

  return updated
}

// ====================================
// SEQUENCE METRICS OPERATIONS
// ====================================

// GetSequenceMetrics - Get comprehensive metrics for a sequence
export async function getSequenceMetrics(sequenceId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ sequenceId }, "📊 [METRICS] Getting sequence metrics")

  // 1. Get enrollment statistics
  const enrollmentStats = await db
    .select({
      status: sequenceEnrollments.status,
      count: sql<number>`count(*)::int`,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))
    .groupBy(sequenceEnrollments.status)

  // 2. Get email statistics from email_events
  // For open and click events, count unique emails (not total events)
  const emailStats = await db
    .select({
      eventType: emailEvents.eventType,
      count: sql<number>`
        CASE 
          WHEN ${emailEvents.eventType} IN ('open', 'click') 
          THEN COUNT(DISTINCT ${emailEvents.emailId})::int
          ELSE COUNT(*)::int
        END
      `,
    })
    .from(emailEvents)
    .innerJoin(emailsTable, eq(emailEvents.emailId, emailsTable.id))
    .where(eq(emailsTable.sequenceId, sequenceId))
    .groupBy(emailEvents.eventType)

  // 3. Get total sent emails count
  const totalSentResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailsTable)
    .where(eq(emailsTable.sequenceId, sequenceId))

  // 4. Get last sent email timestamp
  const lastSentResult = await db
    .select({ lastSentAt: emailsTable.sentAt })
    .from(emailsTable)
    .where(eq(emailsTable.sequenceId, sequenceId))
    .orderBy(desc(emailsTable.sentAt))
    .limit(1)

  // Process enrollment statistics
  const enrollmentCounts = {
    total: 0,
    active: 0,
    completed: 0,
    paused: 0,
    stopped: 0,
    bounced: 0,
    unsubscribed: 0,
  }

  enrollmentStats.forEach((stat) => {
    enrollmentCounts.total += stat.count
    enrollmentCounts[stat.status as keyof typeof enrollmentCounts] = stat.count
  })

  // Process email statistics
  const emailCounts = {
    totalSent: totalSentResult[0]?.count || 0,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    dropped: 0,
    unsubscribed: 0,
  }

  emailStats.forEach((stat) => {
    switch (stat.eventType) {
      case "delivered":
        emailCounts.delivered = stat.count
        break
      case "open":
        emailCounts.opened = stat.count
        break
      case "click":
        emailCounts.clicked = stat.count
        break
      case "bounce":
        emailCounts.bounced = stat.count
        break
      case "dropped":
        emailCounts.dropped = stat.count
        break
      case "unsubscribe":
        emailCounts.unsubscribed = stat.count
        break
    }
  })

  // Calculate rates
  // delivered 이벤트가 없을 경우 totalSent를 기준으로 계산
  const deliveredCount = emailCounts.delivered > 0 ? emailCounts.delivered : emailCounts.totalSent
  const openRate = deliveredCount > 0 ? (emailCounts.opened / deliveredCount) * 100 : 0
  const clickRate = deliveredCount > 0 ? (emailCounts.clicked / deliveredCount) * 100 : 0
  const bounceRate =
    emailCounts.totalSent > 0 ? (emailCounts.bounced / emailCounts.totalSent) * 100 : 0

  // 디버깅: 이메일 카운트 로깅
  logger.info(
    {
      sequenceId,
      emailCounts: {
        totalSent: emailCounts.totalSent,
        delivered: emailCounts.delivered,
        opened: emailCounts.opened,
        clicked: emailCounts.clicked,
        bounced: emailCounts.bounced,
      },
      calculatedRates: {
        openRate,
        clickRate,
        bounceRate,
      },
      calculationDetails: {
        deliveredCount,
        usingDeliveredEvent: emailCounts.delivered > 0,
      },
    },
    "🔍 [DEBUG] Email counts and calculated rates",
  )

  const metrics = {
    // 발송 통계
    totalSent: emailCounts.totalSent,
    delivered: emailCounts.delivered,
    bounced: emailCounts.bounced,
    dropped: emailCounts.dropped,

    // 참여 통계
    opened: emailCounts.opened,
    clicked: emailCounts.clicked,
    replied: 0, // TODO: Implement reply detection
    unsubscribed: emailCounts.unsubscribed,

    // 성과 지표
    openRate: Math.round(openRate * 10) / 10,
    clickRate: Math.round(clickRate * 10) / 10,
    replyRate: 0, // TODO: Implement reply detection
    bounceRate: Math.round(bounceRate * 10) / 10,

    // 시퀀스 진행도
    totalEnrollments: enrollmentCounts.total,
    activeEnrollments: enrollmentCounts.active,
    completedEnrollments: enrollmentCounts.completed,
    pausedEnrollments: enrollmentCounts.paused,

    // 시간별 통계
    lastSentAt: lastSentResult[0]?.lastSentAt?.toISOString(),
  }

  logger.info(
    {
      sequenceId,
      metrics: {
        totalSent: metrics.totalSent,
        delivered: metrics.delivered,
        openRate: metrics.openRate,
        clickRate: metrics.clickRate,
        totalEnrollments: metrics.totalEnrollments,
      },
    },
    "📊 [METRICS] Sequence metrics calculated",
  )

  return metrics
}

// GetEnrollmentMetrics - Get detailed metrics for a specific enrollment
export async function getEnrollmentMetrics(enrollmentId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ enrollmentId }, "📊 [METRICS] Getting enrollment metrics")

  // 1. Get enrollment details
  const enrollmentResult = await db
    .select({
      id: sequenceEnrollments.id,
      companyName: leads.companyName,
      emailAddress: userEmailAccounts.emailAddress,
      status: sequenceEnrollments.status,
      enrolledAt: sequenceEnrollments.enrolledAt,
      currentStep: sequenceEnrollments.currentStepOrder,
      firstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
      lastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
    })
    .from(sequenceEnrollments)
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .innerJoin(userEmailAccounts, eq(sequenceEnrollments.userEmailAccountId, userEmailAccounts.id))
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (enrollmentResult.length === 0) {
    throw new Error("Enrollment not found")
  }

  const enrollment = enrollmentResult[0]
  if (!enrollment) {
    throw new Error("Enrollment not found")
  }

  // 2. Get total steps for this sequence
  const stepsResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceSteps)
    .innerJoin(sequenceEnrollments, eq(sequenceSteps.sequenceId, sequenceEnrollments.sequenceId))
    .where(eq(sequenceEnrollments.id, enrollmentId))

  const totalSteps = stepsResult[0]?.count || 0

  // 3. Get total emails sent for this enrollment (from sequence_step_executions)
  const emailsSentResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sequenceStepExecutions)
    .innerJoin(emailsTable, eq(sequenceStepExecutions.emailId, emailsTable.id))
    .where(eq(sequenceStepExecutions.enrollmentId, enrollmentId))

  const emailsSent = emailsSentResult[0]?.count || 0

  // 4. Get email event statistics for this enrollment
  // For open and click events, count unique emails (not total events)
  const emailStats = await db
    .select({
      eventType: emailEvents.eventType,
      count: sql<number>`
        CASE 
          WHEN ${emailEvents.eventType} IN ('open', 'click') 
          THEN COUNT(DISTINCT ${emailEvents.emailId})::int
          ELSE COUNT(*)::int
        END
      `,
    })
    .from(emailEvents)
    .innerJoin(emailsTable, eq(emailEvents.emailId, emailsTable.id))
    .innerJoin(sequenceStepExecutions, eq(emailsTable.id, sequenceStepExecutions.emailId))
    .where(eq(sequenceStepExecutions.enrollmentId, enrollmentId))
    .groupBy(emailEvents.eventType)

  // Process email statistics
  const emailCounts = {
    emailsSent: emailsSent, // Use actual sent count from sequence_step_executions
    emailsDelivered: 0,
    emailsOpened: 0,
    emailsClicked: 0,
    emailsReplied: 0,
    emailsBounced: 0,
  }

  emailStats.forEach((stat) => {
    switch (stat.eventType) {
      case "delivered":
        emailCounts.emailsDelivered = stat.count
        break
      case "open":
        emailCounts.emailsOpened = stat.count
        break
      case "click":
        emailCounts.emailsClicked = stat.count
        break
      case "bounce":
        emailCounts.emailsBounced = stat.count
        break
    }
  })

  // Calculate rates
  // delivered 이벤트가 없을 경우 emailsSent를 기준으로 계산
  const deliveredCount =
    emailCounts.emailsDelivered > 0 ? emailCounts.emailsDelivered : emailCounts.emailsSent
  const openRate = deliveredCount > 0 ? (emailCounts.emailsOpened / deliveredCount) * 100 : 0
  const clickRate = deliveredCount > 0 ? (emailCounts.emailsClicked / deliveredCount) * 100 : 0
  const bounceRate =
    emailCounts.emailsSent > 0 ? (emailCounts.emailsBounced / emailCounts.emailsSent) * 100 : 0

  const metrics = {
    companyName: enrollment.companyName || "알 수 없음",
    emailAddress: enrollment.emailAddress || "",
    enrollmentId: enrollment.id,
    status: enrollment.status,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    currentStep: enrollment.currentStep,
    totalSteps: totalSteps,

    // 이메일 발송 통계
    emailsSent: emailCounts.emailsSent,
    emailsDelivered: emailCounts.emailsDelivered,
    emailsOpened: emailCounts.emailsOpened,
    emailsClicked: emailCounts.emailsClicked,
    emailsReplied: emailCounts.emailsReplied,
    emailsBounced: emailCounts.emailsBounced,

    // 성과 지표
    openRate: Math.round(openRate * 10) / 10,
    clickRate: Math.round(clickRate * 10) / 10,
    replyRate: 0, // TODO: Implement reply detection
    bounceRate: Math.round(bounceRate * 10) / 10,

    // 시간 통계
    firstEmailSentAt: enrollment.firstEmailSentAt?.toISOString(),
    lastEmailSentAt: enrollment.lastEmailSentAt?.toISOString(),

    // 상세 이메일 이력
    emailHistory: await getEmailHistoryForEnrollment(enrollmentId),
  }

  logger.info(
    {
      enrollmentId,
      companyName: metrics.companyName,
      emailsSent: metrics.emailsSent,
      openRate: metrics.openRate,
      clickRate: metrics.clickRate,
    },
    "📊 [METRICS] Enrollment metrics calculated",
  )

  return metrics
}

// GetEmailHistoryForEnrollment - Get detailed email history for an enrollment
async function getEmailHistoryForEnrollment(enrollmentId: string) {
  const { default: logger } = await import("../utils/logger")

  logger.debug({ enrollmentId }, "📧 [HISTORY] Getting email history for enrollment")

  // Get emails through sequence_step_executions
  const emailHistory = await db
    .select({
      stepOrder: sequenceStepExecutions.stepOrder,
      subject: emailsTable.subject,
      sentAt: emailsTable.sentAt,
      status: emailsTable.status,
      openCount: emailsTable.openCount,
      clickCount: emailsTable.clickCount,
      deliveredAt: emailsTable.deliveredAt,
      openedAt: emailsTable.openedAt,
      clickedAt: emailsTable.clickedAt,
      repliedAt: emailsTable.repliedAt,
    })
    .from(sequenceStepExecutions)
    .innerJoin(emailsTable, eq(sequenceStepExecutions.emailId, emailsTable.id))
    .where(eq(sequenceStepExecutions.enrollmentId, enrollmentId))
    .orderBy(sequenceStepExecutions.stepOrder)

  return emailHistory.map((email) => ({
    stepOrder: email.stepOrder,
    subject: email.subject || "제목 없음",
    sentAt: email.sentAt?.toISOString() || "",
    status: email.status,
    openCount: email.openCount || 0,
    clickCount: email.clickCount || 0,
    deliveredAt: email.deliveredAt?.toISOString(),
    openedAt: email.openedAt?.toISOString(),
    clickedAt: email.clickedAt?.toISOString(),
    repliedAt: email.repliedAt?.toISOString(),
  }))
}
