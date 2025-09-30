import { and, desc, eq, ilike, lte, or, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { userEmailAccounts } from '../db/schema/email-accounts'
import { leadContacts } from '../db/schema/lead-details'
import { leads } from '../db/schema/leads'
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from '../db/schema/sequences'
import { users } from '../db/schema/users'
import { workspaces } from '../db/schema/workspaces'

// ====================================
// SEQUENCE CRUD OPERATIONS
// ====================================

// GetSequence :one
export async function getSequence(id: string) {
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
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
    .leftJoin(users, eq(sequences.createdBy, users.id))
    .where(eq(sequences.id, id))
    .limit(1)

  return result[0]
}

// CreateSequence :one
export async function createSequence(data: {
  workspaceId: string
  name: string
  description?: string
  status?: 'draft' | 'active' | 'paused' | 'archived'
  createdBy?: string
}) {
  const [newSequence] = await db
    .insert(sequences)
    .values({
      workspaceId: data.workspaceId,
      name: data.name,
      description: data.description || null,
      status: data.status || 'draft',
      createdBy: data.createdBy || null,
    })
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
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
    name: string
    description?: string
    status: 'draft' | 'active' | 'paused' | 'archived'
  },
) {
  const [updatedSequence] = await db
    .update(sequences)
    .set({
      name: data.name,
      description: data.description,
      status: data.status,
      updatedAt: new Date(),
    })
    .where(eq(sequences.id, id))
    .returning({
      id: sequences.id,
      workspaceId: sequences.workspaceId,
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
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
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      createdBy: sequences.createdBy,
      createdAt: sequences.createdAt,
      updatedAt: sequences.updatedAt,
      workspaceName: workspaces.name,
      createdByUsername: users.username,
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
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
    status?: 'draft' | 'active' | 'paused' | 'archived'
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
    conditions.push(
      or(
        ilike(sequences.name, `%${filters.search}%`),
        ilike(sequences.description, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    conditions.push(or(...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)))!)
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    conditions.push(or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))!)
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
    })
    .from(sequences)
    .innerJoin(workspaces, eq(sequences.workspaceId, workspaces.id))
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
      name: sequences.name,
      description: sequences.description,
      status: sequences.status,
      createdAt: sequences.createdAt,
    })
    .from(sequences)
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
      updatedAt: new Date(),
    })
    .where(eq(sequenceSteps.id, id))
    .returning({
      id: sequenceSteps.id,
      sequenceId: sequenceSteps.sequenceId,
      stepOrder: sequenceSteps.stepOrder,
      delayDays: sequenceSteps.delayDays,
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
  status?: 'active' | 'paused' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed'
}) {
  const [newEnrollment] = await db
    .insert(sequenceEnrollments)
    .values({
      sequenceId: data.sequenceId,
      leadId: data.leadId,
      userEmailAccountId: data.userEmailAccountId,
      enrolledBy: data.enrolledBy || null,
      status: data.status || 'active',
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
  status: 'active' | 'paused' | 'completed' | 'stopped' | 'bounced' | 'unsubscribed',
) {
  const [updatedEnrollment] = await db
    .update(sequenceEnrollments)
    .set({
      status,
      stoppedAt: status === 'stopped' ? new Date() : undefined,
      completedAt: status === 'completed' ? new Date() : undefined,
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
  status?: 'draft' | 'active' | 'paused' | 'archived'
  search?: string
  workspaceIds?: string[]
  createdByIds?: string[]
}) {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(sequences.status, filters.status))
  }

  if (filters?.search) {
    conditions.push(
      or(
        ilike(sequences.name, `%${filters.search}%`),
        ilike(sequences.description, `%${filters.search}%`),
      )!,
    )
  }

  if (filters?.workspaceIds && filters.workspaceIds.length > 0) {
    conditions.push(or(...filters.workspaceIds.map((id) => eq(sequences.workspaceId, id)))!)
  }

  if (filters?.createdByIds && filters.createdByIds.length > 0) {
    conditions.push(or(...filters.createdByIds.map((id) => eq(sequences.createdBy, id)))!)
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
  status: 'draft' | 'active' | 'paused' | 'archived',
) {
  const result = await db
    .update(sequences)
    .set({
      status,
      updatedAt: new Date(),
    })
    .where(or(...sequenceIds.map((id) => eq(sequences.id, id)))!)
    .returning({ id: sequences.id })

  return result.length
}

// BulkDelete :exec
export async function bulkDelete(sequenceIds: string[]) {
  const result = await db
    .delete(sequences)
    .where(or(...sequenceIds.map((id) => eq(sequences.id, id)))!)
    .returning({ id: sequences.id })

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
  const result = await db
    .update(sequenceEnrollments)
    .set({
      status: 'stopped',
      stoppedAt: new Date(),
    })
    .where(or(...enrollmentIds.map((id) => eq(sequenceEnrollments.id, id)))!)
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
  // Get sequence steps to create schedules
  const steps = await getSequenceSteps(data.sequenceId)

  if (steps.length === 0) {
    throw new Error('시퀀스에 스텝이 없습니다.')
  }

  // Filter leads with valid email contacts
  const leadsWithEmails = await db
    .select({
      leadId: leads.id,
      email: leadContacts.contactValue,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(
      and(
        or(...data.leadIds.map((id) => eq(leads.id, id)))!,
        eq(leadContacts.contactType, 'email'),
        eq(leadContacts.isPrimary, true),
      ),
    )

  if (leadsWithEmails.length === 0) {
    throw new Error('이메일이 있는 리드가 없습니다.')
  }

  const validLeadIds = leadsWithEmails.map((l) => l.leadId)

  // Create enrollments
  const enrollmentValues = validLeadIds.map((leadId) => ({
    sequenceId: data.sequenceId,
    leadId,
    userEmailAccountId: data.userEmailAccountId,
    enrolledBy: data.enrolledBy || null,
    currentStepOrder: 0,
    status: 'active' as const,
  }))

  const enrollments = await db.insert(sequenceEnrollments).values(enrollmentValues).returning({
    id: sequenceEnrollments.id,
    leadId: sequenceEnrollments.leadId,
    enrolledAt: sequenceEnrollments.enrolledAt,
  })

  // Create step executions for each enrollment
  const now = new Date()
  const stepExecutionValues = []

  for (const enrollment of enrollments) {
    for (const step of steps) {
      const scheduledAt = new Date(now.getTime() + step.delayDays * 24 * 60 * 60 * 1000)

      stepExecutionValues.push({
        enrollmentId: enrollment.id,
        stepId: step.id,
        stepOrder: step.stepOrder,
        status: 'pending' as const,
        scheduledAt,
      })
    }
  }

  if (stepExecutionValues.length > 0) {
    await db.insert(sequenceStepExecutions).values(stepExecutionValues)
  }

  // Update nextStepScheduledAt for enrollments
  for (const enrollment of enrollments) {
    const firstStep = steps[0]
    const nextScheduledAt = new Date(
      new Date(enrollment.enrolledAt).getTime() + firstStep.delayDays * 24 * 60 * 60 * 1000,
    )

    await db
      .update(sequenceEnrollments)
      .set({ nextStepScheduledAt: nextScheduledAt })
      .where(eq(sequenceEnrollments.id, enrollment.id))
  }

  return {
    enrolledCount: enrollments.length,
    totalSteps: steps.length,
    scheduledExecutions: stepExecutionValues.length,
  }
}

// GetLeadsWithEmails - Get leads from a list that have email contacts
export async function getLeadsWithEmails(leadIds: string[]) {
  const result = await db
    .select({
      leadId: leads.id,
      companyName: leads.companyName,
      email: leadContacts.contactValue,
      isPrimary: leadContacts.isPrimary,
    })
    .from(leads)
    .innerJoin(leadContacts, eq(leads.id, leadContacts.leadId))
    .where(
      and(or(...leadIds.map((id) => eq(leads.id, id)))!, eq(leadContacts.contactType, 'email')),
    )
    .orderBy(leads.companyName, desc(leadContacts.isPrimary))

  return result
}

// GetPendingStepExecutions - Get step executions that need to be sent
export async function getPendingStepExecutions(limit: number = 100) {
  const now = new Date()

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
        eq(sequenceStepExecutions.status, 'pending'),
        lte(sequenceStepExecutions.scheduledAt, now),
        eq(sequenceEnrollments.status, 'active'),
        eq(sequences.status, 'active'),
      ),
    )
    .orderBy(sequenceStepExecutions.scheduledAt)
    .limit(limit)

  return result
}

// UpdateStepExecutionStatus - Update step execution status after sending
export async function updateStepExecutionStatus(
  executionId: string,
  status: 'sent' | 'failed' | 'skipped',
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
  // Get total steps for this enrollment
  const enrollment = await db
    .select({
      sequenceId: sequenceEnrollments.sequenceId,
      currentStepOrder: sequenceEnrollments.currentStepOrder,
    })
    .from(sequenceEnrollments)
    .where(eq(sequenceEnrollments.id, enrollmentId))
    .limit(1)

  if (!enrollment[0]) return null

  const steps = await getSequenceSteps(enrollment[0].sequenceId)
  const isLastStep = stepOrder >= steps.length

  const updateData: any = {
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
  }

  // If last step, mark as completed
  if (isLastStep) {
    updateData.status = 'completed'
    updateData.completedAt = new Date()
    updateData.nextStepScheduledAt = null
  } else {
    // Schedule next step
    const nextStep = steps.find((s) => s.stepOrder === stepOrder + 1)
    if (nextStep) {
      const nextScheduledAt = new Date(Date.now() + nextStep.delayDays * 24 * 60 * 60 * 1000)
      updateData.nextStepScheduledAt = nextScheduledAt
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

  return updated
}
