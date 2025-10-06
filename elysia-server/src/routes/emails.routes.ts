import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailEvents, emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import { sequences } from "../db/schema/sequences"
import { workspaces } from "../db/schema/workspaces"
import { emailService } from "../services/email.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import logger from "../utils/logger"

// Email Schema
const emailSchema = t.Object({
  workspaceId: t.String({ format: "uuid" }),
  userEmailAccountId: t.String({ format: "uuid" }),
  leadId: t.Optional(t.String({ format: "uuid" })),
  sequenceId: t.Optional(t.String({ format: "uuid" })),
  stepId: t.Optional(t.String({ format: "uuid" })),
  direction: t.Union([t.Literal("outbound"), t.Literal("inbound")]),
  fromEmail: t.String({ format: "email", maxLength: 255 }),
  toEmail: t.String({ format: "email", maxLength: 255 }),
  ccEmails: t.Optional(t.Array(t.String())),
  bccEmails: t.Optional(t.Array(t.String())),
  subject: t.Optional(t.String({ maxLength: 500 })),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal("draft"),
      t.Literal("scheduled"),
      t.Literal("queued"),
      t.Literal("sent"),
      t.Literal("delivered"),
      t.Literal("opened"),
      t.Literal("clicked"),
      t.Literal("replied"),
      t.Literal("bounced"),
      t.Literal("failed"),
      t.Literal("spam"),
      t.Literal("unsubscribed"),
    ]),
  ),
  scheduledAt: t.Optional(t.String()),
})

// Send Email Schema
const sendEmailSchema = t.Object({
  toEmail: t.String({ format: "email", maxLength: 255 }),
  subject: t.String({ minLength: 1, maxLength: 500 }),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  ccEmails: t.Optional(t.Array(t.String({ format: "email" }))),
  bccEmails: t.Optional(t.Array(t.String({ format: "email" }))),
  fromName: t.Optional(t.String({ maxLength: 255 })),
  leadId: t.Optional(t.String({ format: "uuid" })),
  sequenceId: t.Optional(t.String({ format: "uuid" })),
  stepId: t.Optional(t.String({ format: "uuid" })),
  replyTo: t.Optional(t.String({ format: "email" })),
  inReplyTo: t.Optional(t.String()),
  references: t.Optional(t.Array(t.String())),
  scheduledAt: t.Optional(t.String()), // ISO 8601 datetime for scheduled sending
  // Required fields for user_email_accounts integration
  workspaceId: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
})

