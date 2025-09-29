import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { Elysia, t } from 'elysia'
import { db } from '../db/index'
import { userEmailAccounts } from '../db/schema/email-accounts'
import { emailEvents, emails } from '../db/schema/emails'
import { leads } from '../db/schema/leads'
import { sequences } from '../db/schema/sequences'
import { workspaces } from '../db/schema/workspaces'
import { emailService } from '../services/email.service'
import { errorResponse, ResponseCode } from '../types/response.types'

// Email Schema
const emailSchema = t.Object({
  workspaceId: t.String({ format: 'uuid' }),
  userEmailAccountId: t.String({ format: 'uuid' }),
  leadId: t.Optional(t.String({ format: 'uuid' })),
  sequenceId: t.Optional(t.String({ format: 'uuid' })),
  stepId: t.Optional(t.String({ format: 'uuid' })),
  direction: t.Union([t.Literal('outbound'), t.Literal('inbound')]),
  fromEmail: t.String({ format: 'email', maxLength: 255 }),
  toEmail: t.String({ format: 'email', maxLength: 255 }),
  ccEmails: t.Optional(t.Array(t.String())),
  bccEmails: t.Optional(t.Array(t.String())),
  subject: t.Optional(t.String({ maxLength: 500 })),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  status: t.Optional(
    t.Union([
      t.Literal('draft'),
      t.Literal('scheduled'),
      t.Literal('queued'),
      t.Literal('sent'),
      t.Literal('delivered'),
      t.Literal('opened'),
      t.Literal('clicked'),
      t.Literal('replied'),
      t.Literal('bounced'),
      t.Literal('failed'),
      t.Literal('spam'),
      t.Literal('unsubscribed'),
    ]),
  ),
  scheduledAt: t.Optional(t.String()),
})

// Send Email Schema
const sendEmailSchema = t.Object({
  workspaceId: t.String({ format: 'uuid' }),
  userEmailAccountId: t.String({ format: 'uuid' }),
  toEmail: t.String({ format: 'email', maxLength: 255 }),
  subject: t.String({ minLength: 1, maxLength: 500 }),
  bodyText: t.Optional(t.String()),
  bodyHtml: t.Optional(t.String()),
  ccEmails: t.Optional(t.Array(t.String({ format: 'email' }))),
  bccEmails: t.Optional(t.Array(t.String({ format: 'email' }))),
  leadId: t.Optional(t.String({ format: 'uuid' })),
  sequenceId: t.Optional(t.String({ format: 'uuid' })),
  stepId: t.Optional(t.String({ format: 'uuid' })),
  replyTo: t.Optional(t.String({ format: 'email' })),
  inReplyTo: t.Optional(t.String()),
  references: t.Optional(t.Array(t.String())),
  scheduledAt: t.Optional(t.String()), // ISO 8601 datetime for scheduled sending
})

