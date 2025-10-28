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
 */
export async function deleteEmailReply(id: string): Promise<void> {
  // Strategy 1: Try to get the reply by its ID
  let reply = await db
    .select({
      id: emailReplies.id,
      originalEmailId: emailReplies.originalEmailId,
      replyEmailId: emailReplies.replyEmailId,
    })
    .from(emailReplies)
    .where(eq(emailReplies.id, id))
    .limit(1)

  // Strategy 2: If no reply found, the ID might be an email ID
  if (!reply[0]) {
    reply = await db
      .select({
        id: emailReplies.id,
        originalEmailId: emailReplies.originalEmailId,
        replyEmailId: emailReplies.replyEmailId,
      })
      .from(emailReplies)
      .where(or(eq(emailReplies.originalEmailId, id), eq(emailReplies.replyEmailId, id)))
      .limit(1)
  }

  // Strategy 3: If still no reply found, the ID might be a threadId
  if (!reply[0]) {
    const threadsEmails = await db
      .select({
        id: emails.id,
        threadId: emails.threadId,
      })
      .from(emails)
      .where(eq(emails.threadId, id))

    const emailIds = threadsEmails.map((e) => e.id)

    if (emailIds.length > 0) {
      const replies = await db
        .select({
          id: emailReplies.id,
          originalEmailId: emailReplies.originalEmailId,
          replyEmailId: emailReplies.replyEmailId,
        })
        .from(emailReplies)
        .where(
          or(
            inArray(emailReplies.originalEmailId, emailIds),
            inArray(emailReplies.replyEmailId, emailIds),
          ),
        )

      // Delete all email_replies in this thread
      if (replies.length > 0) {
        const replyIdsToDelete = replies.map((r) => r.id)
        await db.delete(emailReplies).where(inArray(emailReplies.id, replyIdsToDelete))
      }

      // Delete ALL emails in this thread
      await db.delete(emails).where(eq(emails.threadId, id))
      return
    }
  }

  if (reply[0]) {
    // Delete the reply record
    await db.delete(emailReplies).where(eq(emailReplies.id, reply[0].id))

    // Cascade delete: Delete associated emails
    const emailIdsToDelete = [reply[0].originalEmailId, reply[0].replyEmailId]
    await db.delete(emails).where(inArray(emails.id, emailIdsToDelete))
  }
}

/**
 * Bulk delete email replies and their associated emails (cascade delete)
 * Accepts email_replies IDs, emails IDs, or threadIds
 */
export async function bulkDeleteEmailReplies(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0

  // Strategy 1: Try to find replies by their ID
  let replies = await db
    .select({
      id: emailReplies.id,
      originalEmailId: emailReplies.originalEmailId,
      replyEmailId: emailReplies.replyEmailId,
    })
    .from(emailReplies)
    .where(inArray(emailReplies.id, ids))

  // Strategy 2: If no replies found, the IDs might be email IDs
  if (replies.length === 0) {
    replies = await db
      .select({
        id: emailReplies.id,
        originalEmailId: emailReplies.originalEmailId,
        replyEmailId: emailReplies.replyEmailId,
      })
      .from(emailReplies)
      .where(
        or(inArray(emailReplies.originalEmailId, ids), inArray(emailReplies.replyEmailId, ids)),
      )
  }

  // Strategy 3: If still no replies found, the IDs might be threadIds
  // Find all emails in these threads, then find their associated email_replies
  if (replies.length === 0) {
    const threadsEmails = await db
      .select({
        id: emails.id,
        threadId: emails.threadId,
      })
      .from(emails)
      .where(inArray(emails.threadId, ids))

    const emailIds = threadsEmails.map((e) => e.id)

    if (emailIds.length > 0) {
      replies = await db
        .select({
          id: emailReplies.id,
          originalEmailId: emailReplies.originalEmailId,
          replyEmailId: emailReplies.replyEmailId,
        })
        .from(emailReplies)
        .where(
          or(
            inArray(emailReplies.originalEmailId, emailIds),
            inArray(emailReplies.replyEmailId, emailIds),
          ),
        )

      // If we found replies via threadId, we need to delete ALL emails in the threads
      // not just the ones associated with email_replies
      const replyIdsToDelete = replies.map((r) => r.id)

      // Delete all email_replies in these threads
      if (replyIdsToDelete.length > 0) {
        await db.delete(emailReplies).where(inArray(emailReplies.id, replyIdsToDelete))
      }

      // Delete ALL emails in these threads (this is the key difference)
      await db.delete(emails).where(inArray(emails.threadId, ids))

      return ids.length // Return number of threads deleted
    }
  }

  if (replies.length === 0) return 0

  // Extract reply IDs for deletion
  const replyIdsToDelete = replies.map((r) => r.id)

  // Delete the reply records
  await db.delete(emailReplies).where(inArray(emailReplies.id, replyIdsToDelete))

  // Cascade delete: Collect all associated email IDs and delete them
  const emailIdsToDelete: string[] = []
  for (const reply of replies) {
    emailIdsToDelete.push(reply.originalEmailId, reply.replyEmailId)
  }

  // Remove duplicates and delete
  const uniqueEmailIds = [...new Set(emailIdsToDelete)]
  if (uniqueEmailIds.length > 0) {
    await db.delete(emails).where(inArray(emails.id, uniqueEmailIds))
  }

  return replies.length
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