export const emailRoutes = new Elysia({ prefix: "/api/v1/emails" })
  // Send email via SendGrid (using user_email_accounts)
  .post(
    "/send",
    async ({ body, set }) => {
      try {
        // Find user's email account by workspaceId and userId
        const [emailAccount] = await db
          .select({
            id: userEmailAccounts.id,
            emailAddress: userEmailAccounts.emailAddress,
            displayName: userEmailAccounts.displayName,
            apiKey: userEmailAccounts.apiKey,
            status: userEmailAccounts.status,
            isVerified: userEmailAccounts.isVerified,
          })
          .from(userEmailAccounts)
          .where(
            and(
              eq(userEmailAccounts.workspaceId, body.workspaceId),
              eq(userEmailAccounts.userId, body.userId),
              eq(userEmailAccounts.status, "active"),
            ),
          )
          .limit(1)

        if (!emailAccount) {
          set.status = 404
          return errorResponse(
            "해당 워크스페이스와 사용자에 대한 활성화된 이메일 계정을 찾을 수 없습니다.",
            ResponseCode.NOT_FOUND,
          )
        }

        if (!emailAccount.isVerified) {
          set.status = 400
          return errorResponse(
            "이메일 계정이 인증되지 않았습니다. 먼저 이메일 계정을 인증해주세요.",
            ResponseCode.VALIDATION_ERROR,
          )
        }

        const fromEmail = emailAccount.emailAddress
        const fromName = body.fromName || emailAccount.displayName || emailAccount.emailAddress
        const apiKey = emailAccount.apiKey

        logger.info(
          {
            from: `${fromName} <${fromEmail}>`,
            to: body.toEmail,
            subject: body.subject,
            workspaceId: body.workspaceId,
            userId: body.userId,
          },
          "Sending email",
        )

        // If scheduled, save to database
        if (body.scheduledAt) {
          logger.info({ scheduledAt: body.scheduledAt }, "Scheduling email")

          try {
            // Insert into database with 'scheduled' status
            const [newEmail] = await db
              .insert(emails)
              .values({
                workspaceId: body.workspaceId,
                userEmailAccountId: emailAccount.id,
                direction: "outbound",
                fromEmail: fromEmail,
                toEmail: body.toEmail,
                subject: body.subject,
                bodyText: body.bodyText || null,
                bodyHtml: body.bodyHtml || null,
                ccEmails: body.ccEmails || null,
                bccEmails: body.bccEmails || null,
                status: "scheduled",
                scheduledAt: new Date(body.scheduledAt),
                leadId: body.leadId || null,
                sequenceId: body.sequenceId || null,
                stepId: body.stepId || null,
              })
              .returning()

            if (!newEmail) {
              set.status = 500
              return errorResponse("이메일 저장에 실패했습니다", ResponseCode.INTERNAL_ERROR)
            }

            logger.info({ emailId: newEmail.id }, "Email scheduled successfully")

            return {
              success: true,
              email: newEmail,
              message: "이메일이 예약되었습니다.",
            }
          } catch (error: unknown) {
            logger.error({ err: error }, "Failed to schedule email")
            throw new Error("이메일 예약 중 오류가 발생했습니다.")
          }
        }

        // Get lead and sequence info for denormalization
        let leadName = null
        let leadEmail = null
        let sequenceName = null

        if (body.leadId) {
          const [lead] = await db
            .select({ companyName: leads.companyName })
            .from(leads)
            .where(eq(leads.id, body.leadId))
            .limit(1)
          if (lead) {
            leadName = lead.companyName
            // leadEmail is stored separately in lead_contacts table, leaving as null for now
            leadEmail = null
          }
        }

        if (body.sequenceId) {
          const [sequence] = await db
            .select({ name: sequences.name })
            .from(sequences)
            .where(eq(sequences.id, body.sequenceId))
            .limit(1)
          if (sequence) {
            sequenceName = sequence.name
          }
        }

        // Send email via SendGrid
        const sendResult = await emailService.sendEmail({
          fromEmail: fromEmail,
          fromName: fromName,
          toEmail: body.toEmail,
          subject: body.subject,
          bodyText: body.bodyText,
          bodyHtml: body.bodyHtml,
          ccEmails: body.ccEmails,
          bccEmails: body.bccEmails,
          replyTo: body.replyTo,
          inReplyTo: body.inReplyTo,
          references: body.references,
          apiKey: apiKey,
        })

        if (!sendResult.success) {
          logger.error({ error: sendResult.error }, "Email send failed")
          set.status = 500
          return errorResponse(
            sendResult.error || "이메일 발송에 실패했습니다.",
            ResponseCode.INTERNAL_ERROR,
          )
        }

        // Determine threadId: use messageId as threadId for first email, inherit for replies
        let threadId = sendResult.messageId // First email: messageId becomes threadId

        if (body.inReplyTo) {
          // This is a reply, find original email's threadId
          const [originalEmail] = await db
            .select({ threadId: emails.threadId })
            .from(emails)
            .where(eq(emails.messageId, body.inReplyTo))
            .limit(1)

          if (originalEmail?.threadId) {
            threadId = originalEmail.threadId // Inherit threadId from original
          }
        }

        // Save to database with optimized structure
        const savedEmails = await db
          .insert(emails)
          .values({
            workspaceId: body.workspaceId,
            userEmailAccountId: emailAccount.id,
            leadId: body.leadId || null,
            sequenceId: body.sequenceId || null,
            stepId: body.stepId || null,
            direction: "outbound",
            fromEmail: fromEmail,
            toEmail: body.toEmail,
            subject: body.subject,
            bodyText: body.bodyText || null,
            bodyHtml: body.bodyHtml || null,
            ccEmails: body.ccEmails || null,
            bccEmails: body.bccEmails || null,
            status: "sent",
            sentAt: new Date(),
            messageId: sendResult.messageId,
            sendgridMessageId: sendResult.sendgridMessageId,
            inReplyTo: body.inReplyTo || null,
            threadId: threadId, // Optimized threading
            // Denormalized fields for performance
            leadName: leadName,
            leadEmail: leadEmail,
            sequenceName: sequenceName,
          })
          .returning()

        const savedEmail = savedEmails[0]
        if (!savedEmail) {
          set.status = 500
          return errorResponse("이메일 저장에 실패했습니다", ResponseCode.INTERNAL_ERROR)
        }

        logger.info(
          { emailId: savedEmail.id, messageId: sendResult.messageId },
          "Email sent and saved successfully",
        )

        return {
          success: true,
          email: savedEmail,
          message: "이메일이 발송되었습니다.",
        }
      } catch (error: unknown) {
        logger.error({ err: error }, "Error sending email")
        set.status = 500
        return errorResponse("이메일 발송 중 오류가 발생했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      body: sendEmailSchema,
    },
  )

  // Search emails with filters
  .get(
    "/search",
    async ({ query }) => {
      const limit = parseInt(query.limit || "10", 10)
      const offset = parseInt(query.offset || "0", 10)

      const conditions = []

      if (query.status) {
        conditions.push(
          eq(
            emails.status,
            query.status as
              | "draft"
              | "scheduled"
              | "queued"
              | "sent"
              | "delivered"
              | "opened"
              | "clicked"
              | "replied"
              | "bounced"
              | "failed"
              | "spam"
              | "unsubscribed",
          ),
        )
      }

      if (query.direction) {
        conditions.push(eq(emails.direction, query.direction as "outbound" | "inbound"))
      }

      if (query.workspaceId) {
        conditions.push(eq(emails.workspaceId, query.workspaceId))
      }

      if (query.leadId) {
        conditions.push(eq(emails.leadId, query.leadId))
      }

      if (query.sequenceId) {
        conditions.push(eq(emails.sequenceId, query.sequenceId))
      }

      if (query.search) {
        const searchCondition = or(
          ilike(emails.subject, `%${query.search}%`),
          ilike(emails.fromEmail, `%${query.search}%`),
          ilike(emails.toEmail, `%${query.search}%`),
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      // OPTIMIZED: Use denormalized fields instead of JOINs
      const result = await db
        .select({
          id: emails.id,
          workspaceId: emails.workspaceId,
          direction: emails.direction,
          fromEmail: emails.fromEmail,
          toEmail: emails.toEmail,
          subject: emails.subject,
          status: emails.status,
          sentAt: emails.sentAt,
          deliveredAt: emails.deliveredAt,
          openedAt: emails.openedAt,
          clickedAt: emails.clickedAt,
          openCount: emails.openCount,
          clickCount: emails.clickCount,
          createdAt: emails.createdAt,
          threadId: emails.threadId,
          // Use denormalized fields (no JOINs!)
          leadCompanyName: emails.leadName,
          sequenceName: emails.sequenceName,
        })
        .from(emails)
        .where(whereClause)
        .orderBy(desc(emails.createdAt))
        .limit(limit)
        .offset(offset)

      const countResult = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(emails)
        .where(whereClause)

      const total = countResult[0]?.count ?? 0

      return {
        data: result,
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        direction: t.Optional(t.String()),
        workspaceId: t.Optional(t.String()),
        leadId: t.Optional(t.String()),
        sequenceId: t.Optional(t.String()),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Search replied emails with filters - THREAD-BASED (스레드 기반)
  .get(
    "/search-replied",
    async ({ query }) => {
      const workspaceId = query.workspaceId
      const limit = parseInt(query.limit || "20", 10)
      const offset = parseInt(query.offset || "0", 10)

      // Filters
      const statusFilter = query.status
      const leadIdFilter = query.leadId
      const sequenceIdFilter = query.sequenceId
      const searchFilter = query.search

      if (!workspaceId) {
        return {
          data: [],
          total: 0,
          limit,
          offset,
        }
      }

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Request received",
        query: {
          workspaceId,
          limit,
          offset,
          statusFilter,
          leadIdFilter,
          sequenceIdFilter,
          searchFilter,
        },
      })

      // Step 1: Find threadIds that have at least one inbound message (replies)
      const inboundConditions = [eq(emails.direction, "inbound")]

      if (workspaceId !== "all") {
        inboundConditions.push(eq(emails.workspaceId, workspaceId))
      }

      const repliedThreadIds = await db
        .selectDistinct({ threadId: emails.threadId })
        .from(emails)
        .where(and(...inboundConditions))

      const threadIdsList = repliedThreadIds
        .map((t) => t.threadId)
        .filter((id): id is string => !!id)

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Found threads with replies",
        threadIdsCount: threadIdsList.length,
        threadIds: threadIdsList.slice(0, 10), // Log first 10 for debugging
      })

      if (threadIdsList.length === 0) {
        return {
          data: [],
          total: 0,
          limit,
          offset,
        }
      }

      // Step 2: Build filter conditions for all emails in replied threads
      const conditions = [inArray(emails.threadId, threadIdsList)]

      if (workspaceId !== "all") {
        conditions.push(eq(emails.workspaceId, workspaceId))
      }

      if (statusFilter && statusFilter !== "all") {
        conditions.push(
          eq(
            emails.status,
            statusFilter as
              | "draft"
              | "scheduled"
              | "queued"
              | "sent"
              | "delivered"
              | "opened"
              | "clicked"
              | "replied"
              | "bounced"
              | "failed"
              | "spam"
              | "unsubscribed",
          ),
        )
      }
      if (leadIdFilter) {
        conditions.push(eq(emails.leadId, leadIdFilter))
      }
      if (sequenceIdFilter) {
        conditions.push(eq(emails.sequenceId, sequenceIdFilter))
      }
      if (searchFilter) {
        const searchCondition = or(
          ilike(emails.subject, `%${searchFilter}%`),
          ilike(emails.fromEmail, `%${searchFilter}%`),
          ilike(emails.leadName, `%${searchFilter}%`),
        )
        if (searchCondition) {
          conditions.push(searchCondition)
        }
      }

      const whereClause = and(...conditions)

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Conditions built",
        conditionsCount: conditions.length,
        hasWorkspaceFilter: workspaceId !== "all",
        hasStatusFilter: statusFilter && statusFilter !== "all",
        hasLeadFilter: !!leadIdFilter,
        hasSequenceFilter: !!sequenceIdFilter,
        hasSearchFilter: !!searchFilter,
      })

      // Step 3: Get threads with their latest message (스레드별 최신 메시지 - any direction)
      // Use subquery to get latest email per thread
      const threadsQuery = db
        .select({
          threadId: emails.threadId,
          latestCreatedAt: sql<Date>`MAX(${emails.createdAt})`.as("latest_created_at"),
        })
        .from(emails)
        .where(whereClause)
        .groupBy(emails.threadId)
        .orderBy(desc(sql`MAX(${emails.createdAt})`))
        .limit(limit)
        .offset(offset)
        .as("threads")

      // Get full email details for latest message in each thread
      const threadEmails = await db
        .select({
          id: emails.id,
          threadId: emails.threadId,
          workspaceId: emails.workspaceId,
          fromEmail: emails.fromEmail,
          toEmail: emails.toEmail,
          subject: emails.subject,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
          status: emails.status,
          repliedAt: emails.repliedAt,
          deliveredAt: emails.deliveredAt,
          openedAt: emails.openedAt,
          createdAt: emails.createdAt,
          updatedAt: emails.updatedAt,
          leadName: emails.leadName,
          leadEmail: emails.leadEmail,
          sequenceName: emails.sequenceName,
          leadId: emails.leadId,
          sequenceId: emails.sequenceId,
        })
        .from(emails)
        .innerJoin(threadsQuery, eq(emails.threadId, threadsQuery.threadId))
        .where(eq(emails.createdAt, threadsQuery.latestCreatedAt))

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Thread emails fetched",
        threadEmailsCount: threadEmails.length,
        threadIds: threadEmails.map((e) => e.threadId),
      })

      // Get message count for each thread
      const threadCounts = await db
        .select({
          threadId: emails.threadId,
          messageCount: sql<number>`COUNT(*)`.as("message_count"),
        })
        .from(emails)
        .where(whereClause)
        .groupBy(emails.threadId)

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Thread counts fetched",
        threadCountsCount: threadCounts.length,
        counts: threadCounts.map((tc) => ({ threadId: tc.threadId, count: tc.messageCount })),
      })

      // Combine data
      const threadsWithCounts = threadEmails.map((email) => {
        const countData = threadCounts.find((tc) => tc.threadId === email.threadId)
        return {
          ...email,
          messageCount: Number(countData?.messageCount || 1),
        }
      })

      // Count total threads (only threads with inbound replies)
      const totalThreadsResult = await db
        .select({ count: sql<number>`COUNT(DISTINCT ${emails.threadId})` })
        .from(emails)
        .where(whereClause)

      const totalCount = totalThreadsResult[0]?.count || 0

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Final result",
        dataCount: threadsWithCounts.length,
        totalThreads: totalCount,
        limit,
        offset,
      })

      return {
        data: threadsWithCounts,
        total: Number(totalCount),
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        workspaceId: t.String(), // "all" or UUID
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        leadId: t.Optional(t.String({ format: "uuid" })),
        sequenceId: t.Optional(t.String({ format: "uuid" })),
        search: t.Optional(t.String()),
      }),
    },
  )

  // Get emails in a specific thread (simplified for replied emails page)
  .get(
    "/thread/:threadId",
    async ({ params: { threadId }, query }) => {
      const workspaceId = query.workspaceId

      if (!threadId) {
        return { data: [] }
      }

      logger.info({
        msg: "✓ Fetching thread emails",
        threadId,
        workspaceId,
      })

      // Build where conditions
      const conditions = [eq(emails.threadId, threadId)]

      // If workspaceId is provided and not "all", filter by workspace
      if (workspaceId && workspaceId !== "all") {
        conditions.push(eq(emails.workspaceId, workspaceId))
      }

      // Get all emails in thread, ordered chronologically
      const threadEmails = await db
        .select({
          id: emails.id,
          direction: emails.direction,
          fromEmail: emails.fromEmail,
          toEmail: emails.toEmail,
          subject: emails.subject,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
          status: emails.status,
          sentAt: emails.sentAt,
          repliedAt: emails.repliedAt,
          deliveredAt: emails.deliveredAt,
          openedAt: emails.openedAt,
          createdAt: emails.createdAt,
          updatedAt: emails.updatedAt,
          threadId: emails.threadId,
          inReplyTo: emails.inReplyTo,
          messageId: emails.messageId,
          leadName: emails.leadName,
          leadEmail: emails.leadEmail,
          sequenceName: emails.sequenceName,
          leadId: emails.leadId,
          sequenceId: emails.sequenceId,
          workspaceId: emails.workspaceId,
        })
        .from(emails)
        .where(and(...conditions))
        .orderBy(asc(emails.createdAt))

      return { data: threadEmails }
    },
    {
      params: t.Object({
        threadId: t.String(),
      }),
      query: t.Object({
        workspaceId: t.Optional(t.String()), // "all" or UUID or undefined
      }),
    },
  )

  // Get email by ID
  .get(
    "/:id",
    async ({ params: { id }, set }) => {
      const result = await db
        .select({
          id: emails.id,
          workspaceId: emails.workspaceId,
          userEmailAccountId: emails.userEmailAccountId,
          leadId: emails.leadId,
          sequenceId: emails.sequenceId,
          stepId: emails.stepId,
          direction: emails.direction,
          fromEmail: emails.fromEmail,
          toEmail: emails.toEmail,
          ccEmails: emails.ccEmails,
          bccEmails: emails.bccEmails,
          subject: emails.subject,
          bodyText: emails.bodyText,
          bodyHtml: emails.bodyHtml,
          status: emails.status,
          scheduledAt: emails.scheduledAt,
          sentAt: emails.sentAt,
          deliveredAt: emails.deliveredAt,
          openedAt: emails.openedAt,
          clickedAt: emails.clickedAt,
          repliedAt: emails.repliedAt,
          bounceType: emails.bounceType,
          bounceReason: emails.bounceReason,
          errorMessage: emails.errorMessage,
          sendgridMessageId: emails.sendgridMessageId,
          messageId: emails.messageId,
          inReplyTo: emails.inReplyTo,
          threadId: emails.threadId,
          openCount: emails.openCount,
          clickCount: emails.clickCount,
          unsubscribedAt: emails.unsubscribedAt,
          spamReportedAt: emails.spamReportedAt,
          retryCount: emails.retryCount,
          lastRetryAt: emails.lastRetryAt,
          createdAt: emails.createdAt,
          updatedAt: emails.updatedAt,
          workspaceName: workspaces.name,
          leadCompanyName: leads.companyName,
          emailAccountAddress: userEmailAccounts.emailAddress,
        })
        .from(emails)
        .innerJoin(workspaces, eq(emails.workspaceId, workspaces.id))
        .innerJoin(userEmailAccounts, eq(emails.userEmailAccountId, userEmailAccounts.id))
        .leftJoin(leads, eq(emails.leadId, leads.id))
        .where(eq(emails.id, id))
        .limit(1)

      if (!result[0]) {
        set.status = 404
        return errorResponse("이메일을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      return result[0]
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Create email
  .post(
    "/",
    async ({ body }) => {
      const [newEmail] = await db
        .insert(emails)
        .values({
          ...body,
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        })
        .returning({
          id: emails.id,
          workspaceId: emails.workspaceId,
          fromEmail: emails.fromEmail,
          toEmail: emails.toEmail,
          subject: emails.subject,
          status: emails.status,
          createdAt: emails.createdAt,
        })

      return newEmail
    },
    {
      body: emailSchema,
    },
  )

  // Update email status
  .patch(
    "/:id/status",
    async ({ params: { id }, body, set }) => {
      const [updatedEmail] = await db
        .update(emails)
        .set({
          status: body.status,
          updatedAt: new Date(),
        })
        .where(eq(emails.id, id))
        .returning({
          id: emails.id,
          status: emails.status,
          updatedAt: emails.updatedAt,
        })

      if (!updatedEmail) {
        set.status = 404
        return errorResponse("이메일을 찾을 수 없습니다.", ResponseCode.NOT_FOUND)
      }

      return updatedEmail
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal("draft"),
          t.Literal("scheduled"),
          t.Literal("queued"),
          t.Literal("sent"),
          t.Literal("delivered"),
          t.Literal("opened"),
          t.Literal("clicked"),
          t.Literal("replied"),
          t.Literal("bounced"),
          t.Literal("failed"),
          t.Literal("spam"),
          t.Literal("unsubscribed"),
        ]),
      }),
    },
  )

  // Delete email
  .delete(
    "/:id",
    async ({ params: { id } }) => {
      await db.delete(emails).where(eq(emails.id, id))
      return { success: true, message: "이메일이 삭제되었습니다." }
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Get email events
  .get(
    "/:id/events",
    async ({ params: { id } }) => {
      const events = await db
        .select({
          id: emailEvents.id,
          eventType: emailEvents.eventType,
          timestamp: emailEvents.timestamp,
          sendgridEventId: emailEvents.sendgridEventId,
          userAgent: emailEvents.userAgent,
          ipAddress: emailEvents.ipAddress,
          url: emailEvents.url,
          bounceType: emailEvents.bounceType,
          bounceReason: emailEvents.bounceReason,
          processed: emailEvents.processed,
          createdAt: emailEvents.createdAt,
        })
        .from(emailEvents)
        .where(eq(emailEvents.emailId, id))
        .orderBy(desc(emailEvents.timestamp))

      return events
    },
    {
      params: t.Object({
        id: t.String({ format: "uuid" }),
      }),
    },
  )

  // Webhook endpoint for email events (SendGrid)
  .post("/webhook", async ({ body }) => {
    // SendGrid sends events as an array
    const events = Array.isArray(body) ? body : [body]

    for (const event of events) {
      // Find email by sendgridMessageId
      const [email] = await db
        .select({ id: emails.id })
        .from(emails)
        .where(eq(emails.sendgridMessageId, event.sg_message_id))
        .limit(1)

      if (!email) continue

      // Insert event
      await db.insert(emailEvents).values({
        emailId: email.id,
        eventType: event.event,
        timestamp: new Date(event.timestamp * 1000),
        sendgridEventId: event.sg_event_id,
        userAgent: event.useragent,
        ipAddress: event.ip,
        url: event.url,
        bounceType: event.bounce_classification,
        bounceReason: event.reason,
        smtpResponse: event.response,
        rawEventData: event,
      })

      // Update email status based on event
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      switch (event.event) {
        case "delivered":
          updateData.status = "delivered"
          updateData.deliveredAt = new Date(event.timestamp * 1000)
          break
        case "open":
          updateData.status = "opened"
          updateData.openedAt = updateData.openedAt || new Date(event.timestamp * 1000)
          updateData.openCount = sql`${emails.openCount} + 1`
          break
        case "click":
          updateData.status = "clicked"
          updateData.clickedAt = updateData.clickedAt || new Date(event.timestamp * 1000)
          updateData.clickCount = sql`${emails.clickCount} + 1`
          break
        case "bounce":
          updateData.status = "bounced"
          updateData.bounceType = event.bounce_classification
          updateData.bounceReason = event.reason
          break
        case "dropped":
        case "deferred":
          updateData.status = "failed"
          updateData.errorMessage = event.reason
          break
        case "spam_report":
          updateData.status = "spam"
          updateData.spamReportedAt = new Date(event.timestamp * 1000)
          break
        case "unsubscribe":
          updateData.status = "unsubscribed"
          updateData.unsubscribedAt = new Date(event.timestamp * 1000)
          break
      }

      await db.update(emails).set(updateData).where(eq(emails.id, email.id))
    }

    return { success: true, processed: events.length }
  })

// Admin bulk routes
export const adminEmailRoutes = new Elysia({ prefix: "/api/v1/admin/emails" })
  // Bulk update status
  .put(
    "/bulk/status",
    async ({ body }) => {
      const idCondition = or(...body.emailIds.map((id) => eq(emails.id, id)))
      if (!idCondition) {
        return { updatedCount: 0 }
      }

      const result = await db
        .update(emails)
        .set({
          status: body.status,
          updatedAt: new Date(),
        })
        .where(idCondition)
        .returning({ id: emails.id })

      return { updatedCount: result.length }
    },
    {
      body: t.Object({
        emailIds: t.Array(t.String({ format: "uuid" })),
        status: t.Union([
          t.Literal("draft"),
          t.Literal("scheduled"),
          t.Literal("queued"),
          t.Literal("sent"),
          t.Literal("delivered"),
          t.Literal("opened"),
          t.Literal("clicked"),
          t.Literal("replied"),
          t.Literal("bounced"),
          t.Literal("failed"),
          t.Literal("spam"),
          t.Literal("unsubscribed"),
        ]),
      }),
    },
  )

  // Bulk delete
  .delete(
    "/bulk",
    async ({ body }) => {
      const idCondition = or(...body.emailIds.map((id) => eq(emails.id, id)))
      if (!idCondition) {
        return { deletedCount: 0 }
      }

      const result = await db.delete(emails).where(idCondition).returning({ id: emails.id })

      return { deletedCount: result.length }
    },
    {
      body: t.Object({
        emailIds: t.Array(t.String({ format: "uuid" })),
      }),
    },
  )
