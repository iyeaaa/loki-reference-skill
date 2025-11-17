import { and, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { alias } from "drizzle-orm/pg-core"
import { db } from "../db"
import { emailReplies, emails, userEmailAccounts } from "../db/schema"
import type { EmailReply } from "../db/schema/emails"
import { leadContacts } from "../db/schema/lead-details"
import { leads } from "../db/schema/leads"

// Create table aliases for joining emails table twice
const originalEmail = alias(emails, "original_email")
const replyEmail = alias(emails, "reply_email")

interface EmailReplyFilters {
  workspaceId?: string
  isRead?: boolean
  sentiment?: string
  search?: string
  emailAccountId?: string
}

interface EmailReplyWithDetails extends EmailReply {
  originalEmail: {
    id: string
    subject: string | null
    fromEmail: string
    toEmail: string
    sentAt: Date | null
  } | null
  replyEmail: {
    id: string
    subject: string | null
    fromEmail: string
    toEmail: string
    bodyText: string | null
    bodyHtml: string | null
    sentAt: Date | null
    leadName: string | null
    companyName: string | null
    contactName: string | null
  } | null
  emailAccount: {
    id: string
    emailAddress: string
  } | null
}

/**
 * List all inbound emails grouped by thread with pagination and filters
 * Shows the latest inbound email in each thread
 */
export async function listEmailReplies(
  limit: number,
  offset: number,
  filters: EmailReplyFilters,
): Promise<EmailReplyWithDetails[]> {
  const conditions = buildInboundFilterConditions(filters)

  // Get latest inbound email per thread with pagination
  const results = await db
    .select({
      inboundEmail: emails,
      emailAccount: {
        id: userEmailAccounts.id,
        emailAddress: userEmailAccounts.emailAddress,
      },
      lead: {
        companyName: leads.companyName,
      },
      leadContact: {
        contactName: leadContacts.contactName,
      },
      // Get email_reply metadata if it exists
      replyMetadata: {
        id: emailReplies.id,
        intent: emailReplies.intent,
        sentiment: emailReplies.sentiment,
        aiSummary: emailReplies.aiSummary,
        isRead: emailReplies.isRead,
        assignedTo: emailReplies.assignedTo,
        originalEmailId: emailReplies.originalEmailId,
      },
    })
    .from(emails)
    .leftJoin(userEmailAccounts, eq(emails.userEmailAccountId, userEmailAccounts.id))
    .leftJoin(leads, eq(emails.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(eq(leadContacts.leadId, leads.id), eq(leadContacts.isPrimary, true)),
    )
    .leftJoin(emailReplies, eq(emails.id, emailReplies.replyEmailId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(emails.createdAt))
    .limit(limit)
    .offset(offset)

  // Transform to match EmailReplyWithDetails interface
  return results.map((r) => ({
    // Use email_reply id if exists, otherwise use email id
    id: r.replyMetadata?.id || r.inboundEmail.id,
    workspaceId: r.inboundEmail.workspaceId,
    originalEmailId: r.replyMetadata?.originalEmailId || "",
    replyEmailId: r.inboundEmail.id,
    intent: r.replyMetadata?.intent || null,
    sentiment: r.replyMetadata?.sentiment || null,
    aiSummary: r.replyMetadata?.aiSummary || null,
    isRead: r.replyMetadata?.isRead ?? r.inboundEmail.isRead,
    assignedTo: r.replyMetadata?.assignedTo || null,
    createdAt: r.inboundEmail.createdAt,
    originalEmail: r.replyMetadata?.originalEmailId
      ? {
          id: r.replyMetadata.originalEmailId,
          subject: null,
          fromEmail: "",
          toEmail: "",
          sentAt: null,
        }
      : null,
    replyEmail: {
      id: r.inboundEmail.id,
      subject: r.inboundEmail.subject,
      fromEmail: r.inboundEmail.fromEmail,
      toEmail: r.inboundEmail.toEmail,
      bodyText: r.inboundEmail.bodyText,
      bodyHtml: r.inboundEmail.bodyHtml,
      sentAt: r.inboundEmail.sentAt,
      leadName: r.inboundEmail.leadName,
      companyName: r.lead?.companyName || null,
      contactName: r.leadContact?.contactName || null,
    },
    emailAccount: r.emailAccount,
  }))
}

/**
 * Count total inbound emails matching filters
 */
export async function countEmailReplies(filters: EmailReplyFilters): Promise<number> {
  const conditions = buildInboundFilterConditions(filters)

  const result = await db
    .select({ count: count() })
    .from(emails)
    .leftJoin(userEmailAccounts, eq(emails.userEmailAccountId, userEmailAccounts.id))
    .leftJoin(emailReplies, eq(emails.id, emailReplies.replyEmailId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return result[0]?.count || 0
}

/**
 * Get email reply by ID with full details
 */
export async function getEmailReplyById(id: string): Promise<EmailReplyWithDetails | null> {
  const result = await db
    .select({
      reply: emailReplies,
      originalEmail: {
        id: originalEmail.id,
        subject: originalEmail.subject,
        fromEmail: originalEmail.fromEmail,
        toEmail: originalEmail.toEmail,
        sentAt: originalEmail.sentAt,
      },
      replyEmail: {
        id: replyEmail.id,
        subject: replyEmail.subject,
        fromEmail: replyEmail.fromEmail,
        toEmail: replyEmail.toEmail,
        bodyText: replyEmail.bodyText,
        bodyHtml: replyEmail.bodyHtml,
        sentAt: replyEmail.sentAt,
        leadName: replyEmail.leadName,
      },
      emailAccount: {
        id: userEmailAccounts.id,
        emailAddress: userEmailAccounts.emailAddress,
      },
      lead: {
        companyName: leads.companyName,
      },
      leadContact: {
        contactName: leadContacts.contactName,
      },
    })
    .from(emailReplies)
    .leftJoin(originalEmail, eq(emailReplies.originalEmailId, originalEmail.id))
    .leftJoin(replyEmail, eq(emailReplies.replyEmailId, replyEmail.id))
    .leftJoin(userEmailAccounts, eq(replyEmail.userEmailAccountId, userEmailAccounts.id))
    .leftJoin(leads, eq(replyEmail.leadId, leads.id))
    .leftJoin(
      leadContacts,
      and(eq(leadContacts.leadId, leads.id), eq(leadContacts.isPrimary, true)),
    )
    .where(eq(emailReplies.id, id))
    .limit(1)

  if (!result[0]) return null

  const r = result[0]
  return {
    ...r.reply,
    originalEmail: r.originalEmail,
    replyEmail: r.replyEmail
      ? {
          ...r.replyEmail,
          companyName: r.lead?.companyName || null,
          contactName: r.leadContact?.contactName || null,
        }
      : null,
    emailAccount: r.emailAccount,
  }
}

/**
 * Mark reply as read
 */
export async function markAsRead(id: string): Promise<EmailReply | null> {
  const result = await db
    .update(emailReplies)
    .set({ isRead: true })
    .where(eq(emailReplies.id, id))
    .returning()

  return result[0] || null
}

/**
 * Mark reply as unread
 */
export async function markAsUnread(id: string): Promise<EmailReply | null> {
  const result = await db
    .update(emailReplies)
    .set({ isRead: false })
    .where(eq(emailReplies.id, id))
    .returning()

  return result[0] || null
}

/**
 * Bulk mark as read
 */
export async function bulkMarkAsRead(replyIds: string[]): Promise<number> {
  if (replyIds.length === 0) return 0

  const result = await db
    .update(emailReplies)
    .set({ isRead: true })
    .where(inArray(emailReplies.id, replyIds))
    .returning({ id: emailReplies.id })

  return result.length
}

/**
 * Bulk mark as unread
 */
export async function bulkMarkAsUnread(replyIds: string[]): Promise<number> {
  if (replyIds.length === 0) return 0

  const result = await db
    .update(emailReplies)
    .set({ isRead: false })
    .where(inArray(emailReplies.id, replyIds))
    .returning({ id: emailReplies.id })

  return result.length
}

/**
 * Delete email reply and its associated emails (cascade delete)
 * Accepts email_reply ID (UUID), email ID (UUID), or threadId (string)
 *
 * With CASCADE DELETE constraints, deleting emails automatically deletes:
 * - email_replies (both originalEmailId and replyEmailId references)
 * - email_events
 */
export async function deleteEmailReply(id: string): Promise<void> {
  // Strategy 1: Try as threadId (most common case from UI)
  // Delete ALL emails in the thread → CASCADE deletes email_replies & email_events
  const threadsEmails = await db
    .select({ id: emails.id })
    .from(emails)
    .where(eq(emails.threadId, id))

  if (threadsEmails.length > 0) {
    const emailIds = threadsEmails.map((e) => e.id)
    // Delete all emails in thread → CASCADE handles email_replies & email_events
    await db.delete(emails).where(inArray(emails.id, emailIds))
    return
  }

  // Strategy 2: Try as email_reply ID
  const reply = await db
    .select({
      originalEmailId: emailReplies.originalEmailId,
      replyEmailId: emailReplies.replyEmailId,
    })
    .from(emailReplies)
    .where(eq(emailReplies.id, id))
    .limit(1)

  if (reply[0]) {
    // Collect all email IDs to delete
    const emailIdsToDelete = [reply[0].originalEmailId, reply[0].replyEmailId]
    // Delete emails → CASCADE deletes email_replies & email_events
    await db.delete(emails).where(inArray(emails.id, emailIdsToDelete))
    return
  }

  // Strategy 3: Try as email ID
  const emailFound = await db
    .select({ id: emails.id })
    .from(emails)
    .where(eq(emails.id, id))
    .limit(1)

  if (emailFound[0]) {
    // Delete email → CASCADE deletes email_replies & email_events
    await db.delete(emails).where(eq(emails.id, id))
  }
}

/**
 * Bulk delete email replies and their associated emails (cascade delete)
 * Accepts threadIds (most common), email_replies IDs, or email IDs
 *
 * With CASCADE DELETE constraints, deleting emails automatically deletes:
 * - email_replies (both originalEmailId and replyEmailId references)
 * - email_events
 *
 * IMPORTANT: When given threadIds, deletes ALL emails in those threads.
 */
export async function bulkDeleteEmailReplies(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  // Strategy 1: Try as threadIds (most common from UI - reply list selection)
  // This finds ALL emails in the given threads and deletes them
  const threadsEmails = await db
    .select({ id: emails.id, threadId: emails.threadId })
    .from(emails)
    .where(inArray(emails.threadId, ids))

  if (threadsEmails.length > 0) {
    const emailIds = threadsEmails.map((e) => e.id)
    // Delete all emails in threads → CASCADE handles email_replies & email_events
    const deleted = await db
      .delete(emails)
      .where(inArray(emails.id, emailIds))
      .returning({ id: emails.id })

    return deleted.length
  }

  // Strategy 2: Try as email_replies IDs
  const replies = await db
    .select({
      originalEmailId: emailReplies.originalEmailId,
      replyEmailId: emailReplies.replyEmailId,
    })
    .from(emailReplies)
    .where(inArray(emailReplies.id, ids))

  if (replies.length > 0) {
    // Collect all unique email IDs from the replies
    const emailIdsSet = new Set<string>()
    replies.forEach((r) => {
      emailIdsSet.add(r.originalEmailId)
      emailIdsSet.add(r.replyEmailId)
    })

    // Delete emails → CASCADE handles email_replies & email_events
    const deleted = await db
      .delete(emails)
      .where(inArray(emails.id, Array.from(emailIdsSet)))
      .returning({ id: emails.id })

    return deleted.length
  }

  // Strategy 3: Try as email IDs
  const emailsFound = await db.select({ id: emails.id }).from(emails).where(inArray(emails.id, ids))

  if (emailsFound.length > 0) {
    // Delete emails → CASCADE handles email_replies & email_events
    const deleted = await db
      .delete(emails)
      .where(inArray(emails.id, ids))
      .returning({ id: emails.id })

    return deleted.length
  }

  return 0
}

/**
 * Build filter conditions for inbound emails queries
 */
function buildInboundFilterConditions(filters: EmailReplyFilters) {
  const conditions = [eq(emails.direction, "inbound")]

  if (filters.workspaceId) {
    conditions.push(eq(emails.workspaceId, filters.workspaceId))
  }

  if (filters.isRead !== undefined) {
    conditions.push(eq(emails.isRead, filters.isRead))
  }

  if (filters.sentiment) {
    conditions.push(
      eq(
        emailReplies.sentiment,
        filters.sentiment as "positive" | "neutral" | "negative" | "interested" | "not_interested",
      ),
    )
  }

  if (filters.emailAccountId) {
    conditions.push(eq(userEmailAccounts.id, filters.emailAccountId))
  }

  if (filters.search) {
    conditions.push(
      or(
        ilike(emails.subject, `%${filters.search}%`),
        ilike(emails.fromEmail, `%${filters.search}%`),
        ilike(emails.bodyText, `%${filters.search}%`),
      )!,
    )
  }

  return conditions
}

/**
 * Get count of inbound threads by intent category
 * Counts DISTINCT threads (conversations), not individual emails
 */
export async function getIntentCounts(workspaceId: string) {
  const whereClause =
    workspaceId === "all"
      ? eq(emails.direction, "inbound")
      : and(eq(emails.workspaceId, workspaceId), eq(emails.direction, "inbound"))

  // Get total count of distinct threads with inbound emails
  const totalResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emails.threadId})::int` })
    .from(emails)
    .where(whereClause)

  const total = totalResult[0]?.count || 0

  // Get important count (threads with at least one important inbound email)
  const importantResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emails.threadId})::int` })
    .from(emails)
    .where(and(whereClause, eq(emails.isImportant, true)))

  const important = importantResult[0]?.count || 0

  // Get unread count (threads with at least one unread inbound email)
  const unreadResult = await db
    .select({ count: sql<number>`COUNT(DISTINCT ${emails.threadId})::int` })
    .from(emails)
    .where(and(whereClause, eq(emails.isRead, false)))

  const unread = unreadResult[0]?.count || 0

  // Get intent counts from email_replies (for threads that have replies)
  // Count distinct threads by intent
  const intentCountsResult = await db
    .select({
      intent: emailReplies.intent,
      count: sql<number>`COUNT(DISTINCT ${emails.threadId})::int`,
    })
    .from(emails)
    .innerJoin(emailReplies, eq(emails.id, emailReplies.replyEmailId))
    .where(whereClause)
    .groupBy(emailReplies.intent)

  // Format the response
  const intentCounts: Record<string, number> = {
    all: total,
    important: important,
    unread: unread,
    meeting_request: 0,
    question: 0,
    objection: 0,
    out_of_office: 0,
    not_interested: 0,
    positive_interest: 0,
    neutral: 0,
    unclassified: 0,
  }

  for (const row of intentCountsResult) {
    if (row.intent) {
      intentCounts[row.intent] = Number(row.count)
    } else {
      intentCounts.unclassified = Number(row.count)
    }
  }

  return intentCounts
}

/**
 * Update email reply intent and sentiment manually
 */
export async function updateEmailReply(
  replyId: string,
  data: {
    intent?: string | null
    sentiment?: "positive" | "neutral" | "negative" | "interested" | "not_interested" | null
  },
) {
  const [updated] = await db
    .update(emailReplies)
    .set({
      ...(data.intent !== undefined && { intent: data.intent }),
      ...(data.sentiment !== undefined && { sentiment: data.sentiment }),
    })
    .where(eq(emailReplies.id, replyId))
    .returning()

  return updated
}

/**
 * Reclassify email reply using AI
 */
export async function reclassifyEmailReply(replyId: string) {
  const { getAIClassificationService } = await import("./ai-classification.service")

  // Get email reply with full details
  const replyResult = await db
    .select({
      id: emailReplies.id,
      replyEmailId: emailReplies.replyEmailId,
      subject: replyEmail.subject,
      bodyText: replyEmail.bodyText,
      bodyHtml: replyEmail.bodyHtml,
    })
    .from(emailReplies)
    .innerJoin(replyEmail, eq(emailReplies.replyEmailId, replyEmail.id))
    .where(eq(emailReplies.id, replyId))
    .limit(1)

  const reply = replyResult[0]

  if (!reply) {
    return null
  }

  // Classify using AI
  const aiService = getAIClassificationService()
  const classification = await aiService.classifyReply({
    subject: reply.subject || "",
    body: reply.bodyText || reply.bodyHtml || "",
  })

  // Update email_replies with classification results
  const [updated] = await db
    .update(emailReplies)
    .set({
      intent: classification.intent,
      sentiment: classification.sentiment as
        | "positive"
        | "neutral"
        | "negative"
        | "interested"
        | "not_interested",
    })
    .where(eq(emailReplies.id, replyId))
    .returning()

  return {
    ...updated,
    classification: {
      intent: classification.intent,
      sentiment: classification.sentiment,
      confidence: classification.confidence,
      reasoning: classification.reasoning,
    },
  }
}

/**
 * Toggle important status for all inbound emails in a thread
 */
export async function toggleImportant(threadId: string, isImportant: boolean): Promise<number> {
  // Update all inbound emails in the thread
  const result = await db
    .update(emails)
    .set({ isImportant })
    .where(and(eq(emails.threadId, threadId), eq(emails.direction, "inbound")))
    .returning({ id: emails.id })

  return result.length
}

/**
 * Mark all inbound emails in a thread as read
 */
export async function markThreadAsRead(threadId: string): Promise<number> {
  // Update all inbound emails in the thread to mark as read
  const result = await db
    .update(emails)
    .set({ isRead: true })
    .where(and(eq(emails.threadId, threadId), eq(emails.direction, "inbound")))
    .returning({ id: emails.id })

  return result.length
}
