import { and, desc, eq, ilike, lte, or, sql } from "drizzle-orm"
import { db } from "../db/index"
import { customerGroups } from "../db/schema/customer-groups"
import { userEmailAccounts } from "../db/schema/email-accounts"
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
      customerGroupId: sequences.customerGroupId,
      customerGroupName: customerGroups.name,
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
      emailBodyHtml: data.emailBodyHtml || null,
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
  const [updatedStep] = await db
    .update(sequenceSteps)
    .set({
      ...data,
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

  // Create enrollments
  const enrollmentValues = validLeadIds.map((leadId) => ({
    sequenceId: data.sequenceId,
    leadId,
    userEmailAccountId: data.userEmailAccountId,
    enrolledBy: data.enrolledBy || null,
    currentStepOrder: 0,
    status: "active" as const,
  }))

  const enrollments = await db.insert(sequenceEnrollments).values(enrollmentValues).returning({
    id: sequenceEnrollments.id,
    leadId: sequenceEnrollments.leadId,
    enrolledAt: sequenceEnrollments.enrolledAt,
  })

  logger.info(
    {
      sequenceId: data.sequenceId,
      enrollmentsCreated: enrollments.length,
      enrollmentIds: enrollments.map((e) => e.id),
    },
    "✅ [STEP-BASED] Created enrollments",
  )

  // Create step executions for each enrollment with KST scheduling
  const stepExecutionValues = []

  for (const enrollment of enrollments) {
    let baseDate = new Date(enrollment.enrolledAt)

    logger.debug(
      {
        enrollmentId: enrollment.id,
        leadId: enrollment.leadId,
        enrolledAt: enrollment.enrolledAt,
      },
      "📅 [STEP-BASED] Calculating schedules for enrollment",
    )

    for (const step of steps) {
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
    enrolledCount: enrollments.length,
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
  status: "sent" | "failed" | "skipped",
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
