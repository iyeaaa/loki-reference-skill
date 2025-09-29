import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '../db/index'
import { userEmailAccounts } from '../db/schema/email-accounts'
import { leads } from '../db/schema/leads'
import { sequenceEnrollments, sequenceSteps, sequences } from '../db/schema/sequences'
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
