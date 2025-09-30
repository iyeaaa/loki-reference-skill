import { and, desc, eq } from 'drizzle-orm'
import { db } from '../db/index'
import { leads } from '../db/schema/leads'
import { sequenceEnrollments } from '../db/schema/sequences'
import { workflowGeneratedEmails } from '../db/schema/workflow-emails'

// ====================================
// WORKFLOW GENERATED EMAILS CRUD
// ====================================

// Get generated emails for a node
export async function getGeneratedEmailsByNode(sequenceId: string, nodeId: string) {
  const result = await db
    .select()
    .from(workflowGeneratedEmails)
    .innerJoin(leads, eq(workflowGeneratedEmails.leadId, leads.id))
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, sequenceId),
        eq(workflowGeneratedEmails.nodeId, nodeId),
      ),
    )
    .orderBy(desc(workflowGeneratedEmails.createdAt))

  // Map to flat structure
  return result.map((row) => ({
    id: row.workflow_generated_emails.id,
    sequenceId: row.workflow_generated_emails.sequenceId,
    nodeId: row.workflow_generated_emails.nodeId,
    leadId: row.workflow_generated_emails.leadId,
    subject: row.workflow_generated_emails.subject,
    bodyText: row.workflow_generated_emails.bodyText,
    bodyHtml: row.workflow_generated_emails.bodyHtml,
    status: row.workflow_generated_emails.status,
    generationMode: row.workflow_generated_emails.generationMode,
    aiPrompt: row.workflow_generated_emails.aiPrompt,
    aiModel: row.workflow_generated_emails.aiModel,
    generationError: row.workflow_generated_emails.generationError,
    generatedAt: row.workflow_generated_emails.generatedAt,
    editedAt: row.workflow_generated_emails.editedAt,
    createdAt: row.workflow_generated_emails.createdAt,
    updatedAt: row.workflow_generated_emails.updatedAt,
    // Lead information
    companyName: row.leads.companyName,
    contactName: row.leads.contactName,
    contactEmail: row.leads.contactEmail,
    industry: row.leads.industry,
  }))
}

// Get single generated email
export async function getGeneratedEmail(emailId: string) {
  const result = await db
    .select()
    .from(workflowGeneratedEmails)
    .innerJoin(leads, eq(workflowGeneratedEmails.leadId, leads.id))
    .where(eq(workflowGeneratedEmails.id, emailId))
    .limit(1)

  if (result.length === 0) return null

  const row = result[0]
  if (!row) return null
  return {
    id: row.workflow_generated_emails.id,
    sequenceId: row.workflow_generated_emails.sequenceId,
    nodeId: row.workflow_generated_emails.nodeId,
    leadId: row.workflow_generated_emails.leadId,
    subject: row.workflow_generated_emails.subject,
    bodyText: row.workflow_generated_emails.bodyText,
    bodyHtml: row.workflow_generated_emails.bodyHtml,
    status: row.workflow_generated_emails.status,
    generationMode: row.workflow_generated_emails.generationMode,
    aiPrompt: row.workflow_generated_emails.aiPrompt,
    aiModel: row.workflow_generated_emails.aiModel,
    generationError: row.workflow_generated_emails.generationError,
    generatedAt: row.workflow_generated_emails.generatedAt,
    editedAt: row.workflow_generated_emails.editedAt,
    createdAt: row.workflow_generated_emails.createdAt,
    updatedAt: row.workflow_generated_emails.updatedAt,
    // Lead information
    companyName: row.leads.companyName,
    contactName: row.leads.contactName,
    contactEmail: row.leads.contactEmail,
    industry: row.leads.industry,
  }
}

