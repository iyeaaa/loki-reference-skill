import { and, count, desc, eq, ilike, inArray, or } from "drizzle-orm"
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
 * List email replies with pagination and filters
 */
export async function listEmailReplies(
  limit: number,
  offset: number,
  filters: EmailReplyFilters,
): Promise<EmailReplyWithDetails[]> {
  const conditions = buildFilterConditions(filters)

  const results = await db
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
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(emailReplies.createdAt))
    .limit(limit)
    .offset(offset)

  return results.map((r) => ({
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
  }))
}

/**
 * Count total email replies matching filters
 */
export async function countEmailReplies(filters: EmailReplyFilters): Promise<number> {
  const conditions = buildFilterConditions(filters)

  const result = await db
    .select({ count: count() })
    .from(emailReplies)
    .leftJoin(replyEmail, eq(emailReplies.replyEmailId, replyEmail.id))
    .leftJoin(userEmailAccounts, eq(replyEmail.userEmailAccountId, userEmailAccounts.id))
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
 * Build filter conditions for queries
 */
function buildFilterConditions(filters: EmailReplyFilters) {
  const conditions = []

  if (filters.workspaceId) {
    conditions.push(eq(emailReplies.workspaceId, filters.workspaceId))
  }

  if (filters.isRead !== undefined) {
    conditions.push(eq(emailReplies.isRead, filters.isRead))
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
        ilike(replyEmail.subject, `%${filters.search}%`),
        ilike(replyEmail.fromEmail, `%${filters.search}%`),
        ilike(replyEmail.bodyText, `%${filters.search}%`),
      ),
    )
  }

  return conditions
}