export const emailRoutes = new Elysia({ prefix: '/api/v1/emails' })
  // Send email via SendGrid
  .post(
    '/send',
    async ({ body, set }) => {
      try {
        // Get email account details
        const [emailAccount] = await db
          .select({
            id: userEmailAccounts.id,
            emailAddress: userEmailAccounts.emailAddress,
            displayName: userEmailAccounts.displayName,
            apiKey: userEmailAccounts.apiKey,
            status: userEmailAccounts.status,
            workspaceId: userEmailAccounts.workspaceId,
          })
          .from(userEmailAccounts)
          .where(eq(userEmailAccounts.id, body.userEmailAccountId))
          .limit(1)

        if (!emailAccount) {
          set.status = 404
          return errorResponse('이메일 계정을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
        }

        if (emailAccount.status !== 'active') {
          set.status = 400
          return errorResponse('이메일 계정이 활성화되어 있지 않습니다.', ResponseCode.BAD_REQUEST)
        }

        if (emailAccount.workspaceId !== body.workspaceId) {
          set.status = 403
          return errorResponse('워크스페이스 권한이 없습니다.', ResponseCode.FORBIDDEN)
        }

        // Create email record in DB with 'queued' status
        const [newEmail] = await db
          .insert(emails)
          .values({
            workspaceId: body.workspaceId,
            userEmailAccountId: body.userEmailAccountId,
            leadId: body.leadId || null,
            sequenceId: body.sequenceId || null,
            stepId: body.stepId || null,
            direction: 'outbound',
            fromEmail: emailAccount.emailAddress,
            toEmail: body.toEmail,
            ccEmails: body.ccEmails || null,
            bccEmails: body.bccEmails || null,
            subject: body.subject,
            bodyText: body.bodyText || null,
            bodyHtml: body.bodyHtml || null,
            status: body.scheduledAt ? 'scheduled' : 'queued',
            scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
            inReplyTo: body.inReplyTo || null,
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

        // If scheduled, don't send now
        if (body.scheduledAt) {
          return {
            success: true,
            email: newEmail,
            message: '이메일이 예약되었습니다.',
          }
        }

        // Send email via SendGrid
        const sendResult = await emailService.sendEmail({
          fromEmail: emailAccount.emailAddress,
          fromName: emailAccount.displayName || emailAccount.emailAddress,
          toEmail: body.toEmail,
          subject: body.subject,
          bodyText: body.bodyText,
          bodyHtml: body.bodyHtml,
          ccEmails: body.ccEmails,
          bccEmails: body.bccEmails,
          replyTo: body.replyTo,
          inReplyTo: body.inReplyTo,
          references: body.references,
          apiKey: emailAccount.apiKey,
        })

        // Update email record with send result
        if (sendResult.success) {
          await db
            .update(emails)
            .set({
              status: 'sent',
              sentAt: new Date(),
              sendgridMessageId: sendResult.messageId || null,
              updatedAt: new Date(),
            })
            .where(eq(emails.id, newEmail.id))

          // Update sent count for email account
          await db
            .update(userEmailAccounts)
            .set({
              dailySentCount: sql`${userEmailAccounts.dailySentCount} + 1`,
              monthlySentCount: sql`${userEmailAccounts.monthlySentCount} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(userEmailAccounts.id, body.userEmailAccountId))

          return {
            success: true,
            email: {
              ...newEmail,
              status: 'sent',
              sentAt: new Date(),
              sendgridMessageId: sendResult.messageId,
            },
            message: '이메일이 발송되었습니다.',
          }
        } else {
          // Update email record with failure
          await db
            .update(emails)
            .set({
              status: 'failed',
              errorMessage: sendResult.error || '발송 실패',
              updatedAt: new Date(),
            })
            .where(eq(emails.id, newEmail.id))

          set.status = 500
          return errorResponse(
            sendResult.error || '이메일 발송에 실패했습니다.',
            ResponseCode.INTERNAL_SERVER_ERROR,
          )
        }
      } catch (error: any) {
        console.error('이메일 발송 중 오류:', error)
        set.status = 500
        return errorResponse(
          '이메일 발송 중 오류가 발생했습니다.',
          ResponseCode.INTERNAL_SERVER_ERROR,
        )
      }
    },
    {
      body: sendEmailSchema,
    },
  )

  // Search emails with filters
  .get(
    '/search',
    async ({ query }) => {
      const limit = parseInt(query.limit || '10', 10)
      const offset = parseInt(query.offset || '0', 10)

      const conditions = []

      if (query.status) {
        conditions.push(eq(emails.status, query.status as any))
      }

      if (query.direction) {
        conditions.push(eq(emails.direction, query.direction as any))
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
        conditions.push(
          or(
            ilike(emails.subject, `%${query.search}%`),
            ilike(emails.fromEmail, `%${query.search}%`),
            ilike(emails.toEmail, `%${query.search}%`),
          )!,
        )
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

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
          leadCompanyName: leads.companyName,
          sequenceName: sequences.name,
        })
        .from(emails)
        .leftJoin(leads, eq(emails.leadId, leads.id))
        .leftJoin(sequences, eq(emails.sequenceId, sequences.id))
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

  // Get email by ID
  .get(
    '/:id',
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
        return errorResponse('이메일을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }

      return result[0]
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Create email
  .post(
    '/',
    async ({ body }) => {
      const [newEmail] = await db.insert(emails).values(body).returning({
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
    '/:id/status',
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
        return errorResponse('이메일을 찾을 수 없습니다.', ResponseCode.NOT_FOUND)
      }

      return updatedEmail
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
      body: t.Object({
        status: t.Union([
          t.Literal('draft'),
          t.Literal('scheduled'),
          t.Literal('queued'),
          t.Literal('sent'),
          t.Literal('delivered'),
          t.Literal('opened'),
          t.Literal('clicked'),
          t.Literal('replied'),
          t.Literal('bounced'),
          t.Literal('failed'),
          t.Literal('spam'),
          t.Literal('unsubscribed'),
        ]),
      }),
    },
  )

  // Delete email
  .delete(
    '/:id',
    async ({ params: { id } }) => {
      await db.delete(emails).where(eq(emails.id, id))
      return { success: true, message: '이메일이 삭제되었습니다.' }
    },
    {
      params: t.Object({
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Get email events
  .get(
    '/:id/events',
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
        id: t.String({ format: 'uuid' }),
      }),
    },
  )

  // Webhook endpoint for email events (SendGrid)
  .post('/webhook', async ({ body }) => {
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
      const updateData: any = {
        updatedAt: new Date(),
      }

      switch (event.event) {
        case 'delivered':
          updateData.status = 'delivered'
          updateData.deliveredAt = new Date(event.timestamp * 1000)
          break
        case 'open':
          updateData.status = 'opened'
          updateData.openedAt = updateData.openedAt || new Date(event.timestamp * 1000)
          updateData.openCount = sql`${emails.openCount} + 1`
          break
        case 'click':
          updateData.status = 'clicked'
          updateData.clickedAt = updateData.clickedAt || new Date(event.timestamp * 1000)
          updateData.clickCount = sql`${emails.clickCount} + 1`
          break
        case 'bounce':
          updateData.status = 'bounced'
          updateData.bounceType = event.bounce_classification
          updateData.bounceReason = event.reason
          break
        case 'dropped':
        case 'deferred':
          updateData.status = 'failed'
          updateData.errorMessage = event.reason
          break
        case 'spam_report':
          updateData.status = 'spam'
          updateData.spamReportedAt = new Date(event.timestamp * 1000)
          break
        case 'unsubscribe':
          updateData.status = 'unsubscribed'
          updateData.unsubscribedAt = new Date(event.timestamp * 1000)
          break
      }

      await db.update(emails).set(updateData).where(eq(emails.id, email.id))
    }

    return { success: true, processed: events.length }
  })

// Admin bulk routes
export const adminEmailRoutes = new Elysia({ prefix: '/api/v1/admin/emails' })
  // Bulk update status
  .put(
    '/bulk/status',
    async ({ body }) => {
      const result = await db
        .update(emails)
        .set({
          status: body.status,
          updatedAt: new Date(),
        })
        .where(or(...body.emailIds.map((id) => eq(emails.id, id)))!)
        .returning({ id: emails.id })

      return { updatedCount: result.length }
    },
    {
      body: t.Object({
        emailIds: t.Array(t.String({ format: 'uuid' })),
        status: t.Union([
          t.Literal('draft'),
          t.Literal('scheduled'),
          t.Literal('queued'),
          t.Literal('sent'),
          t.Literal('delivered'),
          t.Literal('opened'),
          t.Literal('clicked'),
          t.Literal('replied'),
          t.Literal('bounced'),
          t.Literal('failed'),
          t.Literal('spam'),
          t.Literal('unsubscribed'),
        ]),
      }),
    },
  )

  // Bulk delete
  .delete(
    '/bulk',
    async ({ body }) => {
      const result = await db
        .delete(emails)
        .where(or(...body.emailIds.map((id) => eq(emails.id, id)))!)
        .returning({ id: emails.id })

      return { deletedCount: result.length }
    },
    {
      body: t.Object({
        emailIds: t.Array(t.String({ format: 'uuid' })),
      }),
    },
  )