// Create or update generated email
export async function upsertGeneratedEmail(data: {
  sequenceId: string
  nodeId: string
  leadId: string
  subject: string
  bodyText?: string
  bodyHtml?: string
  status?: 'pending' | 'generating' | 'generated' | 'edited' | 'failed'
  generationMode?: 'ai' | 'manual' | 'template'
  aiPrompt?: string
  aiModel?: string
  generationError?: string
  contextSnapshot?: Record<string, unknown>
}) {
  // Check if email already exists
  const existing = await db
    .select({ id: workflowGeneratedEmails.id })
    .from(workflowGeneratedEmails)
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, data.sequenceId),
        eq(workflowGeneratedEmails.nodeId, data.nodeId),
        eq(workflowGeneratedEmails.leadId, data.leadId),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    // Update existing
    const [updated] = await db
      .update(workflowGeneratedEmails)
      .set({
        subject: data.subject,
        bodyText: data.bodyText,
        bodyHtml: data.bodyHtml,
        status: data.status,
        generationMode: data.generationMode,
        aiPrompt: data.aiPrompt,
        aiModel: data.aiModel,
        generationError: data.generationError,
        contextSnapshot: data.contextSnapshot,
        generatedAt: data.status === 'generated' ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(workflowGeneratedEmails.id, existing[0].id))
      .returning()

    return updated
  }

  // Insert new
  const [newEmail] = await db
    .insert(workflowGeneratedEmails)
    .values({
      sequenceId: data.sequenceId,
      nodeId: data.nodeId,
      leadId: data.leadId,
      subject: data.subject,
      bodyText: data.bodyText || null,
      bodyHtml: data.bodyHtml || null,
      status: data.status || 'pending',
      generationMode: data.generationMode || 'manual',
      aiPrompt: data.aiPrompt || null,
      aiModel: data.aiModel || null,
      generationError: data.generationError || null,
      contextSnapshot: data.contextSnapshot || {},
      generatedAt: data.status === 'generated' ? new Date() : null,
    })
    .returning()

  return newEmail
}

// Update generated email
export async function updateGeneratedEmail(
  emailId: string,
  data: {
    subject?: string
    bodyText?: string
    bodyHtml?: string
    status?: 'pending' | 'generating' | 'generated' | 'edited' | 'failed'
  },
) {
  const [updated] = await db
    .update(workflowGeneratedEmails)
    .set({
      ...data,
      editedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(workflowGeneratedEmails.id, emailId))
    .returning()

  return updated
}

// Delete generated email
export async function deleteGeneratedEmail(emailId: string) {
  await db.delete(workflowGeneratedEmails).where(eq(workflowGeneratedEmails.id, emailId))
}

// Delete all generated emails for a node
export async function deleteGeneratedEmailsByNode(sequenceId: string, nodeId: string) {
  await db
    .delete(workflowGeneratedEmails)
    .where(
      and(
        eq(workflowGeneratedEmails.sequenceId, sequenceId),
        eq(workflowGeneratedEmails.nodeId, nodeId),
      ),
    )
}

// Get leads for sequence (for email generation)
export async function getSequenceLeads(sequenceId: string) {
  const result = await db
    .select()
    .from(sequenceEnrollments)
    .innerJoin(leads, eq(sequenceEnrollments.leadId, leads.id))
    .where(eq(sequenceEnrollments.sequenceId, sequenceId))

  // Map to flat structure
  return result.map((row) => ({
    id: row.leads.id,
    companyName: row.leads.companyName,
    contactName: row.leads.contactName,
    contactEmail: row.leads.contactEmail,
    industry: row.leads.industry,
    website: row.leads.website,
    size: row.leads.size,
  }))
}

// Replace template variables
export function replaceTemplateVariables(
  template: string,
  context: {
    companyName?: string
    contactName?: string
    contactEmail?: string
    industry?: string
    [key: string]: string | undefined
  },
): string {
  let result = template

  for (const [key, value] of Object.entries(context)) {
    if (value) {
      const regex = new RegExp(`{{${key}}}`, 'gi')
      result = result.replace(regex, value)
    }
  }

  // 한글 변수도 지원
  const koreanMap: Record<string, string> = {
    회사명: context.companyName || '',
    담당자명: context.contactName || '',
    이름: context.contactName || '',
    이메일: context.contactEmail || '',
    업종: context.industry || '',
  }

  for (const [key, value] of Object.entries(koreanMap)) {
    if (value) {
      const regex = new RegExp(`{{${key}}}`, 'g')
      result = result.replace(regex, value)
    }
  }

  return result
}
