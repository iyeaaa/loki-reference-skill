import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm"
import { Elysia, t } from "elysia"
import { db } from "../db/index"
import { userEmailAccounts } from "../db/schema/email-accounts"
import { emailEvents, emailReplies, emails } from "../db/schema/emails"
import { leads } from "../db/schema/leads"
import {
  sequenceEnrollments,
  sequenceStepExecutions,
  sequenceSteps,
  sequences,
} from "../db/schema/sequences"
import { workspaces } from "../db/schema/workspaces"
import type { SendGridAttachment } from "../models/email.model"
import { emailService } from "../services/email.service"
import * as leadService from "../services/lead.service"
import { errorResponse, ResponseCode } from "../types/response.types"
import { fixUtf8Encoding, parseEmailBody } from "../utils/email.util"
import { convertFilesToAttachments, getTotalFileSize, validateFileSize } from "../utils/file.util"
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
  // FormData로 전송 시 string이 될 수 있음
  references: t.Optional(t.Union([t.Array(t.String()), t.String()])),
  scheduledAt: t.Optional(t.String()), // ISO 8601 datetime for scheduled sending
  // FormData로 전송 시 string이 될 수 있음
  includeSignature: t.Optional(t.Union([t.Boolean(), t.String()])),
  files: t.Optional(t.Files()), // 첨부 파일
  // Required fields for user_email_accounts integration
  workspaceId: t.String({ format: "uuid" }),
  userId: t.String({ format: "uuid" }),
})

export const emailRoutes = new Elysia({ prefix: "/api/v1/emails" })
  // Get today's sent email count
  .get(
    "/stats/today-sent",
    async ({ query }) => {
      try {
        // Use Korea timezone (UTC+9) - more reliable calculation
        const now = new Date()
        const koreaOffset = 9 * 60 // 9 hours in minutes
        const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000)

        // Get start of today in Korea timezone
        const today = new Date(koreaTime)
        today.setHours(0, 0, 0, 0)

        // Get start of tomorrow in Korea timezone
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Convert back to UTC for database queries
        const todayUTC = new Date(today.getTime() - koreaOffset * 60 * 1000)
        const tomorrowUTC = new Date(tomorrow.getTime() - koreaOffset * 60 * 1000)

        const conditions = [
          eq(emails.direction, "outbound"),
          sql`${emails.sentAt} >= ${todayUTC}`,
          sql`${emails.sentAt} < ${tomorrowUTC}`,
        ]

        // Filter by workspace if provided
        if (query.workspaceId) {
          conditions.push(eq(emails.workspaceId, query.workspaceId))
        }

        const whereClause = and(...conditions)

        const result = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(emails)
          .where(whereClause)

        const todaySentCount = result[0]?.count ?? 0

        return {
          success: true,
          code: "S200",
          message: "정상 처리되었습니다.",
          data: {
            todaySentCount,
            date: koreaTime.toISOString().split("T")[0], // YYYY-MM-DD format in Korea timezone
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: query.workspaceId,
          },
          "Failed to get today's sent email count",
        )
        return errorResponse(
          "오늘 발송된 이메일 수 조회에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  // Get average open rate
  .get(
    "/stats/avg-open-rate",
    async ({ query }) => {
      try {
        const conditions = [eq(emails.direction, "outbound")]

        // Filter by workspace if provided
        if (query.workspaceId) {
          conditions.push(eq(emails.workspaceId, query.workspaceId))
        }

        const whereClause = and(...conditions)

        // OPTIMIZED: Single query to get both total sent and opened counts (all time)
        const statsResult = await db
          .select({
            totalSent: sql<number>`COUNT(*)::int`,
            openedCount: sql<number>`COUNT(DISTINCT CASE WHEN ${emails.openedAt} IS NOT NULL THEN ${emails.id} END)::int`,
          })
          .from(emails)
          .where(whereClause)

        const totalSent = statsResult[0]?.totalSent ?? 0
        const openedCount = statsResult[0]?.openedCount ?? 0

        // Calculate open rate
        const openRate = totalSent > 0 ? (openedCount / totalSent) * 100 : 0

        return {
          success: true,
          code: "S200",
          message: "정상 처리되었습니다.",
          data: {
            avgOpenRate: Math.round(openRate * 10) / 10, // Round to 1 decimal place
            totalSent,
            openedCount,
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: query.workspaceId,
          },
          "Failed to get average open rate",
        )
        return errorResponse("평균 오픈률 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  // Get recent sequence performance
  .get(
    "/stats/recent-sequences",
    async ({ query }) => {
      try {
        const limit = parseInt(query.limit || "4", 10)

        // OPTIMIZED: Single query with LEFT JOINs to get all metrics at once
        const sequencesWithMetrics = await db
          .select({
            id: sequences.id,
            name: sequences.name,
            status: sequences.status,
            createdAt: sequences.createdAt,
            sent: sql<number>`COALESCE(sent_stats.sent_count, 0)::int`,
            opened: sql<number>`COALESCE(opened_stats.opened_count, 0)::int`,
            clicked: sql<number>`COALESCE(clicked_stats.clicked_count, 0)::int`,
          })
          .from(sequences)
          .leftJoin(
            sql`(
              SELECT 
                sequence_id,
                COUNT(*) as sent_count
              FROM emails 
              WHERE direction = 'outbound'
              GROUP BY sequence_id
            ) as sent_stats`,
            sql`sent_stats.sequence_id = ${sequences.id}`,
          )
          .leftJoin(
            sql`(
              SELECT 
                sequence_id,
                COUNT(DISTINCT id) as opened_count
              FROM emails 
              WHERE direction = 'outbound' AND opened_at IS NOT NULL
              GROUP BY sequence_id
            ) as opened_stats`,
            sql`opened_stats.sequence_id = ${sequences.id}`,
          )
          .leftJoin(
            sql`(
              SELECT 
                sequence_id,
                COUNT(DISTINCT id) as clicked_count
              FROM emails 
              WHERE direction = 'outbound' AND clicked_at IS NOT NULL
              GROUP BY sequence_id
            ) as clicked_stats`,
            sql`clicked_stats.sequence_id = ${sequences.id}`,
          )
          .where(query.workspaceId ? eq(sequences.workspaceId, query.workspaceId) : undefined)
          .orderBy(desc(sequences.createdAt))
          .limit(limit)

        // Transform the results
        const result = sequencesWithMetrics.map((sequence) => ({
          id: sequence.id,
          name: sequence.name,
          status: sequence.status,
          createdAt: sequence.createdAt.toISOString(),
          sent: sequence.sent,
          opened: sequence.opened,
          clicked: sequence.clicked,
        }))

        return {
          success: true,
          code: "S200",
          message: "정상 처리되었습니다.",
          data: {
            sequences: result,
            total: result.length,
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error({ error }, "Failed to get recent sequence performance")
        return errorResponse("최근 시퀀스 성과 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
        limit: t.Optional(t.String()),
      }),
    },
  )
  // Get scheduled follow-up emails
  .get(
    "/stats/scheduled-followups",
    async ({ query }) => {
      try {
        // Use Korea timezone (UTC+9) - more reliable calculation
        const now = new Date()
        const koreaOffset = 9 * 60 // 9 hours in minutes
        const koreaTime = new Date(now.getTime() + koreaOffset * 60 * 1000)

        // Get start of today in Korea timezone
        const today = new Date(koreaTime)
        today.setHours(0, 0, 0, 0)

        // Get start of tomorrow in Korea timezone
        const tomorrow = new Date(today)
        tomorrow.setDate(tomorrow.getDate() + 1)

        // Convert back to UTC for database queries
        const todayUTC = new Date(today.getTime() - koreaOffset * 60 * 1000)

        // Get scheduled follow-ups grouped by delay days (all future scheduled)
        const scheduledFollowups = await db
          .select({
            delayDays: sequenceSteps.delayDays,
            count: sql<number>`COUNT(*)::int`,
            sequenceName: sequences.name,
            stepSubject: sequenceSteps.emailSubject,
            scheduledDate: sql<string>`DATE(${sequenceStepExecutions.scheduledAt})`,
          })
          .from(sequenceStepExecutions)
          .innerJoin(
            sequenceEnrollments,
            eq(sequenceStepExecutions.enrollmentId, sequenceEnrollments.id),
          )
          .innerJoin(sequenceSteps, eq(sequenceStepExecutions.stepId, sequenceSteps.id))
          .innerJoin(sequences, eq(sequenceSteps.sequenceId, sequences.id))
          .where(
            and(
              eq(sequenceStepExecutions.status, "pending"),
              sql`${sequenceStepExecutions.scheduledAt} >= ${todayUTC}`, // Today or future
              query.workspaceId ? eq(sequences.workspaceId, query.workspaceId) : undefined,
            ),
          )
          .groupBy(
            sequenceSteps.delayDays,
            sequences.name,
            sequenceSteps.emailSubject,
            sql`DATE(${sequenceStepExecutions.scheduledAt})`,
          )
          .orderBy(
            asc(sequenceSteps.delayDays),
            asc(sql`DATE(${sequenceStepExecutions.scheduledAt})`),
          )

        // Group by delay days and scheduled date for easier display
        const groupedFollowups = scheduledFollowups.reduce(
          (acc, item) => {
            const key = `${item.delayDays}일 후 팔로우업 (${item.scheduledDate})`
            if (!acc[key]) {
              acc[key] = {
                delayDays: item.delayDays,
                scheduledDate: item.scheduledDate,
                totalCount: 0,
                sequences: [],
              }
            }
            acc[key].totalCount += item.count
            acc[key].sequences.push({
              sequenceName: item.sequenceName,
              subject: item.stepSubject,
              count: item.count,
            })
            return acc
          },
          {} as Record<
            string,
            {
              delayDays: number
              scheduledDate: string
              totalCount: number
              sequences: Array<{
                sequenceName: string
                subject: string
                count: number
              }>
            }
          >,
        )

        // Calculate total scheduled (all future)
        const totalScheduled = scheduledFollowups.reduce((sum, item) => sum + item.count, 0)

        return {
          success: true,
          code: "S200",
          message: "정상 처리되었습니다.",
          data: {
            followups: Object.values(groupedFollowups),
            totalScheduled,
            date: koreaTime.toISOString().split("T")[0], // YYYY-MM-DD format in Korea timezone
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: query.workspaceId,
          },
          "Failed to get scheduled follow-up emails",
        )
        return errorResponse(
          "예약된 팔로우업 이메일 조회에 실패했습니다.",
          ResponseCode.INTERNAL_ERROR,
        )
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  // Get buyer response rate
  .get(
    "/stats/buyer-response-rate",
    async ({ query }) => {
      try {
        const conditions = [eq(emails.direction, "outbound")]

        // Filter by workspace if provided
        if (query.workspaceId) {
          conditions.push(eq(emails.workspaceId, query.workspaceId))
        }

        const whereClause = and(...conditions)

        // Get total sent emails count (all time)
        const totalSentResult = await db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(emails)
          .where(whereClause)

        const totalSent = totalSentResult[0]?.count ?? 0

        // Get replied emails count from email_replies table (all time)
        const repliedCountResult = await db
          .select({
            count: sql<number>`COUNT(DISTINCT ${emailReplies.originalEmailId})::int`,
          })
          .from(emailReplies)
          .innerJoin(emails, eq(emailReplies.originalEmailId, emails.id))
          .where(
            and(
              eq(emails.direction, "outbound"),
              query.workspaceId ? eq(emails.workspaceId, query.workspaceId) : undefined,
            ),
          )

        const repliedCount = repliedCountResult[0]?.count ?? 0

        // Calculate response rate
        const responseRate = totalSent > 0 ? (repliedCount / totalSent) * 100 : 0

        // Debug logging
        logger.info(
          {
            workspaceId: query.workspaceId,
            totalSent,
            repliedCount,
            responseRate,
          },
          "Buyer response rate calculation",
        )

        return {
          success: true,
          code: "S200",
          message: "정상 처리되었습니다.",
          data: {
            responseRate: Math.round(responseRate * 10) / 10, // Round to 1 decimal place
            totalSent,
            repliedCount,
          },
          timestamp: new Date().toISOString(),
        }
      } catch (error) {
        logger.error(
          {
            error,
            workspaceId: query.workspaceId,
          },
          "Failed to get buyer response rate",
        )
        return errorResponse("바이어 응답률 조회에 실패했습니다.", ResponseCode.INTERNAL_ERROR)
      }
    },
    {
      query: t.Object({
        workspaceId: t.Optional(t.String({ format: "uuid" })),
      }),
    },
  )
  // Send email via SendGrid (using user_email_accounts)
  .post(
    "/send",
    async ({ body, set }) => {
      try {
        logger.info(
          {
            workspaceId: body.workspaceId,
            userId: body.userId,
          },
          "Looking for email account",
        )

        // Find active email account by workspaceId only (workspace-shared account)
        const [emailAccount] = await db
          .select({
            id: userEmailAccounts.id,
            emailAddress: userEmailAccounts.emailAddress,
            displayName: userEmailAccounts.displayName,
            apiKey: userEmailAccounts.apiKey,
            status: userEmailAccounts.status,
            isVerified: userEmailAccounts.isVerified,
            workspaceId: userEmailAccounts.workspaceId,
          })
          .from(userEmailAccounts)
          .where(
            and(
              eq(userEmailAccounts.workspaceId, body.workspaceId),
              eq(userEmailAccounts.status, "active"),
            ),
          )
          .limit(1)

        if (!emailAccount) {
          logger.error(
            {
              workspaceId: body.workspaceId,
            },
            "Active email account not found",
          )
          set.status = 404
          return errorResponse(
            "해당 워크스페이스에 활성화된 이메일 계정을 찾을 수 없습니다.",
            ResponseCode.NOT_FOUND,
          )
        }

        logger.info(
          {
            emailAccountId: emailAccount.id,
            emailAddress: emailAccount.emailAddress,
            status: emailAccount.status,
            isVerified: emailAccount.isVerified,
          },
          "Email account found",
        )

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

        // Process attachments if files are provided
        let attachments: SendGridAttachment[] | undefined
        let attachmentMetadata: Array<{
          filename: string
          type: string
          size: number
        }> | null = null

        if (body.files && body.files.length > 0) {
          const files = Array.isArray(body.files) ? body.files : [body.files]

          // Validate file size (SendGrid limit: 30MB total)
          if (!validateFileSize(files, 30 * 1024 * 1024)) {
            const totalSize = getTotalFileSize(files)
            set.status = 400
            return errorResponse(
              `첨부 파일 총 크기가 30MB를 초과합니다. (현재: ${Math.round(
                totalSize / 1024 / 1024,
              )}MB)`,
              ResponseCode.VALIDATION_ERROR,
            )
          }

          // Convert files to SendGrid attachment format
          try {
            attachments = await convertFilesToAttachments(files)

            // Save metadata for database
            attachmentMetadata = files.map((file) => ({
              filename: file.name,
              type: file.type || "application/octet-stream",
              size: file.size,
            }))

            logger.info(
              {
                fileCount: files.length,
                totalSize: getTotalFileSize(files),
              },
              "Files converted to attachments",
            )
          } catch (error) {
            logger.error({ err: error }, "Failed to process attachments")
            set.status = 500
            return errorResponse(
              "첨부 파일 처리 중 오류가 발생했습니다.",
              ResponseCode.INTERNAL_ERROR,
            )
          }
        }

        logger.info(
          {
            from: `${fromName} <${fromEmail}>`,
            to: body.toEmail,
            subject: body.subject,
            workspaceId: body.workspaceId,
            userId: body.userId,
            hasAttachments: !!attachments,
            attachmentCount: attachments?.length || 0,
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
                attachments: attachmentMetadata || null,
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
        // FormData로 전송 시 타입 변환 처리
        const references = body.references
          ? typeof body.references === "string"
            ? [body.references] // string을 array로 변환
            : body.references
          : undefined

        const includeSignature =
          body.includeSignature !== undefined
            ? typeof body.includeSignature === "string"
              ? body.includeSignature === "true" // string "true"를 boolean으로 변환
              : body.includeSignature
            : undefined

        logger.info(
          {
            fromEmail,
            toEmail: body.toEmail,
            subject: body.subject,
            hasApiKey: !!apiKey,
            apiKeyLength: apiKey?.length,
          },
          "Attempting to send email via SendGrid",
        )

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
          references: references,
          attachments: attachments,
          includeSignature: includeSignature,
          userId: body.userId,
          workspaceId: body.workspaceId,
          apiKey: apiKey,
        })

        if (!sendResult.success) {
          logger.error(
            {
              error: sendResult.error,
              fromEmail,
              toEmail: body.toEmail,
            },
            "Email send failed",
          )
          set.status = 500
          return errorResponse(
            sendResult.error || "이메일 발송에 실패했습니다.",
            ResponseCode.INTERNAL_ERROR,
          )
        }

        logger.info(
          {
            messageId: sendResult.messageId,
            sendgridMessageId: sendResult.sendgridMessageId,
          },
          "Email sent successfully via SendGrid",
        )

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
        logger.info(
          {
            threadId,
            inReplyTo: body.inReplyTo,
          },
          "Saving email to database",
        )

        try {
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
              attachments: attachmentMetadata || null,
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
            logger.error("Failed to save email: no email returned")
            set.status = 500
            return errorResponse("이메일 저장에 실패했습니다", ResponseCode.INTERNAL_ERROR)
          }

          logger.info(
            {
              emailId: savedEmail.id,
              messageId: sendResult.messageId,
            },
            "Email saved successfully",
          )

          // Update lead status to 'contacted' if leadId is provided
          if (body.leadId) {
            try {
              await leadService.updateLead(body.leadId, {
                leadStatus: "contacted",
                lastContactedAt: new Date(),
              })
              logger.info(
                {
                  leadId: body.leadId,
                  emailId: savedEmail.id,
                },
                "Lead status updated to contacted",
              )
            } catch (leadUpdateError) {
              logger.error(
                {
                  leadId: body.leadId,
                  error: leadUpdateError,
                },
                "Failed to update lead status",
              )
            }
          }

          return {
            success: true,
            email: savedEmail,
            message: "이메일이 발송되었습니다.",
          }
        } catch (dbError: unknown) {
          logger.error(
            {
              err: dbError,
              messageId: sendResult.messageId,
            },
            "Failed to save email to database",
          )
          set.status = 500
          return errorResponse(
            "이메일은 발송되었으나 저장에 실패했습니다.",
            ResponseCode.INTERNAL_ERROR,
          )
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
      const intentFilter = query.intent
      const sentimentFilter = query.sentiment
      const categoryFilter = query.category
      const priorityFilter = query.priority
      const dateFrom = query.dateFrom
      const dateTo = query.dateTo

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
          intentFilter,
          sentimentFilter,
          categoryFilter,
          priorityFilter,
        },
      })

      // Step 1: Find threadIds that have at least one inbound message (replies)
      const inboundConditions = [eq(emails.direction, "inbound")]

      if (workspaceId !== "all") {
        inboundConditions.push(eq(emails.workspaceId, workspaceId))
      }

      // Add important and unread filters
      if (query.isImportant === "true") {
        inboundConditions.push(eq(emails.isImportant, true))
      }
      if (query.isUnread === "true") {
        inboundConditions.push(eq(emails.isRead, false))
      }

      // Build the query for finding replied threads
      // Handle filters by building the appropriate query
      type RepliedThreadId =
        | { threadId: string | null }
        | {
            threadId: string | null
            matchedEmailId: string
            matchedCreatedAt: Date
          }
      let repliedThreadIds: RepliedThreadId[]
      // Important and Unread filters don't need emailReplies join
      // as they are fields in the emails table itself
      const needsEmailRepliesJoin =
        (intentFilter && intentFilter !== "all") ||
        sentimentFilter ||
        categoryFilter ||
        priorityFilter

      if (needsEmailRepliesJoin) {
        // Add intent filter conditions
        if (intentFilter && intentFilter !== "all") {
          if (intentFilter === "unclassified") {
            // Filter for threads with unclassified replies (intent IS NULL)
            inboundConditions.push(sql`${emailReplies.intent} IS NULL`)
          } else {
            // Filter for specific intent
            inboundConditions.push(eq(emailReplies.intent, intentFilter))
          }
        }

        if (sentimentFilter) {
          const sentiments = sentimentFilter.split(",").filter(Boolean)
          logger.info({
            msg: "🔍 [SENTIMENT-FILTER] Applying sentiment filter",
            sentimentFilter,
            sentiments,
          })
          if (sentiments.length > 0) {
            if (sentiments.includes("unclassified")) {
              const otherSentiments = sentiments.filter(
                (s: string) => s !== "unclassified",
              ) as Array<"positive" | "neutral" | "negative" | "interested" | "not_interested">
              if (otherSentiments.length > 0) {
                const condition = or(
                  inArray(emailReplies.sentiment, otherSentiments),
                  isNull(emailReplies.sentiment),
                )
                if (condition) {
                  inboundConditions.push(condition)
                }
              } else {
                inboundConditions.push(isNull(emailReplies.sentiment))
              }
            } else {
              inboundConditions.push(
                inArray(
                  emailReplies.sentiment,
                  sentiments as Array<
                    "positive" | "neutral" | "negative" | "interested" | "not_interested"
                  >,
                ),
              )
            }
          }
        }

        // Add category filter (comma-separated values)
        // Note: category maps to intent in the database
        if (categoryFilter) {
          const categories = categoryFilter.split(",").filter(Boolean)
          if (categories.length > 0) {
            // Map frontend category names to backend intent values
            const categoryMap: Record<string, string> = {
              meeting_request: "meeting_request",
              question: "question",
              auto: "out_of_office",
              other: "neutral",
            }
            const mappedCategories = categories.map((c: string) => categoryMap[c] || c)
            inboundConditions.push(inArray(emailReplies.intent, mappedCategories))
          }
        }

        // Add priority filter (comma-separated values)
        // Note: Priority is based on leadScore which is in the leads table, not email_replies
        // For now, we'll skip this filter as it requires joining with leads table
        // TODO: Add proper join with leads table to filter by leadScore
        if (priorityFilter) {
          logger.info({
            msg: "⚠️ Priority filter requested but not yet implemented (requires leads table join)",
            priorityFilter,
          })
          // Priority filtering will be implemented in a future update
        }

        // Build query with join
        const matchedEmailsSubquery = db
          .select({
            threadId: emails.threadId,
            emailId: emails.id,
            createdAt: emails.createdAt,
            rowNum:
              sql<number>`ROW_NUMBER() OVER (PARTITION BY ${emails.threadId} ORDER BY ${emails.createdAt} DESC)`.as(
                "row_num",
              ),
          })
          .from(emails)
          .innerJoin(emailReplies, eq(emailReplies.replyEmailId, emails.id))
          .where(and(...inboundConditions))
          .as("matched_emails")

        repliedThreadIds = await db
          .select({
            threadId: matchedEmailsSubquery.threadId,
            matchedEmailId: matchedEmailsSubquery.emailId,
            matchedCreatedAt: matchedEmailsSubquery.createdAt,
          })
          .from(matchedEmailsSubquery)
          .where(eq(matchedEmailsSubquery.rowNum, 1))
      } else {
        // Build query without join (for Important/Unread filters)
        // Important: Must only include threads that have replies (exist in email_replies table)
        // Use a subquery to get threads with replies, then filter by important/unread
        const existsQuery =
          workspaceId !== "all"
            ? sql`EXISTS (
                SELECT 1 FROM email_replies er
                INNER JOIN emails e ON er.original_email_id = e.id
                WHERE e.thread_id = ${emails.threadId}
                AND er.workspace_id = ${workspaceId}
              )`
            : sql`EXISTS (
                SELECT 1 FROM email_replies er
                INNER JOIN emails e ON er.original_email_id = e.id
                WHERE e.thread_id = ${emails.threadId}
              )`

        repliedThreadIds = await db
          .selectDistinct({ threadId: emails.threadId })
          .from(emails)
          .where(and(...inboundConditions, existsQuery))
      }

      const threadIdsList = repliedThreadIds
        .map((t) => t.threadId)
        .filter((id): id is string => !!id)

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Found threads with replies",
        threadIdsCount: threadIdsList.length,
        threadIds: threadIdsList.slice(0, 10), // Log first 10 for debugging
        intentFilter: intentFilter || "none",
        usedIntentJoin: !!(intentFilter && intentFilter !== "all"),
        queryDetails: {
          hasIntentFilter: !!intentFilter && intentFilter !== "all",
          intentValue: intentFilter,
          joinedEmailReplies: !!(intentFilter && intentFilter !== "all"),
          searchingUnclassified: intentFilter === "unclassified",
        },
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
      // Date range filtering
      if (dateFrom) {
        conditions.push(sql`${emails.createdAt} >= ${new Date(dateFrom)}`)
      }
      if (dateTo) {
        // Add one day to include the entire end date
        const endDate = new Date(dateTo)
        endDate.setDate(endDate.getDate() + 1)
        conditions.push(sql`${emails.createdAt} < ${endDate}`)
      }
      if (searchFilter) {
        // Enhanced full-text search
        // Supports Korean and English text search
        const searchCondition = or(
          // Email metadata search
          ilike(emails.subject, `%${searchFilter}%`),
          ilike(emails.fromEmail, `%${searchFilter}%`),
          ilike(emails.toEmail, `%${searchFilter}%`),
          ilike(emails.leadName, `%${searchFilter}%`),
          ilike(emails.leadEmail, `%${searchFilter}%`),
          // Body content search (full-text)
          ilike(emails.bodyText, `%${searchFilter}%`),
          ilike(emails.bodyHtml, `%${searchFilter}%`),
          // Search in related leads table
          sql`EXISTS (
            SELECT 1 FROM ${leads}
            WHERE ${leads.id} = ${emails.leadId}
            AND (
              ${leads.companyName} ILIKE ${`%${searchFilter}%`}
              OR ${leads.contactName} ILIKE ${`%${searchFilter}%`}
            )
          )`,
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
        hasIntentFilter: !!intentFilter && intentFilter !== "all",
      })

      // Step 3: Get threads with their representative email
      // When filtering by intent/sentiment, show the matched email from Step 1
      // Otherwise, show the first email of the thread
      const threadsQuery = db
        .select({
          threadId: emails.threadId,
          firstCreatedAt: sql<Date>`MIN(${emails.createdAt})`.as("first_created_at"),
          latestCreatedAt: sql<Date>`MAX(${emails.createdAt})`.as("latest_created_at"),
        })
        .from(emails)
        .where(whereClause)
        .groupBy(emails.threadId)
        .orderBy(desc(sql`MAX(${emails.createdAt})`))
        .limit(limit)
        .offset(offset)
        .as("threads")

      // Get full email details for first email in each thread + reply intent/sentiment
      // Note: There's only ONE email_replies record per thread (gets updated with latest reply)
      const threadEmails = await db
        .select({
          id: emails.id,
          threadId: emails.threadId,
          workspaceId: emails.workspaceId,
          direction: emails.direction,
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
          sequenceName: sequences.name,
          leadId: emails.leadId,
          sequenceId: emails.sequenceId,
          // Lead fields
          companyName: leads.companyName,
          foundCompanyName: leads.foundCompanyName,
          contactName: leads.contactName,
          websiteUrl: leads.websiteUrl,
          finalUrl: leads.finalUrl,
          businessType: leads.businessType,
          address: leads.address,
          country: leads.country,
          city: leads.city,
          state: leads.state,
          employeeCount: leads.employeeCount,
          leadStatus: leads.leadStatus,
          leadScore: leads.leadScore,
          leadSource: leads.leadSource,
          // Sequence enrollment fields
          enrollmentId: sequenceEnrollments.id,
          enrollmentStatus: sequenceEnrollments.status,
          enrollmentCurrentStepOrder: sequenceEnrollments.currentStepOrder,
          enrollmentEnrolledAt: sequenceEnrollments.enrolledAt,
          enrollmentFirstEmailSentAt: sequenceEnrollments.firstEmailSentAt,
          enrollmentLastEmailSentAt: sequenceEnrollments.lastEmailSentAt,
          enrollmentCompletedAt: sequenceEnrollments.completedAt,
          enrollmentStoppedAt: sequenceEnrollments.stoppedAt,
          enrollmentNextStepScheduledAt: sequenceEnrollments.nextStepScheduledAt,
          // Reply classification (from email_replies) - always shows latest reply's classification
          replyIntent: emailReplies.intent,
          replySentiment: emailReplies.sentiment,
          // Latest activity timestamp from thread
          latestActivityAt: threadsQuery.latestCreatedAt,
          // UI state fields (for inbound emails)
          isImportant: emails.isImportant,
          isRead: emails.isRead,
        })
        .from(emails)
        .innerJoin(threadsQuery, eq(emails.threadId, threadsQuery.threadId))
        .leftJoin(leads, eq(emails.leadId, leads.id))
        .leftJoin(sequences, eq(emails.sequenceId, sequences.id))
        .leftJoin(
          sequenceEnrollments,
          and(
            eq(sequenceEnrollments.sequenceId, emails.sequenceId),
            eq(sequenceEnrollments.leadId, emails.leadId),
          ),
        )
        // Join email_replies - there's only ONE record per thread
        .leftJoin(
          emailReplies,
          needsEmailRepliesJoin
            ? eq(emailReplies.replyEmailId, emails.id) // Join with inbound email when filtering
            : eq(emailReplies.originalEmailId, emails.id), // Join with outbound email otherwise
        )
        .where(
          needsEmailRepliesJoin
            ? // When filtering, show the matched email from Step 1
              inArray(
                emails.id,
                repliedThreadIds
                  .filter(
                    (
                      t,
                    ): t is {
                      threadId: string | null
                      matchedEmailId: string
                      matchedCreatedAt: Date
                    } => "matchedEmailId" in t,
                  )
                  .map((t) => t.matchedEmailId),
              )
            : // Otherwise, show the first email of each thread
              eq(emails.createdAt, threadsQuery.firstCreatedAt),
        )

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Thread emails fetched",
        threadEmailsCount: threadEmails.length,
        threadIds: threadEmails.map((e) => e.threadId),
        sentimentFilter: sentimentFilter || "none",
        intentFilter: intentFilter || "none",
        emailDetails: threadEmails.map((e) => ({
          threadId: e.threadId,
          direction: e.direction,
          subject: e.subject,
          replyIntent: e.replyIntent,
          replySentiment: e.replySentiment,
        })),
        sequenceInfo: threadEmails.map((e) => ({
          threadId: e.threadId,
          sequenceId: e.sequenceId,
          sequenceName: e.sequenceName,
        })),
        leadInfo: threadEmails.map((e) => ({
          threadId: e.threadId,
          leadId: e.leadId,
          leadName: e.leadName,
          companyName: e.companyName,
          contactName: e.contactName,
        })),
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
        counts: threadCounts.map((tc) => ({
          threadId: tc.threadId,
          count: tc.messageCount,
        })),
      })

      // Get thread IDs for additional queries
      const threadIdsForLatest = threadEmails
        .map((e) => e.threadId)
        .filter((id): id is string => !!id)

      // Get thread-level important/unread states (based on inbound emails)
      const threadStates = await db
        .select({
          threadId: emails.threadId,
          isImportant:
            sql<boolean>`BOOL_OR(${emails.isImportant} AND ${emails.direction} = 'inbound')`.as(
              "is_important",
            ),
          isUnread:
            sql<boolean>`BOOL_OR(NOT ${emails.isRead} AND ${emails.direction} = 'inbound')`.as(
              "is_unread",
            ),
        })
        .from(emails)
        .where(inArray(emails.threadId, threadIdsForLatest))
        .groupBy(emails.threadId)

      const threadStatesMap = new Map<string, { isImportant: boolean; isUnread: boolean }>()
      for (const state of threadStates) {
        if (state.threadId) {
          threadStatesMap.set(state.threadId, {
            isImportant: state.isImportant || false,
            isUnread: state.isUnread || false,
          })
        }
      }

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Thread states fetched",
        threadStatesCount: threadStatesMap.size,
      })

      // Get latest message body for each thread (for preview)
      // Fetch all messages in these threads, ordered by date desc

      let allThreadMessages: Array<{
        threadId: string | null
        bodyText: string | null
        bodyHtml: string | null
        direction: "outbound" | "inbound"
        fromEmail: string
        createdAt: Date
      }> = []

      if (threadIdsForLatest.length > 0) {
        allThreadMessages = await db
          .select({
            threadId: emails.threadId,
            bodyText: emails.bodyText,
            bodyHtml: emails.bodyHtml,
            direction: emails.direction,
            fromEmail: emails.fromEmail,
            createdAt: emails.createdAt,
          })
          .from(emails)
          .where(inArray(emails.threadId, threadIdsForLatest))
          .orderBy(desc(emails.createdAt))
      }

      // Group by threadId and take the first (latest) message per thread
      const latestMessagesMap = new Map<string, (typeof allThreadMessages)[0]>()
      for (const msg of allThreadMessages) {
        if (msg.threadId && !latestMessagesMap.has(msg.threadId)) {
          latestMessagesMap.set(msg.threadId, msg)
        }
      }

      logger.info({
        msg: "✓ [REPLIED-EMAILS] Latest messages fetched",
        latestMessagesCount: latestMessagesMap.size,
      })

      // Helper function to clean MIME headers from body content and fix encoding
      const cleanBodyContent = (body: string | null): string | null => {
        if (!body) return body

        let cleaned = body

        // Check if body contains MIME headers (indicates unparsed content)
        if (cleaned.includes("Content-Type:") || cleaned.includes("Content-Transfer-Encoding:")) {
          const parsed = parseEmailBody(cleaned)
          cleaned = parsed.html || parsed.text || cleaned
        }

        // Fix UTF-8 encoding issues (mojibake)
        cleaned = fixUtf8Encoding(cleaned)

        return cleaned
      }

      // Combine data
      const threadsWithCounts = threadEmails.map((email) => {
        const countData = threadCounts.find((tc) => tc.threadId === email.threadId)
        const latestMsg = email.threadId ? latestMessagesMap.get(email.threadId) : undefined
        const threadState = email.threadId ? threadStatesMap.get(email.threadId) : undefined

        // Clean MIME headers from latest message if present
        const latestBodyText = cleanBodyContent(latestMsg?.bodyText || email.bodyText)
        const latestBodyHtml = cleanBodyContent(latestMsg?.bodyHtml || email.bodyHtml)

        return {
          ...email,
          messageCount: Number(countData?.messageCount || 1),
          // Add latest message preview (for showing the actual reply content)
          latestMessageBody: latestBodyText,
          latestMessageBodyHtml: latestBodyHtml,
          latestMessageDirection: latestMsg?.direction || email.direction,
          latestMessageFrom: latestMsg?.fromEmail || email.fromEmail,
          // Override with thread-level states (based on inbound emails)
          isImportant: threadState?.isImportant || false,
          isRead: !(threadState?.isUnread || false), // isRead is inverse of isUnread
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
        intent: t.Optional(t.String()), // Intent filter (e.g., "meeting_request", "positive_interest", "unclassified")
        isImportant: t.Optional(t.String()), // Important filter ("true" or "false")
        isUnread: t.Optional(t.String()), // Unread filter ("true" or "false")
        sentiment: t.Optional(t.String()), // Sentiment filter (comma-separated: "positive,negative,neutral,question")
        category: t.Optional(t.String()), // Category filter (comma-separated: "meeting_request,question,auto,other")
        priority: t.Optional(t.String()), // Priority filter (comma-separated: "high,medium,low")
        dateFrom: t.Optional(t.String()), // Date range start (ISO 8601 format)
        dateTo: t.Optional(t.String()), // Date range end (ISO 8601 format)
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

      // Step 1: Find all messageIds in this thread (including the threadId itself)
      const initialConditions = [eq(emails.threadId, threadId)]
      if (workspaceId && workspaceId !== "all") {
        initialConditions.push(eq(emails.workspaceId, workspaceId))
      }

      const threadMessageIds = await db
        .select({ messageId: emails.messageId })
        .from(emails)
        .where(and(...initialConditions))

      const messageIdSet = new Set(threadMessageIds.map((e) => e.messageId).filter(Boolean))
      messageIdSet.add(threadId) // Include threadId as it might be a messageId

      logger.info({
        msg: "✓ Found messageIds in thread",
        threadId,
        messageIdCount: messageIdSet.size,
      })

      // Step 2: Find ALL emails that reference these messageIds OR have this threadId
      // This includes emails where:
      // - threadId matches
      // - messageId is in our set (the email itself is referenced)
      // - inReplyTo is in our set (replying to an email in thread)
      const messageIdArray = Array.from(messageIdSet).filter(Boolean) as string[]

      const orConditions = [eq(emails.threadId, threadId)]

      if (messageIdArray.length > 0) {
        orConditions.push(inArray(emails.messageId, messageIdArray))
        orConditions.push(inArray(emails.inReplyTo, messageIdArray))
      }

      const conditions = [or(...orConditions)]

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
          clickedAt: emails.clickedAt,
          createdAt: emails.createdAt,
          updatedAt: emails.updatedAt,
          threadId: emails.threadId,
          inReplyTo: emails.inReplyTo,
          messageId: emails.messageId,
          leadName: emails.leadName,
          leadEmail: emails.leadEmail,
          sequenceName: sequences.name,
          leadId: emails.leadId,
          sequenceId: emails.sequenceId,
          stepId: emails.stepId,
          workspaceId: emails.workspaceId,
          openCount: emails.openCount,
          clickCount: emails.clickCount,
          stepOrder: sequenceSteps.stepOrder,
          // Reply classification from email_replies
          emailReplyId: emailReplies.id,
          replyIntent: emailReplies.intent,
          replySentiment: emailReplies.sentiment,
        })
        .from(emails)
        .leftJoin(sequences, eq(emails.sequenceId, sequences.id))
        .leftJoin(sequenceSteps, eq(emails.stepId, sequenceSteps.id))
        .leftJoin(emailReplies, eq(emailReplies.replyEmailId, emails.id))
        .where(and(...conditions))
        .orderBy(asc(emails.createdAt))

      logger.info({
        msg: "✓ Thread emails fetched",
        threadId,
        emailCount: threadEmails.length,
      })

      // Clean MIME headers from body content and fix encoding if present
      const cleanedEmails = threadEmails.map((email) => {
        let cleanedBodyText = email.bodyText
        let cleanedBodyHtml = email.bodyHtml

        // Check and parse bodyText if it contains MIME headers
        if (
          cleanedBodyText &&
          (cleanedBodyText.includes("Content-Type:") ||
            cleanedBodyText.includes("Content-Transfer-Encoding:"))
        ) {
          const parsed = parseEmailBody(cleanedBodyText)
          cleanedBodyText = parsed.text || parsed.html || cleanedBodyText
        }

        // Check and parse bodyHtml if it contains MIME headers
        if (
          cleanedBodyHtml &&
          (cleanedBodyHtml.includes("Content-Type:") ||
            cleanedBodyHtml.includes("Content-Transfer-Encoding:"))
        ) {
          const parsed = parseEmailBody(cleanedBodyHtml)
          cleanedBodyHtml = parsed.html || parsed.text || cleanedBodyHtml
        }

        // Fix UTF-8 encoding issues (mojibake) in both text and HTML
        if (cleanedBodyText) {
          cleanedBodyText = fixUtf8Encoding(cleanedBodyText)
        }
        if (cleanedBodyHtml) {
          cleanedBodyHtml = fixUtf8Encoding(cleanedBodyHtml)
        }

        return {
          ...email,
          bodyText: cleanedBodyText,
          bodyHtml: cleanedBodyHtml,
        }
      })

      return { data: cleanedEmails }
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
